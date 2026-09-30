import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateOpenApiTypeScriptSdk, parseOpenApiSdkArgs, runOpenApiSdk } from "./openapi-sdk.js";

const tempDirs: string[] = [];

afterEach(() => {
  process.exitCode = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) rmSync(directory, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "farming-openapi-sdk-"));
  tempDirs.push(directory);
  return directory;
}

function contract(extraPaths: Record<string, unknown> = {}) {
  return {
    openapi: "3.1.0",
    info: { title: "Widget API", version: "1.0.0" },
    servers: [{ url: "https://api.example.com/v1" }],
    components: {
      schemas: {
        ApiError: {
          type: "object",
          required: ["message"],
          properties: { message: { type: "string" } },
        },
        Widget: {
          type: "object",
          required: ["id", "name"],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            state: { type: "string", enum: ["active", "archived"] },
          },
          additionalProperties: false,
        },
        WidgetInput: {
          type: "object",
          required: ["name"],
          properties: { name: { type: "string" } },
          additionalProperties: false,
        },
      },
    },
    paths: {
      "/widgets/{id}": {
        get: {
          operationId: "constructor",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            { name: "include", in: "query", schema: { type: "array", items: { type: "string" } } },
            { name: "x-tenant", in: "header", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Widget",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/Widget" } },
              },
            },
          },
        },
      },
      "/widgets": {
        post: {
          operationId: "createWidget",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/WidgetInput" } },
            },
          },
          responses: {
            "201": {
              description: "Created",
              content: {
                "application/json": { schema: { $ref: "#/components/schemas/Widget" } },
              },
            },
          },
        },
      },
      ...extraPaths,
    },
  };
}

describe("parseOpenApiSdkArgs", () => {
  it("accepts positional and named sources with generation flags", () => {
    expect(
      parseOpenApiSdkArgs([
        "openapi.yaml",
        "--out",
        "src/api.ts",
        "--client-name=Widgets",
        "--base-url",
        "https://example.com",
        "--force",
      ]),
    ).toEqual({
      source: "openapi.yaml",
      output: "src/api.ts",
      clientName: "Widgets",
      baseUrl: "https://example.com",
      sourceBaseUrl: undefined,
      check: false,
      dryRun: false,
      force: true,
      help: false,
    });

    expect(
      parseOpenApiSdkArgs(["--source", "openapi.json", "--output=api.ts", "--check"]),
    ).toMatchObject({ source: "openapi.json", output: "api.ts", check: true });
  });

  it("rejects incomplete and conflicting invocations", () => {
    expect(() => parseOpenApiSdkArgs(["openapi.yaml"])).toThrow("--output");
    expect(() => parseOpenApiSdkArgs(["openapi.yaml", "other.yaml", "--output", "api.ts"])).toThrow(
      "exactly one",
    );
    expect(() =>
      parseOpenApiSdkArgs(["openapi.yaml", "--output", "api.ts", "--check", "--dry-run"]),
    ).toThrow("either --check or --dry-run");
  });
});

describe("generateOpenApiTypeScriptSdk", () => {
  it("generates deterministic, compilable component and operation types", () => {
    const code = generateOpenApiTypeScriptSdk(contract(), {
      source: "openapi.yaml\nunsafe",
    });

    expect(code).toContain("// Source: openapi.yaml unsafe");
    expect(code).toContain("export type ApiError2 =");
    expect(code).toContain("export type Widget =");
    expect(code).toContain("export interface ConstructorInput");
    expect(code).toContain("async constructorOperation(input: ConstructorInput)");
    expect(code).toContain('operationPath.replaceAll("{id}"');
    expect(code).toContain("appendQueryParameter(url.searchParams");
    expect(code).toContain('headers.set("x-tenant"');
    expect(code).toContain('headers.set("content-type", "application/json")');
    expect(code).toContain('const DEFAULT_BASE_URL = "https://api.example.com/v1";');
    expect(generateOpenApiTypeScriptSdk(contract())).toBe(generateOpenApiTypeScriptSdk(contract()));

    const result = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        strict: true,
      },
      reportDiagnostics: true,
    });
    expect(result.diagnostics ?? []).toEqual([]);

    const generatedPath = path.join(createTempDir(), "api.ts");
    writeFileSync(generatedPath, code, "utf8");
    const program = ts.createProgram([generatedPath], {
      lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
      module: ts.ModuleKind.ESNext,
      noEmit: true,
      noUnusedLocals: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2022,
    });
    expect(
      ts
        .getPreEmitDiagnostics(program)
        .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")),
    ).toEqual([]);
  });
});

