import { describe, expect, it } from "vitest";
import {
  buildDocsAgentDiscoverySpec,
  findDocsMarkdownPage,
  isDocsAgentDiscoveryRequest,
  isDocsMcpRequest,
  isDocsPublicGetRequest,
  isDocsSkillRequest,
  renderDocsMarkdownDocument,
  renderDocsSkillDocument,
  resolveDocsAgentMdxContent,
  resolveDocsLlmsTxtFormat,
  resolveDocsSkillFormat,
  resolveDocsMarkdownRequest,
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
    expect(resolveDocsSkillFormat(new URL("https://example.com/internal/docs?format=llms"))).toBeNull();
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
    });

    expect(spec.api.agentSpecDefault).toBe("/.well-known/agent.json");
    expect(spec.markdown.rootPage).toBe("/docs.md");
    expect(spec.llms.publicTxt).toBe("/llms.txt");
    expect(spec.skills.file).toBe("skill.md");
    expect(spec.skills.route).toBe("/skill.md");
    expect(spec.skills.wellKnown).toBe("/.well-known/skill.md");
    expect(spec.skills.api).toBe("/api/docs?format=skill");
    expect(spec.skills.generatedFallback).toBe(true);
    expect(spec.mcp.publicEndpoints).toEqual(["/mcp", "/.well-known/mcp"]);
  });
});
