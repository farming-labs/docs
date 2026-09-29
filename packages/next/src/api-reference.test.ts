import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildNextOpenApiDocument,
  createNextApiReference,
  flattenApiReferencePageTreeForSidebar,
  getNextApiReferenceMode,
  withNextApiReferenceBanner,
} from "./api-reference.js";

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
});

describe("getNextApiReferenceMode", () => {
  it("defaults to the Farming Labs renderer for Next.js", () => {
    expect(
      getNextApiReferenceMode({
        entry: "docs",
        apiReference: true,
      }),
    ).toBe("farming-labs");
  });

  it("respects an explicit scalar renderer override", () => {
    expect(
      getNextApiReferenceMode({
        entry: "docs",
        apiReference: {
          enabled: true,
          renderer: "scalar",
        },
      }),
    ).toBe("scalar");
  });

  it("preserves the explicit Fumadocs renderer override", () => {
    expect(
      getNextApiReferenceMode({
        entry: "docs",
        apiReference: {
          enabled: true,
          renderer: "fumadocs",
        },
      }),
    ).toBe("fumadocs");
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

  it("serves the native API reference as HTML by default", async () => {
    const handler = createNextApiReference({
      entry: "docs",
      apiReference: true,
    });

    const response = await handler(new Request("https://docs.example.com/api-reference"));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(html).toContain('meta name="generator" content="@farming-labs/docs"');
    expect(html).toContain('id="fl-api-search"');
  });
});

describe("flattenApiReferencePageTreeForSidebar", () => {
  it("promotes a single top-level folder into direct sidebar items", () => {
    expect(
      flattenApiReferencePageTreeForSidebar({
        name: "API",
        children: [
          {
            type: "folder",
            name: "Api",
            children: [
              {
                type: "page",
                name: "Checkout",
                url: "/api-reference/api/checkout",
              },
            ],
          },
        ],
      }),
    ).toEqual({
      name: "API",
      children: [
        {
          type: "page",
          name: "Checkout",
          url: "/api-reference/api/checkout",
        },
      ],
    });
  });
});