describe("runOpenApiSdk", () => {
  it("writes local JSON contracts and checks generated-file freshness", async () => {
    const rootDir = createTempDir();
    const sourcePath = path.join(rootDir, "openapi.json");
    const outputPath = path.join(rootDir, "generated", "api.ts");
    writeFileSync(sourcePath, JSON.stringify(contract()), "utf8");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const generated = await runOpenApiSdk({
      ...parseOpenApiSdkArgs(["openapi.json", "--output", "generated/api.ts"]),
      rootDir,
    });
    expect(generated).toMatchObject({
      format: "farming-labs-openapi-sdk.v1",
      operationCount: 2,
      schemaCount: 3,
      changed: true,
      wrote: true,
    });
    expect(readFileSync(outputPath, "utf8")).toContain("export class WidgetAPIClient");

    const current = await runOpenApiSdk({
      ...parseOpenApiSdkArgs(["openapi.json", "--output", "generated/api.ts", "--check"]),
      rootDir,
    });
    expect(current.changed).toBe(false);
    expect(process.exitCode).toBeUndefined();

    writeFileSync(
      sourcePath,
      JSON.stringify(
        contract({
          "/health": {
            get: {
              operationId: "health",
              responses: { "204": { description: "Healthy" } },
            },
          },
        }),
      ),
      "utf8",
    );
    const stale = await runOpenApiSdk({
      ...parseOpenApiSdkArgs(["openapi.json", "--output", "generated/api.ts", "--check"]),
      rootDir,
    });
    expect(stale.changed).toBe(true);
    expect(process.exitCode).toBe(1);
  });

  it("loads remote YAML and supports dry runs without writing", async () => {
    const rootDir = createTempDir();
    const fetchMock = vi.fn(
      async () =>
        new Response(`
openapi: 3.1.0
info:
  title: Remote API
  version: 1.0.0
paths:
  /health:
    get:
      operationId: getHealth
      responses:
        "204":
          description: Healthy
`),
    );
    vi.stubGlobal("fetch", fetchMock);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runOpenApiSdk({
      ...parseOpenApiSdkArgs([
        "https://api.example.com/openapi.yaml?secret=value",
        "--output",
        "api.ts",
        "--dry-run",
      ]),
      rootDir,
    });

    expect(report).toMatchObject({
      source: "https://api.example.com/openapi.yaml",
      operationCount: 1,
      changed: true,
      wrote: false,
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("export class RemoteAPIClient"));
    expect(() => readFileSync(path.join(rootDir, "api.ts"), "utf8")).toThrow();
  });

  it("protects non-generated files and paths outside the project", async () => {
    const rootDir = createTempDir();
    writeFileSync(path.join(rootDir, "openapi.json"), JSON.stringify(contract()), "utf8");
    writeFileSync(path.join(rootDir, "api.ts"), "export const userCode = true;\n", "utf8");
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      runOpenApiSdk({
        ...parseOpenApiSdkArgs(["openapi.json", "--output", "api.ts"]),
        rootDir,
      }),
    ).rejects.toThrow("Refusing to replace non-generated file");

    const forced = await runOpenApiSdk({
      ...parseOpenApiSdkArgs(["openapi.json", "--output", "api.ts", "--force"]),
      rootDir,
    });
    expect(forced.wrote).toBe(true);
    expect(readFileSync(path.join(rootDir, "api.ts"), "utf8")).toContain(
      "Generated by @farming-labs/docs",
    );

    await expect(
      runOpenApiSdk({
        ...parseOpenApiSdkArgs(["openapi.json", "--output", "../api.ts"]),
        rootDir,
      }),
    ).rejects.toThrow("inside the project root");
  });

  it.runIf(process.platform !== "win32")(
    "rejects outputs that escape through a symlink",
    async () => {
      const rootDir = createTempDir();
      const externalDir = createTempDir();
      writeFileSync(path.join(rootDir, "openapi.json"), JSON.stringify(contract()), "utf8");
      symlinkSync(externalDir, path.join(rootDir, "generated"), "dir");

      await expect(
        runOpenApiSdk({
          ...parseOpenApiSdkArgs(["openapi.json", "--output", "generated/api.ts"]),
          rootDir,
        }),
      ).rejects.toThrow("escape the project root through a symlink");
    },
  );
});
