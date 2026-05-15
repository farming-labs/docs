import { describe, expect, it } from "vitest";
import {
  buildDocsAgentDiscoverySpec,
  findDocsMarkdownPage,
  getDocsMarkdownCanonicalLinkHeader,
  getDocsMarkdownVaryHeader,
  hasDocsMarkdownSignatureAgent,
  isDocsAgentDiscoveryRequest,
  isDocsLlmsTxtPublicRequest,
  isDocsMcpRequest,
  isDocsPublicGetRequest,
  isDocsSkillRequest,
  getDocsLlmsTxtMaxCharsIssue,
  matchesDocsLlmsTxtSection,
  renderDocsMarkdownDocument,
  renderDocsMarkdownNotFound,
  renderDocsLlmsTxt,
  renderDocsSkillDocument,
  resolveDocsAgentFeedbackConfig,
  resolveDocsAgentFeedbackRequest,
  resolveDocsAgentMdxContent,
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

    expect(resolveDocsLlmsTxtFormat(new URL("https://example.com/llms.txt"))).toBe("llms");
    expect(resolveDocsLlmsTxtFormat(new URL("https://example.com/api/docs?format=llms"))).toBe(
      "llms",
    );
    expect(resolveDocsLlmsTxtFormat(new URL("https://example.com/blog?format=llms"))).toBeNull();
    expect(resolveDocsLlmsTxtFormat(new URL("https://example.com/.well-known/llms-full.txt"))).toBe(
      "llms-full",
    );
    expect(isDocsLlmsTxtPublicRequest(new URL("https://example.com/llms.txt"))).toBe(true);
    expect(isDocsLlmsTxtPublicRequest(new URL("https://example.com/.well-known/llms.txt"))).toBe(
      true,
    );
    expect(
      isDocsLlmsTxtPublicRequest(new URL("https://example.com/api/docs?format=llms")),
    ).toBe(false);

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

    const signatureAgentRoute = resolveDocsMarkdownRequest(
      "docs",
      new URL("https://example.com/docs/install"),
      new Request("https://example.com/docs/install", {
        headers: { "Signature-Agent": "https://chatgpt.com" },
      }),
    );
    expect(signatureAgentRoute).toEqual({ requestedPath: "install" });

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

  it("renders recovery links for markdown 404 responses", () => {
    const document = renderDocsMarkdownNotFound({
      entry: "docs",
      requestedPath: "missing/page",
      sitemap: { routePrefix: "/docs-map" },
    });

    expect(document).toContain("# Docs Page Not Found");
    expect(document).toContain("`/docs/missing/page.md`");
    expect(document).toContain("`/.well-known/agent.json`");
    expect(document).toContain("`/api/docs?query={query}`");
    expect(document).toContain("`/api/docs?format=markdown&path=missing/page`");
    expect(document).toContain("`/docs-map/sitemap.md`");
    expect(document).toContain("`/docs-map/.well-known/sitemap.md`");
    expect(document).toContain("`/docs-map/sitemap.xml`");
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
          related: [{ href: "/docs/configuration" }],
          content: "Visible",
          rawContent: "Visible",
          agentFallbackRawContent: "Visible\n\nHidden",
        },
      ],
      "install.md",
    );

    expect(page).not.toBeNull();
    expect(renderDocsMarkdownDocument(page!)).toContain("LLM index: /llms.txt");
    expect(renderDocsMarkdownDocument(page!, { llms: false })).not.toContain(
      "LLM index: /llms.txt",
    );
    expect(renderDocsMarkdownDocument(page!)).toContain("Related: /docs/configuration");
    expect(renderDocsMarkdownDocument(page!)).toContain("Hidden");
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
          listPages: true,
          readPage: true,
          searchDocs: true,
          getNavigation: true,
        },
      },
      llms: {
        enabled: true,
        siteTitle: "Guides",
        siteDescription: "Machine-readable guides",
      },
    });

    expect(document).toContain("name: docs");
    expect(document).toContain("# Guides Skill");
    expect(document).toContain("Base URL: https://docs.example.com");
    expect(document).toContain("/guides.md");
    expect(document).toContain("/.well-known/agent.json");
    expect(document).toContain("/robots.txt");
    expect(document).toContain("/api/docs?format=skill");
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
          listPages: true,
          readPage: true,
          searchDocs: true,
          getNavigation: true,
        },
      },
      llms: { enabled: true, siteTitle: "Docs" },
      sitemap: true,
      robots: true,
    });

    expect(spec.api.agentSpecDefault).toBe("/.well-known/agent.json");
    expect(spec.markdown.rootPage).toBe("/docs.md");
    expect(spec.markdown.signatureAgentHeader).toBe("Signature-Agent");
    expect(spec.llms.publicTxt).toBe("/llms.txt");
    expect(spec.skills.file).toBe("skill.md");
    expect(spec.skills.route).toBe("/skill.md");
    expect(spec.skills.wellKnown).toBe("/.well-known/skill.md");
    expect(spec.skills.api).toBe("/api/docs?format=skill");
    expect(spec.skills.generatedFallback).toBe(true);
    expect(spec.mcp.publicEndpoints).toEqual(["/mcp", "/.well-known/mcp"]);
    expect(spec.sitemap.xml.route).toBe("/sitemap.xml");
    expect(spec.sitemap.markdown.wellKnownRoute).toBe("/.well-known/sitemap.md");
    expect(spec.capabilities.robots).toBe(true);
    expect(spec.capabilities.structuredData).toBe(true);
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
