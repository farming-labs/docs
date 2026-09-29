import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspectApiReferenceHealth } from "./api-doctor.js";
import { runDoctor } from "./doctor.js";

function writePackageJson(rootDir: string, dependencies: Record<string, string>) {
  writeFileSync(
    path.join(rootDir, "package.json"),
    JSON.stringify({ name: "api-doctor-fixture", private: true, dependencies }),
    "utf8",
  );
}

function writeFile(rootDir: string, relativePath: string, content: string) {
  const filePath = path.join(rootDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content, "utf8");
}

function openApiDocument(operations: Array<{ method: string; path: string; id: string }>) {
  const paths = Object.fromEntries(
    operations.map((operation) => [
      operation.path,
      {
        [operation.method]: {
          operationId: operation.id,
          summary: operation.id,
          responses: { "200": { description: "OK" } },
        },
      },
    ]),
  );
  return JSON.stringify({
    openapi: "3.1.0",
    info: { title: "Widget API", version: "1.0.0" },
    paths,
  });
}

describe("API doctor", () => {
  const originalCwd = process.cwd();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "docs-api-doctor-"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.exitCode = undefined;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("validates versioned local contracts, overlays, identities, and generated surfaces", async () => {
    writePackageJson(tmpDir, { astro: "5.0.0" });
    writeFile(
      tmpDir,
      "docs.config.ts",
      `export default {
  entry: "docs",
  apiReference: {
    path: "reference",
    versions: {
      v1: { specUrl: "./v1.json", label: "Version 1" },
      v2: {
        specUrl: "./v2.json",
        label: "Version 2",
        overlays: ["./v2.overlay.yaml"],
      },
    },
    defaultVersion: "v2",
  },
};`,
    );
    writeFile(
      tmpDir,
      "v1.json",
      openApiDocument([{ method: "get", path: "/widgets", id: "listLegacyWidgets" }]),
    );
    writeFile(
      tmpDir,
      "v2.json",
      openApiDocument([
        { method: "get", path: "/widgets", id: "listWidgets" },
        { method: "post", path: "/widgets/new", id: "createWidget" },
      ]),
    );
    writeFile(
      tmpDir,
      "v2.overlay.yaml",
      `overlay: "1.1.0"
info: { title: Doctor overlay, version: "1" }
actions:
  - target: $['paths']['/widgets']['get']['summary']
    update: List current widgets
`,
    );

    process.chdir(tmpDir);
    const report = await inspectApiReferenceHealth();

    expect(report).toMatchObject({
      mode: "api",
      framework: "astro",
      enabled: true,
      renderer: "scalar",
      defaultVersion: "v2",
      sourceCount: 2,
      operationCount: 3,
    });
    expect(report.sources).toEqual([
      expect.objectContaining({ id: "v1", status: "pass", operationCount: 1, overlays: 0 }),
      expect.objectContaining({ id: "v2", status: "pass", operationCount: 2, overlays: 1 }),
    ]);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "sources", status: "pass" }),
        expect.objectContaining({ id: "operation-identities", status: "pass" }),
        expect.objectContaining({ id: "renderer", status: "pass" }),
        expect.objectContaining({ id: "surface-parity", status: "pass" }),
      ]),
    );
  });

  it.each([
    ["nextjs", { next: "16.0.0" }, "fumadocs"],
    ["tanstack-start", { "@tanstack/react-start": "1.0.0" }, "scalar"],
    ["farmjs", { "@farm.js/core": "1.0.0" }, "scalar"],
    ["sveltekit", { "@sveltejs/kit": "2.0.0" }, "scalar"],
    ["astro", { astro: "5.0.0" }, "scalar"],
    ["nuxt", { nuxt: "4.0.0" }, "scalar"],
  ] as const)(
    "uses a compatible default renderer for %s",
    async (framework, dependencies, renderer) => {
      writePackageJson(tmpDir, dependencies);
      writeFile(
        tmpDir,
        "docs.config.ts",
        `export default { apiReference: { specUrl: "./openapi.json" } };`,
      );
      writeFile(
        tmpDir,
        "openapi.json",
        openApiDocument([{ method: "get", path: "/widgets", id: "listWidgets" }]),
      );

      process.chdir(tmpDir);
      const report = await inspectApiReferenceHealth();

      expect(report.framework).toBe(framework);
      expect(report.renderer).toBe(renderer);
      expect(report.checks.find((check) => check.id === "renderer")?.status).toBe("pass");
    },
  );

  it("reports original validation diagnostics and honors JSON failure policy", async () => {
    writePackageJson(tmpDir, { next: "16.0.0" });
    writeFile(
      tmpDir,
      "docs.config.ts",
      `export default { apiReference: { specUrl: "./openapi.json" } };`,
    );
    writeFile(
      tmpDir,
      "openapi.json",
      JSON.stringify({
        openapi: "3.1.0",
        info: { title: "Broken API", version: "1.0.0" },
        paths: {
          "/one": {
            get: { operationId: "duplicate", responses: { "200": { description: "OK" } } },
          },
          "/two": {
            post: { operationId: "duplicate", responses: { "200": { description: "OK" } } },
          },
        },
      }),
    );

    process.chdir(tmpDir);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const report = await runDoctor({ mode: "api", json: true, failOn: "fail" });

    expect(report.mode).toBe("api");
    if (report.mode !== "api") throw new Error("Expected an API doctor report.");
    expect(report.checks.find((check) => check.id === "sources")?.status).toBe("fail");
    expect(report.sources[0]?.diagnostic).toContain("duplicate");
    expect(process.exitCode).toBe(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as { mode: string };
    expect(payload.mode).toBe("api");
  });

  it("fails renderer compatibility when Fumadocs is selected outside Next.js", async () => {
    writePackageJson(tmpDir, { astro: "5.0.0" });
    writeFile(
      tmpDir,
      "docs.config.ts",
      `export default {
  apiReference: { specUrl: "./openapi.json", renderer: "fumadocs" },
};`,
    );
    writeFile(tmpDir, "openapi.json", openApiDocument([]));

    process.chdir(tmpDir);
    const report = await inspectApiReferenceHealth();

    expect(report.checks.find((check) => check.id === "renderer")).toMatchObject({
      status: "fail",
      recommendation: 'Set apiReference.renderer to "scalar" for this framework.',
    });
  });

  it("redacts remote source credentials and query parameters from reports", async () => {
    writePackageJson(tmpDir, { next: "16.0.0" });
    writeFile(
      tmpDir,
      "docs.config.ts",
      `export default {
  apiReference: { specUrl: "https://reader:secret@example.com/openapi.json?token=private" },
};`,
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(openApiDocument([{ method: "get", path: "/widgets", id: "listWidgets" }]), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    process.chdir(tmpDir);
    const report = await inspectApiReferenceHealth();
    const serialized = JSON.stringify(report);

    expect(report.sources[0]?.source).toBe("https://redacted:redacted@example.com/openapi.json");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("private");
  });
});
