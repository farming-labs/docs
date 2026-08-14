import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  InMemoryTransport,
  ResourceTemplate,
  LATEST_PROTOCOL_VERSION,
} from "@modelcontextprotocol/server";
import { Client } from "@modelcontextprotocol/client";
import type {
  DocsAgentGoldenTask,
  DocsAnalyticsEvent,
  DocsMcpAuthenticateContext,
  DocsObservabilityEvent,
  DocsSearchAdapter,
  DocsSearchAdapterContext,
} from "./types.js";
import type {
  DocsMcpConfigSchemaOption,
  DocsMcpDocsList,
  DocsMcpDocsPageSummary,
  DocsMcpPage,
  DocsMcpResolvedConfig,
} from "./mcp.js";
import {
  DOCS_CONFIG_SCHEMA_OPTIONS,
  DOCS_MCP_CONTENT_CHANGES_CURRENT_URI,
  buildDocsMcpContext,
  createDocsMcpHttpHandler,
  createDocsMcpServer,
  createFilesystemDocsMcpSource,
  getDocsConfigSchema,
  normalizeDocsMcpRoute,
  resolveDocsMcpConfig,
} from "./mcp.js";
import { buildDocsMcpProtectedResourceMetadataRoute } from "./mcp-auth.js";

async function parseMcpPayload<T>(response: Response): Promise<T> {
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return JSON.parse(body) as T;
  }

  const dataLines = body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice("data: ".length).trim())
    .filter(Boolean);

  const payload = dataLines.at(-1);
  if (!payload) {
    throw new Error(`Expected MCP response payload, got: ${body}`);
  }

  return JSON.parse(payload) as T;
}

async function callMcpTool(
  handlers: ReturnType<typeof createDocsMcpHttpHandler>,
  name: string,
  args: Record<string, unknown>,
  requestUrl = "http://localhost/api/docs/mcp",
) {
  return handlers.POST({
    request: new Request(requestUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        "mcp-session-id": "stale-session",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `call-${name}`,
        method: "tools/call",
        params: { name, arguments: args },
      }),
    }),
  });
}

async function callMcpMethod(
  handlers: ReturnType<typeof createDocsMcpHttpHandler>,
  method: string,
  params: Record<string, unknown> = {},
) {
  return handlers.POST({
    request: new Request("http://localhost/api/docs/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: `call-${method}`, method, params }),
    }),
  });
}

const MCP_2026_PROTOCOL_VERSION = "2026-07-28";

async function callModernMcpMethod(
  handlers: ReturnType<typeof createDocsMcpHttpHandler>,
  method: string,
  params: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return handlers.POST({
    request: new Request("http://localhost/api/docs/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-method": method,
        ...(typeof params.name === "string"
          ? { "mcp-name": params.name }
          : typeof params.uri === "string"
            ? { "mcp-name": params.uri }
            : {}),
        "mcp-protocol-version": MCP_2026_PROTOCOL_VERSION,
        ...headers,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `call-modern-${method}`,
        method,
        params: {
          ...params,
          _meta: {
            "io.modelcontextprotocol/protocolVersion": MCP_2026_PROTOCOL_VERSION,
            "io.modelcontextprotocol/clientInfo": {
              name: "cache-hints-test",
              version: "1.0.0",
            },
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      }),
    }),
  });
}

function expectSuccessfulStructuredTextResult(payload: {
  result?: {
    content?: Array<{ text?: string }>;
    structuredContent?: unknown;
    isError?: boolean;
  };
}) {
  expect(payload.result?.isError).not.toBe(true);
  expect(payload.result?.structuredContent).toEqual(expect.any(Object));
  expect(payload.result?.content?.[0]?.text?.trim().length).toBeGreaterThan(0);
}

const DEFAULT_RESOLVED_MCP_CORS = {
  enabled: true,
  allowedHeaders: [
    "Accept",
    "Authorization",
    "Content-Type",
    "Last-Event-ID",
    "MCP-Method",
    "MCP-Name",
    "MCP-Protocol-Version",
    "MCP-Session-Id",
  ],
  exposedHeaders: ["MCP-Protocol-Version", "MCP-Session-Id", "WWW-Authenticate"],
  allowCredentials: false,
  maxAgeSeconds: 600,
};

const DEFAULT_RESOLVED_MCP_PROMPTS = {
  enabled: true,
  contracts: true,
  goldenTasks: [],
};

describe("resolveDocsMcpConfig", () => {
  it("keeps the new task metadata fields additive for existing consumers", () => {
    const legacySummary: DocsMcpDocsPageSummary = {
      slug: "overview",
      url: "/docs/overview",
      title: "Overview",
    };
    const legacyResolvedConfig: DocsMcpResolvedConfig = {
      enabled: true,
      route: "/api/docs/mcp",
      name: "docs",
      version: "1.0.0",
      tools: {
        listDocs: true,
        listPages: true,
        readPage: true,
        searchDocs: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
        getContext: true,
      },
    };

    expect(legacySummary.agent).toBeUndefined();
    expect(legacyResolvedConfig.tools.listTasks).toBeUndefined();
    expect(resolveDocsMcpConfig().tools).toMatchObject({ listTasks: true, readTask: true });
  });

  it("enables MCP by default when config is omitted", () => {
    expect(resolveDocsMcpConfig()).toEqual({
      enabled: true,
      route: "/api/docs/mcp",
      name: "@farming-labs/docs",
      version: "0.0.0",
      tools: {
        listDocs: true,
        listPages: true,
        listPageSections: true,
        readPage: true,
        readPages: true,
        submitFeedback: true,
        listTasks: true,
        readTask: true,
        searchDocs: true,
        searchFacets: true,
        listContentChanges: true,
        hydrateContentChanges: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
        getContext: true,
        getTrustMetadata: true,
      },
      prompts: DEFAULT_RESOLVED_MCP_PROMPTS,
      security: {
        allowedOrigins: "same-origin",
        authenticate: undefined,
        protectedResource: undefined,
        maxBodyBytes: 1_048_576,
        cors: DEFAULT_RESOLVED_MCP_CORS,
      },
    });
  });

  it("treats null config like an omitted config", () => {
    expect(resolveDocsMcpConfig(null as never)).toEqual({
      enabled: true,
      route: "/api/docs/mcp",
      name: "@farming-labs/docs",
      version: "0.0.0",
      tools: {
        listDocs: true,
        listPages: true,
        listPageSections: true,
        readPage: true,
        readPages: true,
        submitFeedback: true,
        listTasks: true,
        readTask: true,
        searchDocs: true,
        searchFacets: true,
        listContentChanges: true,
        hydrateContentChanges: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
        getContext: true,
        getTrustMetadata: true,
      },
      prompts: DEFAULT_RESOLVED_MCP_PROMPTS,
      security: {
        allowedOrigins: "same-origin",
        authenticate: undefined,
        protectedResource: undefined,
        maxBodyBytes: 1_048_576,
        cors: DEFAULT_RESOLVED_MCP_CORS,
      },
    });
  });

  it("normalizes defaults for enabled object configs", () => {
    expect(
      resolveDocsMcpConfig({
        enabled: true,
      }),
    ).toEqual({
      enabled: true,
      route: "/api/docs/mcp",
      name: "@farming-labs/docs",
      version: "0.0.0",
      tools: {
        listDocs: true,
        listPages: true,
        listPageSections: true,
        readPage: true,
        readPages: true,
        submitFeedback: true,
        listTasks: true,
        readTask: true,
        searchDocs: true,
        searchFacets: true,
        listContentChanges: true,
        hydrateContentChanges: true,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: true,
        getContext: true,
        getTrustMetadata: true,
      },
      prompts: DEFAULT_RESOLVED_MCP_PROMPTS,
      security: {
        allowedOrigins: "same-origin",
        authenticate: undefined,
        protectedResource: undefined,
        maxBodyBytes: 1_048_576,
        cors: DEFAULT_RESOLVED_MCP_CORS,
      },
    });
  });

  it("resolves contract and golden-task prompt selection independently", () => {
    expect(
      resolveDocsMcpConfig({
        prompts: {
          contracts: [" /docs/install ", "/docs/install", "/docs/configuration"],
          goldenTasks: [" install-next ", "install-next", "create-theme"],
        },
      }).prompts,
    ).toEqual({
      enabled: true,
      contracts: ["/docs/install", "/docs/configuration"],
      goldenTasks: ["install-next", "create-theme"],
    });
    expect(resolveDocsMcpConfig({ prompts: false }).prompts).toEqual({
      enabled: false,
      contracts: false,
      goldenTasks: [],
    });
    expect(() => resolveDocsMcpConfig({ prompts: { goldenTasks: ["valid", ""] } })).toThrow(
      /mcp\.prompts\.goldenTasks/,
    );
  });

  it("publishes built-in prompt controls in the config schema", () => {
    expect(getDocsConfigSchema({ option: "mcp.prompts" })).toMatchObject({
      resultCount: 3,
      options: [
        {
          path: "mcp.prompts",
          type: "boolean | DocsMcpPromptsConfig",
          children: [
            { path: "mcp.prompts.contracts", type: "boolean | string[]" },
            { path: "mcp.prompts.goldenTasks", type: "string[]" },
          ],
        },
      ],
    });
  });

  it("publishes the list_page_sections tool toggle in the config schema", () => {
    expect(getDocsConfigSchema({ option: "mcp.tools.listPageSections" })).toMatchObject({
      resultCount: 1,
      options: [
        {
          path: "mcp.tools.listPageSections",
          name: "listPageSections",
          type: "boolean",
          default: true,
          description: expect.stringContaining("list_page_sections"),
        },
      ],
    });
  });

  it("publishes the list_search_facets tool toggle in the config schema", () => {
    expect(getDocsConfigSchema({ option: "mcp.tools.searchFacets" })).toMatchObject({
      resultCount: 1,
      options: [
        {
          path: "mcp.tools.searchFacets",
          name: "searchFacets",
          type: "boolean",
          default: true,
          description: expect.stringContaining("list_search_facets"),
        },
      ],
    });
  });

  it("publishes the list_content_changes tool toggle in the config schema", () => {
    expect(getDocsConfigSchema({ option: "mcp.tools.listContentChanges" })).toMatchObject({
      resultCount: 1,
      options: [
        {
          path: "mcp.tools.listContentChanges",
          name: "listContentChanges",
          type: "boolean",
          default: true,
          description: expect.stringContaining("list_content_changes"),
        },
      ],
    });
  });

  it("publishes and resolves the hydrate_content_changes tool toggle", () => {
    expect(getDocsConfigSchema({ option: "mcp.tools.hydrateContentChanges" })).toMatchObject({
      resultCount: 1,
      options: [
        {
          path: "mcp.tools.hydrateContentChanges",
          name: "hydrateContentChanges",
          type: "boolean",
          default: true,
          description: expect.stringContaining("hydrate_content_changes"),
        },
      ],
    });
    expect(
      resolveDocsMcpConfig({ tools: { hydrateContentChanges: false } }).tools.hydrateContentChanges,
    ).toBe(false);
  });

  it("resolves custom HTTP security without enabling authentication by default", () => {
    const authenticate = async () => ({ id: "docs-user" });

    expect(
      resolveDocsMcpConfig({
        security: {
          allowedOrigins: ["https://app.example.com"],
          authenticate,
          maxBodyBytes: 4096.9,
        },
      }).security,
    ).toEqual({
      allowedOrigins: ["https://app.example.com"],
      authenticate,
      protectedResource: undefined,
      maxBodyBytes: 4096,
      cors: DEFAULT_RESOLVED_MCP_CORS,
    });

    expect(resolveDocsMcpConfig({ security: { maxBodyBytes: 0 } }).security).toMatchObject({
      allowedOrigins: "same-origin",
      authenticate: undefined,
      protectedResource: undefined,
      maxBodyBytes: 1_048_576,
      cors: DEFAULT_RESOLVED_MCP_CORS,
    });

    expect(
      resolveDocsMcpConfig({
        security: {
          cors: {
            allowedHeaders: ["X-API-Key", "content-type", "bad\nheader"],
            exposedHeaders: ["X-Docs-Version"],
            allowCredentials: true,
            maxAgeSeconds: 12.9,
          },
        },
      }).security?.cors,
    ).toMatchObject({
      enabled: true,
      allowedHeaders: expect.arrayContaining(["Content-Type", "X-API-Key"]),
      exposedHeaders: expect.arrayContaining(["MCP-Session-Id", "X-Docs-Version"]),
      allowCredentials: true,
      maxAgeSeconds: 12,
    });
    expect(resolveDocsMcpConfig({ security: { cors: false } }).security?.cors.enabled).toBe(false);
  });

  it("normalizes RFC 9728 protected-resource configuration", () => {
    const resolved = resolveDocsMcpConfig({
      security: {
        protectedResource: {
          authorizationServers: [
            " https://auth.example.com ",
            "https://auth.example.com",
            "http://localhost:4100",
          ],
          scopesSupported: ["docs:read", "docs:read"],
          requiredScopes: ["docs:read", " docs:write "],
          resourceName: " Product docs ",
          resourceDocumentation: " https://docs.example.com/auth ",
        },
      },
    }).security?.protectedResource;

    expect(resolved).toEqual({
      authorizationServers: ["https://auth.example.com", "http://localhost:4100"],
      scopesSupported: ["docs:read"],
      requiredScopes: ["docs:read", "docs:write"],
      resourceName: "Product docs",
      resourceDocumentation: "https://docs.example.com/auth",
    });
  });

  it("rejects invalid OAuth protected-resource configuration instead of weakening auth", () => {
    for (const authorizationServers of [
      [],
      ["http://auth.example.com"],
      ["/relative-issuer"],
      ["https://auth.example.com/?tenant=one"],
      ["https://auth.example.com/#fragment"],
      ["https://user@auth.example.com"],
    ]) {
      expect(() =>
        resolveDocsMcpConfig({
          security: { protectedResource: { authorizationServers } },
        }),
      ).toThrow(/authorizationServers/);
    }
    expect(() =>
      resolveDocsMcpConfig({
        security: {
          protectedResource: {
            authorizationServers: ["https://auth.example.com"],
            requiredScopes: ["docs:read write"],
          },
        },
      }),
    ).toThrow(/requiredScopes/);
    expect(() =>
      resolveDocsMcpConfig({
        security: {
          protectedResource: {
            authorizationServers: ["https://auth.example.com"],
            resourceDocumentation: "/auth/mcp",
          },
        },
      }),
    ).toThrow(/resourceDocumentation/);
  });

  it("normalizes custom routes", () => {
    expect(normalizeDocsMcpRoute("api/internal/docs/mcp/")).toBe("/api/internal/docs/mcp");
    expect(buildDocsMcpProtectedResourceMetadataRoute("/")).toBe(
      "/.well-known/oauth-protected-resource",
    );
    expect(buildDocsMcpProtectedResourceMetadataRoute("/mcp/")).toBe(
      "/.well-known/oauth-protected-resource/mcp/",
    );
  });
});

