import { describe, expect, it } from "vitest";
import {
  createDocsAgentContractCases,
  DOCS_AGENT_CONTRACT_VERSION,
  runDocsAgentConformance,
} from "./agent-conformance.js";
import type { DocsAgentContractSurface } from "./agent-conformance.js";

function createPassingResponse(surface: DocsAgentContractSurface, contentType?: string): Response {
  const contractCase = createDocsAgentContractCases().find(
    (candidate) => candidate.surface === surface,
  );

  if (!contractCase) throw new Error(`Missing contract case for ${surface}`);

  const expectedContentType = contractCase.expect.contentTypes[0];
  if (!expectedContentType) throw new Error(`Missing content type for ${surface}`);

  return new Response(contractCase.expect.bodyIncludes?.join("\n") ?? "ok", {
    status: contractCase.expect.statuses[0],
    headers: { "Content-Type": contentType ?? expectedContentType },
  });
}

describe("agent conformance contract", () => {
  it("defines every required agent surface once", () => {
    const cases = createDocsAgentContractCases();
    const surfaces = cases.map((contractCase) => contractCase.surface);
    const expectedSurfaces = new Set([
      "discovery",
      "config",
      "diagnostics",
      "feedback-schema",
      "markdown",
      "markdown-accept",
      "markdown-locale",
      "markdown-missing",
      "llms",
      "llms-full",
      "agents",
      "skill",
      "sitemap-xml",
      "sitemap-markdown",
      "robots",
      "mcp",
    ]);

    expect(cases).toHaveLength(16);
    expect(new Set(surfaces).size).toBe(surfaces.length);
    expect(new Set(surfaces)).toEqual(expectedSurfaces);
  });

  it("accepts an exact media type regardless of case or parameters", async () => {
    const report = await runDocsAgentConformance({
      adapter: "next",
      async handle(_request, surface) {
        const response = createPassingResponse(surface);
        const contentType = response.headers.get("content-type");

        if (!contentType) throw new Error(`Missing content type for ${surface}`);

        response.headers.set("Content-Type", `  ${contentType.toUpperCase()} ; Charset=UTF-8  `);
        return response;
      },
    });

    expect(report.passed).toBe(true);
  });

  it("rejects content types that only prefix-match an expected media type", async () => {
    const invalidContentTypes = new Map<DocsAgentContractSurface, string>([
      ["discovery", "application/jsonp"],
      ["markdown", "text/markdown-evil"],
    ]);
    const report = await runDocsAgentConformance({
      adapter: "next",
      async handle(_request, surface) {
        return createPassingResponse(surface, invalidContentTypes.get(surface));
      },
    });

    expect(report.passed).toBe(false);
    for (const [surface, contentType] of invalidContentTypes) {
      expect(report.cases.find((result) => result.surface === surface)).toMatchObject({
        passed: false,
        contentType,
        issues: [expect.stringContaining("expected content-type")],
      });
    }
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
