import { describe, expect, it } from "vitest";
import {
  acceptsDocsMarkdown,
  buildDocsAgentDiscoverySpec,
  buildDocsConfigMap,
  buildDocsDiagnostics,
  buildDocsMcpEndpointCandidates,
  createDocsMarkdownResponse,
  detectDocsMarkdownAgentRequest,
  findDocsMarkdownPage,
  getDocsMarkdownCanonicalLinkHeader,
  getDocsMarkdownVaryHeader,
  hasDocsMarkdownSignatureAgent,
  isDocsAgentDiscoveryRequest,
  isDocsAgentsRequest,
  isDocsConfigRequest,
  isDocsDiagnosticsRequest,
  isDocsLlmsTxtPublicRequest,
  isDocsMcpRequest,
  isDocsPublicGetRequest,
  isDocsSkillRequest,
  getDocsLlmsTxtMaxCharsIssue,
  matchesDocsLlmsTxtSection,
  renderDocsMarkdownDocument,
  renderDocsMarkdownNotFound,
  renderDocsLlmsTxt,
  renderDocsAgentsDocument,
  renderDocsSkillDocument,
  resolveDocsMarkdownRecovery,
  resolveDocsAgentFeedbackConfig,
  resolveDocsAgentFeedbackRequest,
  resolveDocsAgentMdxContent,
  resolveDocsAgentsFormat,
  resolveDocsLlmsTxtFormat,
  resolveDocsLlmsTxtRequest,
  resolveDocsLlmsTxtSections,
  resolveDocsMarkdownCanonicalUrl,
  resolveDocsSkillFormat,
  resolveDocsMarkdownRequest,
  selectDocsLlmsTxtContent,
  toDocsMarkdownUrl,
} from "./agent.js";

