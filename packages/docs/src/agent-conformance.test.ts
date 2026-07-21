import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createDocsAgentContractCases,
  DOCS_AGENT_CONTRACT_VERSION,
  runDocsAgentConformance,
} from "./agent-conformance.js";
import type { DocsAgentContractSurface } from "./agent-conformance.js";

const AGENT_SKILL_CONTENT = `---
name: docs
description: Use the documentation through its agent-readable resources.
---

# Documentation
`;
const AGENT_SKILL_DIGEST = createHash("sha256").update(AGENT_SKILL_CONTENT, "utf8").digest("hex");

function createPassingResponse(surface: DocsAgentContractSurface, contentType?: string): Response {
  const contractCase = createDocsAgentContractCases().find(
    (candidate) => candidate.surface === surface,
  );

  if (!contractCase) throw new Error(`Missing contract case for ${surface}`);

  const expectedContentType = contractCase.expect.contentTypes[0];
  if (!expectedContentType) throw new Error(`Missing content type for ${surface}`);

  const headers = new Headers({ "Content-Type": contentType ?? expectedContentType });
  for (const [header, values] of Object.entries(contractCase.expect.headerIncludes ?? {})) {
    headers.set(header, values.join(", "));
  }
  if (contractCase.expect.linkRelations) {
    headers.set(
      "Link",
      contractCase.expect.linkRelations
        .map(({ href, rel }) => `<${href}>; title="Docs, API"; rel="${rel}"`)
        .join(", "),
    );
  }

  let body = contractCase.expect.bodyIncludes?.join("\n") ?? "ok";
  if (surface === "agent-skills-index") {
    body = JSON.stringify({
      $schema: "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
      skills: [
        {
          name: "docs",
          type: "skill-md",
          description: "Use the documentation through its agent-readable resources.",
          url: "/.well-known/agent-skills/docs/SKILL.md",
          digest: `sha256:${AGENT_SKILL_DIGEST}`,
        },
      ],
    });
  } else if (surface === "agent-skill") {
    body = AGENT_SKILL_CONTENT;
  }

  return new Response(contractCase.expect.bodyEmpty ? null : body, {
    status: contractCase.expect.statuses[0],
    headers,
  });
}

describe("agent conformance contract", () => {
  it("defines every required agent surface once", () => {
    const cases = createDocsAgentContractCases();
    const surfaces = cases.map((contractCase) => contractCase.surface);
    const expectedSurfaces = new Set([
      "discovery",
      "api-catalog",
      "api-catalog-head",
      "agent-skills-index",
      "agent-skills-index-head",
      "agent-skill",
      "agent-skill-head",
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

    expect(cases).toHaveLength(22);
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

        const [mediaType, ...parameters] = contentType.split(";");
        response.headers.set(
          "Content-Type",
          `  ${mediaType!.toUpperCase()} ${parameters.length > 0 ? `;${parameters.join(";")}` : ""} ; Charset=UTF-8  `,
        );
        return response;
      },
    });

    expect(report.cases.filter((result) => !result.passed)).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it("requires the RFC 9727 profile on API catalog GET and HEAD responses", async () => {
    const report = await runDocsAgentConformance({
      adapter: "next",
      async handle(_request, surface) {
        return createPassingResponse(
          surface,
          surface === "api-catalog" || surface === "api-catalog-head"
            ? "application/linkset+json"
            : undefined,
        );
      },
    });

    for (const surface of ["api-catalog", "api-catalog-head"] as const) {
      expect(report.cases.find((result) => result.surface === surface)).toMatchObject({
        passed: false,
        issues: [expect.stringContaining("profile")],
      });
    }
  });

  it("verifies every Agent Skills artifact against its exact UTF-8 SHA-256 digest", async () => {
    const report = await runDocsAgentConformance({
      adapter: "next",
      async handle(_request, surface) {
        const response = createPassingResponse(surface);
        if (surface !== "agent-skills-index") return response;

        const index = (await response.json()) as { skills: Array<{ digest: string }> };
        index.skills[0]!.digest = `sha256:${"0".repeat(64)}`;
        return new Response(JSON.stringify(index), {
          status: response.status,
          headers: response.headers,
        });
      },
    });

    expect(report.cases.find((result) => result.surface === "agent-skills-index")).toMatchObject({
      passed: false,
      issues: [expect.stringContaining("digest")],
    });
  });

  it("validates archive artifacts as exact binary bytes", async () => {
    const archive = Uint8Array.from([31, 139, 8, 0, 255, 0, 128, 1]);
    const digest = createHash("sha256").update(archive).digest("hex");
    const report = await runDocsAgentConformance({
      adapter: "next",
      async handle(request, surface) {
        if (surface === "agent-skills-index") {
          const response = createPassingResponse(surface);
          const index = (await response.json()) as {
            skills: Array<Record<string, unknown>>;
          };
          index.skills.push({
            name: "bundle",
            description: "Use the bundled binary workflow.",
            type: "archive",
            url: "/.well-known/agent-skills/bundle.tar.gz",
            digest: `sha256:${digest}`,
          });
          return new Response(JSON.stringify(index), {
            status: response.status,
            headers: response.headers,
          });
        }
        if (surface === "agent-skill" && request.url.endsWith("/bundle.tar.gz")) {
          return new Response(archive, { headers: { "Content-Type": "application/gzip" } });
        }
        return createPassingResponse(surface);
      },
    });

    expect(report.cases.filter((result) => !result.passed)).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it("correlates each Link target and relation while allowing quoted commas", async () => {
    const report = await runDocsAgentConformance({
      adapter: "next",
      async handle(_request, surface) {
        const response = createPassingResponse(surface);
        if (surface === "agent-skills-index") {
          response.headers.set(
            "Link",
            '</.well-known/agent-skills/docs/SKILL.md>; title="Docs, API"; rel="service-meta", </unrelated>; rel="item", </.well-known/api-catalog>; rel="api-catalog"',
          );
        }
        return response;
      },
    });

    expect(report.cases.find((result) => result.surface === "agent-skills-index")).toMatchObject({
      passed: false,
      issues: [expect.stringContaining("same link-value")],
    });
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
