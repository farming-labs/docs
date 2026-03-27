import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { renderToStaticMarkup } from "react-dom/server";
import { jsx } from "react/jsx-runtime";
import {
  buildNextOpenApiDocument,
  createNextApiReference,
  createNextApiReferenceLayout,
  createNextApiReferencePage,
  getNextApiReferenceMode,
  withNextApiReferenceBanner,
} from "./api-reference.js";

const nextHeadersMock = vi.hoisted(() => ({
  headers: vi.fn(),
}));

const createAPIPageMock = vi.hoisted(() => vi.fn());
const loaderMock = vi.hoisted(() => vi.fn());
const notebookLayoutMock = vi.hoisted(() => vi.fn());
const notebookPageMock = vi.hoisted(() => vi.fn());
const notebookTitleMock = vi.hoisted(() => vi.fn());
const notebookDescriptionMock = vi.hoisted(() => vi.fn());
const notebookBodyMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`redirect:${url}`);
  }),
);
const notFoundMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error("notFound");
  }),
);

vi.mock("next/headers", () => nextHeadersMock);
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));

vi.mock("fumadocs-ui/layouts/notebook", () => ({
  DocsLayout: notebookLayoutMock.mockImplementation(
    function MockDocsLayout(props: Record<string, unknown>) {
      return jsx("div", {
        "data-notebook-layout": true,
        "data-nav-title":
          typeof (props.nav as Record<string, unknown> | undefined)?.title === "string"
            ? (props.nav as Record<string, unknown>).title
            : "Docs",
        children: props.children,
      });
    },
  ),
}));

vi.mock("fumadocs-ui/layouts/notebook/page", () => ({
  DocsPage: notebookPageMock.mockImplementation(function MockDocsPage(props: Record<string, unknown>) {
    return jsx("div", {
      "data-notebook-page": true,
      "data-toc": Array.isArray(props.toc) ? String(props.toc.length) : "0",
      children: props.children,
    });
  }),
  DocsTitle: notebookTitleMock.mockImplementation(function MockDocsTitle(props: Record<string, unknown>) {
    return jsx("h1", { "data-notebook-title": true, children: props.children });
  }),
  DocsDescription: notebookDescriptionMock.mockImplementation(function MockDocsDescription(
    props: Record<string, unknown>,
  ) {
    return jsx("p", { "data-notebook-description": true, children: props.children });
  }),
  DocsBody: notebookBodyMock.mockImplementation(function MockDocsBody(props: Record<string, unknown>) {
    return jsx("div", { "data-notebook-body": true, children: props.children });
  }),
}));

vi.mock("./client-callbacks.js", () => ({
  default: function MockDocsClientCallbacks() {
    return null;
  },
}));

vi.mock("fumadocs-openapi/server", () => ({
  createOpenAPI: vi.fn(() => ({
    options: {},
    getSchemas: vi.fn(),
    getSchema: vi.fn(),
    createProxy: vi.fn(),
  })),
  openapiPlugin: vi.fn(() => ({ name: "fumadocs:openapi" })),
  openapiSource: vi.fn(async () => ({ files: [] })),
}));

vi.mock("fumadocs-openapi/ui", () => ({
  createAPIPage: createAPIPageMock.mockImplementation(
    () =>
      function MockApiPage(props: Record<string, unknown>) {
        return jsx("div", {
          "data-api-page": true,
          "data-document": String(props.document ?? ""),
          children: "mock-api-page",
        });
      },
  ),
}));

