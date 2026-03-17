import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildApiReferenceOpenApiDocument } from "./api-reference.js";
import { defineDocs } from "./define-docs.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("buildApiReferenceOpenApiDocument", () => {
  it("respects project-root routeRoot values for Astro endpoints", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-api-ref-"));
    tempDirs.push(rootDir);

    const apiDir = join(rootDir, "src", "pages", "api");
    mkdirSync(apiDir, { recursive: true });
    writeFileSync(
      join(apiDir, "hello.ts"),
      [
        "/**",
        " * Summary: Hello endpoint",
        " */",
        "export async function GET() {",
        "  return new Response('ok');",
        "}",
        "",
      ].join("\n"),
    );

    const config = defineDocs({
      apiReference: {
        enabled: true,
        routeRoot: "src/pages/api",
      },
    });

    const document = buildApiReferenceOpenApiDocument(config, {
      framework: "astro",
      rootDir,
    });

    expect(document.paths).toHaveProperty("/api/hello.get");
    expect(document.paths).not.toHaveProperty("/src/pages/api/hello.get");
  });
});
