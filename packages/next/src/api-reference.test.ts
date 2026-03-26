import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildNextOpenApiDocument,
  createNextApiReference,
  createNextApiReferenceMetadata,
  withNextApiReferenceBanner,
} from "./api-reference.js";

function collectText(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join("");

  if (
    typeof node === "object" &&
    node !== null &&
    "type" in node &&
    typeof (node as { type?: unknown }).type === "function" &&
    "props" in node
  ) {
    return collectText(
      (node as { type: (props: unknown) => unknown; props: unknown }).type(
        (node as { props: unknown }).props,
      ),
    );
  }

  if (typeof node === "object" && "props" in node) {
    return collectText((node as { props?: { children?: unknown } }).props?.children);
  }

  return "";
}

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
      "/internal-api/hello": {
        get: {
          summary: "Hello endpoint",
        },
      },
    });
  });

  it("excludes configured routes from the generated reference", () => {
    mkdirSync(join(tmpDir, "app", "api", "hello"), { recursive: true });
    mkdirSync(join(tmpDir, "app", "api", "secret"), { recursive: true });

    writeFileSync(
      join(tmpDir, "app", "api", "hello", "route.ts"),
      `/** Public endpoint */
export async function GET() {
  return Response.json({ ok: true });
}
`,
      "utf-8",
    );

    writeFileSync(
      join(tmpDir, "app", "api", "secret", "route.ts"),
      `/** Secret endpoint */
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
        exclude: ["/api/secret"],
      },
    });

    expect(document.paths).toMatchObject({
      "/api/hello": {
        get: {
          summary: "Public endpoint",
        },
      },
    });
    expect(document.paths).not.toHaveProperty("/api/secret");
  });

  it("uses a nested routeRoot path as the OpenAPI path prefix", () => {
    mkdirSync(join(tmpDir, "app", "v2", "api", "users", "[id]"), { recursive: true });
    writeFileSync(
      join(tmpDir, "app", "v2", "api", "users", "[id]", "route.ts"),
      `/** User endpoint */
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
        routeRoot: "v2/api",
      },
    });

    expect(document.paths).toMatchObject({
      "/v2/api/users/{id}": {
        get: {
          summary: "User endpoint",
        },
      },
    });
  });
});

describe("withNextApiReferenceBanner", () => {
  it("does not inject the docs/api switcher when apiReference is disabled", () => {
    const config = {
      entry: "docs",
      sidebar: {
        flat: true,
      },
      apiReference: false,
    };

    expect(withNextApiReferenceBanner(config)).toBe(config);
  });

  it("describes the fumadocs renderer in the switcher banner", () => {
    const config = withNextApiReferenceBanner({
      entry: "docs",
      sidebar: true,
      apiReference: {
        enabled: true,
        renderer: "fumadocs",
      },
    });

    expect(collectText((config.sidebar as { banner: ReactElement }).banner)).toContain(
      "Fumadocs OpenAPI explorer",
    );
  });
});

describe("createNextApiReference", () => {
  it("returns 404 when apiReference is disabled", async () => {
    const handler = createNextApiReference({
      entry: "docs",
      apiReference: false,
    });

    const response = await handler();

    expect(response.status).toBe(404);
  });

  it("returns 404 when the fumadocs renderer is selected", async () => {
    const handler = createNextApiReference({
      entry: "docs",
      apiReference: {
        enabled: true,
        renderer: "fumadocs",
      },
    });

    const response = await handler();

    expect(response.status).toBe(404);
  });
});

describe("createNextApiReferenceMetadata", () => {
  it("builds a page title from docs metadata", () => {
    expect(
      createNextApiReferenceMetadata({
        entry: "docs",
        metadata: {
          titleTemplate: "%s – Example",
          description: "API docs",
        },
      }),
    ).toMatchObject({
      title: "API Reference – Example",
      description: "API docs",
    });
  });
});
