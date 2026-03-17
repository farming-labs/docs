import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildNextOpenApiDocument } from "./api-reference.js";

describe("buildNextOpenApiDocument", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tmpDir = mkdtempSync(join(tmpdir(), "next-api-reference-"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("scans a custom routeRoot when configured", () => {
    mkdirSync(join(tmpDir, "app", "internal-api", "hello"), { recursive: true });
    writeFileSync(
      join(tmpDir, "app", "internal-api", "hello", "route.ts"),
      `/** Hello endpoint */
export async function GET() {
  return Response.json({ ok: true });
}
`,
      "utf-8",
    );

    process.chdir(tmpDir);

    const document = buildNextOpenApiDocument({
      entry: "docs",
      apiReference: {
        enabled: true,
        path: "api-reference",
        routeRoot: "app/internal-api",
      },
    });

    expect(document.paths).toMatchObject({
      "/api/hello": {
        get: {
          summary: "Hello endpoint",
        },
      },
    });
  });
});
