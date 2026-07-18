import { describe, expect, it } from "vitest";
import {
  createDocsAgentContractCases,
  DOCS_AGENT_CONTRACT_VERSION,
  runDocsAgentConformance,
} from "./agent-conformance.js";

describe("agent conformance contract", () => {
  it("defines every required agent surface once", () => {
    const cases = createDocsAgentContractCases();
    const surfaces = cases.map((contractCase) => contractCase.surface);

    expect(new Set(surfaces).size).toBe(surfaces.length);
    expect(surfaces).toEqual(
      expect.arrayContaining([
        "discovery",
        "markdown-alias",
        "markdown-negotiation",
        "markdown-locale",
        "llms",
        "agents",
        "skill",
        "sitemap-xml",
        "robots",
        "mcp-initialize",
      ]),
    );
  });

  it("returns actionable failures without stopping the remaining cases", async () => {
    const report = await runDocsAgentConformance({
      adapter: "next",
      locale: false,
      handle: async (_request, surface) =>
        new Response(surface, {
          status: surface === "discovery" ? 500 : 200,
          headers: { "Content-Type": "text/plain" },
        }),
    });

    expect(report.contractVersion).toBe(DOCS_AGENT_CONTRACT_VERSION);
    expect(report.passed).toBe(false);
    expect(report.cases).toHaveLength(createDocsAgentContractCases({ locale: false }).length);
    expect(report.cases.find((result) => result.surface === "discovery")?.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("expected status 200"),
        expect.stringContaining("expected content-type application/json"),
      ]),
    );
  });
});