describe("P1 trust and OpenAPI tools", () => {
  it("publishes OKF trust and executes only allowlisted OpenAPI operations", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(String(input)).toBe("https://api.example.com/v1/users/42?expand=teams");
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer server-secret");
      return Response.json({ id: 42, name: "Ada" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const server = await createDocsMcpServer({
      source: {
        entry: "docs",
        siteTitle: "Trust Docs",
        getPages: () => [
          {
            slug: "install",
            url: "/docs/install",
            title: "Install",
            content: "Install content",
            lastmod: "2026-01-01",
            okf: {
              verified: [{ by: "human:docs-team", at: "2026-01-02" }],
            },
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
      okf: { staleAfterDays: 30 },
      openapi: {
        config: {
          enabled: true,
          operations: ["getUser"],
          headers: { Authorization: "Bearer server-secret" },
          resolveHost: async () => ["93.184.216.34"],
        },
        document: {
          openapi: "3.1.0",
          servers: [{ url: "https://api.example.com/v1" }],
          paths: {
            "/users/{id}": {
              get: {
                operationId: "getUser",
                parameters: [
                  { name: "id", in: "path", required: true },
                  { name: "expand", in: "query" },
                ],
              },
            },
          },
        },
      },
    });
    const client = new Client({ name: "p1-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(["get_trust_metadata", "api_getUser"]),
      );
      const trust = await client.callTool({
        name: "get_trust_metadata",
        arguments: { path: "install" },
      });
      expect(JSON.stringify(trust)).toContain('"trust_tier":"human-reviewed"');

      const result = await client.callTool({
        name: "api_getUser",
        arguments: { parameters: { id: 42, expand: "teams" } },
      });
      expect(JSON.stringify(result)).toContain('"name":"Ada"');
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      await client.close();
      await server.close();
      vi.unstubAllGlobals();
    }
  });
});

describe("page access policies", () => {
  const source = {
    getPages: () => [
      { slug: "public", url: "/docs/public", title: "Public", content: "Public content" },
      {
        slug: "private",
        url: "/docs/private",
        title: "Private",
        content: "Private MCP sentinel",
        agent: { access: { scopes: ["docs:private"] } },
      },
    ],
    getNavigation: () => ({
      name: "Docs",
      children: [
        { type: "page" as const, name: "Public", url: "/docs/public" },
        { type: "page" as const, name: "Private", url: "/docs/private" },
      ],
    }),
  };

  it.each([
    ["public", undefined, ["/docs/public"]],
    [
      "authorized",
      { transport: "http" as const, auth: { id: "agent", scopes: ["docs:private"] } },
      ["/docs/private", "/docs/public"],
    ],
  ])("filters MCP pages and navigation for %s requests", async (_label, requestContext, urls) => {
    const server = await createDocsMcpServer({ source, requestContext });
    const client = new Client({ name: "access-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const listed = await client.callTool({ name: "list_pages", arguments: {} });
      const navigation = await client.callTool({ name: "get_navigation", arguments: {} });
      expect(JSON.stringify(listed)).not.toContain("Private MCP sentinel");
      const listedUrls = JSON.stringify(listed).match(/\/docs\/(?:private|public)/g) ?? [];
      expect([...new Set(listedUrls)].sort()).toEqual(urls);
      expect(JSON.stringify(navigation).includes("/docs/private")).toBe(
        requestContext !== undefined,
      );
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe("MCP contract prompts", () => {
  const contractPage: DocsMcpPage = {
    slug: "installation",
    url: "/docs/installation",
    title: "Install the docs framework",
    description: "Install Farming Labs Docs in a supported application.",
    content:
      "# Installation\n\nFull installation details that are not part of the compact contract.",
    agent: {
      task: "Install Farming Labs Docs in an existing application.",
      outcome: "The selected framework serves a working docs route.",
      appliesTo: {
        framework: ["nextjs", "astro"],
        version: ">=0.2.60",
        package: ["@farming-labs/next", "@farming-labs/astro"],
      },
      prerequisites: ["Start in an existing supported application."],
      commands: [{ run: "pnpm dlx @farming-labs/docs init" }],
      verification: [{ run: "pnpm exec docs doctor --agent", expect: "No hard failures." }],
      rollback: ["Restore the package manifest and generated routes."],
      failureModes: [{ symptom: "The docs route returns 404.", resolution: "Check routing." }],
    },
  };
  const goldenTask: DocsAgentGoldenTask = {
    id: "install-existing-nextjs",
    query: "Install the docs framework in an existing Next.js application",
    filters: { framework: "nextjs", version: "16" },
    tokenBudget: 2_000,
    expect: {
      relevantSources: ["/docs/installation#secret-evaluator-source"],
      forbiddenSources: ["https://poison.example.test/result"],
      safety: {
        promptInjection: {
          markers: ["EVALUATOR_ONLY_CANARY"],
        },
      },
    },
  };

  function createPromptSource() {
    return {
      entry: "docs",
      siteTitle: "Prompt Test Docs",
      getPages: () => [contractPage],
      getNavigation: () => ({ name: "Docs", children: [] }),
    };
  }

  const promptConfig = {
    enabled: true,
    name: "Prompt Test Docs",
    prompts: {
      contracts: ["/docs/installation"],
      goldenTasks: [goldenTask.id],
    },
  } as const;

  it("lists and gets validated contract and expectation-blind golden prompts", async () => {
    const server = await createDocsMcpServer({
      source: createPromptSource(),
      mcp: promptConfig,
      evaluations: { tasks: [goldenTask] },
    });
    const client = new Client({ name: "prompt-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      expect(client.getServerCapabilities()?.prompts).toEqual({ listChanged: false });
      const listed = await client.listPrompts();
      expect(listed.prompts.map((prompt) => prompt.name)).toEqual([
        "contract-docs-installation",
        "golden-install-existing-nextjs",
      ]);
      expect(
        listed.prompts.find((prompt) => prompt.name === "contract-docs-installation"),
      ).toMatchObject({
        title: "Install the docs framework",
        arguments: expect.arrayContaining([
          expect.objectContaining({ name: "framework", required: true }),
          expect.objectContaining({ name: "request", required: false }),
        ]),
      });

      await expect(
        client.getPrompt({ name: "contract-docs-installation", arguments: {} }),
      ).rejects.toThrow(/framework|required/i);

      const contract = await client.getPrompt({
        name: "contract-docs-installation",
        arguments: {
          framework: "nextjs",
          version: "16",
          package: "@farming-labs/next",
          request: "Use pnpm and preserve the existing application routes.",
        },
      });
      const contractPayload = JSON.stringify(contract);
      expect(contractPayload).toContain("Target framework: nextjs");
      expect(contractPayload).toContain("## Agent Contract");
      expect(contractPayload).toContain("docs://docs/installation");
      expect(contractPayload).not.toContain("Full installation details");

      const golden = await client.getPrompt({
        name: "golden-install-existing-nextjs",
        arguments: { request: "Keep the current package manager." },
      });
      const goldenPayload = JSON.stringify(golden);
      expect(goldenPayload).toContain(goldenTask.query);
      expect(goldenPayload).toContain('\\"framework\\":\\"nextjs\\"');
      expect(goldenPayload).toContain("Context token budget: 2000");
      expect(goldenPayload).not.toContain("secret-evaluator-source");
      expect(goldenPayload).not.toContain("poison.example.test");
      expect(goldenPayload).not.toContain("EVALUATOR_ONLY_CANARY");
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("serves prompt discovery and retrieval through the 2026-07-28 stateless protocol", async () => {
    const handlers = createDocsMcpHttpHandler({
      source: createPromptSource(),
      mcp: promptConfig,
      evaluations: { tasks: [goldenTask] },
    });

    try {
      const listResponse = await callModernMcpMethod(handlers, "prompts/list");
      expect(listResponse.status).toBe(200);
      const listPayload = await parseMcpPayload<{
        result?: { prompts?: Array<{ name: string }> };
      }>(listResponse);
      expect(listPayload.result?.prompts?.map((prompt) => prompt.name)).toEqual([
        "contract-docs-installation",
        "golden-install-existing-nextjs",
      ]);

      const getResponse = await callModernMcpMethod(handlers, "prompts/get", {
        name: "contract-docs-installation",
        arguments: { framework: "astro" },
      });
      expect(getResponse.status).toBe(200);
      const getPayload = await parseMcpPayload<{ result?: { messages?: unknown[] } }>(getResponse);
      expect(getPayload.result?.messages).toHaveLength(2);
      expect(JSON.stringify(getPayload)).toContain("Target framework: astro");
    } finally {
      await handlers.close?.();
    }
  });

  it("rejects stale contract and golden-task selectors during server creation", async () => {
    await expect(
      createDocsMcpServer({
        source: createPromptSource(),
        mcp: { prompts: { contracts: ["/docs/missing"] } },
      }),
    ).rejects.toThrow(/no docs page matches/i);
    await expect(
      createDocsMcpServer({
        source: createPromptSource(),
        mcp: { prompts: { contracts: false, goldenTasks: ["missing-task"] } },
        evaluations: { tasks: [goldenTask] },
      }),
    ).rejects.toThrow(/no configured golden task/i);
  });
});

describe("agent-ready MCP write and batch tools", () => {
  const source = {
    entry: "docs",
    siteTitle: "Batch Docs",
    getPages: () => [
      {
        slug: "first",
        url: "/docs/first",
        title: "First",
        content: "# First\n\nFirst page content.",
      },
      {
        slug: "second",
        url: "/docs/second",
        title: "Second",
        content: "# Second\n\nSecond page content.",
      },
    ],
    getNavigation: () => ({ name: "Docs", children: [] }),
  };

  it("reads several pages under one shared token budget", async () => {
    const server = await createDocsMcpServer({ source });
    const client = new Client({ name: "batch-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("read_pages");
      const result = await client.callTool({
        name: "read_pages",
        arguments: {
          paths: ["first", "/docs/second", "missing"],
          tokenBudget: 256,
        },
      });
      expect(result.structuredContent).toMatchObject({
        format: "docs-read-pages.v1",
        requestedCount: 3,
        resultCount: 2,
        errors: [{ path: "missing", error: expect.stringContaining("No docs page matched") }],
        pages: [
          { requestedPath: "first", document: expect.stringContaining("First page content") },
          {
            requestedPath: "/docs/second",
            document: expect.stringContaining("Second page content"),
          },
        ],
      });
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("validates submit_feedback with the configured schema before delivery", async () => {
    const onFeedback = vi.fn();
    const server = await createDocsMcpServer({
      source,
      feedback: {
        agent: {
          schema: {
            type: "object",
            properties: { outcome: { type: "string" } },
            required: ["outcome"],
            additionalProperties: false,
          },
          onFeedback,
        },
      },
    });
    const client = new Client({ name: "feedback-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const tools = await client.listTools();
      expect(tools.tools.map((tool) => tool.name)).toContain("submit_feedback");
      const invalid = await client.callTool({
        name: "submit_feedback",
        arguments: { payload: {} },
      });
      expect(invalid.isError).toBe(true);
      expect(onFeedback).not.toHaveBeenCalled();

      const valid = await client.callTool({
        name: "submit_feedback",
        arguments: {
          context: { page: "/docs/first" },
          payload: { outcome: "The example was useful." },
        },
      });
      expect(valid.structuredContent).toEqual({
        accepted: true,
        message: "Feedback accepted.",
      });
      expect(onFeedback).toHaveBeenCalledWith({
        context: { page: "/docs/first", source: "mcp" },
        payload: { outcome: "The example was useful." },
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe("MCP cursor pagination", () => {
  it("keeps legacy DocsMcpDocsList object producers source-compatible", () => {
    const legacyList: DocsMcpDocsList = {
      resultCount: 0,
      sectionCount: 0,
      pages: [],
      rootPages: [],
      sections: [],
    };

    expect(legacyList.total).toBeUndefined();
    expect(legacyList.hasMore).toBeUndefined();
  });

  type ProtocolPaginationMeta = {
    "dev.farming-labs/pagination"?: {
      hasMore?: boolean;
      total?: number;
    };
  };

  type ProtocolListResult<T, K extends string> = {
    [Key in K]?: T[];
  } & {
    nextCursor?: string;
    _meta?: ProtocolPaginationMeta;
  };

  type ToolPaginationResult<T, K extends string> = {
    [Key in K]?: T[];
  } & {
    resultCount?: number;
    total?: number;
    hasMore?: boolean;
    nextCursor?: string;
  };

  type ProtocolCacheableResult = {
    resultType?: "complete" | "input_required";
    ttlMs?: number;
    cacheScope?: "public" | "private";
    nextCursor?: string;
  };

  async function readStructuredToolResult<T>(response: Response): Promise<{
    result?: {
      structuredContent?: T;
      content?: Array<{ text?: string }>;
      isError?: boolean;
    };
  }> {
    return parseMcpPayload(response);
  }

  function createPaginationPages(count: number): DocsMcpPage[] {
    return Array.from({ length: count }, (_, index) => {
      const number = String(index + 1).padStart(3, "0");
      const rawContent = `# MCP pagination page ${number}

Shared MCP cursor marker ${number}.
`;
      return {
        slug: `guides/page-${number}`,
        url: `/docs/guides/page-${number}`,
        title: `MCP pagination page ${number}`,
        description: `Cursor pagination fixture ${number}.`,
        content: `Shared MCP cursor marker ${number}.`,
        rawContent,
        framework: "nextjs",
        tags: ["pagination"],
        agent: {
          task: `Run pagination contract ${number}`,
          outcome: `Pagination contract ${number} is complete.`,
          appliesTo: {
            framework: ["nextjs"],
            package: ["@farming-labs/docs"],
          },
        },
      };
    });
  }

  it("emits useful public cache hints for completed discovery, every list page, and resource reads", async () => {
    const handlers = createDocsMcpHttpHandler({
      source: {
        getPages: () => createPaginationPages(25),
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });

    const expectCacheHint = (
      result: ProtocolCacheableResult | undefined,
      ttlMs: number,
      cacheScope: "public" | "private" = "public",
    ) => {
      expect(result).toMatchObject({
        resultType: "complete",
        ttlMs,
        cacheScope,
      });
    };

    try {
      const discovery = await parseMcpPayload<{ result?: ProtocolCacheableResult }>(
        await callModernMcpMethod(handlers, "server/discover"),
      );
      expectCacheHint(discovery.result, 300_000);

      for (const method of ["tools/list", "resources/list", "prompts/list"] as const) {
        let cursor: string | undefined;
        let pageCount = 0;
        do {
          const page = await parseMcpPayload<{ result?: ProtocolCacheableResult }>(
            await callModernMcpMethod(handlers, method, cursor ? { cursor } : {}),
          );
          expectCacheHint(page.result, 300_000);
          cursor = page.result?.nextCursor;
          pageCount += 1;
        } while (cursor);
        expect(pageCount).toBeGreaterThan(1);
      }

      const templates = await parseMcpPayload<{ result?: ProtocolCacheableResult }>(
        await callModernMcpMethod(handlers, "resources/templates/list"),
      );
      expectCacheHint(templates.result, 300_000);

      const read = await parseMcpPayload<{ result?: ProtocolCacheableResult }>(
        await callModernMcpMethod(handlers, "resources/read", {
          uri: "docs://navigation",
        }),
      );
      expectCacheHint(read.result, 60_000);

      const legacy = await parseMcpPayload<{ result?: ProtocolCacheableResult }>(
        await callMcpMethod(handlers, "resources/read", {
          uri: "docs://navigation",
        }),
      );
      expect(legacy.result).not.toHaveProperty("ttlMs");
      expect(legacy.result).not.toHaveProperty("cacheScope");
    } finally {
      await handlers.close?.();
    }
  });

  it("keeps cacheable MCP results private when their source is authentication-dependent", async () => {
    const handlers = createDocsMcpHttpHandler({
      source: {
        getPages: (_locale, context) => [
          {
            slug: "private",
            url: "/docs/private",
            title: `Private docs for ${context?.auth?.id ?? "anonymous"}`,
            content: "Authenticated documentation.",
            agent: {
              task: "Read authenticated documentation.",
              outcome: "The authenticated caller receives its scoped documentation.",
            },
          },
        ],
        getNavigation: (_locale, context) => ({
          name: `Private docs for ${context?.auth?.id ?? "anonymous"}`,
          children: [],
        }),
      },
      mcp: {
        security: {
          authenticate: async () => ({ id: "agent-123" }),
        },
      },
    });
    const authHeaders = { authorization: "Bearer private-token" };

    try {
      const cases: Array<{
        method: string;
        params?: Record<string, unknown>;
        ttlMs: number;
      }> = [
        { method: "server/discover", ttlMs: 300_000 },
        { method: "tools/list", ttlMs: 300_000 },
        { method: "prompts/list", ttlMs: 300_000 },
        { method: "resources/list", ttlMs: 300_000 },
        { method: "resources/templates/list", ttlMs: 300_000 },
        {
          method: "resources/read",
          params: { uri: "docs://navigation" },
          ttlMs: 60_000,
        },
      ];

      for (const testCase of cases) {
        const payload = await parseMcpPayload<{ result?: ProtocolCacheableResult }>(
          await callModernMcpMethod(handlers, testCase.method, testCase.params, authHeaders),
        );
        expect(payload.result).toMatchObject({
          resultType: "complete",
          ttlMs: testCase.ttlMs,
          cacheScope: "private",
        });
      }
    } finally {
      await handlers.close?.();
    }
  });

  it("paginates MCP protocol resources and tools with stable standard cursors", async () => {
    const pages = createPaginationPages(105);
    const source = {
      getPages: () => pages,
      getNavigation: () => ({ name: "Docs", children: [] }),
    };
    const handlers = createDocsMcpHttpHandler({ source });

    async function listResources(cursor?: string) {
      return parseMcpPayload<{
        result?: ProtocolListResult<{ uri: string }, "resources">;
        error?: { code?: number; message?: string };
      }>(await callMcpMethod(handlers, "resources/list", cursor ? { cursor } : {}));
    }

    const firstResources = await listResources();
    const repeatedResources = await listResources();
    expect(firstResources.result?.resources).toHaveLength(10);
    expect(firstResources.result?.nextCursor).toEqual(expect.any(String));
    expect(repeatedResources.result?.nextCursor).toBe(firstResources.result?.nextCursor);
    expect(repeatedResources.result?.resources).toEqual(firstResources.result?.resources);
    expect(firstResources.result?._meta).toEqual({
      "dev.farming-labs/pagination": {
        hasMore: true,
        total: 108,
      },
    });

    const resourcePages = [firstResources.result];
    while (resourcePages.at(-1)?.nextCursor) {
      const response = await listResources(resourcePages.at(-1)?.nextCursor);
      expect(response.error).toBeUndefined();
      resourcePages.push(response.result);
    }
    const resourceUris = resourcePages.flatMap(
      (page) => page?.resources?.map((resource) => resource.uri) ?? [],
    );
    expect(resourcePages.map((page) => page?.resources?.length)).toEqual([
      10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 8,
    ]);
    expect(resourcePages.at(-1)?._meta).toEqual({
      "dev.farming-labs/pagination": {
        hasMore: false,
        total: 108,
      },
    });
    expect(new Set(resourceUris).size).toBe(resourceUris.length);
    expect(resourceUris).toHaveLength(108);
    expect(resourceUris).toEqual(
      [...resourceUris].sort((left, right) => left.localeCompare(right)),
    );

    async function listTools(cursor?: string) {
      return parseMcpPayload<{
        result?: ProtocolListResult<{ name: string }, "tools">;
        error?: { code?: number; message?: string };
      }>(await callMcpMethod(handlers, "tools/list", cursor ? { cursor } : {}));
    }

    const firstTools = await listTools();
    const repeatedTools = await listTools();
    expect(firstTools.result?.nextCursor).toEqual(expect.any(String));
    expect(repeatedTools.result?.nextCursor).toBe(firstTools.result?.nextCursor);
    expect(repeatedTools.result?.tools).toEqual(firstTools.result?.tools);

    const toolPages = [firstTools.result];
    while (toolPages.at(-1)?.nextCursor) {
      const response = await listTools(toolPages.at(-1)?.nextCursor);
      expect(response.error).toBeUndefined();
      toolPages.push(response.result);
    }
    const toolNames = toolPages.flatMap((page) => page?.tools?.map((tool) => tool.name) ?? []);
    const toolMeta = toolPages.at(-1)?._meta?.["dev.farming-labs/pagination"];
    expect(toolPages.length).toBeGreaterThan(1);
    expect(toolMeta).toEqual({
      hasMore: false,
      total: toolNames.length,
    });
    expect(new Set(toolNames).size).toBe(toolNames.length);
    expect(toolNames).toEqual([...toolNames].sort((left, right) => left.localeCompare(right)));
    expect(toolNames).toEqual(
      expect.arrayContaining([
        "list_docs",
        "list_pages",
        "list_page_sections",
        "list_tasks",
        "search_docs",
      ]),
    );

    const malformed = await parseMcpPayload<{
      error?: { code?: number; message?: string };
    }>(await callMcpMethod(handlers, "resources/list", { cursor: "not-a-valid-cursor" }));
    expect(malformed.error).toMatchObject({
      code: -32602,
      message: expect.stringContaining("Invalid or stale pagination cursor"),
    });

    const wrongOperation = await parseMcpPayload<{
      error?: { code?: number; message?: string };
    }>(
      await callMcpMethod(handlers, "tools/list", {
        cursor: firstResources.result?.nextCursor,
      }),
    );
    expect(wrongOperation.error).toMatchObject({
      code: -32602,
      message: expect.stringContaining("Invalid or stale pagination cursor"),
    });

    pages.push(...createPaginationPages(1).map((page) => ({ ...page, url: "/docs/new-page" })));
    const stale = await parseMcpPayload<{
      error?: { code?: number; message?: string };
    }>(
      await callMcpMethod(handlers, "resources/list", {
        cursor: firstResources.result?.nextCursor,
      }),
    );
    expect(stale.error).toMatchObject({
      code: -32602,
      message: expect.stringContaining("Invalid or stale pagination cursor"),
    });
  });

  it("returns terminal pagination metadata for the content-change resource template", async () => {
    const handlers = createDocsMcpHttpHandler({
      source: {
        getPages: () => [],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const response = await parseMcpPayload<{
      result?: ProtocolListResult<{ name: string }, "resourceTemplates">;
    }>(await callMcpMethod(handlers, "resources/templates/list"));

    expect(response.result).toEqual({
      resourceTemplates: [
        expect.objectContaining({
          name: "docs-content-changes-by-generation",
          uriTemplate: "docs://changes/{generation}",
        }),
      ],
      _meta: {
        "dev.farming-labs/pagination": {
          hasMore: false,
          total: 1,
        },
      },
    });
  });

  it("paginates the SDK live registries, including late tools, resources, and prompts", async () => {
    const server = await createDocsMcpServer({
      source: {
        getPages: () => [],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const lateTool = server.registerTool(
      "late_tool",
      { description: "Registered after the docs MCP server was created." },
      async () => ({ content: [{ type: "text", text: "late tool" }] }),
    );
    const removableTool = server.registerTool(
      "removable_late_tool",
      { description: "Removed after the docs MCP server was created." },
      async () => ({ content: [{ type: "text", text: "removable late tool" }] }),
    );
    const lateResource = server.registerResource(
      "late-resource",
      "docs://late/resource",
      { description: "Late fixed resource" },
      async (uri) => ({ contents: [{ uri: uri.href, text: "late resource" }] }),
    );
    for (let index = 0; index < 11; index += 1) {
      const number = String(index + 1).padStart(2, "0");
      server.registerResource(
        `late-template-${number}`,
        new ResourceTemplate(`docs://late/${number}/{id}`, {
          list: async () => ({
            resources: [
              {
                uri: `docs://late/${number}/generated`,
                name: `Late generated resource ${number}`,
              },
            ],
          }),
        }),
        { description: `Late dynamic resource template ${number}` },
        async (uri) => ({ contents: [{ uri: uri.href, text: `late template ${number}` }] }),
      );
    }
    for (let index = 0; index < 11; index += 1) {
      const number = String(index + 1).padStart(2, "0");
      server.registerPrompt(
        `late_prompt_${number}`,
        { description: `Late prompt ${number}` },
        async () => ({
          messages: [
            {
              role: "user",
              content: { type: "text", text: `Late prompt ${number}` },
            },
          ],
        }),
      );
    }

    const client = new Client({ name: "pagination-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    async function listAllTools() {
      const tools = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor !== undefined ? { cursor } : undefined);
        tools.push(...page.tools);
        cursor = page.nextCursor;
      } while (cursor !== undefined);
      return tools;
    }

    async function listAllResources() {
      const resources = [];
      let cursor: string | undefined;
      do {
        const page = await client.listResources(cursor !== undefined ? { cursor } : undefined);
        resources.push(...page.resources);
        cursor = page.nextCursor;
      } while (cursor !== undefined);
      return resources;
    }

    async function listAllPrompts() {
      const prompts = [];
      let cursor: string | undefined;
      do {
        const page = await client.listPrompts(cursor !== undefined ? { cursor } : undefined);
        prompts.push(...page.prompts);
        cursor = page.nextCursor;
      } while (cursor !== undefined);
      return prompts;
    }

    async function listAllResourceTemplates() {
      const templates = [];
      let cursor: string | undefined;
      do {
        const page = await client.listResourceTemplates(
          cursor !== undefined ? { cursor } : undefined,
        );
        templates.push(...page.resourceTemplates);
        cursor = page.nextCursor;
      } while (cursor !== undefined);
      return templates;
    }

    try {
      const tools = await listAllTools();
      expect(tools.find((tool) => tool.name === "late_tool")).toMatchObject({
        name: "late_tool",
      });
      expect((await listAllResources()).map((resource) => resource.uri)).toEqual(
        expect.arrayContaining(["docs://late/resource", "docs://late/01/generated"]),
      );
      const resourceTemplates = await listAllResourceTemplates();
      expect(resourceTemplates).toHaveLength(12);
      expect(resourceTemplates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "late-template-01",
            uriTemplate: "docs://late/01/{id}",
          }),
        ]),
      );
      expect((await listAllPrompts()).map((prompt) => prompt.name)).toHaveLength(11);

      lateTool.disable();
      lateResource.disable();
      expect((await listAllTools()).some((tool) => tool.name === "late_tool")).toBe(false);
      expect(
        (await listAllResources()).some((resource) => resource.uri === "docs://late/resource"),
      ).toBe(false);

      lateTool.enable();
      lateTool.update({ name: "renamed_late_tool" });
      expect((await listAllTools()).some((tool) => tool.name === "renamed_late_tool")).toBe(true);

      removableTool.remove();
      lateResource.remove();
      expect((await listAllTools()).some((tool) => tool.name === "removable_late_tool")).toBe(
        false,
      );
      expect(
        (await listAllResources()).some((resource) => resource.uri === "docs://late/resource"),
      ).toBe(false);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("paginates custom list tools, prunes list_docs trees, and continues search_docs", async () => {
    const pages = createPaginationPages(55);
    const sectionHeadings = Array.from(
      { length: 55 },
      (_, index) => `## Section ${String(index + 1).padStart(3, "0")}

Section pagination body ${index + 1}.`,
    ).join("\n\n");
    pages.push({
      slug: "section-index",
      url: "/docs/section-index",
      title: "Section pagination index",
      description: "A page with enough headings to require MCP pagination.",
      content: "Shared MCP cursor marker section index.",
      rawContent: `# Section pagination index

Shared MCP cursor marker section index.

${sectionHeadings}
`,
      framework: "nextjs",
      tags: ["pagination"],
      agent: {
        task: "Run pagination contract for section discovery",
        outcome: "Every section is discoverable exactly once.",
        appliesTo: {
          framework: ["nextjs"],
          package: ["@farming-labs/docs"],
        },
      },
    });
    const source = {
      entry: "docs",
      getPages: () => pages,
      getNavigation: () => ({ name: "Docs", children: [] }),
    };
    const handlers = createDocsMcpHttpHandler({
      source,
      search: { provider: "simple", chunking: { strategy: "page" } },
    });

    async function traverseTool<T extends Record<string, unknown>, K extends keyof T & string>(
      name: string,
      key: K,
      args: Record<string, unknown> = {},
    ): Promise<Array<ToolPaginationResult<T[K] extends Array<infer I> ? I : never, K>>> {
      const resultPages: Array<ToolPaginationResult<T[K] extends Array<infer I> ? I : never, K>> =
        [];
      let cursor: string | undefined;

      do {
        const payload = await readStructuredToolResult<
          ToolPaginationResult<T[K] extends Array<infer I> ? I : never, K>
        >(
          await callMcpTool(handlers, name, {
            ...args,
            ...(cursor ? { cursor } : {}),
          }),
        );
        expect(payload.result?.isError).not.toBe(true);
        const page = payload.result?.structuredContent;
        expect(page).toEqual(expect.any(Object));
        expect(page?.resultCount).toBe(page?.[key]?.length);
        expect(page?.hasMore).toBe(Boolean(page?.nextCursor));
        resultPages.push(page!);
        cursor = page?.nextCursor;
      } while (cursor);

      return resultPages;
    }

    const listPagePages = await traverseTool<{ pages: Array<{ url: string }> }, "pages">(
      "list_pages",
      "pages",
    );
    expect(listPagePages.map((page) => page.resultCount)).toEqual([25, 25, 6]);
    expect(listPagePages.map((page) => page.total)).toEqual([56, 56, 56]);
    const listedPageUrls = listPagePages.flatMap(
      (page) => page.pages?.map((item) => item.url) ?? [],
    );
    expect(new Set(listedPageUrls).size).toBe(56);

    const listTaskPages = await traverseTool<{ tasks: Array<{ url: string }> }, "tasks">(
      "list_tasks",
      "tasks",
      { query: "pagination contract", framework: "NEXTJS" },
    );
    expect(listTaskPages.map((page) => page.resultCount)).toEqual([25, 25, 6]);
    expect(listTaskPages.map((page) => page.total)).toEqual([56, 56, 56]);
    const listedTaskUrls = listTaskPages.flatMap(
      (page) => page.tasks?.map((item) => item.url) ?? [],
    );
    expect(new Set(listedTaskUrls).size).toBe(56);

    type DocsListPage = ToolPaginationResult<{ url: string }, "pages"> & {
      sectionCount?: number;
      rootPages?: Array<{ url: string }>;
      sections?: Array<{
        slug?: string;
        pageCount?: number;
        pages?: Array<{ url: string }>;
        sections?: DocsListPage["sections"];
      }>;
    };
    const listDocsPages = (await traverseTool<{ pages: Array<{ url: string }> }, "pages">(
      "list_docs",
      "pages",
    )) as DocsListPage[];
    expect(listDocsPages.map((page) => page.resultCount)).toEqual([25, 25, 6]);
    expect(listDocsPages.map((page) => page.total)).toEqual([56, 56, 56]);
    expect(listDocsPages.map((page) => page.sectionCount)).toEqual([1, 1, 1]);
    expect(
      listDocsPages.map(
        (page) => page.sections?.find((section) => section.slug === "guides")?.pageCount,
      ),
    ).toEqual([55, 55, 55]);

    function flattenSectionPageUrls(sections: NonNullable<DocsListPage["sections"]>): string[] {
      return sections.flatMap((section) => [
        ...(section.pages?.map((page) => page.url) ?? []),
        ...flattenSectionPageUrls(section.sections ?? []),
      ]);
    }

    for (const page of listDocsPages) {
      const responsePageUrls = page.pages?.map((item) => item.url) ?? [];
      const representedPageUrls = [
        ...(page.rootPages?.map((item) => item.url) ?? []),
        ...flattenSectionPageUrls(page.sections ?? []),
      ];
      expect(representedPageUrls).toHaveLength(responsePageUrls.length);
      expect([...representedPageUrls].sort()).toEqual([...responsePageUrls].sort());
    }
    const allDocsUrls = listDocsPages.flatMap((page) => page.pages?.map((item) => item.url) ?? []);
    expect(new Set(allDocsUrls).size).toBe(56);

    const sectionPages = await traverseTool<{ sections: Array<{ id: string }> }, "sections">(
      "list_page_sections",
      "sections",
      { path: "section-index" },
    );
    expect(sectionPages.map((page) => page.resultCount)).toEqual([25, 25, 8]);
    expect(sectionPages.map((page) => page.total)).toEqual([58, 58, 58]);
    const sectionIds = sectionPages.flatMap(
      (page) => page.sections?.map((section) => section.id) ?? [],
    );
    expect(new Set(sectionIds).size).toBe(58);

    const firstSearch = await readStructuredToolResult<{
      resultCount: number;
      total: number;
      hasMore: boolean;
      nextCursor?: string;
      results: Array<{ id: string }>;
    }>(
      await callMcpTool(handlers, "search_docs", {
        query: "shared MCP cursor marker",
        limit: 2,
      }),
    );
    expect(firstSearch.result?.structuredContent).toMatchObject({
      resultCount: 2,
      total: 56,
      hasMore: true,
      nextCursor: expect.any(String),
    });
    const secondSearch = await readStructuredToolResult<{
      resultCount: number;
      total: number;
      hasMore: boolean;
      nextCursor?: string;
      results: Array<{ id: string }>;
    }>(
      await callMcpTool(handlers, "search_docs", {
        query: "shared MCP cursor marker",
        limit: 2,
        cursor: firstSearch.result?.structuredContent?.nextCursor,
      }),
    );
    expect(secondSearch.result?.structuredContent).toMatchObject({
      resultCount: 2,
      total: 56,
      hasMore: true,
    });
    const firstSearchIds =
      firstSearch.result?.structuredContent?.results.map((result) => result.id) ?? [];
    const secondSearchIds =
      secondSearch.result?.structuredContent?.results.map((result) => result.id) ?? [];
    expect(new Set([...firstSearchIds, ...secondSearchIds]).size).toBe(4);

    const invalidSearch = await readStructuredToolResult<Record<string, unknown>>(
      await callMcpTool(handlers, "search_docs", {
        query: "shared MCP cursor marker",
        limit: 2,
        cursor: "not-a-valid-cursor",
      }),
    );
    expect(invalidSearch.result?.isError).toBe(true);
    expect(invalidSearch.result?.content?.[0]?.text).toContain(
      "Invalid or stale pagination cursor",
    );
  });
});

describe("MCP content-change synchronization", () => {
  it("omits content synchronization when agent content changes are disabled", async () => {
    const handlers = createDocsMcpHttpHandler({
      source: {
        getPages: () => [],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
      contentChanges: false,
    });

    try {
      const toolPayload = await parseMcpPayload<{
        error?: { code?: number; message?: string };
      }>(await callMcpTool(handlers, "list_content_changes", {}));
      expect(toolPayload.error).toMatchObject({
        code: -32602,
        message: expect.stringContaining("not found"),
      });
      const hydrationPayload = await parseMcpPayload<{
        error?: { code?: number; message?: string };
      }>(
        await callMcpTool(handlers, "hydrate_content_changes", {
          since: `sha256:${"a".repeat(64)}`,
          tokenBudget: 5_000,
        }),
      );
      expect(hydrationPayload.error).toMatchObject({
        code: -32602,
        message: expect.stringContaining("not found"),
      });

      const resourcePayload = await parseMcpPayload<{
        error?: { code?: number; message?: string };
      }>(
        await callMcpMethod(handlers, "resources/read", {
          uri: DOCS_MCP_CONTENT_CHANGES_CURRENT_URI,
        }),
      );
      expect(resourcePayload.error).toMatchObject({
        message: expect.stringContaining("not found"),
      });
    } finally {
      await handlers.close?.();
    }
  });

  it("polls changes with since and reads generation-addressed resources", async () => {
    const pages: DocsMcpPage[] = [
      {
        slug: "install",
        url: "/docs/install",
        title: "Install",
        content: "# Install\n\nRun the installer.",
      },
    ];
    const handlers = createDocsMcpHttpHandler({
      source: {
        baseUrl: "https://docs.example.com",
        getPages: () => pages,
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });

    try {
      const firstPayload = await parseMcpPayload<{
        result?: { structuredContent?: Record<string, unknown> };
      }>(await callMcpTool(handlers, "list_content_changes", {}));
      const first = firstPayload.result?.structuredContent as
        | {
            mode: string;
            indexGeneration: string;
            counts: { added: number; changed: number; deleted: number };
          }
        | undefined;
      expect(first).toMatchObject({
        mode: "snapshot",
        counts: { added: 1, changed: 0, deleted: 0 },
      });

      pages[0] = {
        ...pages[0]!,
        content: "# Install\n\nRun the installer, then verify the generated files.",
      };
      const secondPayload = await parseMcpPayload<{
        result?: { structuredContent?: Record<string, unknown> };
      }>(
        await callMcpTool(handlers, "list_content_changes", {
          since: first?.indexGeneration,
        }),
      );
      const second = secondPayload.result?.structuredContent as
        | {
            mode: string;
            since: string;
            indexGeneration: string;
            changed: Array<{ canonicalUrl: string; previousDigest: string }>;
          }
        | undefined;
      expect(second).toMatchObject({
        mode: "delta",
        since: first?.indexGeneration,
        changed: [
          {
            canonicalUrl: "https://docs.example.com/docs/install",
            previousDigest: expect.stringMatching(/^sha256:/u),
          },
        ],
      });
      expect(second?.indexGeneration).not.toBe(first?.indexGeneration);

      const resourcePayload = await parseMcpPayload<{
        result?: { contents?: Array<{ uri?: string; text?: string }> };
      }>(
        await callMcpMethod(handlers, "resources/read", {
          uri: `docs://changes/${first?.indexGeneration}`,
        }),
      );
      expect(resourcePayload.result?.contents?.[0]?.uri).toBe(
        `docs://changes/${first?.indexGeneration}`,
      );
      expect(JSON.parse(resourcePayload.result?.contents?.[0]?.text ?? "{}")).toMatchObject({
        mode: "delta",
        since: first?.indexGeneration,
        indexGeneration: second?.indexGeneration,
      });

      const currentPayload = await parseMcpPayload<{
        result?: { contents?: Array<{ uri?: string; text?: string }> };
      }>(
        await callMcpMethod(handlers, "resources/read", {
          uri: DOCS_MCP_CONTENT_CHANGES_CURRENT_URI,
        }),
      );
      expect(currentPayload.result?.contents?.[0]?.uri).toBe(DOCS_MCP_CONTENT_CHANGES_CURRENT_URI);
      expect(JSON.parse(currentPayload.result?.contents?.[0]?.text ?? "{}")).toMatchObject({
        mode: "snapshot",
        since: null,
        indexGeneration: second?.indexGeneration,
      });
    } finally {
      await handlers.close?.();
    }
  });

  it("hydrates changed sections and deletion tombstones with budget cursors", async () => {
    const pages: DocsMcpPage[] = [
      {
        slug: "stable",
        url: "/docs/stable",
        title: "Stable",
        content: "# Stable\n\nStable content.",
      },
      {
        slug: "install",
        url: "/docs/install",
        title: "Install",
        content: "# Install\n\nOld content.",
      },
      {
        slug: "removed",
        url: "/docs/removed",
        title: "Removed",
        content: "# Removed\n\nThis page will be removed.",
      },
    ];
    const handlers = createDocsMcpHttpHandler({
      source: {
        baseUrl: "https://docs.example.com",
        getPages: () => pages,
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });

    try {
      const firstPayload = await parseMcpPayload<{
        result?: { structuredContent?: { indexGeneration?: string } };
      }>(await callMcpTool(handlers, "list_content_changes", {}));
      const since = firstPayload.result?.structuredContent?.indexGeneration;
      expect(since).toMatch(/^sha256:/u);

      pages.splice(
        1,
        2,
        {
          slug: "install",
          url: "/docs/install",
          title: "Install",
          content: [
            "# Install",
            "",
            "Run the updated installer and inspect every generated file before continuing.",
            "",
            "## Verify",
            "",
            "Start the development server and verify that the documentation route responds.",
          ].join("\n"),
        },
        {
          slug: "added",
          url: "/docs/added",
          title: "Added",
          content: "# Added\n\nThis page was added.",
        },
      );

      const responses: Array<{
        result?: {
          isError?: boolean;
          structuredContent?: {
            indexGeneration: string;
            resultCount: number;
            total: number;
            hasMore: boolean;
            nextCursor?: string;
            budget: { usedUtf8Bytes: number };
            content: Array<{
              canonicalUrl: string;
              digest: string;
              sectionDigest: string;
              chunkDigest: string;
            }>;
            tombstones: Array<{ canonicalUrl: string; digest: string }>;
          };
        };
      }> = [];
      let cursor: string | undefined;
      do {
        const payload = await parseMcpPayload<(typeof responses)[number]>(
          await callMcpTool(handlers, "hydrate_content_changes", {
            since,
            tokenBudget: 48,
            ...(cursor ? { cursor } : {}),
          }),
        );
        expect(payload.result?.isError).not.toBe(true);
        responses.push(payload);
        cursor = payload.result?.structuredContent?.nextCursor;
      } while (cursor);

      const results = responses.map((response) => response.result!.structuredContent!);
      expect(results.length).toBeGreaterThan(1);
      expect(results.every((result) => result.budget.usedUtf8Bytes <= 48)).toBe(true);
      expect(results.at(-1)).toMatchObject({ hasMore: false });
      expect(
        results.flatMap((result) => result.content).map((item) => item.canonicalUrl),
      ).not.toContain("https://docs.example.com/docs/stable");
      expect(
        new Set(results.flatMap((result) => result.content).map((item) => item.canonicalUrl)),
      ).toEqual(
        new Set(["https://docs.example.com/docs/added", "https://docs.example.com/docs/install"]),
      );
      expect(results.flatMap((result) => result.tombstones)).toEqual([
        expect.objectContaining({
          canonicalUrl: "https://docs.example.com/docs/removed",
          digest: expect.stringMatching(/^sha256:/u),
        }),
      ]);
      expect(
        results
          .flatMap((result) => result.content)
          .every(
            (item) =>
              item.digest.startsWith("sha256:") &&
              item.sectionDigest.startsWith("sha256:") &&
              item.chunkDigest.startsWith("sha256:"),
          ),
      ).toBe(true);

      const invalidCursor = responses[0]?.result?.structuredContent?.nextCursor;
      const invalidPayload = await parseMcpPayload<{
        result?: { isError?: boolean; content?: Array<{ text?: string }> };
      }>(
        await callMcpTool(handlers, "hydrate_content_changes", {
          since,
          tokenBudget: 49,
          cursor: invalidCursor,
        }),
      );
      expect(invalidPayload.result?.isError).toBe(true);
      expect(invalidPayload.result?.content?.[0]?.text).toContain(
        "Invalid or stale pagination cursor",
      );
    } finally {
      await handlers.close?.();
    }
  });

  it("notifies 2026-07-28 subscriptions when the default agent corpus changes", async () => {
    const pages: DocsMcpPage[] = [
      {
        slug: "overview",
        url: "/docs/overview",
        title: "Overview",
        content: "# Overview\n\nInitial content.",
      },
    ];
    const handlers = createDocsMcpHttpHandler({
      source: {
        baseUrl: "https://docs.example.com",
        getPages: () => pages,
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
      contentChangePollIntervalMs: 10,
    });
    const abortController = new AbortController();

    try {
      const response = await handlers.POST({
        request: new Request("https://docs.example.com/api/docs/mcp", {
          method: "POST",
          headers: {
            accept: "text/event-stream",
            "content-type": "application/json",
            "mcp-method": "subscriptions/listen",
            "mcp-protocol-version": "2026-07-28",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "content-sync-listener",
            method: "subscriptions/listen",
            params: {
              _meta: {
                "io.modelcontextprotocol/protocolVersion": "2026-07-28",
                "io.modelcontextprotocol/clientInfo": {
                  name: "content-sync-test",
                  version: "1.0.0",
                },
                "io.modelcontextprotocol/clientCapabilities": {},
              },
              notifications: {
                resourcesListChanged: true,
                resourceSubscriptions: [
                  DOCS_MCP_CONTENT_CHANGES_CURRENT_URI,
                  "docs://docs/overview",
                ],
              },
            },
          }),
          signal: abortController.signal,
        }),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/event-stream");

      const reader = response.body?.getReader();
      expect(reader).toBeDefined();
      const decoder = new TextDecoder();
      let received = "";
      const readUntil = async (pattern: string) => {
        while (!received.includes(pattern)) {
          const next = await Promise.race([
            reader!.read(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error(`Timed out waiting for ${pattern}`)), 1_500),
            ),
          ]);
          if (next.done) throw new Error(`Subscription ended before ${pattern}`);
          received += decoder.decode(next.value, { stream: true });
        }
      };

      await readUntil("notifications/subscriptions/acknowledged");
      expect(received).toContain(DOCS_MCP_CONTENT_CHANGES_CURRENT_URI);

      pages[0] = {
        ...pages[0]!,
        content: "# Overview\n\nUpdated content.",
      };
      await readUntil("notifications/resources/list_changed");
      await readUntil(`"uri":"${DOCS_MCP_CONTENT_CHANGES_CURRENT_URI}"`);
      await readUntil('"uri":"docs://docs/overview"');
      expect(received).toContain(`"uri":"${DOCS_MCP_CONTENT_CHANGES_CURRENT_URI}"`);
      expect(received).toContain("notifications/resources/list_changed");

      abortController.abort();
      await reader?.cancel().catch(() => {});
    } finally {
      abortController.abort();
      await handlers.close?.();
    }
  });
});

describe("MCP context and schema APIs", () => {
  it("exposes every skill file as a collision-free text or binary MCP resource", async () => {
    const markdown = "---\nname: portable\ndescription: Portable workflow.\n---\n";
    const source = {
      getPages: () => [],
      getNavigation: () => ({ name: "Docs", children: [] }),
      getSkills: () => [
        {
          name: "portable",
          type: "archive" as const,
          description: "Portable workflow.",
          url: "/.well-known/agent-skills/portable.tar.gz",
          digest: `sha256:${"a".repeat(64)}` as const,
          content: new Uint8Array([1]),
          sha256: "a".repeat(64),
          skillDocument: markdown,
          files: [
            {
              path: "SKILL.md",
              url: "/.well-known/agent-skills/portable/SKILL.md",
              mediaType: "text/markdown",
              content: markdown,
              sha256: "b".repeat(64),
              digest: `sha256:${"b".repeat(64)}` as const,
            },
            {
              path: "assets/a-b.bin",
              url: "/.well-known/agent-skills/portable/assets/a-b.bin",
              mediaType: "application/octet-stream",
              content: new Uint8Array([0, 255]),
              sha256: "c".repeat(64),
              digest: `sha256:${"c".repeat(64)}` as const,
            },
            {
              path: "assets/a/b.bin",
              url: "/.well-known/agent-skills/portable/assets/a/b.bin",
              mediaType: "application/octet-stream",
              content: new Uint8Array([1, 254]),
              sha256: "d".repeat(64),
              digest: `sha256:${"d".repeat(64)}` as const,
            },
          ],
        },
      ],
    };
    const handlers = createDocsMcpHttpHandler({ source });
    const listed = await parseMcpPayload<{
      result?: { resources?: Array<{ uri: string }> };
    }>(await callMcpMethod(handlers, "resources/list"));
    const uris = listed.result?.resources?.map((resource) => resource.uri) ?? [];
    expect(uris).toEqual(
      expect.arrayContaining([
        "docs://skills/portable/SKILL.md",
        "docs://skills/portable/assets/a-b.bin",
        "docs://skills/portable/assets/a/b.bin",
      ]),
    );

    const read = await parseMcpPayload<{
      result?: { contents?: Array<{ blob?: string; mimeType?: string }> };
    }>(
      await callMcpMethod(handlers, "resources/read", {
        uri: "docs://skills/portable/assets/a-b.bin",
      }),
    );
    expect(read.result?.contents?.[0]).toMatchObject({
      mimeType: "application/octet-stream",
      blob: Buffer.from([0, 255]).toString("base64"),
    });
  });
  function page(slug: string, input: Partial<DocsMcpPage> = {}): DocsMcpPage {
    const content = `# Scope guide\n\nUse the shared scope selection guide safely.\n`;
    return {
      slug,
      url: `/docs/${slug}`,
      title: `Scope guide ${slug}`,
      content,
      rawContent: content,
      ...input,
    };
  }

  function findSchemaOption(
    options: readonly DocsMcpConfigSchemaOption[],
    optionPath: string,
  ): DocsMcpConfigSchemaOption | undefined {
    for (const option of options) {
      if (option.path === optionPath) return option;
      const nested = option.children ? findSchemaOption(option.children, optionPath) : undefined;
      if (nested) return nested;
    }
    return undefined;
  }

  it("rejects conflicting scopes and uses the same effective scope for filtering and output", async () => {
    const pages = [
      page("framework-conflict", {
        framework: "nextjs",
        version: "16",
        agent: { appliesTo: { framework: "astro", version: "16" } },
      }),
      page("version-conflict", {
        framework: "astro",
        version: "16",
        agent: { appliesTo: { framework: "astro", version: ">=17" } },
      }),
      page("top-level-intersection", {
        framework: "nextjs",
        version: ">=16 <17",
        agent: {
          appliesTo: { framework: ["nextjs", "astro"], version: ["16", "17"] },
        },
      }),
      page("contract-multi", {
        agent: {
          appliesTo: { framework: ["nextjs", "astro"], version: ["15", "16"] },
        },
      }),
    ];

    const astro = await buildDocsMcpContext({
      pages,
      query: "shared scope selection guide",
      framework: "astro",
      version: "16",
      tokenBudget: 8_000,
    });
    expect(astro.sources).toEqual([
      expect.objectContaining({
        pageUrl: "/docs/contract-multi",
        framework: "astro",
        version: "16",
      }),
    ]);

    const next = await buildDocsMcpContext({
      pages,
      query: "shared scope selection guide",
      framework: "next",
      version: "v16",
      tokenBudget: 8_000,
    });
    expect(
      next.sources.map(({ pageUrl, framework, version }) => ({
        pageUrl,
        framework,
        version,
      })),
    ).toEqual([
      {
        pageUrl: "/docs/contract-multi",
        framework: "nextjs",
        version: "16",
      },
      {
        pageUrl: "/docs/top-level-intersection",
        framework: "nextjs",
        version: ">=16 <17",
      },
    ]);
  });

  it("filters package and tags strictly and excludes pages with missing scope metadata", async () => {
    const result = await buildDocsMcpContext({
      pages: [
        page("matching", {
          agent: { appliesTo: { package: ["@example/runtime"] } },
          tags: ["setup", "agent"],
        }),
        page("missing"),
        page("wrong", {
          agent: { appliesTo: { package: ["@example/other"] } },
          tags: ["setup"],
        }),
      ],
      query: "shared scope selection guide",
      package: ["@EXAMPLE/RUNTIME"],
      tags: "agent",
      tokenBudget: 8_000,
    });

    expect(result.filters).toMatchObject({
      package: ["@example/runtime"],
      tags: ["agent"],
    });
    expect(result.sources).toEqual([
      expect.objectContaining({
        pageUrl: "/docs/matching",
        package: ["@example/runtime"],
        tags: ["setup", "agent"],
      }),
    ]);
  });

  it("caps ranked resolved context candidates with maxResults", async () => {
    const result = await buildDocsMcpContext({
      pages: [page("c"), page("a"), page("b")],
      query: "shared scope selection guide",
      tokenBudget: 8_000,
      maxResults: 2,
    });

    expect(result).toMatchObject({ candidateCount: 2, resultCount: 2 });
    expect(result.sources.map((source) => source.pageUrl)).toEqual(["/docs/a", "/docs/b"]);
  });

  it("retrieves MCP context from the agent projection", async () => {
    const result = await buildDocsMcpContext({
      pages: [
        page("audience", {
          content: "Human screenshot walkthrough.",
          rawContent: "# Audience\n\nHuman screenshot walkthrough.",
          agentFallbackContent: "Use the amber orchestration key.",
        }),
      ],
      query: "amber orchestration key",
      tokenBudget: 8_000,
    });

    expect(result.sources[0]).toMatchObject({
      pageUrl: "/docs/audience",
    });
    expect(result.context).toContain("amber orchestration key");
    expect(result.context).not.toContain("Human screenshot walkthrough");
  });

  it("keeps reserved section anchors distinct through search and MCP hydration", async () => {
    const rawContent = [
      "# Reserved anchors",
      "",
      "## Hash [#foo#bar]",
      "",
      "Reserved anchor marker hash content.",
      "",
      "## Percent [#foo%23bar]",
      "",
      "Reserved anchor marker percent content.",
    ].join("\n");
    const result = await buildDocsMcpContext({
      pages: [
        page("reserved", {
          title: "Reserved anchors",
          content: rawContent,
          rawContent,
        }),
      ],
      query: "reserved anchor marker",
      tokenBudget: 8_000,
    });

    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          anchor: "foo#bar",
          url: "/docs/reserved#foo%23bar",
          content: expect.stringContaining("hash content"),
        }),
        expect.objectContaining({
          anchor: "foo%23bar",
          url: "/docs/reserved#foo%2523bar",
          content: expect.stringContaining("percent content"),
        }),
      ]),
    );
  });

  it("hydrates authored custom anchors ahead of generated contract-only headings", async () => {
    const rawContent = "## Authored [#agent-contract]\n\nAuthored collision retrieval marker.";
    const result = await buildDocsMcpContext({
      pages: [
        page("contract-collision", {
          title: "Contract collision",
          content: rawContent,
          rawContent,
          agent: {
            task: "Run the generated contract task.",
            outcome: "The generated contract outcome is available.",
          },
        }),
      ],
      query: "authored collision retrieval marker",
      tokenBudget: 8_000,
      maxResults: 1,
    });

    expect(result.sources).toEqual([
      expect.objectContaining({
        section: "Authored",
        anchor: "agent-contract",
        url: "/docs/contract-collision#agent-contract",
        content: expect.stringContaining("Authored collision retrieval marker."),
      }),
    ]);
    expect(result.context).not.toContain("generated contract outcome");
  });

  it("returns deep-cloned schema options and examples while freezing the public template", () => {
    const first = getDocsConfigSchema();
    const mode = findSchemaOption(first.options, "review.ci.mode");
    expect(mode?.values).toEqual(["off", "warn", "block"]);

    expect(mode).toBeDefined();
    (mode!.values as string[]).push("mutated");
    first.examples[0].title = "Mutated example";
    first.examples.push({ title: "Injected", code: "export default {}" });
    first.options.splice(0, 1);

    const second = getDocsConfigSchema();
    expect(findSchemaOption(second.options, "review.ci.mode")?.values).toEqual([
      "off",
      "warn",
      "block",
    ]);
    expect(second.examples[0]?.title).toBe("Minimal config");
    expect(second.examples.some((example) => example.title === "Injected")).toBe(false);

    const publicMode = findSchemaOption(DOCS_CONFIG_SCHEMA_OPTIONS, "review.ci.mode");
    expect(Object.isFrozen(DOCS_CONFIG_SCHEMA_OPTIONS)).toBe(true);
    expect(Object.isFrozen(publicMode)).toBe(true);
    expect(Object.isFrozen(publicMode?.values)).toBe(true);
  });

  it("publishes actionable A2A v1 interface, skill, extension, and security schema paths", () => {
    const schema = getDocsConfigSchema();
    const expectedPaths = [
      "agent.a2a.supportedInterfaces[].url",
      "agent.a2a.supportedInterfaces[].protocolBinding",
      "agent.a2a.capabilities.extensions[].uri",
      "agent.a2a.skills[].id",
      "agent.a2a.skills[].securityRequirements",
      "agent.a2a.securitySchemes.<name>.httpAuthSecurityScheme",
      "agent.a2a.securitySchemes.<name>.oauth2SecurityScheme.flows.clientCredentials",
      "agent.a2a.securitySchemes.<name>.oauth2SecurityScheme.flows.implicit",
      "agent.a2a.securitySchemes.<name>.oauth2SecurityScheme.flows.password",
      "agent.a2a.securitySchemes.<name>.openIdConnectSecurityScheme",
      "agent.a2a.securityRequirements[].schemes.<name>.list",
    ];
    for (const path of expectedPaths) {
      expect(findSchemaOption(schema.options, path), path).toBeDefined();
    }

    expect(
      findSchemaOption(schema.options, "agent.a2a.supportedInterfaces[].protocolVersion")?.default,
    ).toBe("1.0");
    expect(findSchemaOption(schema.options, "agent.a2a.protocolVersion")?.default).toBe("0.3");
    expect(findSchemaOption(schema.options, "agent.a2a.skills")?.description).toContain(
      "Required with supportedInterfaces",
    );
    expect(
      findSchemaOption(schema.options, "agent.a2a.securitySchemes.<name>")?.description,
    ).toContain("exactly one wrapper");
    expect(
      findSchemaOption(
        schema.options,
        "agent.a2a.securitySchemes.<name>.oauth2SecurityScheme.flows.implicit",
      )?.description,
    ).toContain("Deprecated");
    expect(
      findSchemaOption(
        schema.options,
        "agent.a2a.securitySchemes.<name>.oauth2SecurityScheme.flows.password",
      )?.description,
    ).toContain("Deprecated");
  });

  it("publishes Agent Skill progressive-disclosure schema paths and defaults", () => {
    const schema = getDocsConfigSchema();
    expect(
      findSchemaOption(schema.options, "agent.skills.progressiveDisclosure.instructionTokenBudget")
        ?.default,
    ).toBe(5_000);
    expect(
      findSchemaOption(schema.options, "agent.skills.progressiveDisclosure.maxReferenceDepth")
        ?.default,
    ).toBe(1);
    expect(
      findSchemaOption(schema.options, "agent.skills.progressiveDisclosure.compatibility")?.values,
    ).toEqual(["when-needed", "always", "off"]);
    expect(findSchemaOption(schema.options, "review.rules.agentSkills")?.default).toBe("warn");
  });

  it("publishes package and tag golden-task filter and scope schema paths", () => {
    const schema = getDocsConfigSchema();
    for (const path of [
      "agent.evaluations.tasks[].filters.package",
      "agent.evaluations.tasks[].filters.tags",
      "agent.evaluations.tasks[].expect.scope.package",
      "agent.evaluations.tasks[].expect.scope.tags",
    ]) {
      expect(findSchemaOption(schema.options, path), path).toMatchObject({
        type: "string | readonly string[]",
      });
    }
  });

  it("publishes adversarial golden-task safety schema paths", () => {
    const schema = getDocsConfigSchema();
    for (const path of [
      "agent.evaluations.tasks[].expect.safety.promptInjection.markers",
      "agent.evaluations.tasks[].expect.safety.poisonedCitations",
      "agent.evaluations.tasks[].expect.safety.authenticatedContent.forbiddenSources",
      "agent.evaluations.tasks[].expect.safety.freshness.indexGeneration",
      "agent.evaluations.tasks[].expect.safety.freshness.sourceDigests.*",
      "agent.evaluations.tasks[].expect.safety.rejectConflictingFrameworkVersions",
      "agent.evaluations.tasks[].expect.safety.deletedSectionTombstones",
      "agent.evaluations.tasks[].expect.safety.queryVariants[].kind",
    ]) {
      expect(findSchemaOption(schema.options, path), path).toBeDefined();
    }
  });

  it("publishes golden-task coverage applicability schema", () => {
    const schema = getDocsConfigSchema();
    expect(
      findSchemaOption(
        schema.options,
        "agent.evaluations.tasks[].expect.coverage.executableExamples",
      ),
    ).toMatchObject({
      type: '"applicable" | "not-applicable"',
      default: "applicable",
      values: ["applicable", "not-applicable"],
    });
  });
});

describe("createFilesystemDocsMcpSource", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  function createTempDocsProject() {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-mcp-test-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "docs", "installation"), { recursive: true });
    mkdirSync(join(rootDir, "docs", "guides"), { recursive: true });

    writeFileSync(
      join(rootDir, "docs", "page.mdx"),
      `---
title: "Introduction"
description: "Start here"
---

# Introduction

Welcome to the docs.
`,
    );

    writeFileSync(
      join(rootDir, "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "Install everything"
related:
  - /docs/guides/quickstart
agent:
  task: Install the framework
  outcome: Dependencies are installed from the lockfile.
  appliesTo:
    framework: nextjs
    package: "@farming-labs/next"
  files:
    - package.json
    - pnpm-lock.yaml
  commands:
    - run: pnpm install --frozen-lockfile
      description: Install exact dependency versions
  verification:
    - run: pnpm test
      expect: Tests pass
---

# Installation

Run pnpm install.
`,
    );

    writeFileSync(
      join(rootDir, "docs", "installation", "agent.md"),
      `<Human>Open the package manager UI.</Human>

<Audience only="agent">
Use \`pnpm install --frozen-lockfile\`.
</Audience>
`,
    );

    writeFileSync(
      join(rootDir, "docs", "guides", "quickstart.mdx"),
      `---
title: "Quickstart"
framework: "nextjs"
version: "16"
tags:
  - setup
related:
  - /docs/installation
  - /docs
agent:
  task: Create the first docs page
  outcome: The quickstart route renders.
  files:
    - docs.config.ts
---

# Quickstart

Build your first app.

\`\`\`ts title="docs.config.ts" framework="nextjs" packageManager="pnpm" runnable
import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
  entry: "docs",
});
\`\`\`

## Verify generated paths

<Agent>
Validate the generated example paths before editing this guide.
</Agent>
`,
    );

    return rootDir;
  }

  it("builds pages and navigation from a filesystem docs tree", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const pages = await source.getPages();
    const tree = await source.getNavigation();

    expect(pages.map((page) => page.url).sort()).toEqual([
      "/docs",
      "/docs/guides/quickstart",
      "/docs/installation",
    ]);
    expect(pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "/docs/installation",
          agentContent: "Use pnpm install --frozen-lockfile.",
          agentRawContent: "Use `pnpm install --frozen-lockfile`.",
          agent: {
            task: "Install the framework",
            outcome: "Dependencies are installed from the lockfile.",
            appliesTo: {
              framework: ["nextjs"],
              package: ["@farming-labs/next"],
            },
            files: ["package.json", "pnpm-lock.yaml"],
            commands: [
              {
                run: "pnpm install --frozen-lockfile",
                description: "Install exact dependency versions",
              },
            ],
            verification: [{ run: "pnpm test", expect: "Tests pass" }],
          },
        }),
        expect.objectContaining({
          url: "/docs/guides/quickstart",
          framework: "nextjs",
          version: "16",
          tags: ["setup"],
          agentFallbackRawContent: expect.stringContaining(
            "Validate the generated example paths before editing this guide.",
          ),
        }),
      ]),
    );
    expect(tree.name).toBe("Example Docs");
    expect(tree.children[0]).toMatchObject({
      type: "page",
      name: "Introduction",
      url: "/docs",
    });
  });

  it("preserves explicit agent-source provenance across search_docs and get_context", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-mcp-provenance-"));
    tempDirs.push(rootDir);

    const pageDir = join(rootDir, "docs", "provenance");
    const pagePath = join(pageDir, "page.mdx");
    const agentPath = join(pageDir, "agent.md");
    mkdirSync(pageDir, { recursive: true });
    writeFileSync(
      pagePath,
      `---
title: "Retrieval provenance"
framework: nextjs
version: "16"
lastmod: 2026-07-17
tags:
  - retrieval
---

# Retrieval provenance

Human-facing overview.
`,
    );
    writeFileSync(
      agentPath,
      `# Retrieval provenance

## Verify source provenance

Run the provenance-exclusive verification command.
`,
    );
    const pageModified = new Date("2026-07-18T08:00:00.000Z");
    const agentModified = new Date("2026-07-19T09:30:00.000Z");
    utimesSync(pagePath, pageModified, pageModified);
    utimesSync(agentPath, agentModified, agentModified);
    const otherPageDir = join(rootDir, "docs", "other");
    mkdirSync(otherPageDir, { recursive: true });
    writeFileSync(
      join(otherPageDir, "page.mdx"),
      `---
title: "Other framework"
framework: astro
---

# Other framework

Unrelated corpus content still belongs to the complete index generation.
`,
    );

    const handlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({
        rootDir,
        entry: "docs",
        contentDir: "docs",
        siteTitle: "Provenance docs",
      }),
    });
    const requestUrl = "https://preview.docs.example/api/docs/mcp";
    const digestPattern = /^sha256:[a-f0-9]{64}$/;

    type RetrievalSource = {
      canonicalUrl: string;
      scope: { audience: string; framework?: string[]; version?: string[]; tags?: string[] };
      lastModified?: string;
      digest: string;
      indexGeneration: string;
    };
    const searchPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          indexGeneration: string;
          results: Array<{ url: string; source?: RetrievalSource }>;
        };
      };
    }>(
      await callMcpTool(
        handlers,
        "search_docs",
        { query: "provenance-exclusive", audience: "agent" },
        requestUrl,
      ),
    );
    const search = searchPayload.result?.structuredContent;
    const searchResult = search?.results.find((result) =>
      result.url.startsWith("/docs/provenance"),
    );

    expect(search?.indexGeneration).toMatch(digestPattern);
    expect(searchResult?.source).toMatchObject({
      canonicalUrl: expect.stringMatching(
        /^https:\/\/preview\.docs\.example\/docs\/provenance(?:#|$)/,
      ),
      scope: {
        audience: "agent",
        framework: ["nextjs"],
        version: ["16"],
        tags: ["retrieval"],
      },
      lastModified: agentModified.toISOString(),
      digest: expect.stringMatching(digestPattern),
      indexGeneration: search?.indexGeneration,
    });
    expect(searchResult?.source?.lastModified).not.toBe(pageModified.toISOString());

    const humanPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          results: Array<{ url: string; source?: RetrievalSource }>;
        };
      };
    }>(
      await callMcpTool(
        handlers,
        "search_docs",
        { query: "human-facing overview", audience: "human" },
        requestUrl,
      ),
    );
    expect(
      humanPayload.result?.structuredContent?.results.find((result) =>
        result.url.startsWith("/docs/provenance"),
      )?.source?.lastModified,
    ).toBe("2026-07-17T00:00:00.000Z");

    const contextPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          context: string;
          sources: Array<{
            pageUrl: string;
            url: string;
            lastModified?: string;
            source?: RetrievalSource;
          }>;
        };
      };
    }>(
      await callMcpTool(
        handlers,
        "get_context",
        {
          query: "provenance-exclusive",
          framework: "nextjs",
          tokenBudget: 2_000,
        },
        requestUrl,
      ),
    );
    const contextResult = contextPayload.result?.structuredContent;
    const contextSource = contextResult?.sources.find(
      (source) => source.pageUrl === "/docs/provenance",
    );

    expect(contextSource).toMatchObject({
      pageUrl: "/docs/provenance",
      url: "https://preview.docs.example/docs/provenance#verify-source-provenance",
      lastModified: agentModified.toISOString(),
      source: {
        canonicalUrl: "https://preview.docs.example/docs/provenance#verify-source-provenance",
        scope: {
          audience: "agent",
          framework: ["nextjs"],
          version: ["16"],
          tags: ["retrieval"],
        },
        lastModified: agentModified.toISOString(),
        digest: searchResult?.source?.digest,
        indexGeneration: search?.indexGeneration,
      },
    });
    expect(contextResult?.context).toContain(
      "Source: https://preview.docs.example/docs/provenance#verify-source-provenance",
    );

    const canonicalHandlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({
        rootDir,
        entry: "docs",
        contentDir: "docs",
        siteTitle: "Provenance docs",
        baseUrl: "https://canonical.docs.example",
      }),
    });
    const canonicalPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          results: Array<{ source?: RetrievalSource }>;
        };
      };
    }>(
      await callMcpTool(
        canonicalHandlers,
        "search_docs",
        { query: "provenance-exclusive", audience: "agent" },
        requestUrl,
      ),
    );
    expect(canonicalPayload.result?.structuredContent?.results[0]?.source?.canonicalUrl).toMatch(
      /^https:\/\/canonical\.docs\.example\/docs\/provenance(?:#|$)/,
    );
  });

  it("does not trust the request origin for hosted-index ownership", async () => {
    let observedContext: Pick<DocsSearchAdapterContext, "baseUrl" | "indexBaseUrl"> | undefined;
    const search: DocsSearchAdapter["search"] = async (_query, context) => {
      observedContext = {
        baseUrl: context.baseUrl,
        indexBaseUrl: context.indexBaseUrl,
      };
      return [];
    };
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        siteTitle: "Unconfigured origin docs",
        getPages: () => [
          {
            slug: "install",
            url: "/docs/install",
            title: "Install",
            content: "Install the origin-safe package.",
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
      search: {
        provider: "custom",
        paginationRevision: "capture-index-origin.v1",
        adapter: {
          name: "capture-index-origin",
          search,
          async searchPage(query, context) {
            await search(query, context);
            throw new Error("force exact local fallback");
          },
        },
      },
    });

    const payload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: unknown;
        isError?: boolean;
      };
    }>(
      await callMcpTool(
        handlers,
        "search_docs",
        { query: "origin-safe" },
        "https://attacker-controlled.example/api/docs/mcp",
      ),
    );
    expectSuccessfulStructuredTextResult(payload);

    expect(observedContext).toEqual({
      baseUrl: "https://attacker-controlled.example",
      indexBaseUrl: undefined,
    });
  });

  it("ignores request-controlled locales for locale-agnostic filesystem sources", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-mcp-locale-agnostic-"));
    tempDirs.push(rootDir);
    mkdirSync(join(rootDir, "docs", "install"), { recursive: true });
    writeFileSync(
      join(rootDir, "docs", "install", "page.mdx"),
      "# Install\n\nInstall the locale-safe package.",
    );
    let observedLocale: string | undefined = "not-called";
    let observedUrls: string[] = [];
    const search: DocsSearchAdapter["search"] = async (query, context) => {
      observedLocale = query.locale;
      observedUrls = context.pages.map((page) => page.url);
      return [];
    };
    const handlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({ rootDir, entry: "docs", contentDir: "docs" }),
      search: {
        provider: "custom",
        paginationRevision: "capture-filesystem-locale.v1",
        adapter: {
          name: "capture-filesystem-locale",
          search,
          async searchPage(query, context) {
            await search(query, context);
            throw new Error("force exact local fallback");
          },
        },
      },
    });
    const payload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          results: Array<{
            source?: { canonicalUrl: string; scope: { locale?: string[] } };
          }>;
        };
      };
    }>(
      await callMcpTool(
        handlers,
        "search_docs",
        { query: "locale-safe", locale: "attacker-controlled" },
        "https://docs.example.com/api/docs/mcp",
      ),
    );

    expect(observedLocale).toBeUndefined();
    expect(observedUrls).toEqual(["/docs/install"]);
    expect(payload.result?.structuredContent?.results[0]?.source).toMatchObject({
      canonicalUrl: "https://docs.example.com/docs/install",
      scope: { audience: "agent" },
    });
    expect(payload.result?.structuredContent?.results[0]?.source?.scope.locale).toBeUndefined();
  });

  it("attributes provenance to the locale actually selected by the source", async () => {
    const requestedLocales: Array<string | undefined> = [];
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        siteTitle: "Localized docs",
        resolveLocale(locale) {
          if (locale === "fr") return "fr-CA";
          if (locale === "fr-CA") return "en";
          return "en";
        },
        getPages(locale) {
          requestedLocales.push(locale);
          return [
            {
              slug: "install",
              url: "/docs/install",
              title: "Install",
              content: "Localized provenance needle.",
              rawContent: "# Install\n\nLocalized provenance needle.",
            },
          ];
        },
        getNavigation() {
          return { name: "Localized docs", children: [] };
        },
      },
    });

    const payload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          results: Array<{
            source?: {
              canonicalUrl: string;
              scope: { locale?: string[] };
            };
          }>;
        };
      };
    }>(
      await callMcpTool(
        handlers,
        "search_docs",
        { query: "localized provenance", locale: "fr", audience: "agent" },
        "https://docs.example.com/mcp",
      ),
    );

    expect(requestedLocales.at(-1)).toBe("fr-CA");
    expect(payload.result?.structuredContent?.results[0]?.source).toMatchObject({
      canonicalUrl: expect.stringContaining("?lang=fr-CA"),
      scope: { locale: ["fr-ca"] },
    });

    const contextPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          sources: Array<{
            url: string;
            source?: { scope: { locale?: string[] } };
          }>;
        };
      };
    }>(
      await callMcpTool(
        handlers,
        "get_context",
        { query: "localized provenance", locale: "fr", tokenBudget: 512 },
        "https://docs.example.com/mcp",
      ),
    );
    expect(requestedLocales.at(-1)).toBe("fr-CA");
    expect(contextPayload.result?.structuredContent?.sources[0]).toMatchObject({
      url: expect.stringContaining("?lang=fr-CA"),
      source: { scope: { locale: ["fr-ca"] } },
    });
  });

  it("uses the current file name for non-index fallback titles", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-mcp-fallback-title-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "docs", "guides"), { recursive: true });
    writeFileSync(
      join(rootDir, "docs", "guides", "quickstart.mdx"),
      `# Quickstart

No frontmatter title here.
`,
    );

    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
    });

    const pages = await source.getPages();
    expect(pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "guides/quickstart",
          title: "Quickstart",
        }),
      ]),
    );
  });

  it("omits hidden folder index pages from MCP pages while keeping their children", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-mcp-hidden-folder-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "docs", "overview", "what-is-surge"), { recursive: true });
    writeFileSync(join(rootDir, "docs", "page.mdx"), "# Home\n");
    writeFileSync(
      join(rootDir, "docs", "overview", "page.mdx"),
      `---
title: "Overview"
sidebar:
  folderIndexBehavior: hidden
---

# Overview
`,
    );
    writeFileSync(
      join(rootDir, "docs", "overview", "what-is-surge", "page.mdx"),
      "# What is Surge\n",
    );

    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
    });

    const pages = await source.getPages();

    expect(pages.some((page) => page.url === "/docs/overview")).toBe(false);
    expect(pages.some((page) => page.url === "/docs/overview/what-is-surge")).toBe(true);
  });

  it("does not emit telemetry for tools called through a local MCP request", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
    });
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));

    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("fetch", fetchMock);

    try {
      const handlers = createDocsMcpHttpHandler({
        source,
        mcp: { enabled: true },
        telemetry: { enabled: true, siteOrigin: "https://docs.example.com" },
      });
      const response = await callMcpTool(handlers, "list_pages", {});

      expect(response.status).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it("serves a working MCP transport with the built-in tools", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });
    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true, name: "Example Docs" },
    });

    const initializeResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    expect(initializeResponse.status).toBe(200);
    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    const toolsListResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      }),
    });

    const toolsList = await parseMcpPayload<{
      result?: {
        tools?: Array<{ name: string; outputSchema?: { type?: string } }>;
        nextCursor?: string;
      };
    }>(toolsListResponse);
    const nextToolsList = await parseMcpPayload<{
      result?: {
        tools?: Array<{ name: string; outputSchema?: { type?: string } }>;
      };
    }>(
      await callMcpMethod(handlers, "tools/list", {
        cursor: toolsList.result?.nextCursor,
      }),
    );
    const listedTools = [
      ...(toolsList.result?.tools ?? []),
      ...(nextToolsList.result?.tools ?? []),
    ];

    expect(listedTools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "list_docs",
        "list_pages",
        "list_page_sections",
        "list_tasks",
        "read_task",
        "get_navigation",
        "search_docs",
        "read_page",
        "get_code_examples",
        "get_config_schema",
        "get_context",
        "list_content_changes",
        "hydrate_content_changes",
      ]),
    );
    expect(listedTools).toEqual(
      expect.arrayContaining(
        [
          "list_docs",
          "list_pages",
          "list_page_sections",
          "list_tasks",
          "read_task",
          "get_navigation",
          "search_docs",
          "read_page",
          "get_code_examples",
          "get_config_schema",
          "get_context",
          "list_content_changes",
          "hydrate_content_changes",
        ].map((name) =>
          expect.objectContaining({
            name,
            outputSchema: expect.objectContaining({ type: "object" }),
          }),
        ),
      ),
    );
    for (const toolName of ["list_pages", "list_docs"]) {
      expect(listedTools.find((tool) => tool.name === toolName)?.outputSchema).toMatchObject({
        properties: {
          pages: {
            type: "array",
            items: {
              type: "object",
              properties: {
                agent: {
                  type: "object",
                  properties: { hasContract: { type: "boolean" } },
                },
              },
            },
          },
        },
      });
    }

    const listPagesResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "list-pages",
          method: "tools/call",
          params: { name: "list_pages", arguments: {} },
        }),
      }),
    });
    const listPagesPayload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }> };
    }>(listPagesResponse);
    const listedPages = JSON.parse(listPagesPayload.result?.content?.[0]?.text ?? "{}") as {
      pages?: Array<{
        url?: string;
        agent?: {
          hasContract?: boolean;
          task?: string;
          outcome?: string;
          files?: string[];
          commands?: unknown[];
        };
      }>;
    };
    expect(listedPages.pages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "/docs/installation",
          agent: expect.objectContaining({
            hasContract: true,
            task: "Install the framework",
            outcome: "Dependencies are installed from the lockfile.",
          }),
        }),
      ]),
    );
    const installationSummary = listedPages.pages?.find(
      (page) => page.url === "/docs/installation",
    );
    expect(installationSummary?.agent).not.toHaveProperty("files");
    expect(installationSummary?.agent).not.toHaveProperty("commands");

    const listTasksResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "list-tasks",
          method: "tools/call",
          params: {
            name: "list_tasks",
            arguments: { query: "lockfile", framework: "nextjs" },
          },
        }),
      }),
    });
    const listTasksPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          resultCount?: number;
          tasks?: Array<{ url?: string; task?: string; appliesTo?: unknown }>;
        };
        content?: Array<{ text?: string }>;
      };
    }>(listTasksResponse);
    expect(listTasksPayload.result?.structuredContent).toMatchObject({
      resultCount: 1,
      tasks: [
        {
          url: "/docs/installation",
          task: "Install the framework",
          appliesTo: {
            framework: ["nextjs"],
            package: ["@farming-labs/next"],
          },
        },
      ],
    });
    expect(JSON.parse(listTasksPayload.result?.content?.[0]?.text ?? "{}")).toEqual(
      listTasksPayload.result?.structuredContent,
    );

    const readTaskResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "read-task",
          method: "tools/call",
          params: { name: "read_task", arguments: { path: "installation" } },
        }),
      }),
    });
    const readTaskPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          page?: { url?: string };
          contract?: { files?: string[]; commands?: unknown[]; verification?: unknown[] };
        };
        content?: Array<{ text?: string }>;
      };
    }>(readTaskResponse);
    expect(readTaskPayload.result?.structuredContent).toMatchObject({
      page: { url: "/docs/installation" },
      contract: {
        files: ["package.json", "pnpm-lock.yaml"],
        commands: [
          {
            run: "pnpm install --frozen-lockfile",
            description: "Install exact dependency versions",
          },
        ],
        verification: [{ run: "pnpm test", expect: "Tests pass" }],
      },
    });
    expect(JSON.parse(readTaskPayload.result?.content?.[0]?.text ?? "{}")).toEqual(
      readTaskPayload.result?.structuredContent,
    );

    const listDocsResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "list-docs",
          method: "tools/call",
          params: {
            name: "list_docs",
            arguments: {
              section: "guides",
            },
          },
        }),
      }),
    });

    const listDocsPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: Record<string, unknown>;
      };
    }>(listDocsResponse);
    expectSuccessfulStructuredTextResult(listDocsPayload);
    const listDocsText = listDocsPayload.result?.content?.[0]?.text ?? "{}";
    const docsList = JSON.parse(listDocsText) as {
      section?: string;
      resultCount?: number;
      sectionCount?: number;
      pages?: Array<{
        slug?: string;
        url?: string;
        sourcePath?: string;
        agent?: { hasContract?: boolean; task?: string; outcome?: string; files?: string[] };
      }>;
      sections?: Array<{
        slug?: string;
        title?: string;
        pageCount?: number;
        pages?: Array<{ slug?: string; url?: string }>;
      }>;
    };

    expect(docsList).toMatchObject({
      section: "guides",
      resultCount: 1,
      sectionCount: 1,
      pages: [
        expect.objectContaining({
          slug: "guides/quickstart",
          url: "/docs/guides/quickstart",
          sourcePath: "docs/guides/quickstart.mdx",
          agent: {
            hasContract: true,
            task: "Create the first docs page",
            outcome: "The quickstart route renders.",
          },
        }),
      ],
      sections: [
        expect.objectContaining({
          slug: "guides",
          title: "Guides",
          pageCount: 1,
          pages: [
            expect.objectContaining({
              slug: "guides/quickstart",
              url: "/docs/guides/quickstart",
            }),
          ],
        }),
      ],
    });
    expect(docsList.pages?.[0]?.agent).not.toHaveProperty("files");
    expect(listDocsPayload.result?.structuredContent).toEqual(docsList);

    const searchResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: {
            name: "search_docs",
            arguments: {
              query: "generated example paths",
            },
          },
        }),
      }),
    });

    const searchPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { results?: Array<{ url?: string }> };
      };
    }>(searchResponse);
    expectSuccessfulStructuredTextResult(searchPayload);

    expect(searchPayload.result?.content?.[0]?.text).toContain("/docs/guides/quickstart");
    expect(searchPayload.result?.structuredContent?.results).toEqual(
      expect.arrayContaining([expect.objectContaining({ url: "/docs/guides/quickstart" })]),
    );

    const readPageResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "read_page",
            arguments: {
              path: "installation",
            },
          },
        }),
      }),
    });

    const readPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          page?: { url?: string };
          document?: string;
          chars?: number;
          truncated?: boolean;
        };
      };
    }>(readPageResponse);
    expectSuccessfulStructuredTextResult(readPayload);

    expect(readPayload.result?.content?.[0]?.text).toContain(
      "Use `pnpm install --frozen-lockfile`.",
    );
    expect(readPayload.result?.content?.[0]?.text).toContain("## Agent Contract");
    expect(readPayload.result?.content?.[0]?.text).toContain("Task: Install the framework");
    expect(readPayload.result?.content?.[0]?.text).toContain("- Package: `@farming-labs/next`");
    expect(readPayload.result?.content?.[0]?.text).not.toContain("# Installation");
    expect(readPayload.result?.content?.[0]?.text).not.toContain("URL: /docs/installation");
    const readDocument = readPayload.result?.content?.[0]?.text ?? "";
    expect(readPayload.result?.structuredContent).toMatchObject({
      page: { url: "/docs/installation" },
      document: readDocument,
      chars: readDocument.length,
      truncated: false,
    });

    const quickstartReadResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: {
            name: "read_page",
            arguments: {
              path: "guides/quickstart",
            },
          },
        }),
      }),
    });

    const quickstartPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { page?: { framework?: string; version?: string } };
      };
    }>(quickstartReadResponse);

    expect(quickstartPayload.result?.content?.[0]?.text).toContain(
      "Validate the generated example paths before editing this guide.",
    );
    expect(quickstartPayload.result?.content?.[0]?.text).toContain(
      "Related: /docs/installation, /docs",
    );
    expect(quickstartPayload.result?.content?.[0]?.text).not.toContain("<Agent>");
    expect(quickstartPayload.result?.structuredContent?.page).toMatchObject({
      framework: "nextjs",
      version: "16",
    });

    const codeExamplesResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: {
            name: "get_code_examples",
            arguments: {
              path: "guides/quickstart",
              framework: "nextjs",
              packageManager: "pnpm",
              runnable: true,
            },
          },
        }),
      }),
    });

    const codeExamplesPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { examples?: unknown[] };
      };
    }>(codeExamplesResponse);
    expectSuccessfulStructuredTextResult(codeExamplesPayload);
    const codeExamplesText = codeExamplesPayload.result?.content?.[0]?.text ?? "{}";
    const codeExamples = JSON.parse(codeExamplesText) as {
      examples?: Array<{
        language?: string;
        title?: string;
        framework?: string;
        packageManager?: string;
        runnable?: boolean;
        meta?: Record<string, unknown>;
        code?: string;
        page?: { url?: string };
      }>;
    };

    expect(codeExamples.examples).toEqual([
      expect.objectContaining({
        language: "ts",
        title: "docs.config.ts",
        framework: "nextjs",
        packageManager: "pnpm",
        runnable: true,
        page: expect.objectContaining({ url: "/docs/guides/quickstart" }),
        meta: expect.objectContaining({
          title: "docs.config.ts",
          framework: "nextjs",
          packageManager: "pnpm",
          runnable: true,
        }),
        code: expect.stringContaining("defineDocs"),
      }),
    ]);
    expect(codeExamplesPayload.result?.structuredContent).toEqual(codeExamples);

    const configSchemaResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 7,
          method: "tools/call",
          params: {
            name: "get_config_schema",
            arguments: {
              option: "mcp.tools.getConfigSchema",
            },
          },
        }),
      }),
    });

    const configSchemaPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: Record<string, unknown>;
      };
    }>(configSchemaResponse);
    expectSuccessfulStructuredTextResult(configSchemaPayload);
    const configSchemaText = configSchemaPayload.result?.content?.[0]?.text ?? "{}";
    const configSchema = JSON.parse(configSchemaText) as {
      resultCount?: number;
      options?: Array<{
        path?: string;
        name?: string;
        type?: string;
        default?: boolean;
        description?: string;
      }>;
    };

    expect(configSchema.resultCount).toBe(1);
    expect(configSchema.options).toEqual([
      expect.objectContaining({
        path: "mcp.tools.getConfigSchema",
        name: "getConfigSchema",
        type: "boolean",
        default: true,
        description: expect.stringContaining("get_config_schema"),
      }),
    ]);
    expect(configSchemaPayload.result?.structuredContent).toEqual(configSchema);

    const ambiguousConfigSchemaResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 8,
          method: "tools/call",
          params: {
            name: "get_config_schema",
            arguments: {
              option: "enabled",
            },
          },
        }),
      }),
    });

    const ambiguousConfigSchemaPayload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }> };
    }>(ambiguousConfigSchemaResponse);
    const ambiguousConfigSchemaText =
      ambiguousConfigSchemaPayload.result?.content?.[0]?.text ?? "{}";
    const ambiguousConfigSchema = JSON.parse(ambiguousConfigSchemaText) as {
      resultCount?: number;
      options?: unknown[];
    };

    expect(ambiguousConfigSchema.resultCount).toBe(0);
    expect(ambiguousConfigSchema.options).toEqual([]);

    const structuredListPagesPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { pages?: Array<{ url?: string }> };
      };
    }>(await callMcpTool(handlers, "list_pages", {}));
    expectSuccessfulStructuredTextResult(structuredListPagesPayload);
    expect(structuredListPagesPayload.result?.structuredContent?.pages).toEqual(
      expect.arrayContaining([expect.objectContaining({ url: "/docs/installation" })]),
    );
    expect(JSON.parse(structuredListPagesPayload.result?.content?.[0]?.text ?? "{}")).toEqual(
      structuredListPagesPayload.result?.structuredContent,
    );

    const navigationPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          navigation?: { name?: string; children?: unknown[] };
          markdown?: string;
        };
      };
    }>(await callMcpTool(handlers, "get_navigation", {}));
    expectSuccessfulStructuredTextResult(navigationPayload);
    expect(navigationPayload.result?.structuredContent?.navigation).toMatchObject({
      name: "Example Docs",
      children: expect.any(Array),
    });
    expect(navigationPayload.result?.content?.[0]?.text).toBe(
      navigationPayload.result?.structuredContent?.markdown,
    );

    const sectionPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          document?: string;
          section?: string;
          anchor?: string;
          chars?: number;
          truncated?: boolean;
        };
      };
    }>(
      await callMcpTool(handlers, "read_page", {
        path: "guides/quickstart",
        section: "verify-generated-paths",
        maxChars: 256,
      }),
    );
    expect(sectionPayload.result?.content?.[0]?.text).toContain("## Verify generated paths");
    expect(sectionPayload.result?.content?.[0]?.text).not.toContain("# Quickstart");
    expect(sectionPayload.result?.structuredContent).toMatchObject({
      section: "Verify generated paths",
      anchor: "verify-generated-paths",
      truncated: false,
    });
    expect(sectionPayload.result?.structuredContent?.document).toBe(
      sectionPayload.result?.content?.[0]?.text,
    );

    const pageHeadingPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { document?: string; section?: string; anchor?: string };
      };
    }>(
      await callMcpTool(handlers, "read_page", {
        path: "guides/quickstart",
        section: "quickstart",
      }),
    );
    expect(pageHeadingPayload.result?.structuredContent).toMatchObject({
      section: "Quickstart",
      anchor: "quickstart",
      document: expect.stringContaining("Build your first app."),
    });

    const contextArguments = {
      query: "generated example paths",
      framework: "next",
      version: "v16",
      tags: ["SETUP"],
      tokenBudget: 256,
    };
    const contextPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          context?: string;
          resultCount?: number;
          candidateCount?: number;
          filters?: { tags?: string[] };
          budget?: {
            requestedTokens?: number;
            strategy?: string;
            maxUtf8Bytes?: number;
            usedUtf8Bytes?: number;
            conservativeTokenUpperBound?: number;
          };
          sources?: Array<{
            url?: string;
            pageUrl?: string;
            section?: string;
            anchor?: string;
            framework?: string;
            version?: string;
            tags?: string[];
          }>;
        };
      };
    }>(await callMcpTool(handlers, "get_context", contextArguments));
    expectSuccessfulStructuredTextResult(contextPayload);
    const context = contextPayload.result?.structuredContent;
    expect(contextPayload.result?.content?.[0]?.text).toBe(context?.context);
    expect(context?.budget).toMatchObject({
      requestedTokens: 256,
      strategy: "utf8-bytes",
      maxUtf8Bytes: 256,
    });
    const contextUtf8Bytes = new TextEncoder().encode(context?.context ?? "").byteLength;
    expect(context?.budget?.usedUtf8Bytes).toBe(contextUtf8Bytes);
    expect(context?.budget?.conservativeTokenUpperBound).toBe(contextUtf8Bytes);
    expect(contextUtf8Bytes).toBeLessThanOrEqual(256);
    expect(context?.filters?.tags).toEqual(["setup"]);
    expect(context?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "http://localhost/docs/guides/quickstart#verify-generated-paths",
          pageUrl: "/docs/guides/quickstart",
          section: "Verify generated paths",
          anchor: "verify-generated-paths",
          framework: "nextjs",
          version: "16",
          tags: ["setup"],
        }),
      ]),
    );

    const repeatedContextPayload = await parseMcpPayload<{
      result?: { structuredContent?: Record<string, unknown> };
    }>(await callMcpTool(handlers, "get_context", contextArguments));
    expect(repeatedContextPayload.result?.structuredContent).toEqual(context);

    const pageHeadingContextPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          sources?: Array<{ url?: string; content?: string }>;
        };
      };
    }>(
      await callMcpTool(handlers, "get_context", {
        query: "Build your first app",
        tokenBudget: 256,
      }),
    );
    expect(pageHeadingContextPayload.result?.structuredContent?.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "http://localhost/docs/guides/quickstart#quickstart",
          content: expect.stringContaining("Build your first app."),
        }),
      ]),
    );

    const deleteResponse = await handlers.DELETE({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "DELETE",
        headers: {
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
      }),
    });

    expect(deleteResponse.status).toBe(405);
  });

  it("keeps general docs in scoped context, excludes mismatches, and orders sources deterministically within hard budgets", async () => {
    const sharedContent = `# Runtime configuration

Shared runtime configuration guidance.

${"Detailed runtime configuration guidance. ".repeat(60)}`;
    const pages: DocsMcpPage[] = [
      {
        slug: "a-general",
        url: "/docs/a-general",
        title: "Alpha",
        content: sharedContent,
        rawContent: sharedContent,
      },
      {
        slug: "b-general",
        url: "/docs/b-general",
        title: "Beta",
        content: sharedContent,
        rawContent: sharedContent,
      },
      {
        slug: "c-next",
        url: "/docs/c-next",
        title: "Gamma",
        locale: "en",
        framework: "nextjs",
        version: "16",
        content: sharedContent,
        rawContent: sharedContent,
      },
      {
        slug: "c-next-fr",
        url: "/docs/c-next-fr",
        title: "Gamma French",
        locale: "fr",
        framework: "nextjs",
        version: "16",
        content: sharedContent,
        rawContent: sharedContent,
      },
      {
        slug: "c-next-old",
        url: "/docs/c-next-old",
        title: "Gamma old",
        framework: "nextjs",
        version: "15",
        content: sharedContent,
        rawContent: sharedContent,
      },
      {
        slug: "d-astro",
        url: "/docs/d-astro",
        title: "Delta",
        framework: "astro",
        version: "5",
        content: sharedContent,
        rawContent: sharedContent,
      },
    ];

    function createHandlers(sourcePages: DocsMcpPage[]) {
      return createDocsMcpHttpHandler({
        source: {
          entry: "docs",
          siteTitle: "Scoped docs",
          getPages: () => sourcePages,
          getNavigation: () => ({ name: "Scoped docs", children: [] }),
        },
      });
    }

    const contextArguments = {
      query: "runtime configuration",
      framework: "next",
      version: "v16",
      locale: "en",
      tokenBudget: 8_000,
    };
    const forwardPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          context: string;
          candidateCount: number;
          resultCount: number;
          budget: {
            requestedTokens: number;
            strategy: string;
            maxUtf8Bytes: number;
          };
          sources: Array<{
            pageUrl: string;
            locale?: string;
            framework?: string;
            version?: string;
          }>;
        };
      };
    }>(await callMcpTool(createHandlers(pages), "get_context", contextArguments));
    const reversePayload = await parseMcpPayload<{
      result?: { structuredContent?: Record<string, unknown> };
    }>(await callMcpTool(createHandlers([...pages].reverse()), "get_context", contextArguments));
    const context = forwardPayload.result?.structuredContent;

    expectSuccessfulStructuredTextResult(forwardPayload);
    expect(context).toMatchObject({
      candidateCount: 3,
      resultCount: 3,
      budget: { requestedTokens: 8_000, strategy: "utf8-bytes", maxUtf8Bytes: 8_000 },
    });
    expect(context?.sources.map((source) => source.pageUrl)).toEqual([
      "/docs/a-general",
      "/docs/b-general",
      "/docs/c-next",
    ]);
    expect(context?.sources.slice(0, 2)).toEqual([
      expect.not.objectContaining({ framework: expect.any(String) }),
      expect.not.objectContaining({ framework: expect.any(String) }),
    ]);
    expect(context?.sources[2]).toMatchObject({
      locale: "en",
      framework: "nextjs",
      version: "16",
    });
    expect(reversePayload.result?.structuredContent).toEqual(context);

    const tightPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          context: string;
          budget: {
            requestedTokens: number;
            strategy: string;
            maxUtf8Bytes: number;
            usedUtf8Bytes: number;
            conservativeTokenUpperBound: number;
            remainingUtf8Bytes: number;
            truncated: boolean;
          };
          sources: Array<{ truncated: boolean }>;
        };
      };
    }>(
      await callMcpTool(createHandlers(pages), "get_context", {
        ...contextArguments,
        tokenBudget: 256,
      }),
    );
    const tight = tightPayload.result?.structuredContent;

    expectSuccessfulStructuredTextResult(tightPayload);
    expect(tightPayload.result?.content?.[0]?.text).toBe(tight?.context);
    expect(tight?.budget).toMatchObject({
      requestedTokens: 256,
      strategy: "utf8-bytes",
      maxUtf8Bytes: 256,
      truncated: true,
    });
    const tightUtf8Bytes = new TextEncoder().encode(tight?.context ?? "").byteLength;
    expect(tight?.budget.usedUtf8Bytes).toBe(tightUtf8Bytes);
    expect(tight?.budget.conservativeTokenUpperBound).toBe(tightUtf8Bytes);
    expect(tight?.budget.remainingUtf8Bytes).toBe(256 - tightUtf8Bytes);
    expect(tightUtf8Bytes).toBeLessThanOrEqual(256);
    expect(tight?.sources.at(-1)?.truncated).toBe(true);
  });

  it("uses structured agent applicability when filtering context by framework and version", async () => {
    const content = `# Installation

Install the docs package for this framework release.
`;
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        getPages: () => [
          {
            slug: "next-16",
            url: "/docs/next-16",
            title: "Next.js 16 installation",
            content,
            rawContent: content,
            agent: {
              task: "Install the docs package on Next.js 16",
              outcome: "The package runs on Next.js 16.",
              appliesTo: { framework: ["nextjs"], version: [">=16"] },
            },
          },
          {
            slug: "next-15",
            url: "/docs/next-15",
            title: "Next.js 15 installation",
            content,
            rawContent: content,
            agent: {
              task: "Install the docs package on Next.js 15",
              outcome: "The package runs on Next.js 15.",
              appliesTo: { framework: ["nextjs"], version: ["15"] },
            },
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });

    const payload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          candidateCount: number;
          sources: Array<{ pageUrl: string; framework?: string; version?: string }>;
        };
      };
    }>(
      await callMcpTool(handlers, "get_context", {
        query: "install docs package",
        framework: "next",
        version: "v16",
        tokenBudget: 2_000,
      }),
    );

    expect(payload.result?.structuredContent).toMatchObject({
      candidateCount: 1,
      sources: [
        {
          pageUrl: "/docs/next-16",
          framework: "nextjs",
          version: ">=16",
        },
      ],
    });
  });

  it("hydrates contract-only context matches with the structured agent contract", async () => {
    const rawContent = `# Operations

General operational guidance.
`;
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        getPages: () => [
          {
            slug: "credential-rotation",
            url: "/docs/credential-rotation",
            title: "Operations",
            content: rawContent,
            rawContent,
            agent: {
              task: "Rotate quasar production credentials",
              outcome: "Production uses the replacement credential without downtime.",
              commands: [{ run: "pnpm credentials:rotate", description: "Rotate credentials" }],
            },
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const payload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          context?: string;
          resultCount?: number;
          sources?: Array<{ url?: string; section?: string; content?: string }>;
        };
      };
    }>(
      await callMcpTool(handlers, "get_context", {
        query: "quasar production credentials",
        tokenBudget: 4_000,
      }),
    );

    expectSuccessfulStructuredTextResult(payload);
    expect(payload.result?.structuredContent).toMatchObject({
      resultCount: 1,
      sources: [
        expect.objectContaining({
          url: "http://localhost/docs/credential-rotation",
          content: expect.stringContaining("Task: Rotate quasar production credentials"),
        }),
      ],
    });
    expect(payload.result?.structuredContent?.context).toContain(
      "Task: Rotate quasar production credentials",
    );
  });

  it("bounds the complete assembled context by UTF-8 bytes for Unicode and code", async () => {
    const rawContent = `# Unicode budget

## Byte ceiling

你好🙂 ${"多语言内容🙂 ".repeat(80)}

\`\`\`ts
${'export const value = "你好🙂";\n'.repeat(40)}
\`\`\`
`;
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        getPages: () => [
          {
            slug: "unicode-budget",
            url: "/docs/unicode-budget",
            title: "Unicode budget",
            content: rawContent,
            rawContent,
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const payload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          context: string;
          budget: {
            requestedTokens: number;
            strategy: string;
            maxUtf8Bytes: number;
            usedUtf8Bytes: number;
            conservativeTokenUpperBound: number;
            remainingUtf8Bytes: number;
          };
          sources: Array<{ content: string; utf8Bytes: number }>;
        };
      };
    }>(
      await callMcpTool(handlers, "get_context", {
        query: "byte ceiling",
        tokenBudget: 256,
      }),
    );
    const result = payload.result?.structuredContent;
    const contextBytes = new TextEncoder().encode(result?.context ?? "").byteLength;

    expectSuccessfulStructuredTextResult(payload);
    expect(result?.budget).toMatchObject({
      requestedTokens: 256,
      strategy: "utf8-bytes",
      maxUtf8Bytes: 256,
      usedUtf8Bytes: contextBytes,
      conservativeTokenUpperBound: contextBytes,
      remainingUtf8Bytes: 256 - contextBytes,
    });
    expect(contextBytes).toBeLessThanOrEqual(256);
    expect(result?.context).not.toContain("�");
    expect(result?.sources[0]?.utf8Bytes).toBe(
      new TextEncoder().encode(result?.sources[0]?.content ?? "").byteLength,
    );

    const defaultPayload = await parseMcpPayload<{
      result?: { structuredContent?: { budget?: Record<string, unknown> } };
    }>(await callMcpTool(handlers, "get_context", { query: "byte ceiling" }));
    expect(defaultPayload.result?.structuredContent?.budget).toMatchObject({
      requestedTokens: 4_000,
      maxUtf8Bytes: 4_000,
    });
  });

  it("discovers canonical page sections without returning the document body", async () => {
    const resolvedLocaleInputs: Array<string | undefined> = [];
    const servedLocales: Array<string | undefined> = [];
    const rawContent = [
      "# Install",
      "",
      "PRIVATE_PAGE_BODY",
      "",
      "## Café 配置",
      "",
      "PRIVATE_FIRST_SECTION",
      "",
      "### Verify",
      "",
      "PRIVATE_NESTED_SECTION",
      "",
      "## Café 配置",
      "",
      "PRIVATE_SECOND_SECTION",
    ].join("\n");
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        baseUrl: "https://canonical.docs.example",
        resolveLocale: (locale) => {
          resolvedLocaleInputs.push(locale);
          if (locale === "fr") return "fr-CA";
          if (locale === "fr-CA") return "resolved-twice";
          return locale;
        },
        getPages: (locale) => {
          servedLocales.push(locale);
          return [
            {
              slug: "international-v1",
              url: "/docs/international?source=other",
              title: "Wrong international version",
              content: "# Wrong\n\nWRONG_VERSION_BODY",
              rawContent: "# Wrong\n\nWRONG_VERSION_BODY",
            },
            {
              slug: "international",
              url: "/docs/international?source=page",
              title: "International",
              content: rawContent,
              rawContent,
            },
          ];
        },
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const payload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          schemaVersion?: number;
          format?: string;
          canonicalUrl?: string;
          markdownUrl?: string;
          sectionIndexUrl?: string;
          lineNumbering?: string;
          sectionCount?: number;
          estimatedTokens?: number;
          utf8Bytes?: number;
          fetchBudget?: { tokenBudget?: number; byteBudget?: number };
          sections?: Array<{
            id?: string;
            heading?: string;
            level?: number;
            parentId?: string;
            startLine?: number;
            endLine?: number;
            estimatedTokens?: number;
            utf8Bytes?: number;
            canonicalUrl?: string;
            markdownUrl?: string;
            content?: string;
            document?: string;
          }>;
        };
        isError?: boolean;
      };
    }>(
      await callMcpTool(
        handlers,
        "list_page_sections",
        {
          path: "/docs/international?source=page",
          locale: "fr",
          tokenBudget: 80,
          byteBudget: 256,
        },
        "https://untrusted-preview.example/api/docs/mcp",
      ),
    );

    expectSuccessfulStructuredTextResult(payload);
    const result = payload.result?.structuredContent;
    expect(result).toMatchObject({
      schemaVersion: 2,
      format: "docs-markdown-sections.v2",
      lineNumbering: "body",
      sectionCount: 4,
      fetchBudget: { tokenBudget: 80, byteBudget: 256 },
      sections: [
        expect.objectContaining({ id: "install", heading: "Install", level: 1 }),
        expect.objectContaining({
          id: "café-配置",
          heading: "Café 配置",
          level: 2,
          parentId: "install",
        }),
        expect.objectContaining({
          id: "verify",
          heading: "Verify",
          level: 3,
          parentId: "café-配置",
        }),
        expect.objectContaining({
          id: "café-配置-1",
          heading: "Café 配置",
          level: 2,
          parentId: "install",
        }),
      ],
    });
    expect(result?.estimatedTokens).toBeGreaterThan(0);
    expect(result?.utf8Bytes).toBeGreaterThan(0);
    expect(result?.sections?.every((section) => (section.startLine ?? 0) > 0)).toBe(true);
    expect(
      result?.sections?.every(
        (section) =>
          (section.endLine ?? 0) >= (section.startLine ?? 0) &&
          (section.estimatedTokens ?? 0) > 0 &&
          (section.utf8Bytes ?? 0) > 0,
      ),
    ).toBe(true);

    for (const value of [
      result?.canonicalUrl,
      result?.markdownUrl,
      result?.sectionIndexUrl,
      ...((result?.sections ?? []).flatMap((section) => [
        section.canonicalUrl,
        section.markdownUrl,
      ]) as Array<string | undefined>),
    ]) {
      expect(value).toBeTruthy();
      expect(new URL(value!).origin).toBe("https://canonical.docs.example");
      expect(new URL(value!).searchParams.get("lang")).toBe("fr-CA");
    }
    expect(new URL(result?.sectionIndexUrl ?? "").searchParams.has("sections")).toBe(true);
    const secondFetchUrl = new URL(result?.sections?.[3]?.markdownUrl ?? "");
    expect(secondFetchUrl.searchParams.get("section")).toBe("café-配置-1");
    expect(secondFetchUrl.searchParams.get("tokenBudget")).toBe("80");
    expect(secondFetchUrl.searchParams.get("byteBudget")).toBe("256");
    expect(
      decodeURIComponent(new URL(result?.sections?.[3]?.canonicalUrl ?? "").hash.slice(1)),
    ).toBe("café-配置-1");

    const serialized = JSON.stringify(payload.result);
    expect(serialized).not.toContain("PRIVATE_PAGE_BODY");
    expect(serialized).not.toContain("PRIVATE_FIRST_SECTION");
    expect(serialized).not.toContain("PRIVATE_NESTED_SECTION");
    expect(serialized).not.toContain("PRIVATE_SECOND_SECTION");
    expect(serialized).not.toContain("WRONG_VERSION_BODY");
    expect(result?.sections?.every((section) => !("content" in section))).toBe(true);
    expect(result?.sections?.every((section) => !("document" in section))).toBe(true);
    expect(resolvedLocaleInputs).toContain("fr");
    expect(resolvedLocaleInputs).not.toContain("fr-CA");
    expect(servedLocales).toContain("fr-CA");
    expect(servedLocales).not.toContain("resolved-twice");
  });

  it("returns an empty body-free index for heading-less pages and an error for missing pages", async () => {
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        getPages: () => [
          {
            slug: "heading-less",
            url: "/docs/heading-less?source=page",
            title: "Synthetic title must stay absent",
            content: "PRIVATE_HEADING_LESS_BODY",
            rawContent: "PRIVATE_HEADING_LESS_BODY",
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });

    const emptyPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: { sectionCount?: number; sections?: unknown[] };
      };
    }>(
      await callMcpTool(handlers, "list_page_sections", {
        path: "/docs/heading-less",
      }),
    );
    expectSuccessfulStructuredTextResult(emptyPayload);
    expect(emptyPayload.result?.structuredContent).toMatchObject({
      sectionCount: 0,
      sections: [],
    });
    expect(JSON.stringify(emptyPayload.result)).not.toContain("PRIVATE_HEADING_LESS_BODY");
    expect(JSON.stringify(emptyPayload.result)).not.toContain("Synthetic title must stay absent");

    const missingPayload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }>; isError?: boolean };
    }>(
      await callMcpTool(handlers, "list_page_sections", {
        path: "/docs/missing",
      }),
    );
    expect(missingPayload.result?.isError).toBe(true);
    expect(JSON.parse(missingPayload.result?.content?.[0]?.text ?? "{}")).toEqual({
      error: 'No docs page matched "/docs/missing".',
    });
    expect(JSON.stringify(missingPayload.result)).not.toContain("PRIVATE_HEADING_LESS_BODY");
  });

  it("caps section-not-found errors and includes only headings that fit", async () => {
    const rawContent = Array.from(
      { length: 20 },
      (_, index) => `## Available heading ${index + 1}\n\nDetails ${index + 1}.`,
    ).join("\n\n");
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        getPages: () => [
          {
            slug: "sections",
            url: "/docs/sections",
            title: "Sections",
            content: rawContent,
            rawContent,
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const payload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        isError?: boolean;
      };
    }>(
      await callMcpTool(handlers, "read_page", {
        path: "/docs/sections",
        section: "missing-heading",
        maxChars: 256,
      }),
    );
    const text = payload.result?.content?.[0]?.text ?? "";
    const error = JSON.parse(text) as {
      error?: string;
      availableSections?: Array<{ title?: string; anchor?: string }>;
      truncated?: boolean;
    };

    expect(payload.result?.isError).toBe(true);
    expect(text.length).toBeLessThanOrEqual(256);
    expect(error).toMatchObject({ error: "section_not_found", truncated: true });
    expect(error.availableSections?.length).toBeGreaterThan(0);
    expect(error.availableSections?.[0]).toEqual({
      title: "Available heading 1",
      anchor: "available-heading-1",
    });
  });

  it("reads duplicate Unicode sections with the canonical rendered anchor", async () => {
    const rawContent = [
      "# International setup",
      "",
      "## Café 配置",
      "",
      "First configuration.",
      "",
      "## Café 配置",
      "",
      "Second configuration.",
    ].join("\n");
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        getPages: () => [
          {
            slug: "international",
            url: "/docs/international",
            title: "International setup",
            content: rawContent,
            rawContent,
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const payload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          document?: string;
          section?: string;
          anchor?: string;
        };
      };
    }>(
      await callMcpTool(handlers, "read_page", {
        path: "/docs/international",
        section: "café-配置-1",
      }),
    );

    expect(payload.result?.structuredContent).toMatchObject({
      section: "Café 配置",
      anchor: "café-配置-1",
      document: expect.stringContaining("Second configuration."),
    });
    expect(payload.result?.content?.[0]?.text).not.toContain("First configuration.");
  });

  it("does not let the synthetic page title shift an MCP contract anchor", async () => {
    const handlers = createDocsMcpHttpHandler({
      source: {
        entry: "docs",
        getPages: () => [
          {
            slug: "agent-contract",
            url: "/docs/agent-contract",
            title: "Agent Contract",
            content: "Use the generated contract.",
            rawContent: "Use the generated contract.",
            agent: {
              task: "Read the generated contract.",
              outcome: "The canonical contract section is returned.",
            },
          },
        ],
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });
    const canonical = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: {
          document?: string;
          section?: string;
          anchor?: string;
        };
      };
    }>(
      await callMcpTool(handlers, "read_page", {
        path: "/docs/agent-contract",
        section: "agent-contract",
      }),
    );

    expect(canonical.result?.structuredContent).toMatchObject({
      section: "Agent Contract",
      anchor: "agent-contract",
      document: expect.stringContaining("## Agent Contract"),
    });
    expect(canonical.result?.structuredContent?.document).not.toContain("URL:");

    const shifted = await parseMcpPayload<{
      result?: {
        isError?: boolean;
        content?: Array<{ text?: string }>;
      };
    }>(
      await callMcpTool(handlers, "read_page", {
        path: "/docs/agent-contract",
        section: "agent-contract-1",
      }),
    );
    expect(shifted.result?.isError).toBe(true);
    expect(shifted.result?.content?.[0]?.text).toContain('"agent-contract"');
  });

  it("rejects invalid supplied Origins before authentication", async () => {
    const rootDir = createTempDocsProject();
    const authenticate = vi.fn(async () => ({ id: "docs-user" }));
    const handlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({ rootDir }),
      mcp: {
        security: { authenticate },
      },
    });

    const response = await handlers.POST({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "POST",
        headers: {
          origin: "https://malicious.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      }),
    });

    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Forbidden Origin" });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("accepts same-origin and explicitly allowed Origins", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({ rootDir });
    const initializeBody = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" },
      },
    });
    const requestHeaders = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
    };

    const sameOriginHandlers = createDocsMcpHttpHandler({ source });
    const sameOriginResponse = await sameOriginHandlers.POST({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "POST",
        headers: { ...requestHeaders, origin: "https://docs.example.com" },
        body: initializeBody,
      }),
    });
    expect(sameOriginResponse.status).toBe(200);
    expect(sameOriginResponse.headers.get("access-control-allow-origin")).toBe(
      "https://docs.example.com",
    );
    expect(sameOriginResponse.headers.get("access-control-allow-credentials")).toBeNull();

    const allowedOriginHandlers = createDocsMcpHttpHandler({
      source,
      mcp: {
        security: { allowedOrigins: ["https://app.example.com/"] },
      },
    });
    const allowedOriginResponse = await allowedOriginHandlers.POST({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "POST",
        headers: { ...requestHeaders, origin: "https://app.example.com" },
        body: initializeBody,
      }),
    });
    expect(allowedOriginResponse.status).toBe(200);
    expect(allowedOriginResponse.headers.get("access-control-allow-origin")).toBe(
      "https://app.example.com",
    );
  });

  it("keeps HTTP MCP public until an authentication callback is configured", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({ rootDir });
    const handlers = createDocsMcpHttpHandler({ source });

    const response = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: "vitest", version: "1.0.0" },
          },
        }),
      }),
    });

    expect(response.status).toBe(200);
  });

  it("does not publish protected-resource metadata without authentication", async () => {
    const rootDir = createTempDocsProject();
    const handlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({ rootDir }),
      mcp: {
        security: {
          protectedResource: {
            authorizationServers: ["https://auth.example.com"],
          },
        },
      },
    });

    const response = await handlers.GET({
      request: new Request("https://docs.example.com/.well-known/oauth-protected-resource/mcp"),
    });
    expect(response.status).toBe(404);
  });

  it("publishes RFC 9728 metadata and returns scoped Bearer challenges", async () => {
    const rootDir = createTempDocsProject();
    const authenticate = vi.fn(async ({ request }: DocsMcpAuthenticateContext) => {
      const authorization = request.headers.get("authorization");
      if (!authorization) return null;
      if (authorization === "Bearer limited") {
        return { id: "limited", scopes: ["docs:list"] };
      }
      if (authorization === "Bearer custom-response") {
        return new Response("provider challenge", {
          status: 429,
          headers: {
            "WWW-Authenticate": 'Bearer realm="provider"',
            "X-Auth-Provider": "custom",
          },
        });
      }
      return { id: "reader", scopes: ["docs:list", "docs:read", "docs:write"] };
    });
    const handlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({ rootDir }),
      mcp: {
        route: "/internal/mcp",
        name: "Product docs MCP",
        security: {
          authenticate,
          protectedResource: {
            authorizationServers: ["https://auth.example.com"],
            scopesSupported: ["docs:list", "docs:read", "docs:write"],
            requiredScopes: ["docs:read", "docs:write"],
            resourceDocumentation: "https://docs.example.com/docs/mcp-auth",
          },
        },
      },
    });

    const metadataCases = [
      ["/.well-known/oauth-protected-resource/mcp", "https://docs.example.com/mcp"],
      ["/.well-known/oauth-protected-resource/mcp/", "https://docs.example.com/mcp/"],
      [
        "/.well-known/oauth-protected-resource/.well-known/mcp",
        "https://docs.example.com/.well-known/mcp",
      ],
      [
        "/.well-known/oauth-protected-resource/internal/mcp",
        "https://docs.example.com/internal/mcp",
      ],
    ] as const;

    for (const [metadataPath, resource] of metadataCases) {
      const response = await handlers.GET({
        request: new Request(`https://docs.example.com${metadataPath}`),
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      await expect(response.json()).resolves.toEqual({
        resource,
        authorization_servers: ["https://auth.example.com"],
        scopes_supported: ["docs:list", "docs:read", "docs:write"],
        bearer_methods_supported: ["header"],
        resource_name: "Product docs MCP",
        resource_documentation: "https://docs.example.com/docs/mcp-auth",
      });
    }
    expect(authenticate).not.toHaveBeenCalled();

    const originMetadata = await handlers.GET({
      request: new Request("https://docs.example.com/.well-known/oauth-protected-resource"),
    });
    expect(originMetadata.status).toBe(404);

    const insecureMetadata = await handlers.GET({
      request: new Request("http://docs.example.com/.well-known/oauth-protected-resource/mcp"),
    });
    expect(insecureMetadata.status).toBe(400);

    const loopbackMetadata = await handlers.GET({
      request: new Request("http://localhost/.well-known/oauth-protected-resource/mcp"),
    });
    expect(loopbackMetadata.status).toBe(200);
    await expect(loopbackMetadata.json()).resolves.toMatchObject({
      resource: "http://localhost/mcp",
    });

    const head = await handlers.GET({
      request: new Request("https://docs.example.com/.well-known/oauth-protected-resource/mcp", {
        method: "HEAD",
      }),
    });
    expect(head.status).toBe(200);
    await expect(head.text()).resolves.toBe("");

    const options = await handlers.OPTIONS({
      request: new Request("https://docs.example.com/.well-known/oauth-protected-resource/mcp", {
        method: "OPTIONS",
      }),
    });
    expect(options.status).toBe(204);
    expect(options.headers.get("access-control-allow-origin")).toBe("*");
    expect(options.headers.get("access-control-allow-methods")).toBe("GET, HEAD, OPTIONS");

    const unsupported = await handlers.POST({
      request: new Request("https://docs.example.com/.well-known/oauth-protected-resource/mcp", {
        method: "POST",
      }),
    });
    expect(unsupported.status).toBe(405);
    expect(authenticate).not.toHaveBeenCalled();

    const initializeBody = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" },
      },
    });
    const requestHeaders = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
    };
    const insecureEndpoint = await handlers.POST({
      request: new Request("http://docs.example.com/mcp", {
        method: "POST",
        headers: requestHeaders,
        body: initializeBody,
      }),
    });
    expect(insecureEndpoint.status).toBe(400);
    expect(authenticate).not.toHaveBeenCalled();

    const unauthorized = await handlers.POST({
      request: new Request("https://docs.example.com/mcp", {
        method: "POST",
        headers: requestHeaders,
        body: initializeBody,
      }),
    });
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://docs.example.com/.well-known/oauth-protected-resource/mcp", scope="docs:read docs:write"',
    );
    await expect(unauthorized.json()).resolves.toEqual({ error: "invalid_token" });
    const authenticationContext = authenticate.mock.calls.at(-1)?.[0];
    expect(authenticationContext?.request.url).toBe("https://docs.example.com/mcp");
    expect(authenticationContext?.pathname).toBe("/mcp");
    expect(authenticationContext?.resource).toBe("https://docs.example.com/mcp");

    const queryUnauthorized = await handlers.POST({
      request: new Request("https://docs.example.com/mcp?tenant=one", {
        method: "POST",
        headers: requestHeaders,
        body: initializeBody,
      }),
    });
    expect(queryUnauthorized.headers.get("www-authenticate")).toContain(
      'resource_metadata="https://docs.example.com/.well-known/oauth-protected-resource/mcp?tenant=one"',
    );
    expect(authenticate.mock.calls.at(-1)?.[0].resource).toBe(
      "https://docs.example.com/mcp?tenant=one",
    );

    const queryMetadata = await handlers.GET({
      request: new Request(
        "https://docs.example.com/.well-known/oauth-protected-resource/mcp?tenant=one",
      ),
    });
    await expect(queryMetadata.json()).resolves.toMatchObject({
      resource: "https://docs.example.com/mcp?tenant=one",
    });

    const spoofedAlias = await handlers.POST({
      request: new Request(
        "https://docs.example.com/internal/mcp?__farming_docs_mcp_resource=/mcp",
        {
          method: "POST",
          headers: requestHeaders,
          body: initializeBody,
        },
      ),
    });
    expect(spoofedAlias.headers.get("www-authenticate")).toContain(
      "https://docs.example.com/.well-known/oauth-protected-resource/internal/mcp?__farming_docs_mcp_resource=/mcp",
    );
    expect(authenticate.mock.calls.at(-1)?.[0].resource).toBe(
      "https://docs.example.com/internal/mcp?__farming_docs_mcp_resource=/mcp",
    );

    const callsBeforeNonCanonicalPath = authenticate.mock.calls.length;
    const nonCanonicalPath = await handlers.POST({
      request: new Request("https://docs.example.com/mcp///", {
        method: "POST",
        headers: requestHeaders,
        body: initializeBody,
      }),
    });
    expect(nonCanonicalPath.status).toBe(404);
    expect(authenticate).toHaveBeenCalledTimes(callsBeforeNonCanonicalPath);

    const trailingSlashUnauthorized = await handlers.POST({
      request: new Request("https://docs.example.com/mcp/", {
        method: "POST",
        headers: requestHeaders,
        body: initializeBody,
      }),
    });
    expect(trailingSlashUnauthorized.headers.get("www-authenticate")).toContain(
      'resource_metadata="https://docs.example.com/.well-known/oauth-protected-resource/mcp/"',
    );

    const insufficient = await handlers.POST({
      request: new Request("https://docs.example.com/mcp", {
        method: "POST",
        headers: { ...requestHeaders, authorization: "Bearer limited" },
        body: initializeBody,
      }),
    });
    expect(insufficient.status).toBe(403);
    expect(insufficient.headers.get("www-authenticate")).toContain('error="insufficient_scope"');
    expect(insufficient.headers.get("www-authenticate")).toContain('scope="docs:read docs:write"');
    await expect(insufficient.json()).resolves.toEqual({ error: "insufficient_scope" });

    const customResponse = await handlers.POST({
      request: new Request("https://docs.example.com/mcp", {
        method: "POST",
        headers: { ...requestHeaders, authorization: "Bearer custom-response" },
        body: initializeBody,
      }),
    });
    expect(customResponse.status).toBe(429);
    expect(customResponse.headers.get("www-authenticate")).toBe('Bearer realm="provider"');
    expect(customResponse.headers.get("x-auth-provider")).toBe("custom");
    await expect(customResponse.text()).resolves.toBe("provider challenge");

    const authorized = await handlers.POST({
      request: new Request("https://docs.example.com/mcp", {
        method: "POST",
        headers: { ...requestHeaders, authorization: "Bearer valid" },
        body: initializeBody,
      }),
    });
    expect(authorized.status).toBe(200);
  });

  it("requires opt-in authentication and exposes the principal to custom sources", async () => {
    const rootDir = createTempDocsProject();
    const filesystemSource = createFilesystemDocsMcpSource({ rootDir });
    const seenContexts: unknown[] = [];
    const originPolicyBodies: string[] = [];
    const authenticatedBodies: string[] = [];
    const allowedOrigins = vi.fn(async ({ request }) => {
      originPolicyBodies.push(await request.text());
      return true;
    });
    const authenticate = vi.fn(async ({ request, pathname }) => {
      authenticatedBodies.push(await request.text());
      if (request.headers.get("authorization") !== "Bearer valid") return null;
      return {
        id: "user-123",
        scopes: ["docs:read"],
        claims: { pathname },
      };
    });
    const handlers = createDocsMcpHttpHandler({
      source: {
        ...filesystemSource,
        getPages(locale, context) {
          seenContexts.push(context);
          return filesystemSource.getPages(locale);
        },
        getNavigation(locale, context) {
          seenContexts.push(context);
          return filesystemSource.getNavigation(locale);
        },
      },
      mcp: {
        security: {
          allowedOrigins,
          authenticate,
          cors: { allowCredentials: true },
        },
      },
    });
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" },
      },
    });
    const headers = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
      origin: "https://app.example.com",
    };

    const unauthorized = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers,
        body,
      }),
    });
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(unauthorized.headers.get("access-control-allow-credentials")).toBe("true");
    await expect(unauthorized.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(seenContexts).toHaveLength(0);

    const authorized = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: { ...headers, authorization: "Bearer valid" },
        body,
      }),
    });
    expect(authorized.status).toBe(200);
    expect(originPolicyBodies).toEqual([body, body]);
    expect(authenticatedBodies).toEqual([body, body]);
    expect(authorized.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(authorized.headers.get("access-control-allow-credentials")).toBe("true");
    expect(authorized.headers.get("access-control-expose-headers")).toContain("MCP-Session-Id");
    expect(authorized.headers.get("vary")).toContain("Origin");
    expect(authenticate).toHaveBeenLastCalledWith(
      expect.objectContaining({ pathname: "/api/docs/mcp" }),
    );
    expect(seenContexts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transport: "http",
          auth: {
            id: "user-123",
            scopes: ["docs:read"],
            claims: { pathname: "/api/docs/mcp" },
          },
        }),
      ]),
    );

    seenContexts.length = 0;
    const contextBody = JSON.stringify({
      jsonrpc: "2.0",
      id: "authenticated-context",
      method: "tools/call",
      params: {
        name: "get_context",
        arguments: { query: "getting started", locale: "en" },
      },
    });
    const contextResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          ...headers,
          authorization: "Bearer valid",
          "mcp-session-id": "stale-session",
        },
        body: contextBody,
      }),
    });
    const contextPayload = await parseMcpPayload<{
      result?: {
        content?: Array<{ text?: string }>;
        structuredContent?: unknown;
        isError?: boolean;
      };
    }>(contextResponse);

    expect(contextResponse.status).toBe(200);
    expectSuccessfulStructuredTextResult(contextPayload);
    expect(seenContexts.length).toBeGreaterThanOrEqual(3);
    for (const context of seenContexts) {
      expect(context).toMatchObject({
        transport: "http",
        auth: {
          id: "user-123",
          scopes: ["docs:read"],
          claims: { pathname: "/api/docs/mcp" },
        },
      });
    }

    for (const toolCall of [
      { name: "list_tasks", arguments: { query: "Install", locale: "en" } },
      { name: "read_task", arguments: { path: "installation", locale: "en" } },
    ]) {
      seenContexts.length = 0;
      const toolResponse = await handlers.POST({
        request: new Request("http://localhost/api/docs/mcp", {
          method: "POST",
          headers: {
            ...headers,
            authorization: "Bearer valid",
            "mcp-session-id": "stale-session",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: `authenticated-${toolCall.name}`,
            method: "tools/call",
            params: toolCall,
          }),
        }),
      });
      const toolPayload = await parseMcpPayload<{
        result?: {
          content?: Array<{ text?: string }>;
          structuredContent?: unknown;
          isError?: boolean;
        };
      }>(toolResponse);

      expect(toolResponse.status).toBe(200);
      expectSuccessfulStructuredTextResult(toolPayload);
      expect(seenContexts.length).toBeGreaterThanOrEqual(3);
      for (const context of seenContexts) {
        expect(context).toMatchObject({
          transport: "http",
          auth: {
            id: "user-123",
            scopes: ["docs:read"],
            claims: { pathname: "/api/docs/mcp" },
          },
        });
      }
    }
  });

  it("passes through custom authentication Responses and sanitizes thrown errors", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({ rootDir });
    const customHandlers = createDocsMcpHttpHandler({
      source,
      mcp: {
        security: {
          authenticate: async () =>
            new Response("Use the organization login", {
              status: 403,
              headers: { "x-auth-provider": "example" },
            }),
        },
      },
    });
    const customResponse = await customHandlers.GET({
      request: new Request("http://localhost/api/docs/mcp"),
    });
    expect(customResponse.status).toBe(403);
    expect(customResponse.headers.get("x-auth-provider")).toBe("example");
    await expect(customResponse.text()).resolves.toBe("Use the organization login");

    const failingHandlers = createDocsMcpHttpHandler({
      source,
      mcp: {
        security: {
          authenticate: async () => {
            throw new Error("secret provider detail");
          },
        },
      },
    });
    const failingResponse = await failingHandlers.GET({
      request: new Request("http://localhost/api/docs/mcp"),
    });
    expect(failingResponse.status).toBe(500);
    expect(await failingResponse.text()).not.toContain("secret provider detail");
  });

  it("rejects POST bodies over the configured byte limit", async () => {
    const rootDir = createTempDocsProject();
    const allowedOrigins = vi.fn(async ({ request }) => {
      await request.text();
      return true;
    });
    const authenticate = vi.fn(async ({ request }) => {
      await request.text();
      return { id: "should-not-run" };
    });
    const handlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({ rootDir }),
      mcp: {
        security: {
          maxBodyBytes: 32,
          allowedOrigins,
          authenticate,
        },
      },
    });

    const request = new Request("http://localhost/api/docs/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://app.example.com",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
    });
    expect(request.headers.has("content-length")).toBe(false);

    const response = await handlers.POST({
      request,
    });

    expect(response.status).toBe(413);
    expect(allowedOrigins).not.toHaveBeenCalled();
    expect(authenticate).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: {
        data: { reason: "request_too_large", maxBodyBytes: 32 },
      },
    });
  });

  it("handles browser CORS preflight without authenticating", async () => {
    const rootDir = createTempDocsProject();
    const authenticate = vi.fn(async () => null);
    const handlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({ rootDir }),
      mcp: {
        security: {
          allowedOrigins: ["https://app.example.com"],
          authenticate,
          cors: {
            allowedHeaders: ["X-API-Key"],
            exposedHeaders: ["X-Docs-Version"],
            allowCredentials: true,
            maxAgeSeconds: 120,
          },
        },
      },
    });

    const response = await handlers.OPTIONS({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.example.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization, content-type, x-api-key",
        },
      }),
    });

    expect(response.status).toBe(204);
    expect(authenticate).not.toHaveBeenCalled();
    expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(response.headers.get("access-control-allow-origin")).not.toBe("*");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-methods")).toBe("GET, POST, DELETE, OPTIONS");
    expect(response.headers.get("access-control-allow-headers")).toContain("X-API-Key");
    expect(response.headers.get("access-control-max-age")).toBe("120");
    expect(response.headers.get("vary")).toContain("Origin");
    expect(response.headers.get("vary")).toContain("Access-Control-Request-Method");
    expect(response.headers.get("vary")).toContain("Access-Control-Request-Headers");

    const rejected = await handlers.OPTIONS({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.example.com",
          "access-control-request-method": "POST",
          "access-control-request-headers": "x-not-allowed",
        },
      }),
    });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get("access-control-allow-origin")).toBe("https://app.example.com");
    expect(authenticate).not.toHaveBeenCalled();

    const corsDisabledHandlers = createDocsMcpHttpHandler({
      source: createFilesystemDocsMcpSource({ rootDir }),
      mcp: {
        security: {
          allowedOrigins: ["https://app.example.com"],
          cors: false,
        },
      },
    });
    const corsDisabled = await corsDisabledHandlers.OPTIONS({
      request: new Request("https://docs.example.com/api/docs/mcp", {
        method: "OPTIONS",
        headers: {
          origin: "https://app.example.com",
          "access-control-request-method": "POST",
        },
      }),
    });
    expect(corsDisabled.status).toBe(204);
    expect(corsDisabled.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("serves stateless MCP requests without requiring sticky sessions", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true, name: "Example Docs" },
    });

    const missingSessionResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "tools-without-session",
          method: "tools/list",
          params: {},
        }),
      }),
    });

    expect(missingSessionResponse.status).toBe(200);
    const missingSessionPayload = await parseMcpPayload<{
      result?: { tools?: Array<{ name: string }>; nextCursor?: string };
    }>(missingSessionResponse);
    const missingSessionNextPayload = await parseMcpPayload<{
      result?: { tools?: Array<{ name: string }> };
    }>(
      await callMcpMethod(handlers, "tools/list", {
        cursor: missingSessionPayload.result?.nextCursor,
      }),
    );
    const missingSessionToolNames = [
      ...(missingSessionPayload.result?.tools ?? []),
      ...(missingSessionNextPayload.result?.tools ?? []),
    ].map((tool) => tool.name);
    expect(missingSessionToolNames).toEqual(
      expect.arrayContaining([
        "list_docs",
        "list_pages",
        "list_page_sections",
        "get_navigation",
        "search_docs",
        "read_page",
        "get_code_examples",
        "get_config_schema",
        "get_context",
      ]),
    );

    const expiredSessionResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "expired-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "tools-expired-session",
          method: "tools/list",
          params: {},
        }),
      }),
    });

    expect(expiredSessionResponse.status).toBe(200);
    const expiredSessionPayload = await parseMcpPayload<{
      result?: { tools?: Array<{ name: string }>; nextCursor?: string };
    }>(expiredSessionResponse);
    expect(expiredSessionPayload.result).toEqual(missingSessionPayload.result);
  });

  it("emits analytics and observability separately for MCP requests, tools, and agent page reads", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });
    const analyticsEvents: DocsAnalyticsEvent[] = [];
    const traceEvents: DocsObservabilityEvent[] = [];

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true, name: "Example Docs" },
      analytics: {
        console: false,
        onEvent(event) {
          analyticsEvents.push(event);
        },
      },
      observability: {
        console: false,
        onEvent(event) {
          traceEvents.push(event);
        },
      },
    });

    const initializeResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    let requestId = 2;
    async function callTool(name: string, args: Record<string, unknown>) {
      const response = await handlers.POST({
        request: new Request("http://localhost/api/docs/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
            "mcp-session-id": "stale-session",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: requestId++,
            method: "tools/call",
            params: {
              name,
              arguments: args,
            },
          }),
        }),
      });

      return parseMcpPayload<{ result?: unknown }>(response);
    }

    await callTool("list_pages", {});
    await callTool("get_navigation", {});
    await callTool("search_docs", { query: "generated example paths" });
    await callTool("read_page", { path: "guides/quickstart" });
    await callTool("read_page", { path: "missing" });

    expect(analyticsEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining(["mcp_request", "mcp_tool", "agent_read"]),
    );
    expect(analyticsEvents.map((event) => event.type)).not.toEqual(
      expect.arrayContaining(["tool.call", "tool.result", "tool.error"]),
    );
    expect(analyticsEvents.filter((event) => event.type === "mcp_request")).toHaveLength(6);
    expect(traceEvents.map((event) => event.type)).toEqual(
      expect.arrayContaining(["tool.call", "tool.result", "tool.error"]),
    );
    expect(traceEvents.filter((event) => event.type === "tool.call")).toHaveLength(5);
    expect(traceEvents.filter((event) => event.type === "tool.result")).toHaveLength(4);
    expect(traceEvents.filter((event) => event.type === "tool.error")).toHaveLength(1);
    expect(
      traceEvents.filter((event) => event.type === "tool.call").map((event) => event.name),
    ).toEqual(["list_pages", "get_navigation", "search_docs", "read_page", "read_page"]);
    expect(
      traceEvents
        .filter((event) => event.type === "tool.result")
        .map((event) => event.outputPreview),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resultCount: 3 }),
        expect.objectContaining({ chars: expect.any(Number) }),
        expect.objectContaining({ resultCount: expect.any(Number) }),
        expect.objectContaining({ found: true, chars: expect.any(Number) }),
      ]),
    );
    expect(traceEvents.find((event) => event.type === "tool.error")).toMatchObject({
      name: "read_page",
      status: "error",
      durationMs: expect.any(Number),
      outputPreview: expect.objectContaining({ found: false, path: "missing" }),
      metadata: expect.objectContaining({ reason: "not_found" }),
    });
    expect(
      analyticsEvents.filter((event) => event.type === "mcp_tool").map((event) => event.properties),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tool: "list_pages", resultCount: 3 }),
        expect.objectContaining({ tool: "get_navigation" }),
        expect.objectContaining({ tool: "search_docs", queryLength: 23 }),
        expect.objectContaining({ tool: "read_page", found: true }),
        expect.objectContaining({ tool: "read_page", found: false }),
      ]),
    );
    expect(
      analyticsEvents
        .filter((event) => event.type === "agent_read")
        .map((event) => event.properties),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          delivery: "mcp_tool",
          tool: "read_page",
          requestedPath: "guides/quickstart",
          found: true,
        }),
        expect.objectContaining({
          delivery: "mcp_tool",
          tool: "read_page",
          requestedPath: "missing",
          found: false,
        }),
      ]),
    );
  });

  it("uses the shared search adapter pipeline for search_docs", async () => {
    const rootDir = createTempDocsProject();
    const seenAudiences: string[] = [];
    const seenFilters: unknown[] = [];
    const seenExplanations: Array<boolean | undefined> = [];
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });
    const search: DocsSearchAdapter["search"] = async (query, context) => {
      seenAudiences.push(`${query.audience}:${context.audience}`);
      seenFilters.push(query.filters);
      seenExplanations.push(query.explain);
      const installationPage = context.pages.find((page) => page.url === "/docs/installation");
      expect(installationPage?.content).toContain("Run pnpm install.");
      expect(installationPage?.content).not.toContain("--frozen-lockfile");
      const searchableContent = context.documents.map((document) => document.content).join(" ");
      if (query.audience === "agent") {
        expect(searchableContent).toContain("--frozen-lockfile");
      } else {
        expect(searchableContent).toContain("Run pnpm install");
      }
      return [
        {
          id: "custom-hit",
          url: "/docs/installation",
          content: "Custom search result",
          description: "Resolved through the shared adapter pipeline.",
          type: "page",
        },
      ];
    };

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true, name: "Example Docs" },
      search: {
        provider: "custom",
        paginationRevision: "custom-search.v1",
        adapter: {
          name: "custom-search",
          search,
          async searchPage(query, context) {
            const results = await search(query, context);
            return { results, total: results.length };
          },
        },
      },
    });

    const initializeResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    const searchResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "search_docs",
            arguments: {
              query: "install",
            },
          },
        }),
      }),
    });

    const searchPayload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }> };
    }>(searchResponse);

    expect(searchPayload.result?.content?.[0]?.text).toContain('"id": "custom-hit"');
    expect(searchPayload.result?.content?.[0]?.text).toContain("/docs/installation");
    expect(searchPayload.result?.content?.[0]?.text).not.toContain("Custom search result");

    const humanSearchPayload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }> };
    }>(await callMcpTool(handlers, "search_docs", { query: "install", audience: "human" }));
    expect(humanSearchPayload.result?.content?.[0]?.text).toContain("/docs/installation");

    const scopedSearchPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          format?: string;
          filters?: Record<string, string[]>;
          resultCount?: number;
          results?: Array<{
            url?: string;
            explanation?: {
              format?: string;
              rankingStrategy?: string;
              selectedScope?: { framework?: string[] };
              filterDecisions?: Array<{ field?: string; outcome?: string }>;
            };
          }>;
          warnings?: unknown[];
        };
      };
    }>(
      await callMcpTool(handlers, "search_docs", {
        query: "install",
        explain: true,
        framework: "Next.js",
        package: ["@FARMING-LABS/NEXT"],
      }),
    );
    expect(scopedSearchPayload.result?.structuredContent).toMatchObject({
      format: "docs-search.v1",
      filters: {
        framework: ["nextjs"],
        package: ["@farming-labs/next"],
      },
      resultCount: expect.any(Number),
      warnings: [],
    });
    expect(scopedSearchPayload.result?.structuredContent?.resultCount).toBeGreaterThan(0);
    expect(
      scopedSearchPayload.result?.structuredContent?.results?.every(
        (result) => result.url?.split("#", 1)[0] === "/docs/installation",
      ),
    ).toBe(true);
    expect(scopedSearchPayload.result?.structuredContent?.results?.[0]?.explanation).toMatchObject({
      format: "docs-search-explanation.v1",
      rankingStrategy: "provider",
      selectedScope: { framework: ["nextjs"] },
      filterDecisions: expect.arrayContaining([
        expect.objectContaining({ field: "framework", outcome: "matched" }),
      ]),
    });

    const facetsPayload = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          format?: string;
          matchedPageCount?: number;
          facets?: Record<
            string,
            { values?: Array<{ value?: string; count?: number }>; valueCount?: number }
          >;
        };
        content?: Array<{ text?: string }>;
      };
    }>(
      await callMcpTool(handlers, "list_search_facets", {
        framework: "Next.js",
      }),
    );
    expect(facetsPayload.result?.structuredContent).toMatchObject({
      format: "docs-search-facets.v1",
      matchedPageCount: 2,
      facets: {
        framework: { values: [{ value: "nextjs", count: 2 }] },
        version: { values: [{ value: "16", count: 1 }] },
        package: { values: [{ value: "@farming-labs/next", count: 1 }] },
        tags: { values: [{ value: "setup", count: 1 }] },
      },
    });
    expect(facetsPayload.result?.content?.[0]?.text).not.toContain("Run pnpm install");

    expect(seenAudiences).toEqual(["agent:agent", "human:human", "agent:agent"]);
    expect(seenFilters).toEqual([
      undefined,
      undefined,
      {
        framework: ["nextjs"],
        package: ["@farming-labs/next"],
      },
    ]);
    expect(seenExplanations).toEqual([undefined, undefined, true]);
  });

  it("continues large search facets with an opaque field-bound cursor", async () => {
    const pages = Array.from({ length: 105 }, (_, index) => ({
      slug: `tag-${index}`,
      url: `/docs/tag-${index}`,
      title: `Tag ${index}`,
      content: `Facet tag ${index}.`,
      tags: [`tag-${String(index).padStart(3, "0")}`],
    }));
    const handlers = createDocsMcpHttpHandler({
      source: {
        getPages: () => pages,
        getNavigation: () => ({ name: "Docs", children: [] }),
      },
    });

    const first = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          facets?: Record<
            string,
            {
              total?: number;
              hasMore?: boolean;
              nextCursor?: string;
              values?: Array<{ value?: string }>;
            }
          >;
        };
      };
    }>(
      await callMcpTool(handlers, "list_search_facets", {
        facet: "tags",
        limit: 50,
      }),
    );
    expect(first.result?.structuredContent?.facets?.tags).toMatchObject({
      total: 105,
      hasMore: true,
    });
    expect(first.result?.structuredContent?.facets?.tags?.values?.at(0)?.value).toBe("tag-000");
    expect(first.result?.structuredContent?.facets?.tags?.values?.at(-1)?.value).toBe("tag-049");

    const second = await parseMcpPayload<{
      result?: {
        structuredContent?: {
          facets?: Record<
            string,
            {
              total?: number;
              hasMore?: boolean;
              nextCursor?: string;
              values?: Array<{ value?: string }>;
            }
          >;
        };
      };
    }>(
      await callMcpTool(handlers, "list_search_facets", {
        facet: "tags",
        limit: 50,
        cursor: first.result?.structuredContent?.facets?.tags?.nextCursor,
      }),
    );
    expect(second.result?.structuredContent?.facets?.tags).toMatchObject({
      total: 105,
      hasMore: true,
    });
    expect(second.result?.structuredContent?.facets?.tags?.values?.at(0)?.value).toBe("tag-050");
    expect(second.result?.structuredContent?.facets?.tags?.values?.at(-1)?.value).toBe("tag-099");

    const wrongFacet = await parseMcpPayload<{
      result?: { isError?: boolean; content?: Array<{ text?: string }> };
    }>(
      await callMcpTool(handlers, "list_search_facets", {
        facet: "framework",
        limit: 50,
        cursor: first.result?.structuredContent?.facets?.tags?.nextCursor,
      }),
    );
    expect(wrongFacet.result?.isError).toBe(true);
    expect(wrongFacet.result?.content?.[0]?.text).toContain("Invalid or stale pagination cursor");
  });

  it.each([
    {
      label: "canonical route",
      endpoint: "/api/docs/mcp",
      route: "/api/docs/mcp",
      requestUrl: "http://localhost/api/docs/mcp",
    },
    {
      label: "public alias",
      endpoint: "/mcp",
      route: "/api/docs/mcp",
      requestUrl: "http://localhost/mcp",
    },
    {
      label: "well-known alias",
      endpoint: "/.well-known/mcp",
      route: "/api/docs/mcp",
      requestUrl: "http://localhost/.well-known/mcp",
    },
    {
      label: "custom route",
      endpoint: "/internal/docs/mcp",
      route: "/internal/docs/mcp",
      requestUrl: "http://localhost/internal/docs/mcp",
    },
    {
      label: "absolute same-origin alias",
      endpoint: "http://localhost/mcp",
      route: "/api/docs/mcp",
      requestUrl: "http://localhost/api/docs/mcp",
    },
  ])("uses direct simple search for a self-referential MCP $label", async (scenario) => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("Unexpected loopback MCP request"));

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true, name: "Example Docs", route: scenario.route },
      search: {
        provider: "mcp",
        endpoint: scenario.endpoint,
        chunking: {
          strategy: "page",
        },
      },
    });

    const initializeResponse = await handlers.POST({
      request: new Request(scenario.requestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    const searchResponse = await handlers.POST({
      request: new Request(scenario.requestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "search_docs",
            arguments: {
              query: "install",
            },
          },
        }),
      }),
    });

    const searchPayload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }> };
    }>(searchResponse);

    expect(searchPayload.result?.content?.[0]?.text).toContain("/docs/installation");
    expect(searchPayload.result?.content?.[0]?.text).not.toContain("#quickstart");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns JSON-RPC 404 responses when MCP is disabled", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: false,
    });

    const response = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {},
        }),
      }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      error: {
        code: -32000,
        message: expect.stringContaining("MCP is disabled"),
        data: {
          reason: "mcp_disabled",
        },
      },
    });
  });

  it("respects tool toggles in the MCP config", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: {
        enabled: true,
        tools: {
          listDocs: false,
          listTasks: false,
          readTask: false,
          searchDocs: false,
          searchFacets: false,
          listPageSections: false,
          readPage: false,
          getConfigSchema: false,
          getContext: false,
        },
      },
    });

    const initializeResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    const toolsListResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: {},
        }),
      }),
    });

    const toolsList = await parseMcpPayload<{
      result?: { tools?: Array<{ name: string }> };
    }>(toolsListResponse);

    expect(toolsList.result?.tools?.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["list_pages", "get_navigation", "get_code_examples"]),
    );
    expect(toolsList.result?.tools?.map((tool) => tool.name)).not.toEqual(
      expect.arrayContaining([
        "list_docs",
        "list_tasks",
        "read_task",
        "search_docs",
        "list_search_facets",
        "list_page_sections",
        "read_page",
        "get_config_schema",
        "get_context",
      ]),
    );
  });

  it("rejects whitespace-only search queries", async () => {
    const rootDir = createTempDocsProject();
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry: "docs",
      contentDir: "docs",
      siteTitle: "Example Docs",
    });

    const handlers = createDocsMcpHttpHandler({
      source,
      mcp: { enabled: true },
    });

    const initializeResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    });

    const sessionId = initializeResponse.headers.get("mcp-session-id");
    expect(sessionId).toBeNull();

    const searchResponse = await handlers.POST({
      request: new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": LATEST_PROTOCOL_VERSION,
          "mcp-session-id": "stale-session",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "search_docs",
            arguments: {
              query: "   ",
            },
          },
        }),
      }),
    });

    const body = await searchResponse.text();
    expect(body).toContain("Input validation error");
  });
});
