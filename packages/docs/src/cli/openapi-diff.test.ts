import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { compareOpenApiDocuments, parseOpenApiDiffArgs, runOpenApiDiff } from "./openapi-diff.js";

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

function contract(version: string, paths: Record<string, unknown>) {
  return {
    openapi: "3.1.0",
    info: { title: "Widget API", version },
    paths,
  };
}

describe("parseOpenApiDiffArgs", () => {
  it("accepts positional sources and CI flags", () => {
    expect(parseOpenApiDiffArgs(["old.yaml", "new.json", "--json", "--fail-on", "any"])).toEqual({
      baseline: "old.yaml",
      current: "new.json",
      baseUrl: undefined,
      failOn: "any",
      json: true,
      help: false,
    });
  });

  it("accepts named source aliases", () => {
    expect(
      parseOpenApiDiffArgs([
        "--baseline=old.yaml",
        "--current",
        "https://api.example.com/openapi.json",
        "--fail-on=never",
      ]),
    ).toMatchObject({
      baseline: "old.yaml",
      current: "https://api.example.com/openapi.json",
      failOn: "never",
    });
  });

  it("fills an omitted named source from a positional argument", () => {
    expect(parseOpenApiDiffArgs(["--base", "old.yaml", "new.yaml"])).toMatchObject({
      baseline: "old.yaml",
      current: "new.yaml",
    });
  });

  it("rejects incomplete and invalid invocations", () => {
    expect(() => parseOpenApiDiffArgs(["old.yaml"])).toThrow("baseline and current");
    expect(() => parseOpenApiDiffArgs(["old.yaml", "new.yaml", "--fail-on", "warnings"])).toThrow(
      'must be "breaking", "any", or "never"',
    );
  });
});

describe("compareOpenApiDocuments", () => {
  it("classifies high-signal operation, parameter, response, security, and schema changes", () => {
    const baseline = contract("1.0.0", {
      "/widgets/{id}": {
        get: {
          operationId: "getWidget",
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            {
              name: "locale",
              in: "query",
              schema: { type: "string", enum: ["en", "fr"] },
            },
          ],
          responses: {
            "200": {
              description: "Widget",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["id", "name"],
                    properties: { id: { type: "string" }, name: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
      "/legacy": {
        delete: {
          operationId: "deleteLegacy",
          responses: { "204": { description: "Deleted" } },
        },
      },
    });
    const current = contract("2.0.0", {
      "/widgets/{id}": {
        get: {
          operationId: "readWidget",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string" } },
            {
              name: "locale",
              in: "query",
              required: true,
              schema: { type: "string", enum: ["en"] },
            },
            { name: "trace", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Widget",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    required: ["id"],
                    properties: { id: { type: "string" } },
                  },
                },
              },
            },
            "404": { description: "Missing" },
          },
        },
      },
      "/health": {
        get: {
          operationId: "health",
          responses: { "200": { description: "Healthy" } },
        },
      },
    });

    const report = compareOpenApiDocuments(baseline, current);

    expect(report.breaking).toBe(true);
    expect(report.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "operation-removed", selector: "DELETE /legacy" }),
        expect.objectContaining({ kind: "operation-id-changed", selector: "GET /widgets/{id}" }),
        expect.objectContaining({ kind: "parameter-required" }),
        expect.objectContaining({ kind: "parameter-schema-changed", severity: "breaking" }),
        expect.objectContaining({ kind: "response-schema-changed", severity: "breaking" }),
        expect.objectContaining({ kind: "security-changed", severity: "breaking" }),
        expect.objectContaining({ kind: "optional-parameter-added", severity: "non-breaking" }),
        expect.objectContaining({ kind: "response-added", severity: "non-breaking" }),
        expect.objectContaining({ kind: "operation-added", selector: "GET /health" }),
      ]),
    );
  });

  it("dereferences component schemas and ignores annotation-only edits", () => {
    const baseline = contract("1", {
      "/widgets": {
        get: {
          responses: {
            "200": {
              description: "Before",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Widget" } } },
            },
          },
        },
      },
    }) as Record<string, unknown>;
    baseline.components = {
      schemas: {
        Widget: {
          type: "object",
          description: "Old prose",
          required: ["id"],
          properties: { id: { type: "string", description: "Old ID prose" } },
        },
      },
    };
    const current = structuredClone(baseline);
    (current.info as Record<string, unknown>).version = "2";
    const widget = ((current.components as Record<string, any>).schemas as Record<string, any>)
      .Widget;
    widget.description = "New prose";
    widget.properties.id.description = "New ID prose";

    expect(compareOpenApiDocuments(baseline, current).changes).toEqual([]);
  });

  it("handles newly added and removed schema restrictions in each direction", () => {
    const makeDocument = (requestSchema: unknown, responseSchema: unknown) =>
      contract("1", {
        "/widgets": {
          post: {
            requestBody: {
              content: { "application/json": { schema: requestSchema } },
            },
            responses: {
              "200": {
                description: "OK",
                content: { "application/json": { schema: responseSchema } },
              },
            },
          },
        },
      });

    const report = compareOpenApiDocuments(
      makeDocument({ type: "string" }, { type: "string", minLength: 3 }),
      makeDocument({ type: "string", maxLength: 20 }, { type: "string" }),
    );

    expect(report.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "request-schema-changed", severity: "breaking" }),
        expect.objectContaining({ kind: "response-schema-changed", severity: "breaking" }),
      ]),
    );
  });

  it("treats reordered security alternatives as equal and changed schemes or servers as breaking", () => {
    const baseline = contract("1", {
      "/widgets": {
        get: {
          security: [{ oauth: ["write", "read"] }, { bearer: [] }],
          servers: [{ url: "https://old.example.com" }],
          responses: { "200": { description: "OK" } },
        },
      },
    }) as Record<string, unknown>;
    baseline.components = {
      securitySchemes: {
        oauth: { type: "oauth2", flows: {} },
        bearer: { type: "http", scheme: "bearer" },
      },
    };
    const reordered = structuredClone(baseline);
    const operation = (
      (reordered.paths as Record<string, unknown>)["/widgets"] as Record<string, unknown>
    ).get as Record<string, unknown>;
    operation.security = [{ bearer: [] }, { oauth: ["read", "write"] }];
    expect(compareOpenApiDocuments(baseline, reordered).changes).toEqual([]);

    const changed = structuredClone(reordered);
    const changedOperation = (
      (changed.paths as Record<string, unknown>)["/widgets"] as Record<string, unknown>
    ).get as Record<string, unknown>;
    changedOperation.servers = [];
    ((changed.components as Record<string, unknown>).securitySchemes as Record<string, unknown>)[
      "bearer"
    ] = { type: "apiKey", in: "header", name: "authorization" };

    expect(compareOpenApiDocuments(baseline, changed).changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "security-scheme-changed", severity: "breaking" }),
        expect.objectContaining({ kind: "server-changed", severity: "breaking" }),
      ]),
    );
  });
});

