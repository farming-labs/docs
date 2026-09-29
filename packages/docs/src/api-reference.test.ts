import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildApiReferenceHtmlDocumentAsync,
  buildApiReferenceScalarCss,
  buildApiReferenceOpenApiDocument,
  buildApiReferenceOpenApiDocumentAsync,
  buildApiReferenceOperationPagesAsync,
  createApiReferenceOperationMarkdownResponse,
  DEFAULT_API_REFERENCE_OPENAPI_ROUTE,
  OPENAPI_SPEC_FETCH_TIMEOUT_MS,
  OPENAPI_SPEC_MAX_BYTES,
  resolveApiReferenceOpenApiDiscovery,
  resolveApiReferenceRenderer,
  resolveApiReferenceVersionFromPathname,
} from "./api-reference.js";
import { defineDocs } from "./define-docs.js";
import { buildNormalizedOpenApiModel } from "./openapi-operations.js";
import { applyOpenApiOverlayDocuments } from "./openapi-overlays.js";
import { OPENAPI_BUNDLED_REFERENCES_EXTENSION } from "./openapi-references.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }

  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("resolveApiReferenceOpenApiDiscovery", () => {
  it("distinguishes the generated endpoint from an identical explicit route", () => {
    expect(resolveApiReferenceOpenApiDiscovery(true)).toMatchObject({
      url: DEFAULT_API_REFERENCE_OPENAPI_ROUTE,
      urlSource: "default",
      catalogTargets: ["/"],
    });
    expect(
      resolveApiReferenceOpenApiDiscovery(true, {
        route: DEFAULT_API_REFERENCE_OPENAPI_ROUTE,
      }),
    ).toMatchObject({
      url: DEFAULT_API_REFERENCE_OPENAPI_ROUTE,
      urlSource: "configured",
      catalogTargets: ["/"],
    });
  });

  it("requires explicit catalog targets for absolute remote schemas", () => {
    expect(
      resolveApiReferenceOpenApiDiscovery({
        enabled: true,
        specUrl: "https://schemas.example.com/product.json",
      }).catalogTargets,
    ).toBeUndefined();
    expect(
      resolveApiReferenceOpenApiDiscovery({
        enabled: true,
        specUrl: "//schemas.example.com/product.json",
      }).catalogTargets,
    ).toBeUndefined();

    expect(
      resolveApiReferenceOpenApiDiscovery({
        enabled: true,
        specUrl: "https://schemas.example.com/product.json",
        catalogTargets: [
          " https://api.example.com/v1 ",
          "https://api.example.com/v1",
          "https://api.example.com/v2",
        ],
      }),
    ).toMatchObject({
      catalogTargets: ["https://api.example.com/v1", "https://api.example.com/v2"],
    });
  });

  it("uses the request origin target for request-relative schemas unless explicitly disabled", () => {
    expect(
      resolveApiReferenceOpenApiDiscovery({
        enabled: true,
        specUrl: "/openapi.json",
      }),
    ).toMatchObject({ catalogTargets: ["/"] });

    expect(
      resolveApiReferenceOpenApiDiscovery({
        enabled: true,
        specUrl: "/openapi.json",
        catalogTargets: [],
      }),
    ).toMatchObject({ catalogTargets: [] });
  });

  it("does not publish a project-relative source path in discovery", () => {
    const discovery = resolveApiReferenceOpenApiDiscovery({
      enabled: true,
      specUrl: "./openapi.yaml",
    });

    expect(discovery.source).toBe("configured");
    expect(discovery.specUrl).toBeUndefined();
    expect(discovery.catalogTargets).toBeUndefined();
  });

  it("publishes stable identities for every configured API version", () => {
    const config = {
      enabled: true,
      versions: {
        v1: { specUrl: "./openapi-v1.yaml", label: "Version 1" },
        v2: { specUrl: "https://schemas.example.com/v2.yaml" },
      },
      defaultVersion: "v2",
    } as const;

    expect(resolveApiReferenceOpenApiDiscovery(config)).toMatchObject({
      source: "configured",
      specUrl: "https://schemas.example.com/v2.yaml",
      apiReferencePath: "/api-reference",
      versions: [
        {
          id: "v1",
          label: "Version 1",
          default: false,
          url: "/api/docs?format=openapi&version=v1",
          apiReferencePath: "/api-reference/v1",
          specUrl: undefined,
        },
        {
          id: "v2",
          label: "v2",
          default: true,
          url: "/api/docs?format=openapi&version=v2",
          apiReferencePath: "/api-reference/v2",
          specUrl: "https://schemas.example.com/v2.yaml",
        },
      ],
    });
    expect(resolveApiReferenceVersionFromPathname(config, "/api-reference/v1/pets")).toMatchObject({
      id: "v1",
    });
  });

  it("requires one explicit valid default for versioned sources", () => {
    expect(() =>
      resolveApiReferenceOpenApiDiscovery({
        enabled: true,
        versions: { v1: { specUrl: "./openapi.yaml" } },
      }),
    ).toThrow("defaultVersion");
    expect(() =>
      resolveApiReferenceOpenApiDiscovery({
        enabled: true,
        versions: { "bad/version": { specUrl: "./openapi.yaml" } },
        defaultVersion: "bad/version",
      }),
    ).toThrow("URL-safe");
  });
});