describe("agent route helpers", () => {
  it("detects well-known agent and llms routes", () => {
    expect(isDocsAgentDiscoveryRequest(new URL("https://example.com/.well-known/agent.json"))).toBe(
      true,
    );
    expect(isDocsAgentDiscoveryRequest(new URL("https://example.com/api/docs?agent=spec"))).toBe(
      true,
    );
    expect(isDocsAgentDiscoveryRequest(new URL("https://example.com/blog?agent=spec"))).toBe(false);
    expect(isDocsConfigRequest(new URL("https://example.com/api/docs?format=config"))).toBe(true);
    expect(isDocsConfigRequest(new URL("https://example.com/api/docs?format=markdown"))).toBe(
      false,
    );
    expect(
      isDocsDiagnosticsRequest(new URL("https://example.com/api/docs?format=diagnostics")),
    ).toBe(true);
    expect(isDocsDiagnosticsRequest(new URL("https://example.com/api/docs?format=config"))).toBe(
      false,
    );

    expect(resolveDocsLlmsTxtFormat(new URL("https://example.com/llms.txt"))).toBe("llms");
    expect(resolveDocsLlmsTxtFormat(new URL("https://example.com/api/docs?format=llms"))).toBe(
      "llms",
    );
    expect(resolveDocsLlmsTxtFormat(new URL("https://example.com/blog?format=llms"))).toBeNull();
    expect(resolveDocsLlmsTxtFormat(new URL("https://example.com/.well-known/llms-full.txt"))).toBe(
      "llms-full",
    );
    expect(resolveDocsLlmsTxtFormat(new URL("https://example.com/docs/llms.txt"), "docs")).toBe(
      "llms",
    );
    expect(
      resolveDocsLlmsTxtFormat(new URL("https://example.com/docs/llms-full.txt"), "docs"),
    ).toBe("llms-full");
    expect(isDocsLlmsTxtPublicRequest(new URL("https://example.com/llms.txt"))).toBe(true);
    expect(isDocsLlmsTxtPublicRequest(new URL("https://example.com/.well-known/llms.txt"))).toBe(
      true,
    );
    expect(
      isDocsLlmsTxtPublicRequest(new URL("https://example.com/docs/llms.txt"), undefined, "docs"),
    ).toBe(true);
    expect(
      isDocsPublicGetRequest(
        "docs",
        new URL("https://example.com/docs/llms.txt"),
        new Request("https://example.com/docs/llms.txt"),
        {},
      ),
    ).toBe(true);
    expect(isDocsLlmsTxtPublicRequest(new URL("https://example.com/api/docs?format=llms"))).toBe(
      false,
    );

    expect(isDocsSkillRequest(new URL("https://example.com/skill.md"))).toBe(true);
    expect(isDocsSkillRequest(new URL("https://example.com/.well-known/skill.md"))).toBe(true);
    expect(isDocsSkillRequest(new URL("https://example.com/api/docs?format=skill"))).toBe(true);
    expect(isDocsSkillRequest(new URL("https://example.com/blog?format=skill"))).toBe(false);
    expect(resolveDocsSkillFormat(new URL("https://example.com/api/docs?format=skill"))).toBe(
      "skill",
    );
    expect(resolveDocsSkillFormat(new URL("https://example.com/internal/docs?format=skill"))).toBe(
      "skill",
    );
    expect(
      resolveDocsSkillFormat(new URL("https://example.com/internal/docs?format=llms")),
    ).toBeNull();

    expect(isDocsAgentsRequest(new URL("https://example.com/AGENTS.md"))).toBe(true);
    expect(isDocsAgentsRequest(new URL("https://example.com/.well-known/AGENTS.md"))).toBe(true);
    expect(isDocsAgentsRequest(new URL("https://example.com/AGENT.md"))).toBe(true);
    expect(isDocsAgentsRequest(new URL("https://example.com/api/docs?format=agents"))).toBe(true);
    expect(isDocsAgentsRequest(new URL("https://example.com/blog?format=agents"))).toBe(false);
    expect(resolveDocsAgentsFormat(new URL("https://example.com/api/docs?format=agents"))).toBe(
      "agents",
    );
  });

  it("builds a JSON-safe docs config map with pointers and redaction", () => {
    function submitDocsFeedback() {}
    const navTitle = {
      $$typeof: Symbol.for("react.element"),
      type: "div",
      props: {},
    };

    const map = buildDocsConfigMap(
      {
        entry: "docs",
        theme: {
          name: "pixel-border",
          ui: {
            layout: {
              sidebarWidth: 320,
              toc: { enabled: true, depth: 3 },
            },
          },
        },
        nav: {
          title: navTitle,
          url: "/",
        },
        search: {
          provider: "algolia",
          appId: "APP_ID",
          searchApiKey: "secret-key",
          apiKeyEnv: "ALGOLIA_SEARCH_API_KEY",
        },
        feedback: {
          enabled: true,
          onFeedback: submitDocsFeedback,
        },
        llmsTxt: {
          sections: [{ title: "Guides", match: "/docs/guides/**" }],
        },
        rootDir: "/tmp/site",
        _preloadedContent: {
          "/docs/page.mdx": "# Internal content",
        },
      },
      { file: "docs.config.tsx" },
    );

    expect(map).toMatchObject({
      schemaVersion: 1,
      format: "docs-config-map.v1",
      source: {
        file: "docs.config.tsx",
        language: "tsx",
      },
      values: {
        entry: "docs",
        theme: {
          $kind: "theme",
          name: "pixel-border",
        },
        nav: {
          title: {
            $kind: "jsx",
            component: "div",
          },
          url: "/",
        },
        feedback: {
          enabled: true,
          onFeedback: {
            $kind: "function",
            name: "submitDocsFeedback",
          },
        },
      },
    });
    expect(map.values.search).toMatchObject({
      provider: "algolia",
      appId: "APP_ID",
      searchApiKey: {
        $kind: "secret",
        value: "[redacted]",
      },
      apiKeyEnv: "ALGOLIA_SEARCH_API_KEY",
    });
    expect(map.pointers["/entry"]).toEqual({ path: "entry", kind: "string" });
    expect(map.pointers["/theme"]).toEqual({ path: "theme", kind: "theme" });
    expect(map.pointers["/search/searchApiKey"]).toEqual({
      path: "search.searchApiKey",
      kind: "secret",
    });
    expect(map.pointers["/llmsTxt/sections/0/title"]).toEqual({
      path: "llmsTxt.sections[0].title",
      kind: "string",
    });
    expect(map.values).not.toHaveProperty("rootDir");
    expect(map.values).not.toHaveProperty("_preloadedContent");
  });

  it("builds docs diagnostics from config-derived capabilities", () => {
    const diagnostics = buildDocsDiagnostics(
      {
        entry: "docs",
        staticExport: true,
        search: {
          provider: "algolia",
          appId: "APP_ID",
          indexName: "docs",
          searchApiKey: "search-secret",
        },
        ai: {
          enabled: true,
          mode: "floating",
        },
        feedback: {
          agent: false,
        },
        llmsTxt: false,
        sitemap: {
          routePrefix: "docs",
        },
        robots: false,
        apiReference: {
          enabled: true,
          path: "reference",
        },
      },
      { adapter: "next" },
    );

    expect(diagnostics).toMatchObject({
      schemaVersion: 1,
      format: "docs-diagnostics.v1",
      ok: false,
      adapter: "next",
      routes: {
        docs: "/docs",
        api: "/api/docs",
        config: "/api/docs?format=config",
        diagnostics: "/api/docs?format=diagnostics",
        search: null,
        askAi: null,
        llmsTxt: null,
        robots: null,
        openapi: "/api/docs?format=openapi",
        apiReference: "/reference",
      },
      features: {
        staticExport: { status: "enabled" },
        search: {
          status: "disabled",
          reason: "static-export",
          provider: "algolia",
        },
        ai: {
          status: "disabled",
          reason: "static-export",
          mode: "floating",
        },
        feedback: {
          status: "enabled",
          human: true,
          agent: false,
        },
        llmsTxt: {
          status: "disabled",
          reason: "configured-disabled",
        },
        sitemap: {
          status: "enabled",
        },
        robots: {
          status: "disabled",
        },
        apiReference: {
          status: "enabled",
          route: "/reference",
        },
      },
    });
    expect(diagnostics.warnings.map((issue) => issue.code)).toContain("static-export-runtime-api");
    expect(diagnostics.errors).toEqual([
      {
        severity: "error",
        code: "ai-static-export",
        path: "/ai/enabled",
        message:
          "Ask AI requires the runtime /api/docs POST handler and will not run in static export builds.",
      },
    ]);
  });

  it("reports invalid search provider diagnostics without leaking configured values", () => {
    const diagnostics = buildDocsDiagnostics(
      {
        entry: "docs",
        search: {
          provider: "typesense",
          baseUrl: "https://search.example.com",
        },
      },
      { adapter: "next" },
    );

    expect(diagnostics.ok).toBe(false);
    expect(diagnostics.features.search).toMatchObject({
      status: "enabled",
      provider: "typesense",
    });
    expect(diagnostics.errors.map((issue) => issue.code)).toEqual([
      "missing-search-collection",
      "missing-search-api-key",
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("https://search.example.com");
  });

  it("maps diagnostics mcp config without server-only imports", () => {
    const diagnostics = buildDocsDiagnostics({
      mcp: {
        route: "internal/docs/mcp/",
        tools: {
          searchDocs: false,
          getConfigSchema: false,
        },
      },
    });

    expect(diagnostics.routes.mcp).toBe("/internal/docs/mcp");
    expect(diagnostics.features.mcp).toMatchObject({
      status: "enabled",
      route: "/internal/docs/mcp",
      tools: {
        listDocs: true,
        listPages: true,
        readPage: true,
        searchDocs: false,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: false,
      },
    });
  });

  it("derives section-level llms.txt routes from URL matchers", () => {
    const config = {
      sections: [
        {
          title: "API",
          description: "Endpoint reference",
          match: "/docs/api/**",
          maxChars: { mode: "error" as const, chars: 20 },
        },
        {
          title: "Guides",
          match: ["/docs/guides/**", "/docs/tutorials/**"],
        },
      ],
    };

    const sections = resolveDocsLlmsTxtSections(config);
    expect(sections.map((section) => [section.route, section.fullRoute])).toEqual([
      ["/docs/api/llms.txt", "/docs/api/llms-full.txt"],
      ["/docs/guides/llms.txt", "/docs/guides/llms-full.txt"],
    ]);
    expect(sections[0]?.maxChars).toEqual({ mode: "error", chars: 20 });

    expect(
      resolveDocsLlmsTxtRequest(new URL("https://example.com/docs/api/llms.txt"), config),
    ).toMatchObject({
      format: "llms",
      section: { title: "API", route: "/docs/api/llms.txt" },
    });
    expect(
      resolveDocsLlmsTxtRequest(new URL("https://example.com/docs/api/llms-full.txt"), config),
    ).toMatchObject({
      format: "llms-full",
      section: { title: "API", route: "/docs/api/llms.txt" },
    });
    expect(
      isDocsLlmsTxtPublicRequest(new URL("https://example.com/docs/api/llms.txt"), config),
    ).toBe(true);
    expect(
      isDocsPublicGetRequest(
        "docs",
        new URL("https://example.com/docs/api/llms.txt"),
        new Request("https://example.com/docs/api/llms.txt"),
        { llms: config },
      ),
    ).toBe(true);

    const [rootDeepSection] = resolveDocsLlmsTxtSections({
      sections: [{ title: "Everything", match: "/**" }],
    });
    expect(rootDeepSection).toBeDefined();
    expect(matchesDocsLlmsTxtSection("/docs/api/users", rootDeepSection!)).toBe(true);
    expect(matchesDocsLlmsTxtSection("/docs", rootDeepSection!)).toBe(true);

    const [rootShallowSection] = resolveDocsLlmsTxtSections({
      sections: [{ title: "Top Level", match: "/*" }],
    });
    expect(rootShallowSection).toBeDefined();
    expect(matchesDocsLlmsTxtSection("/docs", rootShallowSection!)).toBe(true);
    expect(matchesDocsLlmsTxtSection("/docs/api", rootShallowSection!)).toBe(false);
  });

  it("renders root and section llms.txt content with progressive disclosure", () => {
    const content = renderDocsLlmsTxt(
      [
        {
          url: "/docs",
          title: "Overview",
          description: "Start here",
          content: "Welcome.",
        },
        {
          url: "/docs/api/users",
          title: "Users API",
          description: "User endpoints",
          content: "Use the Users API.",
        },
        {
          url: "/docs/guides/auth",
          title: "Auth Guide",
          content: "Set up auth.",
        },
      ],
      {
        siteTitle: "Example Docs",
        baseUrl: "https://docs.example.com",
        maxChars: { mode: "warn", chars: 80 },
        openapi: {
          enabled: true,
          url: "/api/docs?format=openapi",
          apiReferencePath: "/api-reference",
          source: "generated",
        },
        sections: [
          {
            title: "API",
            description: "Endpoint reference",
            match: "/docs/api/**",
          },
        ],
      },
    );

    expect(content.llmsTxt).toContain("## Sections");
    expect(content.llmsTxt).toContain(
      "- [API](https://docs.example.com/docs/api/llms.txt): Endpoint reference",
    );
    expect(content.llmsTxt).toContain("- [Overview](https://docs.example.com/docs.md): Start here");
    expect(content.llmsTxt).toContain("## API Schemas");
    expect(content.llmsTxt).toContain(
      "- [OpenAPI schema](https://docs.example.com/api/docs?format=openapi): Machine-readable API schema for tool use and API clients; rendered API reference at https://docs.example.com/api-reference",
    );
    expect(content.llmsTxt).not.toContain("Users API");

    const request = resolveDocsLlmsTxtRequest(
      new URL("https://docs.example.com/docs/api/llms.txt"),
      {
        sections: [{ title: "API", match: "/docs/api/**" }],
      },
    );
    expect(request).not.toBeNull();
    const selected = request ? selectDocsLlmsTxtContent(content, request) : null;
    expect(selected?.content).toContain("# Example Docs - API");
    expect(selected?.content).toContain(
      "- [Users API](https://docs.example.com/docs/api/users.md)",
    );
    expect(selected?.content).not.toContain("Overview");

    const issue = getDocsLlmsTxtMaxCharsIssue("/llms.txt", content.llmsTxt, content.maxChars);
    expect(issue?.mode).toBe("warn");
  });

  it("detects public docs forwarder requests without taking over api/docs", () => {
    expect(isDocsMcpRequest(new URL("https://example.com/.well-known/mcp"))).toBe(true);
    expect(isDocsMcpRequest(new URL("https://example.com/mcp"))).toBe(true);

    expect(
      isDocsPublicGetRequest(
        "docs",
        new URL("https://example.com/docs/install.md"),
        new Request("https://example.com/docs/install.md"),
      ),
    ).toBe(true);
    expect(
      isDocsPublicGetRequest(
        "docs",
        new URL("https://example.com/.well-known/skill.md"),
        new Request("https://example.com/.well-known/skill.md"),
      ),
    ).toBe(true);
    expect(
      isDocsPublicGetRequest(
        "docs",
        new URL("https://example.com/sitemap.xml"),
        new Request("https://example.com/sitemap.xml"),
      ),
    ).toBe(true);
    expect(
      isDocsPublicGetRequest(
        "docs",
        new URL("https://example.com/robots.txt"),
        new Request("https://example.com/robots.txt"),
      ),
    ).toBe(true);
    expect(
      isDocsPublicGetRequest(
        "docs",
        new URL("https://example.com/robots.txt"),
        new Request("https://example.com/robots.txt"),
        { robots: false },
      ),
    ).toBe(false);
    expect(
      isDocsPublicGetRequest(
        "docs",
        new URL("https://example.com/docs/sitemap.md"),
        new Request("https://example.com/docs/sitemap.md"),
        { sitemap: { routePrefix: "/docs" } },
      ),
    ).toBe(true);
    expect(
      isDocsPublicGetRequest(
        "docs",
        new URL("https://example.com/docs/install"),
        new Request("https://example.com/docs/install", {
          headers: { "Signature-Agent": "https://chatgpt.com" },
        }),
      ),
    ).toBe(true);
    expect(
      isDocsPublicGetRequest(
        "docs",
        new URL("https://example.com/api/docs?format=llms"),
        new Request("https://example.com/api/docs?format=llms"),
      ),
    ).toBe(false);
  });

  it("builds MCP endpoint probes for default routes, origin fallback, and MCP subdomains", () => {
    expect(
      buildDocsMcpEndpointCandidates("https://docs.example.com/docs").map(
        (candidate) => candidate.url,
      ),
    ).toEqual([
      "https://docs.example.com/docs/mcp",
      "https://docs.example.com/docs/.well-known/mcp",
      "https://docs.example.com/mcp",
      "https://docs.example.com/.well-known/mcp",
      "https://example.com/mcp",
      "https://example.com/.well-known/mcp",
      "https://mcp.example.com/mcp",
      "https://mcp.example.com/",
    ]);

    expect(
      buildDocsMcpEndpointCandidates("https://example.com/docs").map((candidate) => candidate.url),
    ).toEqual([
      "https://example.com/docs/mcp",
      "https://example.com/docs/.well-known/mcp",
      "https://example.com/mcp",
      "https://example.com/.well-known/mcp",
      "https://mcp.example.com/mcp",
      "https://mcp.example.com/",
    ]);

    expect(
      buildDocsMcpEndpointCandidates("https://mcp.example.com").map((candidate) => candidate.url),
    ).toEqual([
      "https://mcp.example.com/mcp",
      "https://mcp.example.com/.well-known/mcp",
      "https://example.com/mcp",
      "https://example.com/.well-known/mcp",
      "https://mcp.example.com/",
    ]);

    expect(
      buildDocsMcpEndpointCandidates("https://docs.example.co.uk").map(
        (candidate) => candidate.url,
      ),
    ).toContain("https://mcp.example.co.uk/mcp");

    const koreaCandidates = buildDocsMcpEndpointCandidates("https://docs.example.co.kr").map(
      (candidate) => candidate.url,
    );
    expect(koreaCandidates).toContain("https://mcp.example.co.kr/mcp");
    expect(koreaCandidates).not.toContain("https://mcp.co.kr/mcp");
  });

  it("resolves markdown route and Accept-header requests", () => {
    const markdownRoute = resolveDocsMarkdownRequest(
      "docs",
      new URL("https://example.com/docs/install.md"),
      new Request("https://example.com/docs/install.md"),
    );
    expect(markdownRoute).toEqual({ requestedPath: "install" });

    const acceptRoute = resolveDocsMarkdownRequest(
      "docs",
      new URL("https://example.com/docs/install"),
      new Request("https://example.com/docs/install", {
        headers: { accept: "application/json, text/markdown;q=1" },
      }),
    );
    expect(acceptRoute).toEqual({ requestedPath: "install" });

    const htmlPreferredRoute = resolveDocsMarkdownRequest(
      "docs",
      new URL("https://example.com/docs/install"),
      new Request("https://example.com/docs/install", {
        headers: { accept: "text/html;q=1, text/markdown;q=0.5" },
      }),
    );
    expect(htmlPreferredRoute).toBeNull();
    expect(
      acceptsDocsMarkdown(
        new Request("https://example.com/docs/install", {
          headers: { accept: "text/html;q=0.5, text/markdown;q=1" },
        }),
      ),
    ).toBe(true);
    expect(
      acceptsDocsMarkdown(
        new Request("https://example.com/docs/install", {
          headers: { accept: "*/*;q=1, text/markdown;q=0.5" },
        }),
      ),
    ).toBe(false);

    const signatureAgentRoute = resolveDocsMarkdownRequest(
      "docs",
      new URL("https://example.com/docs/install"),
      new Request("https://example.com/docs/install", {
        headers: { "Signature-Agent": "https://chatgpt.com" },
      }),
    );
    expect(signatureAgentRoute).toEqual({ requestedPath: "install" });
    expect(
      detectDocsMarkdownAgentRequest(
        new Request("https://example.com/docs/install", {
          headers: { "Signature-Agent": "https://chatgpt.com" },
        }),
      ),
    ).toEqual({ detected: true, method: "signature_agent" });

    const userAgentRoute = resolveDocsMarkdownRequest(
      "docs",
      new URL("https://example.com/docs/install"),
      new Request("https://example.com/docs/install", {
        headers: { "user-agent": "ClaudeBot/1.0" },
      }),
    );
    expect(userAgentRoute).toEqual({ requestedPath: "install" });
    expect(
      detectDocsMarkdownAgentRequest(
        new Request("https://example.com/docs/install", {
          headers: { "user-agent": "ClaudeBot/1.0" },
        }),
      ),
    ).toEqual({ detected: true, method: "user_agent" });

    const heuristicAgentRoute = resolveDocsMarkdownRequest(
      "docs",
      new URL("https://example.com/docs/install"),
      new Request("https://example.com/docs/install", {
        headers: { "user-agent": "AcmeAgentFetcher/1.0" },
      }),
    );
    expect(heuristicAgentRoute).toEqual({ requestedPath: "install" });
    expect(
      detectDocsMarkdownAgentRequest(
        new Request("https://example.com/docs/install", {
          headers: { "user-agent": "AcmeAgentFetcher/1.0" },
        }),
      ),
    ).toEqual({ detected: true, method: "heuristic" });
    expect(
      detectDocsMarkdownAgentRequest(
        new Request("https://example.com/docs/install", {
          headers: { "user-agent": "AcmeAgentFetcher/1.0", "sec-fetch-mode": "navigate" },
        }),
      ),
    ).toEqual({ detected: false, method: null });
    expect(
      detectDocsMarkdownAgentRequest(
        new Request("https://example.com/docs/install", {
          headers: { "user-agent": "Googlebot/2.1" },
        }),
      ),
    ).toEqual({ detected: false, method: null });

    expect(
      hasDocsMarkdownSignatureAgent(
        new Request("https://example.com/docs/install", {
          headers: { "Signature-Agent": "https://chatgpt.com" },
        }),
      ),
    ).toBe(true);
    expect(
      getDocsMarkdownVaryHeader(
        new Request("https://example.com/docs/install", {
          headers: { accept: "text/markdown" },
        }),
      ),
    ).toBe("Accept");
    expect(
      getDocsMarkdownVaryHeader(
        new Request("https://example.com/docs/install", {
          headers: { "Signature-Agent": "https://chatgpt.com" },
        }),
      ),
    ).toBe("Accept, Signature-Agent");
    expect(
      getDocsMarkdownVaryHeader(
        new Request("https://example.com/docs/install", {
          headers: { "user-agent": "ClaudeBot/1.0" },
        }),
      ),
    ).toBe("User-Agent");
    expect(
      getDocsMarkdownVaryHeader(
        new Request("https://example.com/docs/install", {
          headers: { "user-agent": "AcmeAgentFetcher/1.0" },
        }),
      ),
    ).toBe("User-Agent, Sec-Fetch-Mode");
    expect(getDocsMarkdownVaryHeader(new Request("https://example.com/docs/install"))).toBeNull();

    const apiFormatRoute = resolveDocsMarkdownRequest(
      "docs",
      new URL("https://example.com/api/docs?format=markdown&path=install"),
      new Request("https://example.com/api/docs?format=markdown&path=install"),
    );
    expect(apiFormatRoute).toEqual({ requestedPath: "install" });

    const hijackRoute = resolveDocsMarkdownRequest(
      "docs",
      new URL("https://example.com/blog?format=markdown&path=install"),
      new Request("https://example.com/blog?format=markdown&path=install"),
    );
    expect(hijackRoute).toBeNull();

    const signatureAgentHijackRoute = resolveDocsMarkdownRequest(
      "docs",
      new URL("https://example.com/blog/install"),
      new Request("https://example.com/blog/install", {
        headers: { "Signature-Agent": "https://chatgpt.com" },
      }),
    );
    expect(signatureAgentHijackRoute).toBeNull();
  });

  it("builds cache-aware Markdown responses with representation metadata", async () => {
    const request = new Request("https://example.com/docs/install.md");
    const document = renderDocsMarkdownDocument(
      {
        url: "/docs/install",
        title: "Install",
        content: "Install the package.",
        lastmod: "2026-07-18",
      },
      { origin: "https://example.com" },
    );
    const response = createDocsMarkdownResponse({
      request,
      document,
      entry: "docs",
      requestedPath: "install",
      origin: "https://example.com",
      locale: "en",
      lastModified: "2026-07-18T14:23:45.000Z",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-location")).toBe(
      "https://example.com/docs/install.md?lang=en",
    );
    expect(response.headers.get("content-language")).toBe("en");
    expect(response.headers.get("link")).toBe(
      '<https://example.com/docs/install?lang=en>; rel="canonical"',
    );
    expect(response.headers.get("etag")).toMatch(/^W\/"[a-f0-9]+-[a-f0-9]{8}"$/);
    expect(response.headers.get("last-modified")).toBe("Sat, 18 Jul 2026 14:23:45 GMT");

    const dateOnlyResponse = createDocsMarkdownResponse({
      request,
      document,
      entry: "docs",
      requestedPath: "install",
      origin: "https://example.com",
      locale: "en",
    });
    expect(dateOnlyResponse.headers.get("last-modified")).toBeNull();

    const dateOnlyConditionalResponse = createDocsMarkdownResponse({
      request: new Request(request, {
        headers: { "If-Modified-Since": "Sun, 19 Jul 2026 00:00:00 GMT" },
      }),
      document,
      entry: "docs",
      requestedPath: "install",
      origin: "https://example.com",
      locale: "en",
    });
    expect(dateOnlyConditionalResponse.status).toBe(200);

    const notModified = createDocsMarkdownResponse({
      request: new Request(request, {
        headers: { "If-None-Match": response.headers.get("etag") ?? "" },
      }),
      document,
      entry: "docs",
      requestedPath: "install",
      origin: "https://example.com",
      locale: "en",
      lastModified: "2026-07-18T14:23:45.000Z",
    });
    expect(notModified.status).toBe(304);
    expect(await notModified.text()).toBe("");
    expect(notModified.headers.get("etag")).toBe(response.headers.get("etag"));

    const dateNotModified = createDocsMarkdownResponse({
      request: new Request(request, {
        headers: { "If-Modified-Since": "Sun, 19 Jul 2026 00:00:00 GMT" },
      }),
      document,
      entry: "docs",
      requestedPath: "install",
      origin: "https://example.com",
      locale: "en",
      lastModified: "2026-07-18T14:23:45.000Z",
    });
    expect(dateNotModified.status).toBe(304);

    const sameDayBeforeModification = createDocsMarkdownResponse({
      request: new Request(request, {
        headers: { "If-Modified-Since": "Sat, 18 Jul 2026 12:00:00 GMT" },
      }),
      document,
      entry: "docs",
      requestedPath: "install",
      origin: "https://example.com",
      locale: "en",
      lastModified: "2026-07-18T14:23:45.000Z",
    });
    expect(sameDayBeforeModification.status).toBe(200);

    const missing = createDocsMarkdownResponse({
      request: new Request("https://example.com/docs/unknown.md"),
      document: null,
      entry: "docs",
      requestedPath: "unknown",
      origin: "https://example.com",
      pages: [],
    });
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
    expect(await missing.text()).toContain("# Docs Page Not Found");
  });

  it("builds per-page markdown alternate URLs", () => {
    expect(toDocsMarkdownUrl("/docs")).toBe("/docs.md");
    expect(toDocsMarkdownUrl("/docs/install")).toBe("/docs/install.md");
    expect(toDocsMarkdownUrl("/docs/install.md")).toBe("/docs/install.md");
    expect(toDocsMarkdownUrl("/docs/install?ref=sidebar", { locale: "fr" })).toBe(
      "/docs/install.md?ref=sidebar&lang=fr",
    );
    expect(toDocsMarkdownUrl("/docs/install?lang=es", { locale: "fr" })).toBe(
      "/docs/install.md?lang=es",
    );
  });

  it("builds canonical Link headers for markdown mirrors", () => {
    expect(
      resolveDocsMarkdownCanonicalUrl({
        origin: "https://docs.example.com",
        entry: "docs",
        requestedPath: "install",
      }),
    ).toBe("https://docs.example.com/docs/install");

    expect(
      resolveDocsMarkdownCanonicalUrl({
        origin: "https://docs.example.com",
        entry: "docs",
        requestedPath: "",
        locale: "fr",
      }),
    ).toBe("https://docs.example.com/docs?lang=fr");

    expect(
      getDocsMarkdownCanonicalLinkHeader({
        origin: "https://docs.example.com",
        entry: "docs",
        requestedPath: "/docs/install.md",
      }),
    ).toBe('<https://docs.example.com/docs/install>; rel="canonical"');
  });

  it("renders recovery links for missing markdown responses", () => {
    const document = renderDocsMarkdownNotFound({
      entry: "docs",
      requestedPath: "missing/page",
      origin: "https://docs.example.com",
      pages: [
        {
          slug: "missing-pages",
          url: "/docs/missing-pages",
          title: "Missing Pages",
          description: "Recover from missing docs pages",
          content: "Recovery guide",
        },
      ],
      sitemap: { routePrefix: "/docs-map" },
    });

    expect(document).toMatch(/^---\ntitle: "Docs Page Not Found"/);
    expect(document).toContain('canonical_url: "https://docs.example.com/docs/missing/page"');
    expect(document).toContain('markdown_url: "https://docs.example.com/docs/missing/page.md"');
    expect(document).toContain("# Docs Page Not Found");
    expect(document).toContain("## Closest Matches");
    expect(document).toContain("[Missing Pages](/docs/missing-pages.md)");
    expect(document).toContain("`/docs/missing/page.md`");
    expect(document).toContain("`/.well-known/agent.json`");
    expect(document).toContain("`/api/docs?query={query}`");
    expect(document).toContain("`/api/docs?format=markdown&path=missing/page`");
    expect(document).toContain("`/docs-map/sitemap.md`");
    expect(document).toContain("`/docs-map/.well-known/sitemap.md`");
    expect(document).toContain("`/docs-map/sitemap.xml`");
    expect(document).toContain("## Sitemap");
    expect(document).toContain("See the full [sitemap](/docs-map/sitemap.md)");
  });

  it("resolves high-confidence markdown recovery redirects", () => {
    const recovery = resolveDocsMarkdownRecovery({
      entry: "docs",
      requestedPath: "instal",
      pages: [
        {
          slug: "install",
          url: "/docs/install",
          title: "Install",
          description: "Install the framework",
          content: "Install docs",
        },
        {
          slug: "configuration",
          url: "/docs/configuration",
          title: "Configuration",
          content: "Config docs",
        },
      ],
    });

    expect(recovery.redirect?.markdownUrl).toBe("/docs/install.md");
    expect(recovery.redirect?.confidence).toBeGreaterThanOrEqual(0.99);
  });

  it("bounds oversized requested paths during markdown recovery scoring", () => {
    const recovery = resolveDocsMarkdownRecovery({
      entry: "docs",
      requestedPath: `install/${"x".repeat(20_000)}`,
      pages: [
        {
          slug: "install",
          url: "/docs/install",
          title: "Install",
          description: "Install the framework",
          content: "Install docs",
        },
      ],
    });

    expect(recovery.redirect).toBeUndefined();
    expect(recovery.matches[0]?.markdownUrl).toBe("/docs/install.md");
  });

  it("renders agent-specific markdown documents", () => {
    const human = resolveDocsAgentMdxContent("Visible\n\n<Agent>\nHidden\n</Agent>", "human");
    const agent = resolveDocsAgentMdxContent("Visible\n\n<Agent>\nHidden\n</Agent>", "agent");
    expect(human).toBe("Visible");
    expect(agent).toBe("Visible\n\nHidden");
    expect(resolveDocsAgentMdxContent("Visible\n\n<Agent>\nHidden\n  </Agent>", "agent")).toBe(
      "Visible\n\nHidden",
    );

    const page = findDocsMarkdownPage(
      "docs",
      [
        {
          slug: "install",
          url: "/docs/install",
          title: "Install",
          description: "Install the framework",
          lastModified: "2026-05-27T12:30:00.000Z",
          related: [{ href: "/docs/configuration" }],
          content: "Visible",
          rawContent: "Visible",
          agentFallbackRawContent: "Visible\n\nHidden",
        },
      ],
      "install.md",
    );

    expect(page).not.toBeNull();
    const document = renderDocsMarkdownDocument(page!, { origin: "https://docs.example.com" });
    expect(document).toMatch(/^---\ntitle: "Install"/);
    expect(document).toContain('description: "Install the framework"');
    expect(document).toContain('canonical_url: "https://docs.example.com/docs/install"');
    expect(document).toContain('markdown_url: "https://docs.example.com/docs/install.md"');
    expect(document).toContain('last_updated: "2026-05-27"');
    expect(document).toContain("LLM index: /llms.txt");
    expect(renderDocsMarkdownDocument(page!, { llms: false })).not.toContain(
      "LLM index: /llms.txt",
    );
    expect(document).toContain("Related: /docs/configuration");
    expect(document).toContain("Hidden");
    expect(document).toContain("## Sitemap");
  });

  it("renders the generated skill.md document", () => {
    const document = renderDocsSkillDocument({
      origin: "https://docs.example.com",
      entry: "guides",
      search: true,
      mcp: {
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
        },
      },
      llms: {
        enabled: true,
        siteTitle: "Guides",
        siteDescription: "Machine-readable guides",
      },
      openapi: {
        enabled: true,
        url: "/api/docs?format=openapi",
        apiReferencePath: "/api-reference",
        source: "generated",
      },
    });

    expect(document).toContain("name: docs");
    expect(document).toContain("# Guides Skill");
    expect(document).toContain("Base URL: https://docs.example.com");
    expect(document).toContain("/guides.md");
    expect(document).toContain("/.well-known/agent.json");
    expect(document).toContain("/robots.txt");
    expect(document).toContain("/api/docs?format=skill");
    expect(document).toContain("OpenAPI schema: /api/docs?format=openapi");
    expect(document).toContain("API reference: /api-reference");
    expect(document).toContain("npx skills add farming-labs/docs");
  });

  it("renders the generated AGENTS.md document", () => {
    const document = renderDocsAgentsDocument({
      origin: "https://docs.example.com",
      entry: "guides",
      search: true,
      mcp: {
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
        },
      },
      feedback: {
        enabled: true,
        route: "/api/docs/agent/feedback",
        schemaRoute: "/api/docs/agent/feedback/schema",
      },
      llms: {
        enabled: true,
        siteTitle: "Guides",
        siteDescription: "Machine-readable guides",
      },
      openapi: {
        enabled: true,
        url: "/api/docs?format=openapi",
        apiReferencePath: "/api-reference",
        source: "generated",
      },
    });

    expect(document).toContain("# Agent Instructions");
    expect(document).toContain("Site: Guides");
    expect(document).toContain("Base URL: https://docs.example.com");
    expect(document).toContain("/guides.md");
    expect(document).toContain("/AGENTS.md");
    expect(document).toContain("/.well-known/AGENTS.md");
    expect(document).toContain("/api/docs?format=agents");
    expect(document).toContain("/api/docs?format=openapi");
    expect(document).toContain("npx @farming-labs/docs@latest upgrade --latest");
    expect(document).toContain("npx skills add farming-labs/docs");
  });

  it("builds the shared discovery spec with public endpoints", () => {
    const spec = buildDocsAgentDiscoverySpec({
      origin: "https://docs.example.com",
      entry: "docs",
      mcp: {
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
        },
      },
      llms: { enabled: true, siteTitle: "Docs" },
      sitemap: true,
      robots: true,
      openapi: {
        enabled: true,
        url: "/api/docs?format=openapi",
        apiReferencePath: "/api-reference",
        source: "generated",
      },
    });

    expect(spec.api.agentSpecDefault).toBe("/.well-known/agent.json");
    expect(spec.api.config).toBe("/api/docs?format=config");
    expect(spec.api.diagnostics).toBe("/api/docs?format=diagnostics");
    expect(spec.api.agents).toBe("/api/docs?format=agents");
    expect(spec.api.openapi).toBe("/api/docs?format=openapi");
    expect(spec.config).toMatchObject({
      format: "docs-config-map.v1",
      endpoint: "/api/docs?format=config",
    });
    expect(spec.markdown.rootPage).toBe("/docs.md");
    expect(spec.markdown.signatureAgentHeader).toBe("Signature-Agent");
    expect(spec.llms.publicTxt).toBe("/llms.txt");
    expect(spec.agents).toEqual({
      enabled: true,
      file: "AGENTS.md",
      route: "/AGENTS.md",
      wellKnown: "/.well-known/AGENTS.md",
      api: "/api/docs?format=agents",
      generatedFallback: true,
      aliases: ["/AGENT.md", "/.well-known/AGENT.md"],
    });
    expect(spec.skills.file).toBe("skill.md");
    expect(spec.skills.route).toBe("/skill.md");
    expect(spec.skills.wellKnown).toBe("/.well-known/skill.md");
    expect(spec.skills.api).toBe("/api/docs?format=skill");
    expect(spec.skills.generatedFallback).toBe(true);
    expect(spec.mcp.publicEndpoints).toEqual(["/mcp", "/.well-known/mcp"]);
    expect(spec.sitemap.xml.route).toBe("/sitemap.xml");
    expect(spec.sitemap.markdown.docsRoute).toBe("/docs/sitemap.md");
    expect(spec.sitemap.markdown.wellKnownRoute).toBe("/.well-known/sitemap.md");
    expect(spec.capabilities.robots).toBe(true);
    expect(spec.capabilities.agents).toBe(true);
    expect(spec.capabilities.structuredData).toBe(true);
    expect(spec.capabilities.apiReference).toBe(true);
    expect(spec.capabilities.openapi).toBe(true);
    expect(spec.openapi).toEqual({
      enabled: true,
      url: "/api/docs?format=openapi",
      source: "generated",
      specUrl: null,
      apiReferencePath: "/api-reference",
      format: "OpenAPI 3.1",
    });
    expect(spec.robots).toEqual({
      enabled: true,
      route: "/robots.txt",
      defaultRoute: "/robots.txt",
    });
    expect(spec.structuredData).toEqual({
      enabled: true,
      format: "application/ld+json",
      schema: "https://schema.org/TechArticle",
      fields: ["headline", "description", "url", "dateModified", "breadcrumb"],
      canonicalUrlField: "url",
      breadcrumbType: "BreadcrumbList",
    });
  });

  it("resolves agent feedback endpoints as default-on with explicit opt-out", () => {
    const enabled = resolveDocsAgentFeedbackConfig();

    expect(enabled.enabled).toBe(true);
    expect(enabled.route).toBe("/api/docs/agent/feedback");
    expect(enabled.schemaRoute).toBe("/api/docs/agent/feedback/schema");
    expect(
      resolveDocsAgentFeedbackRequest(
        new URL("https://example.com/api/docs/agent/feedback/schema"),
        enabled,
      ),
    ).toEqual({ kind: "schema" });
    expect(
      resolveDocsAgentFeedbackRequest(
        new URL("https://example.com/api/docs?feedback=agent"),
        enabled,
      ),
    ).toEqual({ kind: "submit" });

    expect(resolveDocsAgentFeedbackConfig(false).enabled).toBe(false);
    expect(resolveDocsAgentFeedbackConfig({ agent: false }).enabled).toBe(false);
  });
});