describe("runOpenApiDiff", () => {
  it("loads local JSON and YAML and applies the default breaking exit policy", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "openapi-diff-"));
    tempDirs.push(rootDir);
    mkdirSync(path.join(rootDir, "api"));
    writeFileSync(
      path.join(rootDir, "api", "old.json"),
      JSON.stringify(
        contract("1", {
          "/widgets": {
            get: { responses: { "200": { description: "OK" } } },
          },
        }),
      ),
    );
    writeFileSync(
      path.join(rootDir, "api", "new.yaml"),
      ["openapi: 3.1.0", "info:", "  title: Widget API", "  version: '2'", "paths: {}", ""].join(
        "\n",
      ),
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runOpenApiDiff({
      baseline: "api/old.json",
      current: "api/new.yaml",
      failOn: "breaking",
      json: false,
      help: false,
      rootDir,
    });

    expect(report.breakingCount).toBe(1);
    expect(process.exitCode).toBe(1);
  });

  it("loads remote JSON and YAML sources and redacts their URL credentials", async () => {
    const document = contract("1", {
      "/widgets": {
        get: { responses: { "200": { description: "OK" } } },
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL | RequestInfo) => {
        const url = String(input);
        return url.includes("current.yaml")
          ? new Response(
              [
                "openapi: 3.1.0",
                "info:",
                "  title: Widget API",
                "  version: '1'",
                "paths:",
                "  /widgets:",
                "    get:",
                "      responses:",
                "        '200':",
                "          description: OK",
                "",
              ].join("\n"),
              { headers: { "content-type": "application/yaml" } },
            )
          : new Response(JSON.stringify(document), {
              headers: { "content-type": "application/json" },
            });
      }),
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    const report = await runOpenApiDiff({
      baseline: "https://user:password@specs.example.com/baseline.json?token=secret",
      current: "https://specs.example.com/current.yaml?token=secret",
      failOn: "never",
      json: true,
      help: false,
    });

    expect(report.changes).toEqual([]);
    expect(report.baseline.source).toBe(
      "https://redacted:redacted@specs.example.com/baseline.json",
    );
    expect(report.current.source).toBe("https://specs.example.com/current.yaml");
    expect(process.exitCode).toBeUndefined();
  });
});