describe("buildApiReferenceOpenApiDocument", () => {
  function createRemoteOpenApiResponse() {
    return new Response(
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
    );
  }

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

  it("discovers Farm app API route handlers", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-api-ref-farmjs-"));
    tempDirs.push(rootDir);

    const apiDir = join(rootDir, "src", "app", "api", "users");
    mkdirSync(apiDir, { recursive: true });
    writeFileSync(
      join(apiDir, "route.ts"),
      [
        "/**",
        " * Summary: List users",
        " */",
        "export async function GET() {",
        "  return Response.json([]);",
        "}",
        "",
      ].join("\n"),
    );

    const config = defineDocs({
      entry: "docs",
      apiReference: true,
    });
    const document = buildApiReferenceOpenApiDocument(config, {
      framework: "farmjs",
      rootDir,
    });

    expect(document.paths).toHaveProperty("/api/users.get");
  });

  it("loads a hosted OpenAPI JSON document when specUrl is configured for every framework", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => createRemoteOpenApiResponse()),
    );

    const config = defineDocs({
      entry: "docs",
      apiReference: {
        enabled: true,
        specUrl: "https://example.com/openapi.json",
      },
    });

    for (const framework of [
      "next",
      "tanstack-start",
      "farmjs",
      "sveltekit",
      "astro",
      "nuxt",
    ] as const) {
      const document = await buildApiReferenceOpenApiDocumentAsync(config, {
        framework,
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
    }
  });

  it("loads project-relative OpenAPI JSON and YAML files", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-api-ref-files-"));
    tempDirs.push(rootDir);
    const jsonPath = join(rootDir, "openapi.json");
    writeFileSync(
      jsonPath,
      JSON.stringify({
        openapi: "3.1.0",
        info: { title: "Local JSON", version: "1.0.0" },
        paths: {
          "/json-health": {
            get: { summary: "JSON health", responses: { "200": { description: "OK" } } },
          },
        },
      }),
      "utf-8",
    );
    writeFileSync(
      join(rootDir, "openapi.yaml"),
      [
        'openapi: "3.1.0"',
        "info:",
        "  title: Local YAML",
        '  version: "1.0.0"',
        "paths:",
        "  /yaml-health:",
        "    get:",
        "      summary: YAML health",
        "      responses:",
        '        "200":',
        "          description: OK",
        "",
      ].join("\n"),
      "utf-8",
    );

    for (const [specUrl, title, route] of [
      ["openapi.json", "Local JSON", "/json-health"],
      ["./openapi.yaml", "Local YAML", "/yaml-health"],
      [pathToFileURL(jsonPath).href, "Local JSON", "/json-health"],
    ] as const) {
      const config = defineDocs({
        entry: "docs",
        apiReference: { enabled: true, specUrl },
      });
      const syncDocument = buildApiReferenceOpenApiDocument(config, {
        framework: "next",
        rootDir,
      });
      const asyncDocument = await buildApiReferenceOpenApiDocumentAsync(config, {
        framework: "astro",
        rootDir,
      });

      for (const document of [syncDocument, asyncDocument]) {
        expect(document).toMatchObject({
          openapi: "3.1.0",
          info: { title, version: "1.0.0" },
          paths: { [route]: { get: expect.any(Object) } },
        });
      }
    }
  });

  it("selects named API versions and marks their normalized documents", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-api-ref-versions-"));
    tempDirs.push(rootDir);
    for (const version of ["v1", "v2"] as const) {
      writeFileSync(
        join(rootDir, `${version}.yaml`),
        [
          'openapi: "3.1.0"',
          `info: { title: API ${version}, version: '${version}' }`,
          "paths:",
          `  /${version}/pets:`,
          "    get:",
          `      operationId: listPets${version.toUpperCase()}`,
          "      responses:",
          "        '200': { description: OK }",
          "",
        ].join("\n"),
      );
    }
    const config = defineDocs({
      entry: "docs",
      apiReference: {
        enabled: true,
        versions: {
          v1: { specUrl: "./v1.yaml", label: "Version 1" },
          v2: { specUrl: "./v2.yaml", label: "Version 2" },
        },
        defaultVersion: "v2",
      },
    });

    const defaultDocument = await buildApiReferenceOpenApiDocumentAsync(config, {
      framework: "next",
      rootDir,
    });
    const v1Document = await buildApiReferenceOpenApiDocumentAsync(config, {
      framework: "next",
      rootDir,
      version: "v1",
    });

    expect(defaultDocument).toMatchObject({
      info: { title: "API v2" },
      "x-farming-labs-api-version": { id: "v2", label: "Version 2", default: true },
    });
    expect(v1Document).toMatchObject({
      info: { title: "API v1" },
      "x-farming-labs-api-version": { id: "v1", label: "Version 1", default: false },
    });
    const html = await buildApiReferenceHtmlDocumentAsync(config, {
      framework: "astro",
      rootDir,
      version: "v1",
    });
    expect(html).toContain("/api-reference/v1");
  });

  it("applies Overlay 1.0 and 1.1 documents sequentially before resolving references", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-api-ref-overlays-"));
    tempDirs.push(rootDir);
    writeFileSync(
      join(rootDir, "openapi.yaml"),
      [
        'openapi: "3.1.0"',
        "info: { title: Overlay API, version: '1' }",
        "paths:",
        "  /pets:",
        "    get:",
        "      summary: Original",
        "      tags: [public]",
        "      responses:",
        "        '200': { description: OK }",
        "  /copied: {}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(rootDir, "first.overlay.yaml"),
      [
        'overlay: "1.0.0"',
        "info: { title: First overlay, version: '1' }",
        "actions:",
        "  - target: $['paths']['/pets']['get']",
        "    update:",
        "      summary: First",
        "      tags: [beta]",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(rootDir, "second.overlay.yaml"),
      [
        'overlay: "1.1.0"',
        "info: { title: Second overlay, version: '1' }",
        "actions:",
        "  - target: $['paths']['/pets']['get']['summary']",
        "    update: Final",
        "  - target: $['paths']['/copied']",
        "    copy: $['paths']['/pets']",
        "",
      ].join("\n"),
    );
    const config = defineDocs({
      entry: "docs",
      apiReference: {
        enabled: true,
        specUrl: "./openapi.yaml",
        overlays: ["./first.overlay.yaml", "./second.overlay.yaml"],
      },
    });

    for (const document of [
      buildApiReferenceOpenApiDocument(config, { framework: "next", rootDir }),
      await buildApiReferenceOpenApiDocumentAsync(config, { framework: "astro", rootDir }),
    ]) {
      expect(document).toMatchObject({
        paths: {
          "/pets": { get: { summary: "Final", tags: ["public", "beta"] } },
          "/copied": { get: { summary: "Final" } },
        },
      });
    }
  });

  it("reports invalid and unmatched Overlay targets", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-api-ref-overlay-errors-"));
    tempDirs.push(rootDir);
    writeFileSync(
      join(rootDir, "openapi.json"),
      JSON.stringify({
        openapi: "3.1.0",
        info: { title: "Overlay API", version: "1" },
        paths: {},
      }),
    );
    writeFileSync(
      join(rootDir, "bad.overlay.yaml"),
      [
        'overlay: "1.1.0"',
        "info: { title: Bad overlay, version: '1' }",
        "actions:",
        "  - target: $['paths']['/missing']",
        "    update: { summary: Missing }",
        "",
      ].join("\n"),
    );

    const document = buildApiReferenceOpenApiDocument(
      defineDocs({
        entry: "docs",
        apiReference: {
          enabled: true,
          specUrl: "./openapi.json",
          overlays: ["./bad.overlay.yaml"],
        },
      }),
      { framework: "next", rootDir },
    );
    expect(document.info).toMatchObject({
      description: expect.stringContaining("did not match any nodes"),
    });

    writeFileSync(
      join(rootDir, "bad.overlay.yaml"),
      [
        'overlay: "1.1.0"',
        "info: { title: Bad overlay, version: '1' }",
        "actions:",
        "  - target: $['paths'",
        "    update: { summary: Invalid }",
        "",
      ].join("\n"),
    );
    const invalidDocument = buildApiReferenceOpenApiDocument(
      defineDocs({
        entry: "docs",
        apiReference: {
          enabled: true,
          specUrl: "./openapi.json",
          overlays: ["./bad.overlay.yaml"],
        },
      }),
      { framework: "next", rootDir },
    );
    expect(invalidDocument.info).toMatchObject({
      description: expect.stringContaining("invalid RFC 9535 JSONPath"),
    });
  });

  it("rejects mixed target types and invalid copy expressions in Overlay 1.1", () => {
    const document = {
      openapi: "3.1.0",
      info: { title: "Overlay API", version: "1" },
      tags: [],
      paths: {},
    };

    expect(() =>
      applyOpenApiOverlayDocuments(document, [
        {
          source: "mixed.overlay.json",
          document: {
            overlay: "1.1.0",
            info: { title: "Mixed targets", version: "1" },
            actions: [{ target: "$['info','tags']", update: {} }],
          },
        },
      ]),
    ).toThrow("must select only objects, only arrays, or only primitives");

    expect(() =>
      applyOpenApiOverlayDocuments(document, [
        {
          source: "copy.overlay.json",
          document: {
            overlay: "1.1.0",
            info: { title: "Invalid copy", version: "1" },
            actions: [{ target: "$.paths", copy: "info" }],
          },
        },
      ]),
    ).toThrow("`copy` must start with `$`");
  });

  it("bundles local OpenAPI references into a normalized operation model", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-api-ref-refs-"));
    tempDirs.push(rootDir);
    mkdirSync(join(rootDir, "paths"));
    writeFileSync(
      join(rootDir, "openapi.yaml"),
      [
        'openapi: "3.1.0"',
        "info:",
        "  title: Referenced API",
        '  version: "1.0.0"',
        "paths:",
        "  /pets:",
        "    $ref: ./paths/pets.yaml#/Pets",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(rootDir, "paths", "pets.yaml"),
      [
        "Pets:",
        "  get:",
        "    operationId: listPets",
        "    tags: [Pets]",
        "    responses:",
        '      "200":',
        "        $ref: ../responses.yaml#/PetList",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(rootDir, "responses.yaml"),
      [
        "PetList:",
        "  description: Pet list",
        "  content:",
        "    application/json:",
        "      schema:",
        "        $ref: '#/PetListSchema'",
        "      example:",
        "        - id: pet-1",
        "PetListSchema:",
        "  type: array",
        "  items:",
        "    type: object",
        "",
      ].join("\n"),
    );

    const config = defineDocs({
      entry: "docs",
      apiReference: { enabled: true, specUrl: "./openapi.yaml" },
    });
    const syncDocument = buildApiReferenceOpenApiDocument(config, {
      framework: "next",
      rootDir,
    });
    const asyncDocument = await buildApiReferenceOpenApiDocumentAsync(config, {
      framework: "astro",
      rootDir,
    });

    for (const document of [syncDocument, asyncDocument]) {
      expect(document).toHaveProperty(OPENAPI_BUNDLED_REFERENCES_EXTENSION);
      expect(JSON.stringify(document)).not.toContain("./paths/pets.yaml");
      expect(JSON.stringify(document)).not.toContain("../responses.yaml");
      expect(buildNormalizedOpenApiModel(document).operations[0]).toMatchObject({
        operationId: "listPets",
        selector: "GET /pets",
        tags: ["Pets"],
        responses: [
          {
            status: "200",
            content: [
              {
                mediaType: "application/json",
                examples: [{ value: [{ id: "pet-1" }] }],
              },
            ],
          },
        ],
      });
    }
  });

  it("caches repeated remote reference documents within a build", async () => {
    const fetchMock = vi.fn(async (input: URL | string) => {
      const url = String(input);
      if (url === "https://example.com/openapi.json") {
        return new Response(
          JSON.stringify({
            openapi: "3.1.0",
            info: { title: "Cached refs", version: "1" },
            paths: {
              "/pets": {
                get: {
                  operationId: "listPets",
                  responses: {
                    "200": {
                      description: "OK",
                      content: {
                        "application/json": {
                          schema: { $ref: "./schemas.json#/PetList" },
                          examples: { pet: { $ref: "./schemas.json#/PetExample" } },
                        },
                      },
                    },
                  },
                },
              },
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      if (url === "https://example.com/schemas.json") {
        return new Response(
          JSON.stringify({
            PetList: { type: "array", items: { type: "object" } },
            PetExample: { value: [{ id: "pet-1" }] },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const document = await buildApiReferenceOpenApiDocumentAsync(
      defineDocs({
        entry: "docs",
        apiReference: { enabled: true, specUrl: "https://example.com/openapi.json" },
      }),
      { framework: "next" },
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(buildNormalizedOpenApiModel(document).operations[0]?.examples).toEqual([
      expect.objectContaining({ name: "pet", value: [{ id: "pet-1" }] }),
    ]);
  });

  it("loads a hosted OpenAPI YAML document", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          [
            'openapi: "3.1.0"',
            "info:",
            "  title: Remote YAML",
            '  version: "2.0.0"',
            "paths:",
            "  /pets:",
            "    get:",
            "      responses:",
            '        "200":',
            "          description: OK",
            "",
          ].join("\n"),
          {
            status: 200,
            headers: { "Content-Type": "application/yaml" },
          },
        ),
      ),
    );

    const config = defineDocs({
      entry: "docs",
      apiReference: {
        enabled: true,
        specUrl: "https://example.com/openapi.yaml",
      },
    });
    const document = await buildApiReferenceOpenApiDocumentAsync(config, {
      framework: "sveltekit",
    });

    expect(document).toMatchObject({
      openapi: "3.1.0",
      info: { title: "Remote YAML", version: "2.0.0" },
      paths: { "/pets": { get: expect.any(Object) } },
    });
  });

  it("rejects unsupported OpenAPI versions and duplicate operation IDs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            openapi: "4.0.0",
            paths: {
              "/projects": { get: { operationId: "listResources" } },
              "/teams": { get: { operationId: "listResources" } },
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const document = await buildApiReferenceOpenApiDocumentAsync(
      defineDocs({
        entry: "docs",
        apiReference: { enabled: true, specUrl: "https://example.com/openapi.json" },
      }),
      { framework: "next" },
    );

    expect(document.info).toMatchObject({
      description: expect.stringContaining("OpenAPI 4.0.0 is not supported"),
    });
  });

  it("limits remote OpenAPI response size using declared and streamed bytes", async () => {
    const config = defineDocs({
      entry: "docs",
      apiReference: { enabled: true, specUrl: "https://example.com/openapi.json" },
    });
    const oversizedDescription = expect.stringContaining("exceeds the 5 MiB size limit");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("{}", {
          headers: { "Content-Length": String(OPENAPI_SPEC_MAX_BYTES + 1) },
        }),
      ),
    );
    const declared = await buildApiReferenceOpenApiDocumentAsync(config, { framework: "next" });
    expect(declared.info).toMatchObject({ description: oversizedDescription });

    const oversizedChunk = new Uint8Array(OPENAPI_SPEC_MAX_BYTES + 1);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(oversizedChunk);
              controller.close();
            },
          }),
        ),
      ),
    );
    const streamed = await buildApiReferenceOpenApiDocumentAsync(config, { framework: "next" });
    expect(streamed.info).toMatchObject({ description: oversizedDescription });
  });

  it("times out remote OpenAPI requests", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_input: URL | RequestInfo, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted")));
          }),
      ),
    );

    const promise = buildApiReferenceOpenApiDocumentAsync(
      defineDocs({
        entry: "docs",
        apiReference: { enabled: true, specUrl: "https://example.com/openapi.json" },
      }),
      { framework: "next" },
    );
    await vi.advanceTimersByTimeAsync(OPENAPI_SPEC_FETCH_TIMEOUT_MS);

    await expect(promise).resolves.toMatchObject({
      info: { description: expect.stringContaining("did not respond within 10 seconds") },
    });
  });

  it("keeps project-relative files inside the project root", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "docs-api-ref-boundary-"));
    tempDirs.push(workspace);
    const rootDir = join(workspace, "project");
    mkdirSync(rootDir);
    const externalPath = join(workspace, "external.json");
    writeFileSync(
      externalPath,
      JSON.stringify({ openapi: "3.1.0", info: { title: "External", version: "1" }, paths: {} }),
    );

    const relativeDocument = buildApiReferenceOpenApiDocument(
      defineDocs({
        entry: "docs",
        apiReference: { enabled: true, specUrl: "../external.json" },
      }),
      { framework: "next", rootDir },
    );
    expect(relativeDocument.info).toMatchObject({
      description: expect.stringContaining("must stay inside the project root"),
    });

    symlinkSync(externalPath, join(rootDir, "linked.json"));
    const linkedDocument = buildApiReferenceOpenApiDocument(
      defineDocs({
        entry: "docs",
        apiReference: { enabled: true, specUrl: "./linked.json" },
      }),
      { framework: "next", rootDir },
    );
    expect(linkedDocument.info).toMatchObject({
      description: expect.stringContaining("must stay inside the project root"),
    });

    const explicitDocument = await buildApiReferenceOpenApiDocumentAsync(
      defineDocs({
        entry: "docs",
        apiReference: { enabled: true, specUrl: pathToFileURL(externalPath).href },
      }),
      { framework: "next", rootDir },
    );
    expect(explicitDocument.info).toMatchObject({ title: "External", version: "1" });
  });

  it("keeps references from project-relative documents inside the project root", () => {
    const workspace = mkdtempSync(join(tmpdir(), "docs-api-ref-ref-boundary-"));
    tempDirs.push(workspace);
    const rootDir = join(workspace, "project");
    mkdirSync(rootDir);
    writeFileSync(
      join(rootDir, "openapi.yaml"),
      [
        'openapi: "3.1.0"',
        "info: { title: Boundary, version: '1' }",
        "paths: {}",
        "components:",
        "  schemas:",
        "    Secret:",
        "      $ref: ../external.yaml#/Secret",
        "",
      ].join("\n"),
    );
    writeFileSync(join(workspace, "external.yaml"), "Secret:\n  type: string\n");

    const document = buildApiReferenceOpenApiDocument(
      defineDocs({
        entry: "docs",
        apiReference: { enabled: true, specUrl: "./openapi.yaml" },
      }),
      { framework: "next", rootDir },
    );

    expect(document.info).toMatchObject({
      description: expect.stringContaining("must stay inside the project root"),
    });
  });

  it("does not let a remote reference chain read local files", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-api-ref-remote-file-"));
    tempDirs.push(rootDir);
    const secretPath = join(rootDir, "secret.yaml");
    writeFileSync(secretPath, "Secret:\n  type: string\n");
    writeFileSync(
      join(rootDir, "openapi.yaml"),
      [
        'openapi: "3.1.0"',
        "info: { title: Remote chain, version: '1' }",
        "paths: {}",
        "components:",
        "  schemas:",
        "    Secret:",
        "      $ref: https://example.com/schema.json#/Secret",
        "",
      ].join("\n"),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            Secret: { $ref: `${pathToFileURL(secretPath).href}#/Secret` },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const document = await buildApiReferenceOpenApiDocumentAsync(
      defineDocs({
        entry: "docs",
        apiReference: { enabled: true, specUrl: "./openapi.yaml" },
      }),
      { framework: "next", rootDir },
    );

    expect(document.info).toMatchObject({
      description: expect.stringContaining("cannot load local file references"),
    });
  });

  it("adds fallback tags to hosted OpenAPI operations when they are missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => createRemoteOpenApiResponse()),
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

    expect(document.tags).toEqual([
      {
        name: "Pets",
        description: "Pets endpoints",
      },
    ]);
    expect(document.paths).toMatchObject({
      "/pets": {
        get: {
          tags: ["Pets"],
        },
      },
    });
  });

  it("resolves request-relative spec URLs against the request origin", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: URL | string, _init?: RequestInit) => {
        expect(String(input)).toBe("https://example.com/api/openapi.json");
        return createRemoteOpenApiResponse();
      });
    vi.stubGlobal("fetch", fetchMock);

    const config = defineDocs({
      entry: "docs",
      apiReference: {
        enabled: true,
        specUrl: "/api/openapi.json",
      },
    });

    const document = await buildApiReferenceOpenApiDocumentAsync(config, {
      framework: "next",
      baseUrl: "https://example.com",
    });

    expect(document).toMatchObject({
      info: {
        title: "Remote Pets",
      },
      servers: [{ url: "https://example.com" }],
      paths: {
        "/pets": {
          get: expect.any(Object),
        },
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      redirect: "follow",
      signal: expect.any(AbortSignal),
    });
  });

  it("uses the provided request origin for generated local route references", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-api-ref-local-"));
    tempDirs.push(rootDir);

    const apiDir = join(rootDir, "app", "api", "checkout");
    mkdirSync(apiDir, { recursive: true });
    writeFileSync(
      join(apiDir, "route.ts"),
      [
        "/** Create a checkout session. */",
        "export async function POST() {",
        "  return Response.json({ ok: true });",
        "}",
        "",
      ].join("\n"),
      "utf-8",
    );

    const config = defineDocs({
      entry: "docs",
      apiReference: {
        enabled: true,
      },
    });

    const document = buildApiReferenceOpenApiDocument(config, {
      framework: "next",
      rootDir,
      baseUrl: "http://127.0.0.1:4041",
    });

    expect(document).toMatchObject({
      servers: [{ url: "http://127.0.0.1:4041" }],
      paths: {
        "/api/checkout": {
          post: expect.any(Object),
        },
      },
    });
  });

  it("renders hosted OpenAPI HTML for every framework", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => createRemoteOpenApiResponse()),
    );

    const config = defineDocs({
      entry: "docs",
      apiReference: {
        enabled: true,
        specUrl: "https://example.com/openapi.json",
      },
    });

    for (const framework of [
      "next",
      "tanstack-start",
      "farmjs",
      "sveltekit",
      "astro",
      "nuxt",
    ] as const) {
      const html = await buildApiReferenceHtmlDocumentAsync(config, {
        framework,
      });

      expect(html).toContain("Remote Pets");
      expect(html).toContain("/pets");
      expect(html).toContain('meta name="generator" content="@farming-labs/docs"');
      expect(html).toContain('id="fl-api-search"');
    }
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
    expect(css).toContain("--scalar-radius: 0px;");
    expect(css).toContain("--scalar-button-1-color: #0b0b0b;");
    expect(css).toContain("var(--scalar-theme-foreground) 10%");
  });
});

