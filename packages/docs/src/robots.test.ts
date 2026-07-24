import { describe, expect, it } from "vitest";
import {
  analyzeDocsRobotsTxt,
  createDocsRobotsResponse,
  renderDocsRobotsGeneratedBlock,
  renderDocsRobotsTxt,
  resolveDocsRobotsRequest,
  upsertDocsRobotsGeneratedBlock,
} from "./robots.js";

describe("docs robots helpers", () => {
  it("serves a default robots.txt response with agent routes and sitemap hints", async () => {
    const response = createDocsRobotsResponse({
      request: new Request("https://docs.example.com/robots.txt"),
      entry: "docs",
      baseUrl: "https://docs.example.com",
    });

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("text/plain");

    const content = await response?.text();
    expect(content).toContain("Allow: /llms.txt");
    expect(content).toContain("Allow: /AGENTS.md");
    expect(content).toContain("Allow: /sitemap.xml");
    expect(content).toContain("Allow: /docs/sitemap.md");
    expect(content).toContain("Allow: /.well-known/agent.json");
    expect(content).toContain("Allow: /.well-known/api-catalog");
    expect(content).toContain("User-agent: GPTBot");
    expect(content).toContain("Sitemap: https://docs.example.com/sitemap.xml");
  });

  it("omits the API catalog route when a deployment cannot serve its RFC media type", () => {
    const content = renderDocsRobotsTxt({ entry: "docs", apiCatalog: false });

    expect(content).not.toContain("Allow: /.well-known/api-catalog");
    expect(content).toContain("Allow: /.well-known/agent-skills/index.json");
  });

  it.each([
    "/.well-known/api-catalog",
    "/.well-known/agent-skills/index.json",
    "/.well-known/agent-skills/*",
    "/.well-known/skills/index.json",
    "/.well-known/skills/*",
    "/.well-known/mcp",
    "/.well-known/AGENTS.md",
    "/.well-known/skill.md",
  ])("reports a missing discovery allow rule for %s", (route) => {
    const complete = renderDocsRobotsTxt({ entry: "docs" });
    const stale = complete.replace(`Allow: ${route}\n`, "");
    const analysis = analyzeDocsRobotsTxt(stale, { entry: "docs" });

    expect(analysis.blocksAgentRoutes).toBe(false);
    expect(analysis.hasAgentRoutes).toBe(false);
    expect(analysis.missingRoutes).toContain(route);
  });

  it("requires exact discovery allow rules instead of matching narrower paths or comments", () => {
    const complete = renderDocsRobotsTxt({ entry: "docs" });
    const stale = complete
      .replace(
        "Allow: /.well-known/agent-skills/*\n",
        "Allow: /.well-known/agent-skills/*/SKILL.md\n",
      )
      .replace(
        "Allow: /.well-known/skills/*\n",
        "# Allow: /.well-known/skills/* is intentionally missing\n",
      );
    const analysis = analyzeDocsRobotsTxt(stale, { entry: "docs" });

    expect(analysis.missingRoutes).toEqual(
      expect.arrayContaining(["/.well-known/agent-skills/*", "/.well-known/skills/*"]),
    );
  });

  it("combines appended and grouped user-agent policies during analysis", () => {
    const appended = upsertDocsRobotsGeneratedBlock(
      "User-agent: *\nDisallow: /private\n",
      renderDocsRobotsGeneratedBlock(),
    ).replace(
      "User-agent: GPTBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /",
      "User-agent: GPTBot\nUser-agent: ChatGPT-User\nAllow: /",
    );
    const analysis = analyzeDocsRobotsTxt(appended);

    expect(analysis.hasAgentRoutes).toBe(true);
    expect(analysis.blocksAgentRoutes).toBe(false);
    expect(analysis.hasAiPolicy).toBe(true);
    expect(analysis.blocksAiAgents).toBe(false);
  });

  it("uses longest-match and allow-tie precedence for appended policies", () => {
    const generatedBlock = renderDocsRobotsGeneratedBlock();
    const wildcardBlock = analyzeDocsRobotsTxt(
      upsertDocsRobotsGeneratedBlock("User-agent: *\nDisallow: /\n", generatedBlock),
    );
    expect(wildcardBlock.hasAgentRoutes).toBe(true);
    expect(wildcardBlock.blocksAgentRoutes).toBe(false);

    const specificRouteBlock = analyzeDocsRobotsTxt(
      upsertDocsRobotsGeneratedBlock("User-agent: GPTBot\nDisallow: /llms.txt\n", generatedBlock),
    );
    expect(specificRouteBlock.hasAgentRoutes).toBe(true);
    expect(specificRouteBlock.blocksAiAgents).toBe(true);

    const equivalentAllow = analyzeDocsRobotsTxt(
      upsertDocsRobotsGeneratedBlock("User-agent: GPTBot\nDisallow: /\n", generatedBlock),
    );
    expect(equivalentAllow.blocksAiAgents).toBe(false);

    for (const pattern of ["/llms.txt$", "/llms.txt*"]) {
      const specialCharacterBlock = analyzeDocsRobotsTxt(
        upsertDocsRobotsGeneratedBlock(
          `User-agent: GPTBot\nAllow: /llms.txt\nDisallow: ${pattern}\n`,
          generatedBlock,
        ),
      );
      expect(specialCharacterBlock.blocksAiAgents).toBe(true);
    }
  });

  it("does not let other records terminate a multi-user-agent group", () => {
    const content = `${renderDocsRobotsTxt()}
User-agent: GPTBot
Sitemap: https://docs.example.com/sitemap.xml
Crawl-delay: 5
User-agent: ExampleBot
Disallow: /llms.txt
`;
    const analysis = analyzeDocsRobotsTxt(content);

    expect(analysis.blocksAiAgents).toBe(true);
  });

  it("honors optional API catalog and A2A discovery coverage", () => {
    const staticContent = renderDocsRobotsTxt({ apiCatalog: false });
    expect(analyzeDocsRobotsTxt(staticContent, { apiCatalog: false }).hasAgentRoutes).toBe(true);
    expect(analyzeDocsRobotsTxt(staticContent).missingRoutes).toContain("/.well-known/api-catalog");

    const defaultContent = renderDocsRobotsTxt();
    expect(analyzeDocsRobotsTxt(defaultContent).missingRoutes).not.toContain(
      "/.well-known/agent-card.json",
    );
    expect(analyzeDocsRobotsTxt(defaultContent, { agentCard: true }).missingRoutes).toContain(
      "/.well-known/agent-card.json",
    );

    const a2aContent = renderDocsRobotsTxt({ agentCard: true });
    expect(analyzeDocsRobotsTxt(a2aContent, { agentCard: true }).hasAgentRoutes).toBe(true);
  });

  it("uses sitemap routes advertised by hosted discovery instead of default routes", () => {
    const content = renderDocsRobotsTxt({ sitemap: false }).replace(
      "Allow: /.well-known/mcp\n",
      "Allow: /.well-known/mcp\nAllow: /internal/sitemap.xml\nAllow: /internal/sitemap.md\n",
    );
    const analysis = analyzeDocsRobotsTxt(content, {
      sitemapRoutes: ["/internal/sitemap.xml", "/internal/sitemap.md"],
    });

    expect(analysis.hasAgentRoutes).toBe(true);
    expect(analysis.missingRoutes).not.toContain("/sitemap.xml");
    expect(analysis.missingRoutes).not.toContain("/sitemap.md");
  });

  it("detects a wildcard policy that blocks a standards discovery route", () => {
    const content = renderDocsRobotsTxt().replace(
      "Allow: /.well-known/api-catalog",
      "Disallow: /.well-known/api-catalog",
    );
    const analysis = analyzeDocsRobotsTxt(content);

    expect(analysis.blocksAgentRoutes).toBe(true);
    expect(analysis.missingRoutes).toContain("/.well-known/api-catalog");
  });

  it("honors robots opt-out for public and API robots requests", () => {
    expect(resolveDocsRobotsRequest(new URL("https://example.com/robots.txt"), false)).toBeNull();
    expect(
      createDocsRobotsResponse({
        request: new Request("https://example.com/api/docs?format=robots"),
        robots: false,
      }),
    ).toBeNull();
    expect(renderDocsRobotsTxt({ robots: false })).toBe("");
  });
});
