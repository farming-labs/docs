import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildNextOpenApiDocument,
  createNextApiReference,
  flattenApiReferencePageTreeForSidebar,
  getNextApiReferenceMode,
  getNextApiReferenceSourceState,
  withNextApiReferenceBanner,
} from "./api-reference.js";
import { resolveFumadocsOpenAPIPageOptions } from "./fumadocs-api-page.js";
import { fumadocsRenderer } from "./fumadocs-renderer.js";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "docs.example.com" }),
}));

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

  it("builds Fumadocs v12 page props from generated operations", async () => {
    mkdirSync(join(tmpDir, "app", "api", "plants"), { recursive: true });
    writeFileSync(
      join(tmpDir, "app", "api", "plants", "route.ts"),
      `/** List plants */
export async function GET() {
  return Response.json([]);
}
`,
      "utf-8",
    );

    process.chdir(tmpDir);

    const state = await getNextApiReferenceSourceState({
      entry: "docs",
      apiReference: {
        enabled: true,
        renderer: fumadocsRenderer({
          disableCache: true,
          proxyUrl: "/api/docs/proxy",
        }),
      },
    });
    const page = state.pages[0];

    expect(state.pages).toHaveLength(1);
    expect(state.server.options).toMatchObject({
      disableCache: true,
      proxyUrl: "/api/docs/proxy",
    });
    expect(page?.data.getOpenAPIPageProps).toBeTypeOf("function");
    expect(page?.data.getOpenAPIPageProps()).toMatchObject({
      payload: {
        bundled: {
          openapi: expect.stringMatching(/^3\./),
        },
      },
      operations: [
        {
          path: "/api/plants",
          method: "get",
        },
      ],
    });
  });

  it("forwards typed Fumadocs page and playground options to the client renderer", () => {
    const transformAuthInputs = vi.fn((fields) => fields);
    const renderer = fumadocsRenderer({
      disableCache: true,
      oauthRedirectUrl: "/api/docs/oauth",
      playground: {
        enabled: false,
        transformAuthInputs,
      },
      schemaUI: {
        showExample: true,
      },
    });

    const options = resolveFumadocsOpenAPIPageOptions({
      entry: "docs",
      apiReference: {
        enabled: true,
        renderer,
      },
    });

    expect(renderer).toMatchObject({ name: "fumadocs" });
    expect(options).toMatchObject({
      oauthRedirectUrl: "/api/docs/oauth",
      playground: { enabled: false, transformAuthInputs },
      schemaUI: { showExample: true },
    });
    expect(options).not.toHaveProperty("disableCache");
    expect(options.content?.renderOperationLayout).toBeTypeOf("function");
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