vi.mock("fumadocs-core/source", () => ({
  loader: loaderMock,
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
    vi.unstubAllGlobals();
    nextHeadersMock.headers.mockReset();
    createAPIPageMock.mockClear();
    loaderMock.mockReset();
    notebookLayoutMock.mockClear();
    notebookPageMock.mockClear();
    notebookTitleMock.mockClear();
    notebookDescriptionMock.mockClear();
    notebookBodyMock.mockClear();
    redirectMock.mockClear();
    notFoundMock.mockClear();
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

describe("createNextApiReference", () => {
  beforeEach(() => {
    loaderMock.mockImplementation(() => {
      const page = {
        url: "/api-reference/pets/get",
        slugs: ["pets", "get"],
        data: {
          title: "List pets",
          description: "Returns pets.",
          getAPIPageProps: () => ({
            document: "main",
            operations: [],
            webhooks: [],
          }),
        },
      };

      return {
        getPages: () => [page],
        getPage: (slugs: string[]) =>
          slugs.join("/") === "pets/get" ? page : undefined,
        getPageTree: () => ({
          name: "Docs",
          children: [
            {
              type: "folder",
              name: "Pets",
              children: [
                {
                  type: "page",
                  name: "List pets",
                  url: "/api-reference/pets/get",
                },
              ],
            },
          ],
        }),
      };
    });
  });

  it("returns 404 when apiReference is disabled", async () => {
    const handler = createNextApiReference({
      entry: "docs",
      apiReference: false,
    });

    const response = await handler();

    expect(response.status).toBe(404);
  });

  it("defaults to the fumadocs renderer for Next.js API references", () => {
    expect(
      getNextApiReferenceMode({
        entry: "docs",
        apiReference: {
          enabled: true,
        },
      }),
    ).toBe("fumadocs");
  });

  it("respects an explicit scalar renderer for Next.js API references", () => {
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

  it("creates a fumadocs API reference page component", async () => {
    nextHeadersMock.headers.mockResolvedValue(
      new Headers({
        host: "docs.example.com",
        "x-forwarded-proto": "https",
      }),
    );

    const Page = createNextApiReferencePage({
      entry: "docs",
      metadata: {
        description: "Generated API docs",
      },
      apiReference: {
        enabled: true,
        specUrl: "/api/openapi.json",
      },
    });

    const fetchSpy = vi.fn().mockResolvedValue(
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
                summary: "List pets",
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
    );

    vi.stubGlobal("fetch", fetchSpy);

    const element = await Page({
      params: Promise.resolve({
        slug: ["pets", "get"],
      }),
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((fetchSpy.mock.calls[0]?.[0] as URL).href).toBe(
      "https://docs.example.com/api/openapi.json",
    );
    expect(createAPIPageMock).toHaveBeenCalledTimes(1);
    expect(element).toBeTruthy();
    expect(renderToStaticMarkup(element)).toContain("List pets");
  });

  it("renders the published notebook page components for fumadocs mode", async () => {
    nextHeadersMock.headers.mockResolvedValue(
      new Headers({
        host: "docs.example.com",
        "x-forwarded-proto": "https",
      }),
    );

    const Page = createNextApiReferencePage({
      entry: "docs",
      nav: {
        title: "Docs",
        url: "/docs",
      },
      metadata: {
        description: "Generated API docs",
      },
      apiReference: {
        enabled: true,
        specUrl: "/api/openapi.json",
      },
    });

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
            tags: [
              {
                name: "Pets",
              },
            ],
            paths: {
              "/pets": {
                get: {
                  tags: ["Pets"],
                  summary: "List pets",
                  description: "Returns pets.",
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

    await Page({
      params: Promise.resolve({
        slug: ["pets", "get"],
      }),
    });

    expect(notebookPageMock).toHaveBeenCalledTimes(1);
    expect(notebookTitleMock).toHaveBeenCalledTimes(1);
    expect(notebookDescriptionMock).toHaveBeenCalledTimes(1);
    expect(notebookBodyMock).toHaveBeenCalledTimes(1);
  });

  it("redirects the base api-reference page to the first generated OpenAPI page", async () => {
    nextHeadersMock.headers.mockResolvedValue(
      new Headers({
        host: "docs.example.com",
        "x-forwarded-proto": "https",
      }),
    );

    const Page = createNextApiReferencePage({
      entry: "docs",
      apiReference: {
        enabled: true,
        specUrl: "/api/openapi.json",
      },
    });

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
                  summary: "List pets",
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

    await expect(Page()).rejects.toThrow("redirect:/api-reference/pets/get");
    expect(redirectMock).toHaveBeenCalledWith("/api-reference/pets/get");
  });

  it("returns notFound() for an unknown generated OpenAPI page slug", async () => {
    nextHeadersMock.headers.mockResolvedValue(
      new Headers({
        host: "docs.example.com",
        "x-forwarded-proto": "https",
      }),
    );

    const Page = createNextApiReferencePage({
      entry: "docs",
      apiReference: {
        enabled: true,
        specUrl: "/api/openapi.json",
      },
    });

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
                  summary: "List pets",
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

    await expect(
      Page({
        params: Promise.resolve({
          slug: ["missing"],
        }),
      }),
    ).rejects.toThrow("notFound");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
  });

  it("creates a notebook layout for the API reference sidebar", async () => {
    nextHeadersMock.headers.mockResolvedValue(
      new Headers({
        host: "docs.example.com",
        "x-forwarded-proto": "https",
      }),
    );

    const Layout = createNextApiReferenceLayout({
      entry: "docs",
      nav: {
        title: "Docs",
        url: "/docs",
      },
      apiReference: {
        enabled: true,
        specUrl: "/api/openapi.json",
      },
    });

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
            tags: [{ name: "Pets" }],
            paths: {
              "/pets": {
                get: {
                  tags: ["Pets"],
                  summary: "List pets",
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

    const element = await Layout({
      children: jsx("div", { children: "child" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("child");
    expect(notebookLayoutMock).toHaveBeenCalledTimes(1);
    const sidebar = notebookLayoutMock.mock.calls[0]?.[0]?.sidebar as
      | Record<string, unknown>
      | undefined;
    expect(sidebar?.banner).toBeTruthy();
    const bannerHtml = renderToStaticMarkup(sidebar?.banner as any);
    expect(bannerHtml).toContain("Documentation");
    expect(bannerHtml).toContain("API Reference");
    expect(notebookLayoutMock.mock.calls[0]?.[0]?.tree).toMatchObject({
      children: [
        {
          type: "folder",
          name: "Pets",
          children: [
            {
              type: "page",
              name: "List pets",
              url: "/api-reference/pets/get",
            },
          ],
        },
      ],
    });
  });

  it("resolves request-relative specs in the scalar route handler", async () => {
    const handler = createNextApiReference({
      entry: "docs",
      apiReference: {
        enabled: true,
        renderer: "scalar",
        specUrl: "/api/openapi.json",
      },
    });

    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          openapi: "3.0.4",
          info: {
            title: "Remote Pets",
            version: "1.2.3",
          },
          paths: {},
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      ),
    );

    vi.stubGlobal("fetch", fetchSpy);

    const response = await handler(new Request("https://docs.example.com/api-reference"));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((fetchSpy.mock.calls[0]?.[0] as URL).href).toBe(
      "https://docs.example.com/api/openapi.json",
    );
    expect(response.status).toBe(200);
  });
});