describe("buildApiReferenceOperationPagesAsync", () => {
  it("projects every configured API version into deterministic operation search pages", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-api-operation-pages-"));
    tempDirs.push(rootDir);
    for (const [version, summary] of [
      ["v1", "List legacy widgets"],
      ["v2", "List current widgets"],
    ] as const) {
      writeFileSync(
        join(rootDir, `${version}.yaml`),
        [
          'openapi: "3.1.0"',
          "info:",
          "  title: Widget API",
          `  version: "${version}"`,
          "servers:",
          "  - url: https://api.example.com",
          "paths:",
          "  /widgets:",
          "    get:",
          `      operationId: listWidgets${version.toUpperCase()}`,
          `      summary: ${summary}`,
          "      tags: [Widgets]",
          "      parameters:",
          "        - name: limit",
          "          in: query",
          "          schema: { type: integer }",
          "      responses:",
          '        "200":',
          "          description: Widget collection",
          "",
        ].join("\n"),
      );
    }

    const config = defineDocs({
      entry: "docs",
      apiReference: {
        path: "reference",
        versions: {
          v1: { specUrl: "./v1.yaml", label: "Version 1" },
          v2: { specUrl: "./v2.yaml", label: "Version 2" },
        },
        defaultVersion: "v2",
      },
    });
    const pages = await buildApiReferenceOperationPagesAsync(config, {
      framework: "astro",
      rootDir,
      baseUrl: "https://docs.example.com",
      locale: "fr",
    });

    expect(pages).toHaveLength(2);
    expect(pages[0]?.url).toMatch(/^\/reference\/v1\/operations\/list-widgets-v1-[a-z0-9]+$/);
    expect(pages[1]?.url).toMatch(/^\/reference\/v2\/operations\/list-widgets-v2-[a-z0-9]+$/);
    expect(pages[1]).toMatchObject({
      title: "List current widgets",
      canonicalUrl: pages[1]?.url,
      description: "List current widgets",
      type: "api",
      locale: "fr",
      version: "v2",
      tags: ["openapi", "get", "Widgets"],
    });
    expect(pages[1]?.content).toContain("`GET /widgets`");
    expect(pages[1]?.content).toContain("`limit` (query, optional");
    expect(pages[1]?.content).toContain("### 200");

    const operationUrl = pages[1]?.url;
    expect(operationUrl).toBeTruthy();
    const markdownResponse = await createApiReferenceOperationMarkdownResponse(config, {
      request: new Request(`https://docs.example.com${operationUrl}.md`),
      framework: "astro",
      rootDir,
      baseUrl: "https://docs.example.com",
      locale: "fr",
    });
    expect(markdownResponse?.status).toBe(200);
    expect(markdownResponse?.headers.get("content-type")).toContain("text/markdown");
    expect(markdownResponse?.headers.get("content-location")).toBe(
      `https://docs.example.com${operationUrl}.md`,
    );
    expect(markdownResponse?.headers.get("link")).toContain(
      `<https://docs.example.com${operationUrl}>; rel="canonical"`,
    );
    expect(markdownResponse?.headers.get("etag")).toBeTruthy();
    const markdown = await markdownResponse?.text();
    expect(markdown).toContain(`canonical_url: "https://docs.example.com${operationUrl}"`);
    expect(markdown).toContain(`markdown_url: "https://docs.example.com${operationUrl}.md"`);
    expect(markdown).toContain("`GET /widgets`");

    const sharedApiResponse = await createApiReferenceOperationMarkdownResponse(config, {
      request: new Request(
        `https://docs.example.com/api/docs?format=markdown&path=${encodeURIComponent(operationUrl ?? "")}`,
      ),
      framework: "astro",
      rootDir,
      baseUrl: "https://docs.example.com",
    });
    expect(sharedApiResponse?.status).toBe(200);

    await expect(
      createApiReferenceOperationMarkdownResponse(config, {
        request: new Request(`https://docs.example.com${operationUrl}`),
        framework: "astro",
        rootDir,
      }),
    ).resolves.toBeNull();
  });

  it("returns no projected pages when API reference is disabled", async () => {
    await expect(
      buildApiReferenceOperationPagesAsync(defineDocs({ entry: "docs", apiReference: false }), {
        framework: "next",
      }),
    ).resolves.toEqual([]);
  });
});

describe("resolveApiReferenceRenderer", () => {
  it("defaults to the Farming Labs renderer for every framework", () => {
    for (const framework of [
      "next",
      "tanstack-start",
      "farmjs",
      "sveltekit",
      "astro",
      "nuxt",
    ] as const) {
      expect(resolveApiReferenceRenderer(true, framework)).toBe("farming-labs");
    }
  });

  it("preserves explicit Scalar and Fumadocs renderer overrides", () => {
    expect(
      resolveApiReferenceRenderer(
        {
          enabled: true,
          renderer: "scalar",
        },
        "next",
      ),
    ).toBe("scalar");
    expect(
      resolveApiReferenceRenderer(
        {
          enabled: true,
          renderer: "fumadocs",
        },
        "next",
      ),
    ).toBe("fumadocs");
  });
});
