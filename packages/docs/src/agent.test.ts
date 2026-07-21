import { describe, expect, it } from "vitest";
import { findDocsAudienceMdxTags } from "./audience.js";
import {
  acceptsDocsMarkdown,
  AGENT_SKILLS_DISCOVERY_SCHEMA_URI,
  API_CATALOG_MEDIA_TYPE,
  API_CATALOG_PROFILE_URI,
  buildDocsAgentDiscoverySpec,
  buildDocsConfigMap,
  buildDocsDiagnostics,
  buildDocsMcpEndpointCandidates,
  createDocsMarkdownResponse,
  createDocsStandardsDiscoveryResponse,
  detectDocsMarkdownAgentRequest,
  findDocsAudienceMdxIssues,
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
  isDocsStandardsDiscoveryRequest,
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
  resolveDocsAudienceMdxContent,
  resolveDocsAgentMdxContent,
  resolveDocsAgentsFormat,
  resolveDocsLlmsTxtFormat,
  resolveDocsLlmsTxtRequest,
  resolveDocsLlmsTxtSections,
  resolveDocsMarkdownCanonicalUrl,
  resolveDocsRequestApiRoute,
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
    const customAgentSpec = new URL("https://example.com/api/internal/docs?agent=spec");
    expect(isDocsAgentDiscoveryRequest(customAgentSpec)).toBe(false);
    expect(
      isDocsAgentDiscoveryRequest(customAgentSpec, { apiRoute: " api//internal/docs/ " }),
    ).toBe(true);
    expect(
      isDocsSkillRequest(new URL("https://example.com/api/internal/docs?format=skill"), {
        apiRoute: "/api/internal/docs",
      }),
    ).toBe(true);
    expect(
      isDocsAgentsRequest(new URL("https://example.com/api/internal/docs?format=agents"), {
        apiRoute: "/api/internal/docs",
      }),
    ).toBe(true);
    expect(isDocsAgentDiscoveryRequest(new URL("https://example.com/blog?agent=spec"))).toBe(false);
    expect(
      resolveDocsRequestApiRoute(
        new URL("https://example.com/api/internal/docs?format=skill"),
        "/api/configured/docs",
      ),
    ).toBe("/api/internal/docs");
    expect(
      resolveDocsRequestApiRoute(
        new URL("https://example.com/skill.md?lang=en"),
        "/api/configured/docs",
      ),
    ).toBe("/api/configured/docs");
    expect(
      isDocsStandardsDiscoveryRequest(new URL("https://example.com/.well-known/api-catalog")),
    ).toBe(true);
    expect(
      isDocsStandardsDiscoveryRequest(
        new URL("https://example.com/.well-known/agent-skills/index.json"),
      ),
    ).toBe(true);
    expect(
      isDocsStandardsDiscoveryRequest(
        new URL("https://example.com/.well-known/agent-skills/docs/SKILL.md"),
      ),
    ).toBe(true);
    expect(
      isDocsStandardsDiscoveryRequest(
        new URL("https://example.com/api/docs?format=agent-skill&name=docs"),
      ),
    ).toBe(true);
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
        mcp: {
          tools: { listTasks: true, readTask: true },
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
    expect(map.values.mcp).toEqual({
      tools: { listTasks: true, readTask: true },
    });
    expect(map.pointers["/mcp/tools/listTasks"]).toEqual({
      path: "mcp.tools.listTasks",
      kind: "boolean",
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
        apiCatalog: null,
        agentSkillsIndex: "/.well-known/agent-skills/index.json",
        agentSkillsArtifact: "/.well-known/agent-skills/{name}/SKILL.md",
        search: null,
        askAi: null,
        llmsTxt: null,
        robots: null,
        openapi: "/api/docs?format=openapi",
        apiReference: "/reference",
      },
      features: {
        staticExport: { status: "enabled" },
        apiCatalog: {
          status: "disabled",
          reason: "static-export",
          route: null,
          transport: "GET/HEAD",
        },
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

  it("reports the llmsTxt API catalog opt-out without disabling Agent Skills", () => {
    const diagnostics = buildDocsDiagnostics({
      llmsTxt: {
        enabled: true,
        apiCatalog: false,
      },
    });

    expect(diagnostics.routes).toMatchObject({
      apiCatalog: null,
      agentSkillsIndex: "/.well-known/agent-skills/index.json",
      llmsTxt: "/llms.txt",
    });
    expect(diagnostics.features.apiCatalog).toEqual({
      status: "disabled",
      reason: "llms-txt-api-catalog-disabled",
      route: null,
      transport: "GET/HEAD",
    });
    expect(diagnostics.features.llmsTxt.status).toBe("enabled");
    expect(diagnostics.features.skills.status).toBe("enabled");
  });

  it("uses the configured API route throughout diagnostics", () => {
    const diagnostics = buildDocsDiagnostics({
      entry: "docs",
      cloud: { apiRoute: " api//internal/docs/ " },
      ai: { enabled: true },
      apiReference: true,
    });

    expect(diagnostics.routes).toMatchObject({
      api: "/api/internal/docs",
      config: "/api/internal/docs?format=config",
      diagnostics: "/api/internal/docs?format=diagnostics",
      agentSpec: "/api/internal/docs?agent=spec",
      agents: "/api/internal/docs?format=agents",
      skill: "/api/internal/docs?format=skill",
      search: "/api/internal/docs?query={query}",
      askAi: "/api/internal/docs",
      openapi: "/api/internal/docs?format=openapi",
    });
    expect(diagnostics.features).toMatchObject({
      config: { route: "/api/internal/docs?format=config" },
      diagnostics: { route: "/api/internal/docs?format=diagnostics" },
      search: { route: "/api/internal/docs?query={query}" },
      ai: { route: "/api/internal/docs" },
      apiReference: { routes: { openapi: "/api/internal/docs?format=openapi" } },
      agents: { routes: { api: "/api/internal/docs?format=agents" } },
      skills: { routes: { api: "/api/internal/docs?format=skill" } },
    });
  });

  it("honors an effective API catalog diagnostics override", () => {
    const diagnostics = buildDocsDiagnostics(
      { llmsTxt: { apiCatalog: true } },
      { apiCatalog: false },
    );

    expect(diagnostics.routes.apiCatalog).toBeNull();
    expect(diagnostics.features.apiCatalog).toMatchObject({
      status: "disabled",
      reason: "configured-disabled",
      route: null,
    });
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
        listTasks: true,
        readTask: true,
        searchDocs: false,
        getNavigation: true,
        getCodeExamples: true,
        getConfigSchema: false,
        getContext: true,
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

  it("resolves llms.txt query formats on a custom API route", () => {
    const url = new URL("https://example.com/api/internal/docs?format=llms-full");

    expect(resolveDocsLlmsTxtRequest(url)).toBeNull();
    expect(
      resolveDocsLlmsTxtRequest(url, undefined, undefined, {
        apiRoute: "api/internal/docs/",
      }),
    ).toEqual({ format: "llms-full", section: undefined });
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
      "[API catalog](https://docs.example.com/.well-known/api-catalog)",
    );
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

    const withoutApiCatalog = renderDocsLlmsTxt(
      [{ url: "/docs", title: "Overview", content: "Welcome." }],
      { baseUrl: "https://docs.example.com", apiCatalog: false },
    ).llmsTxt;
    expect(withoutApiCatalog).not.toContain("/.well-known/api-catalog");
    expect(withoutApiCatalog).toContain("/.well-known/agent-skills/index.json");
  });

  it("uses the agent projection for runtime llms-full.txt content", () => {
    const content = renderDocsLlmsTxt([
      {
        url: "/docs/audience",
        title: "Audience",
        content: "Human search text.",
        rawContent: "Shared.\n\nHuman-only.",
        agentFallbackRawContent: "Shared.\n\nAgent-only.",
      },
    ]);

    expect(content.llmsFullTxt).toContain("Shared.");
    expect(content.llmsFullTxt).toContain("Agent-only.");
    expect(content.llmsFullTxt).not.toContain("Human-only.");
    expect(content.llmsTxt).not.toContain("Agent-only.");
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
    for (const route of [
      "/.well-known/api-catalog",
      "/.well-known/agent-skills/index.json",
      "/.well-known/agent-skills/docs/SKILL.md",
    ]) {
      expect(
        isDocsPublicGetRequest(
          "docs",
          new URL(`https://example.com${route}`),
          new Request(`https://example.com${route}`),
        ),
      ).toBe(true);
    }
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

    const customApiFormatRoute = resolveDocsMarkdownRequest(
      "docs",
      new URL("https://example.com/api/internal/docs?format=markdown&path=install"),
      new Request("https://example.com/api/internal/docs?format=markdown&path=install"),
      { apiRoute: "/api/internal/docs" },
    );
    expect(customApiFormatRoute).toEqual({ requestedPath: "install" });

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

    const customRouteDocument = renderDocsMarkdownNotFound({
      entry: "docs",
      apiRoute: "/api/internal/docs",
      requestedPath: "unknown",
      pages: [],
    });
    expect(customRouteDocument).toContain("`/api/internal/docs?agent=spec`");
    expect(customRouteDocument).toContain("`/api/internal/docs?query={query}`");
    expect(customRouteDocument).toContain("`/api/internal/docs?format=markdown&path=unknown`");
    expect(customRouteDocument).not.toContain("`/api/docs?query={query}`");
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
          agent: {
            tokenBudget: 800,
            task: "Install the framework",
            outcome: "The docs app starts successfully.",
            appliesTo: { framework: "nextjs", version: ">=16" },
            files: ["package.json"],
            commands: ["pnpm install"],
            verification: [{ run: "pnpm test", expect: "Tests pass" }],
          },
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
    expect(document).toContain("agent:\n  tokenBudget: 800");
    expect(document).toContain('  task: "Install the framework"');
    expect(document).toContain("## Agent Contract");
    expect(document).toContain("- Framework: `nextjs`");
    expect(document).toContain("- `pnpm install`");
    expect(document).toContain("LLM index: /llms.txt");

    const handwrittenContract = renderDocsMarkdownDocument({
      ...page!,
      agentRawContent: "## Agent Contract\n\nUse the handwritten recovery procedure.",
    });
    expect(handwrittenContract.match(/## Agent Contract/g)).toHaveLength(1);
    expect(handwrittenContract).toContain("Use the handwritten recovery procedure.");
    expect(handwrittenContract).not.toContain("farming-labs:agent-contract:start");
    expect(renderDocsMarkdownDocument(page!, { llms: false })).not.toContain(
      "LLM index: /llms.txt",
    );

    const contentOnlyDocument = renderDocsMarkdownDocument({
      ...page!,
      content: "Human-only fallback.",
      rawContent: "Human-only fallback.",
      agentFallbackRawContent: undefined,
      agentContent: "Agent content-only override.",
    });
    expect(contentOnlyDocument).toContain("Agent content-only override.");
    expect(contentOnlyDocument).not.toContain("Human-only fallback.");

    const fallbackContentOnlyDocument = renderDocsMarkdownDocument({
      ...page!,
      content: "Human-only fallback.",
      rawContent: "Human-only fallback.",
      agentFallbackRawContent: undefined,
      agentFallbackContent: "Agent content-only projection.",
    });
    expect(fallbackContentOnlyDocument).toContain("Agent content-only projection.");
    expect(fallbackContentOnlyDocument).not.toContain("Human-only fallback.");
    expect(document).toContain("Related: /docs/configuration");
    expect(document).toContain("Hidden");
    expect(document).toContain("## Sitemap");
  });

  it("resolves Agent, Human, and Audience blocks without changing literal examples", () => {
    const source = `Shared.

<Agent audience="implementation">Agent shorthand.</Agent>
<Agent version=">=2">Quoted greater-than attribute.</Agent>
<Agent when={version >= 2}>Expression greater-than attribute.</Agent>
<Human>Human shorthand.</Human>
<Audience only="agent">Agent explicit.</Audience>
<Audience only={'human'}>Human explicit.</Audience>
<Audience
  only={"agent"}
>
Multiline agent.
</Audience>
<Audience only={runtimeAudience}>Dynamic stays shared.</Audience>
<Human><Agent>Conflicting nested content.</Agent></Human>
<Agent />

\`<Agent>inline example</Agent>\`

\`\`\`mdx
<Agent>fenced example</Agent>
\`\`\`

~~~~mdx
<Human>tilde-fenced example</Human>
~~~~

{/* <Human>MDX comment example</Human> */}
<!-- <Audience only="agent">HTML comment example</Audience> -->
export const audienceExample = "<Agent>module string example</Agent>";
export const multilineAudienceExample = {
  value: "<Agent>multiline module string example</Agent>",
};

\`\`\`md
\`\`\`js
<Agent>nested fence example</Agent>
\`\`\`
\`\`\``;

    const human = resolveDocsAudienceMdxContent(source, "human");
    const agent = resolveDocsAudienceMdxContent(source, "agent");

    expect(human).toContain("Shared.");
    expect(human).toContain("Human shorthand.");
    expect(human).toContain("Human explicit.");
    expect(human).toContain("Dynamic stays shared.");
    expect(human).not.toContain("Agent shorthand.");
    expect(human).not.toContain("Quoted greater-than attribute.");
    expect(human).not.toContain("Expression greater-than attribute.");
    expect(human).not.toContain("Agent explicit.");
    expect(human).not.toContain("Multiline agent.");
    expect(agent).toContain("Shared.");
    expect(agent).toContain("Agent shorthand.");
    expect(agent).toContain("Quoted greater-than attribute.");
    expect(agent).toContain("Expression greater-than attribute.");
    expect(agent).toContain("Agent explicit.");
    expect(agent).toContain("Multiline agent.");
    expect(agent).toContain("Dynamic stays shared.");
    expect(agent).not.toContain("Human shorthand.");
    expect(agent).not.toContain("Human explicit.");
    expect(human).not.toContain("Conflicting nested content.");
    expect(agent).not.toContain("Conflicting nested content.");

    for (const projection of [human, agent]) {
      expect(projection).toContain("`<Agent>inline example</Agent>`");
      expect(projection).toContain("<Agent>fenced example</Agent>");
      expect(projection).toContain("<Human>tilde-fenced example</Human>");
      expect(projection).toContain("{/* <Human>MDX comment example</Human> */}");
      expect(projection).toContain(
        '<!-- <Audience only="agent">HTML comment example</Audience> -->',
      );
      expect(projection).toContain(
        'export const audienceExample = "<Agent>module string example</Agent>";',
      );
      expect(projection).toContain('value: "<Agent>multiline module string example</Agent>",');
      expect(projection).toContain("<Agent>nested fence example</Agent>");
    }

    expect(resolveDocsAgentMdxContent(source, "agent")).toBe(agent);
    expect(findDocsAudienceMdxIssues(source).map((issue) => issue.code)).toEqual(["dynamic-only"]);
  });

  it.each([
    [
      "multiline imports",
      `import {
  thing,
}
from "<Agent>module path literal</Agent>";`,
    ],
    [
      "multiline code spans",
      "Shared `inline code starts\n<Agent>literal code example</Agent>` end.",
    ],
    ["escaped JSX", String.raw`\<Agent>literal escaped example\</Agent>`],
    ["quoted JSX props", '<Example code="<Agent>literal prop example</Agent>" />'],
    ["MDX expression strings", '{"<Agent>literal expression example</Agent>"}'],
    [
      "semicolonless JSX exports",
      'export const Demo = <Example label="<Agent>literal export example</Agent>" />',
    ],
    ["comparison exports", "export const compare = left<right;"],
    ["generic class exports", "export class Store extends Base<Model> {}"],
    ["generic arrow exports", "export const identity = <T>(value: T) => value;"],
    ["expression regex literals", String.raw`{() => /<Agent>literal regex<\/Agent>/.test(value)}`],
    ["module regex literals", 'export const pattern = /[{"]/;'],
    [
      "JSX fragment exports",
      `export const Demo = <>
  <Agent>literal exported component</Agent>
</>`,
    ],
    ["Markdown link titles", '[link](https://example.com "See <Agent>literal</Agent>")'],
    [
      "blockquote fences",
      `> ~~~mdx
> <Agent>literal blockquote fence</Agent>
> ~~~~~`,
    ],
    [
      "nested list fences",
      `- outer
  - ~~~mdx
    <Agent>literal nested list fence</Agent>
    ~~~`,
    ],
    ["HTML comments", "<!-- <Agent>literal HTML comment</Agent> -->"],
    [
      "raw script blocks",
      `<script>
const sample = "<Agent>literal script</Agent>";
</script>`,
    ],
  ])("preserves audience-looking literals in %s", (_name, literal) => {
    const source = `${literal}\n\n<Agent>real agent content</Agent>`;

    expect(resolveDocsAudienceMdxContent(source, "human")).toBe(literal);
    expect(resolveDocsAudienceMdxContent(source, "agent")).toBe(`${literal}\n\nreal agent content`);
  });

  it.each([
    [
      "fenced raw-element delimiters",
      "```md\n<script>\n```\n\n<Agent>SECRET</Agent>\n\n```md\n</script>\n```",
    ],
    ["inline raw-element delimiters", "`<script>`\n\n<Agent>SECRET</Agent>\n\n`</script>`"],
    ["expression raw-element delimiters", '{"<script>"}\n\n<Agent>SECRET</Agent>\n\n{"</script>"}'],
    [
      "module raw-element delimiters",
      'export const open = "<script>";\n\n<Agent>SECRET</Agent>\n\nexport const close = "</script>";',
    ],
    [
      "JSX prop raw-element delimiters",
      '<Card open="<script>" />\n\n<Agent>SECRET</Agent>\n\n<Card close="</script>" />',
    ],
    ["escaped raw-element delimiters", "\\<script>\n\n<Agent>SECRET</Agent>\n\n\\</script>"],
    [
      "fenced HTML comment delimiters",
      "```md\n<!--\n```\n\n<Agent>SECRET</Agent>\n\n```md\n-->\n```",
    ],
    ["escaped HTML comment delimiters", "\\<!--\n\n<Agent>SECRET</Agent>\n\n\\-->"],
  ])("does not pair %s across live audience content", (_name, source) => {
    const human = resolveDocsAudienceMdxContent(source, "human");
    const agent = resolveDocsAudienceMdxContent(source, "agent");

    expect(human).not.toContain("SECRET");
    expect(agent).toContain("SECRET");
    expect(findDocsAudienceMdxTags(source)).toHaveLength(2);
  });

  it.each([
    [
      "script delimiters inside comments",
      "<!-- <script> -->\n\n<Agent>SECRET</Agent>\n\n<!-- </script> -->",
    ],
    [
      "style delimiters inside comments",
      "<!-- <style> -->\n\n<Agent>SECRET</Agent>\n\n<!-- </style> -->",
    ],
    [
      "comment delimiters inside raw script",
      '<script>\nconst value = "<!--";\n</script>\n\n<Agent>SECRET</Agent>\n\n<div>--></div>',
    ],
    [
      "arrow regex and fenced closing delimiter",
      "{() => /<script>/.test(value)}\n\n<Agent>SECRET</Agent>\n\n```md\n</script>\n```",
    ],
    [
      "JSX prop regex and fenced closing delimiter",
      "<Card test={() => /<script>/.test(value)} />\n\n<Agent>SECRET</Agent>\n\n```md\n</script>\n```",
    ],
    [
      "keyword-prefixed regex and fenced closing delimiter",
      "{(() => { return /<script>/.test(value) })()}\n\n<Agent>SECRET</Agent>\n\n```md\n</script>\n```",
    ],
    [
      "Svelte directive regex and fenced closing delimiter",
      "{#if /<script>/.test(value)}\n<Agent>SECRET</Agent>\n```md\n</script>\n```\n{/if}",
    ],
    [
      "angle-bracket link destination and fenced closing delimiter",
      "[link](<script>)\n\n<Agent>SECRET</Agent>\n\n```md\n</script>\n```",
    ],
    [
      "angle-bracket image destination and fenced comment closing delimiter",
      "![image](<!--)\n\n<Agent>SECRET</Agent>\n\n```md\n-->\n```",
    ],
    [
      "self-closing raw element and fenced closing delimiter",
      '<script src="example.js" />\n\n<Agent>SECRET</Agent>\n\n```md\n</script>\n```',
    ],
  ])("keeps %s from swallowing live audience content", (_name, source) => {
    expect(resolveDocsAudienceMdxContent(source, "human")).not.toContain("SECRET");
    expect(resolveDocsAudienceMdxContent(source, "agent")).toContain("SECRET");
    expect(findDocsAudienceMdxTags(source)).toHaveLength(2);
  });

  it.each(["script-loader", "style-guide", "script.foo"])(
    "does not treat the custom %s element as raw code",
    (name) => {
      const source = `<${name}>\n<Agent>SECRET</Agent>\n</${name}>\n<script>ok</script>`;
      expect(resolveDocsAudienceMdxContent(source, "human")).not.toContain("SECRET");
      expect(resolveDocsAudienceMdxContent(source, "agent")).toContain("SECRET");
    },
  );

  it("treats an unclosed lowercase raw element as literal content through EOF", () => {
    const source = '<script>\nconst sample = "<Agent>literal script</Agent>";';
    expect(resolveDocsAudienceMdxContent(source, "human")).toBe(source);
    expect(resolveDocsAudienceMdxContent(source, "agent")).toBe(source);
    expect(findDocsAudienceMdxTags(source)).toEqual([]);
  });

  it("uses JSX-safe replacements for audience elements inside MDX expressions", () => {
    const source = `<Card title={<Agent>Agent title</Agent>} subtitle={<Human>Human subtitle</Human>} />`;
    const human = resolveDocsAudienceMdxContent(source, "human");
    const agent = resolveDocsAudienceMdxContent(source, "agent");

    expect(human).toBe("<Card title={null} subtitle={<>Human subtitle</>} />");
    expect(agent).toBe("<Card title={<>Agent title</>} subtitle={null} />");

    const audienceWithExpressionProp =
      "<Agent child={<Human>Ignored prop.</Human>}>Agent body.</Agent>";
    expect(resolveDocsAudienceMdxContent(audienceWithExpressionProp, "human")).toBe("");
    expect(resolveDocsAudienceMdxContent(audienceWithExpressionProp, "agent")).toBe("Agent body.");

    const expressionAudienceWithProp =
      "{<Agent child={<Human>Ignored prop.</Human>}>Agent body.</Agent>}";
    expect(resolveDocsAudienceMdxContent(expressionAudienceWithProp, "human")).toBe("{null}");
    expect(resolveDocsAudienceMdxContent(expressionAudienceWithProp, "agent")).toBe(
      "{<>Agent body.</>}",
    );

    const nestedChildren = "{<Box><Agent>A</Agent>B<Human>H</Human></Box>}";
    expect(resolveDocsAudienceMdxContent(nestedChildren, "human")).toBe(
      "{<Box>{null}B<>H</></Box>}",
    );
    expect(resolveDocsAudienceMdxContent(nestedChildren, "agent")).toBe(
      "{<Box><>A</>B{null}</Box>}",
    );

    const spreadAttribute = "<Card {...{ title: <Agent>A</Agent>, subtitle: <Human>H</Human> }} />";
    expect(resolveDocsAudienceMdxContent(spreadAttribute, "human")).toBe(
      "<Card {...{ title: null, subtitle: <>H</> }} />",
    );
    expect(resolveDocsAudienceMdxContent(spreadAttribute, "agent")).toBe(
      "<Card {...{ title: <>A</>, subtitle: null }} />",
    );
  });

  it("keeps frontmatter literals out of the audience tree without shifting Unicode offsets", () => {
    const source = `---
description: "😀 <Agent>frontmatter literal</Agent>"
---

<Agent>real agent content</Agent>`;

    expect(resolveDocsAudienceMdxContent(source, "human")).toBe(
      '---\ndescription: "😀 <Agent>frontmatter literal</Agent>"\n---',
    );
    expect(resolveDocsAudienceMdxContent(source, "agent")).toContain("real agent content");

    const blockScalar = `---
description: |
  ---
  <Agent>literal YAML</Agent>
---

<Agent>real block scalar content</Agent>`;
    expect(resolveDocsAudienceMdxContent(blockScalar, "human")).toBe(
      "---\ndescription: |\n  ---\n  <Agent>literal YAML</Agent>\n---",
    );
    expect(resolveDocsAudienceMdxContent(blockScalar, "agent")).toContain(
      "real block scalar content",
    );
  });

  it("projects audience blocks in Svelte MDX without falling back to literal scanners", () => {
    const source = `{#if enabled}
{() => /<Agent>literal<\\/Agent>/.test(value)}
<Agent when={/[}]/.test(value) && score > 1}>Svelte agent content.</Agent>
- outer
  - ~~~mdx
    <Agent>literal fenced content</Agent>
    ~~~
[link](https://example.com "<Agent>literal title</Agent>")
{/if}

<Agent>real trailing content</Agent>`;

    const human = resolveDocsAudienceMdxContent(source, "human");
    const agent = resolveDocsAudienceMdxContent(source, "agent");
    expect(human).not.toContain("Svelte agent content.");
    expect(human).not.toContain("real trailing content");
    expect(agent).toContain("Svelte agent content.");
    expect(agent).toContain("real trailing content");
    for (const projection of [human, agent]) {
      expect(projection).toContain("/<Agent>literal<\\/Agent>/");
      expect(projection).toContain("<Agent>literal fenced content</Agent>");
      expect(projection).toContain('"<Agent>literal title</Agent>"');
    }
  });

  it("preserves whitespace inside protected literals while projecting audience content", () => {
    const source = `Before



\`\`\`txt
a


b
\`\`\`

<Agent>secret</Agent>

After`;

    for (const audience of ["human", "agent"] as const) {
      expect(resolveDocsAudienceMdxContent(source, audience)).toContain("```txt\na\n\n\nb\n```");
    }
  });

  it("treats Audience spread props as dynamic shared content", () => {
    const source = `<Audience only="agent" {...props}>Shared fallback.</Audience>`;

    expect(resolveDocsAudienceMdxContent(source, "human")).toBe("Shared fallback.");
    expect(resolveDocsAudienceMdxContent(source, "agent")).toBe("Shared fallback.");
    expect(findDocsAudienceMdxIssues(source).map((issue) => issue.code)).toEqual(["dynamic-only"]);

    expect(
      findDocsAudienceMdxIssues(
        '<Agent only="human">Agent shorthand.</Agent><Human only="agent">Human shorthand.</Human>',
      ).map((issue) => issue.code),
    ).toEqual(["ignored-agent-only", "ignored-human-only"]);
  });

  it("resolves indented audience elements as live MDX components", () => {
    const source = `- Item
    <Agent>Agent-only nested detail.</Agent>

    <Human>Human-only nested detail.</Human>`;

    expect(resolveDocsAudienceMdxContent(source, "human")).not.toContain(
      "Agent-only nested detail.",
    );
    expect(resolveDocsAudienceMdxContent(source, "human")).toContain("Human-only nested detail.");
    expect(resolveDocsAudienceMdxContent(source, "agent")).toContain("Agent-only nested detail.");
    expect(resolveDocsAudienceMdxContent(source, "agent")).not.toContain(
      "Human-only nested detail.",
    );
  });

  it("does not confuse capitalized Script and Style components with raw code elements", () => {
    const source = `<Script>
<Agent>Agent-only script child.</Agent>
</Script>
<Style><Human>Human-only style child.</Human></Style>`;

    const human = resolveDocsAudienceMdxContent(source, "human");
    const agent = resolveDocsAudienceMdxContent(source, "agent");
    expect(human).not.toContain("Agent-only script child.");
    expect(human).toContain("Human-only style child.");
    expect(agent).toContain("Agent-only script child.");
    expect(agent).not.toContain("Human-only style child.");
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
          listTasks: true,
          readTask: true,
          searchDocs: true,
          getNavigation: true,
          getCodeExamples: true,
          getConfigSchema: true,
          getContext: true,
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
    expect(document).toContain("/.well-known/api-catalog");
    expect(document).toContain("/.well-known/agent-skills/index.json");
    expect(document).toContain("/.well-known/agent-skills/{name}/SKILL.md");
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
          listTasks: true,
          readTask: true,
          searchDocs: true,
          getNavigation: true,
          getCodeExamples: true,
          getConfigSchema: true,
          getContext: true,
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
    expect(document).toContain("/.well-known/api-catalog");
    expect(document).toContain("/.well-known/agent-skills/index.json");
    expect(document).toContain("/.well-known/agent-skills/{name}/SKILL.md");
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
          listTasks: true,
          readTask: true,
          searchDocs: true,
          getNavigation: true,
          getCodeExamples: true,
          getConfigSchema: true,
          getContext: true,
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
    expect(spec.api.apiCatalog).toBe("/.well-known/api-catalog");
    expect(spec.api.apiCatalogQuery).toBe("/api/docs?format=api-catalog");
    expect(spec.api.agentSkillsIndex).toBe("/.well-known/agent-skills/index.json");
    expect(spec.api.openapi).toBe("/api/docs?format=openapi");
    expect(spec.config).toMatchObject({
      format: "docs-config-map.v1",
      endpoint: "/api/docs?format=config",
    });
    expect(spec.markdown.rootPage).toBe("/docs.md");
    expect(spec.markdown.signatureAgentHeader).toBe("Signature-Agent");
    expect(spec.markdown.resolutionOrder).toEqual([
      "agent.md",
      "agent audience projection",
      "shared page markdown",
    ]);
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
    expect(spec.skills.discovery).toEqual({
      schema: AGENT_SKILLS_DISCOVERY_SCHEMA_URI,
      index: "/.well-known/agent-skills/index.json",
      artifact: "/.well-known/agent-skills/{name}/SKILL.md",
      apiIndex: "/api/docs?format=agent-skills",
      apiArtifact: "/api/docs?format=agent-skill&name={name}",
      digest: "sha256",
    });
    expect(spec.apiCatalog).toEqual({
      enabled: true,
      route: "/.well-known/api-catalog",
      api: "/api/docs?format=api-catalog",
      mediaType: API_CATALOG_MEDIA_TYPE,
      profile: API_CATALOG_PROFILE_URI,
    });
    expect(spec.mcp.publicEndpoints).toEqual(["/mcp", "/.well-known/mcp"]);
    expect(spec.sitemap.xml.route).toBe("/sitemap.xml");
    expect(spec.sitemap.markdown.docsRoute).toBe("/docs/sitemap.md");
    expect(spec.sitemap.markdown.wellKnownRoute).toBe("/.well-known/sitemap.md");
    expect(spec.capabilities.robots).toBe(true);
    expect(spec.capabilities.agents).toBe(true);
    expect(spec.capabilities.apiCatalog).toBe(true);
    expect(spec.capabilities.agentSkillsDiscovery).toBe(true);
    expect(spec.capabilities.structuredData).toBe(true);
    expect(spec.capabilities.structuredAgentContracts).toBe(true);
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
      fields: ["headline", "description", "url", "dateModified", "breadcrumb", "mainEntity"],
      canonicalUrlField: "url",
      breadcrumbType: "BreadcrumbList",
      agentContractType: "HowTo",
    });
    expect(spec.agentContract).toMatchObject({
      enabled: true,
      schemaVersion: "page-agent-contract.v1",
      source: "page-frontmatter",
      frontmatterPath: "agent",
      markdownSection: "Agent Contract",
      mcpField: "agent",
      mcpTools: { list: "list_tasks", read: "read_task" },
      usefulContractFields: ["task", "outcome"],
    });
  });

  it("normalizes a custom API route across generated discovery resources", () => {
    const options = {
      origin: "https://docs.example.com",
      apiRoute: " api//internal/docs/ ",
      mcp: {
        enabled: false,
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
      },
      feedback: { enabled: true },
      openapi: true,
    } as const;
    const spec = buildDocsAgentDiscoverySpec(options);

    expect(spec.api).toMatchObject({
      docs: "/api/internal/docs",
      config: "/api/internal/docs?format=config",
      diagnostics: "/api/internal/docs?format=diagnostics",
      agentSpec: "/api/internal/docs?agent=spec",
      agentSpecQuery: "/api/internal/docs?agent=spec",
      agents: "/api/internal/docs?format=agents",
      apiCatalog: "/.well-known/api-catalog",
      apiCatalogQuery: "/api/internal/docs?format=api-catalog",
      agentSkillsIndex: "/.well-known/agent-skills/index.json",
      openapi: "/api/internal/docs?format=openapi",
    });
    expect(spec.api.agentSpecDefault).toBe("/.well-known/agent.json");
    expect(spec.apiCatalog.api).toBe("/api/internal/docs?format=api-catalog");
    expect(spec.config.endpoint).toBe("/api/internal/docs?format=config");
    expect(spec.markdown.apiPattern).toBe("/api/internal/docs?format=markdown&path={slug}");
    expect(spec.llms).toMatchObject({
      txt: "/api/internal/docs?format=llms",
      full: "/api/internal/docs?format=llms-full",
    });
    expect(spec.sitemap.xml.api).toBe("/api/internal/docs?format=sitemap-xml");
    expect(spec.sitemap.markdown.api).toBe("/api/internal/docs?format=sitemap-md");
    expect(spec.search.endpoint).toBe("/api/internal/docs?query={query}");
    expect(spec.agents.api).toBe("/api/internal/docs?format=agents");
    expect(spec.skills.api).toBe("/api/internal/docs?format=skill");
    expect(spec.skills.discovery).toMatchObject({
      index: "/.well-known/agent-skills/index.json",
      artifact: "/.well-known/agent-skills/{name}/SKILL.md",
      apiIndex: "/api/internal/docs?format=agent-skills",
      apiArtifact: "/api/internal/docs?format=agent-skill&name={name}",
    });
    expect(spec.openapi.url).toBe("/api/internal/docs?format=openapi");
    expect(spec.feedback).toMatchObject({
      schemaQuery: "/api/internal/docs?feedback=agent&schema=1",
      submitQuery: "/api/internal/docs?feedback=agent",
    });

    const generatedSkill = renderDocsSkillDocument(options);
    expect(generatedSkill).toContain("/api/internal/docs?query={query}");
    expect(generatedSkill).toContain("/api/internal/docs?format=agents");
    expect(generatedSkill).toContain("/api/internal/docs?format=skill");
    expect(generatedSkill).toContain("/api/internal/docs?format=openapi");
    expect(generatedSkill).toContain("/api/internal/docs?agent=spec");
  });

  it("advertises only task tools exposed by the resolved MCP config", () => {
    const baseTools = {
      listDocs: true,
      listPages: true,
      readPage: true,
      searchDocs: true,
      getNavigation: true,
      getCodeExamples: true,
      getConfigSchema: true,
      getContext: true,
    };
    const build = (mcp: Parameters<typeof buildDocsAgentDiscoverySpec>[0]["mcp"]) =>
      buildDocsAgentDiscoverySpec({ origin: "https://docs.example.com", mcp });

    expect(
      build({
        enabled: false,
        route: "/api/docs/mcp",
        name: "docs",
        version: "1.0.0",
        tools: baseTools,
      }).agentContract,
    ).not.toHaveProperty("mcpTools");

    expect(
      build({
        enabled: true,
        route: "/api/docs/mcp",
        name: "docs",
        version: "1.0.0",
        tools: { ...baseTools, listTasks: false, readTask: true },
      }).agentContract,
    ).toMatchObject({ mcpTools: { read: "read_task" } });

    expect(
      build({
        enabled: true,
        route: "/api/docs/mcp",
        name: "docs",
        version: "1.0.0",
        tools: { ...baseTools, listTasks: false, readTask: false },
      }).agentContract,
    ).not.toHaveProperty("mcpTools");

    // Resolved configs constructed against older public types omit the new
    // flags; omission retains the runtime defaults.
    expect(
      build({
        enabled: true,
        route: "/api/docs/mcp",
        name: "docs",
        version: "1.0.0",
        tools: baseTools,
      }).agentContract,
    ).toMatchObject({ mcpTools: { list: "list_tasks", read: "read_task" } });
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

describe("standards discovery configuration", () => {
  const mcp = {
    enabled: false,
    route: "/api/docs/mcp",
    name: "docs",
    version: "1.0.0",
    tools: {
      listDocs: true,
      listPages: true,
      readPage: true,
      listTasks: true,
      readTask: true,
      searchDocs: true,
      getNavigation: true,
      getCodeExamples: true,
      getConfigSchema: true,
      getContext: true,
    },
  } as const;
  const fallbackSkillDocument = `---
name: docs
description: Use the example documentation.
---

# Docs
`;

  it("uses top-level catalog configuration before llms configuration", async () => {
    const fromLlms = await createDocsStandardsDiscoveryResponse({
      request: new Request("https://docs.example.com/.well-known/api-catalog"),
      origin: "https://docs.example.com",
      mcp,
      llms: { apiCatalog: false },
      fallbackSkillDocument,
    });
    expect(fromLlms?.status).toBe(404);
    expect(fromLlms?.headers.get("link")).not.toContain('rel="api-catalog"');

    const skills = await createDocsStandardsDiscoveryResponse({
      request: new Request("https://docs.example.com/.well-known/agent-skills/index.json"),
      origin: "https://docs.example.com",
      mcp,
      llms: { apiCatalog: false },
      fallbackSkillDocument,
    });
    expect(skills?.status).toBe(200);
    expect(skills?.headers.get("link")).not.toContain('rel="api-catalog"');

    const explicitEnable = await createDocsStandardsDiscoveryResponse({
      request: new Request("https://docs.example.com/.well-known/api-catalog"),
      origin: "https://docs.example.com",
      apiCatalog: true,
      mcp,
      llms: { apiCatalog: false },
      fallbackSkillDocument,
    });
    expect(explicitEnable?.status).toBe(200);

    const explicitDisable = await createDocsStandardsDiscoveryResponse({
      request: new Request("https://docs.example.com/.well-known/api-catalog"),
      origin: "https://docs.example.com",
      apiCatalog: false,
      mcp,
      llms: { apiCatalog: true },
      fallbackSkillDocument,
    });
    expect(explicitDisable?.status).toBe(404);
  });

  it("uses a normalized custom API route throughout the generated catalog", async () => {
    const response = await createDocsStandardsDiscoveryResponse({
      request: new Request("https://docs.example.com/api/internal/docs?format=api-catalog"),
      origin: "https://docs.example.com",
      apiRoute: " api//internal/docs/ ",
      mcp,
      openapi: true,
      fallbackSkillDocument,
    });
    const catalog = (await response?.json()) as {
      linkset: Array<Record<string, Array<{ href: string }> | string>>;
    };

    expect(response?.status).toBe(200);
    expect(catalog.linkset[0].item).toContainEqual(
      expect.objectContaining({ href: "https://docs.example.com/api/internal/docs" }),
    );
    expect(catalog.linkset[0]["service-meta"]).toContainEqual(
      expect.objectContaining({
        href: "https://docs.example.com/api/internal/docs?format=config",
      }),
    );
    expect(catalog.linkset[0]["service-desc"]).toContainEqual(
      expect.objectContaining({
        href: "https://docs.example.com/api/internal/docs?format=openapi",
      }),
    );
  });
});
