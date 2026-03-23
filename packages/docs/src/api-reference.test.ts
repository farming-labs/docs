import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildApiReferenceScalarCss,
  buildApiReferenceOpenApiDocument,
  buildApiReferenceOpenApiDocumentAsync,
} from "./api-reference.js";
import { defineDocs } from "./define-docs.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }

  vi.unstubAllGlobals();
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
      entry: "docs",
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

  it("loads a hosted OpenAPI JSON document when specUrl is configured", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            openapi: "3.0.4",
            info: {
              title: "Remote Pets",
              version: "1.2.3",
            },
            paths: {
              "/pets": {
                get: {
                  responses: {
                    "200": {
                      description: "OK",
                    },
                  },
                },
              },
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      ),
    );

    const config = defineDocs({
      entry: "docs",
      apiReference: {
        enabled: true,
        specUrl: "https://example.com/openapi.json",
      },
    });

    const document = await buildApiReferenceOpenApiDocumentAsync(config, {
      framework: "next",
    });

    expect(document).toMatchObject({
      openapi: "3.0.4",
      info: {
        title: "Remote Pets",
        version: "1.2.3",
      },
      paths: {
        "/pets": {
          get: {
            responses: {
              "200": {
                description: "OK",
              },
            },
          },
        },
      },
    });
  });

  it("returns a friendly fallback document when the remote spec is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("not-json", {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ),
    );

    const config = defineDocs({
      entry: "docs",
      apiReference: {
        enabled: true,
        specUrl: "https://example.com/openapi.json",
      },
    });

    const document = await buildApiReferenceOpenApiDocumentAsync(config, {
      framework: "next",
    });

    expect(document).toMatchObject({
      openapi: "3.1.0",
      info: {
        title: "API Reference",
      },
      paths: {},
    });
    expect(document.info).toMatchObject({
      description: expect.stringContaining("did not return valid JSON"),
    });
  });

  it("uses a readable foreground color for pixel-border themed API references", () => {
    const css = buildApiReferenceScalarCss(
      defineDocs({
        entry: "docs",
        theme: {
          name: "fumadocs-pixel-border",
          ui: {
            colors: {
              primary: "oklch(0.985 0.001 106.423)",
              background: "hsl(0 0% 2%)",
              muted: "hsl(0 0% 55%)",
              border: "hsl(0 0% 15%)",
            },
          },
        },
      }),
    );

    expect(css).toContain("--scalar-theme-foreground: #f5f5f4;");
    expect(css).toContain("--scalar-radius: var(--radius, 0.75rem);");
    expect(css).toContain("--scalar-button-1-color: #0b0b0b;");
  });
});
