import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AGENT_SKILLS_DISCOVERY_SCHEMA_URI,
  API_CATALOG_MEDIA_TYPE,
  API_CATALOG_PROFILE_URI,
  DEFAULT_AGENT_SKILLS_INDEX_ROUTE,
  DEFAULT_API_CATALOG_ROUTE,
  buildDocsAgentSkillsIndex,
  buildDocsApiCatalog,
  createDocsStandardsResponse,
  resolveDocsPublishedAgentSkill,
  resolveDocsStandardsDiscoveryRequest,
} from "./standards-discovery.js";

const generatedSkill = `---
name: docs
description: "Use the Example documentation."
---

# Example skill
`;

function catalog() {
  return buildDocsApiCatalog({
    origin: "https://docs.example.com",
    docsRoute: "/guide",
    apiRoute: "/api/docs",
    configRoute: "/api/docs?format=config",
    diagnosticsRoute: "/api/docs?format=diagnostics",
    agentManifestRoute: "/.well-known/agent.json",
    agentSkillsIndexRoute: DEFAULT_AGENT_SKILLS_INDEX_ROUTE,
    markdownRootRoute: "/docs.md",
    llmsRoutes: ["/llms.txt", "/llms.txt"],
    mcpRoute: "/api/docs/mcp",
    feedbackRoutes: ["/api/docs/agent/feedback", "/api/docs/agent/feedback/schema"],
    openapiRoute: "/api/docs?format=openapi",
    apiReferenceRoute: "/api-reference",
  });
}

describe("RFC 9727 API catalog", () => {
  it("builds an absolute, deduplicated JSON Linkset with enabled API metadata", () => {
    const result = catalog();
    expect(result.linkset[0]).toMatchObject({
      anchor: `https://docs.example.com${DEFAULT_API_CATALOG_ROUTE}`,
      "api-catalog": [
        {
          href: `https://docs.example.com${DEFAULT_API_CATALOG_ROUTE}`,
          type: API_CATALOG_MEDIA_TYPE,
        },
      ],
    });
    expect(result.linkset[0].item?.map((item) => item.href)).toEqual([
      "https://docs.example.com/api/docs",
      "https://docs.example.com/api/docs/mcp",
      "https://docs.example.com/api/docs/agent/feedback",
      "https://docs.example.com/api/docs/agent/feedback/schema",
    ]);
    expect(result.linkset[0]["service-doc"]?.map((item) => item.href)).toContain(
      "https://docs.example.com/guide",
    );
    expect(result.linkset[0]["service-desc"]).toEqual([
      expect.objectContaining({ href: "https://docs.example.com/api/docs?format=openapi" }),
    ]);
    expect(
      result.linkset[0]["service-doc"]?.filter(
        (item) => item.href === "https://docs.example.com/llms.txt",
      ),
    ).toHaveLength(1);
  });

  it("omits disabled and non-HTTP endpoints", () => {
    const result = buildDocsApiCatalog({
      origin: "https://docs.example.com",
      apiRoute: null,
      mcpRoute: "file:///tmp/mcp",
      feedbackRoutes: [],
      openapiRoute: null,
    });
    expect(result.linkset[0].item).toBeUndefined();
    expect(result.linkset[0]["service-desc"]).toBeUndefined();
  });

  it("normalizes a custom query API route in direct catalog builds", () => {
    const result = buildDocsApiCatalog({
      origin: "https://docs.example.com",
      apiRoute: " api//internal/docs/?ignored=true#fragment ",
    });

    expect(result.linkset[0].item).toEqual([
      expect.objectContaining({ href: "https://docs.example.com/api/internal/docs" }),
    ]);
    expect(result.linkset[1].anchor).toBe("https://docs.example.com/api/internal/docs");
  });

  it("serves GET and bodyless HEAD with the RFC media type and Link relation", async () => {
    const get = await createDocsStandardsResponse({
      request: new Request(`https://docs.example.com${DEFAULT_API_CATALOG_ROUTE}`),
      apiCatalog: catalog(),
      fallbackSkillDocument: generatedSkill,
    });
    expect(get?.status).toBe(200);
    expect(get?.headers.get("content-type")).toBe(
      `${API_CATALOG_MEDIA_TYPE}; profile="${API_CATALOG_PROFILE_URI}"; charset=utf-8`,
    );
    expect(get?.headers.get("link")).toContain('rel="api-catalog"');
    expect(await get?.json()).toEqual(catalog());

    const head = await createDocsStandardsResponse({
      request: new Request(`https://docs.example.com${DEFAULT_API_CATALOG_ROUTE}`, {
        method: "HEAD",
      }),
      apiCatalog: catalog(),
      fallbackSkillDocument: generatedSkill,
    });
    expect(head?.status).toBe(200);
    expect(head?.headers.get("content-type")).toContain(API_CATALOG_MEDIA_TYPE);
    expect(await head?.text()).toBe("");
  });

  it("keeps the catalog unavailable without disabling Agent Skills discovery", async () => {
    for (const path of [DEFAULT_API_CATALOG_ROUTE, "/api/docs?format=api-catalog"]) {
      const response = await createDocsStandardsResponse({
        request: new Request(`https://docs.example.com${path}`),
        apiCatalogEnabled: false,
        fallbackSkillDocument: generatedSkill,
      });
      expect(response?.status).toBe(404);
      expect(response?.headers.get("link")).not.toContain('rel="api-catalog"');
    }

    const skills = await createDocsStandardsResponse({
      request: new Request(`https://docs.example.com${DEFAULT_AGENT_SKILLS_INDEX_ROUTE}`),
      apiCatalogEnabled: false,
      fallbackSkillDocument: generatedSkill,
    });
    expect(skills?.status).toBe(200);
    expect(skills?.headers.get("link")).not.toContain('rel="api-catalog"');
    expect((await skills!.json()).skills).toHaveLength(1);
  });

  it("rejects unsupported methods before resolving a discovery resource", async () => {
    for (const path of [
      DEFAULT_API_CATALOG_ROUTE,
      DEFAULT_AGENT_SKILLS_INDEX_ROUTE,
      "/.well-known/agent-skills/docs/SKILL.md",
      "/api/docs?format=agent-skills",
    ]) {
      const response = await createDocsStandardsResponse({
        request: new Request(`https://docs.example.com${path}`, { method: "POST" }),
        apiCatalog: catalog(),
        fallbackSkillDocument: "invalid fallback that must not be resolved",
      });
      expect(response?.status).toBe(405);
      expect(response?.headers.get("allow")).toBe("GET, HEAD");
      expect(response?.headers.get("link")).toContain('rel="api-catalog"');
      expect(await response?.text()).toBe("Method Not Allowed");
    }

    const unrelated = await createDocsStandardsResponse({
      request: new Request("https://docs.example.com/docs", { method: "POST" }),
      apiCatalog: catalog(),
      fallbackSkillDocument: generatedSkill,
    });
    expect(unrelated).toBeNull();
  });
});

describe("Agent Skills discovery", () => {
  it("hashes the exact UTF-8 skill bytes and emits the v0.2.0 index", async () => {
    const customSkill = `---
name: example-docs
description: 'Use the café documentation.'
---

# Café ☕
`;
    const skill = await resolveDocsPublishedAgentSkill({
      preferredDocument: customSkill,
      fallbackDocument: generatedSkill,
    });
    const expected = createHash("sha256").update(customSkill, "utf8").digest("hex");
    expect(skill).toMatchObject({
      name: "example-docs",
      description: "Use the café documentation.",
      url: "/.well-known/agent-skills/example-docs/SKILL.md",
      digest: `sha256:${expected}`,
      content: customSkill,
    });
    expect(buildDocsAgentSkillsIndex(skill)).toEqual({
      $schema: AGENT_SKILLS_DISCOVERY_SCHEMA_URI,
      skills: [
        {
          name: "example-docs",
          type: "skill-md",
          description: "Use the café documentation.",
          url: "/.well-known/agent-skills/example-docs/SKILL.md",
          digest: `sha256:${expected}`,
        },
      ],
    });
  });

  it("keeps an invalid custom legacy skill private from the standards index", async () => {
    const selected = await resolveDocsPublishedAgentSkill({
      preferredDocument: "# Custom legacy instructions without frontmatter\n",
      fallbackDocument: generatedSkill,
    });
    expect(selected.name).toBe("docs");
    expect(selected.content).toBe(generatedSkill);
  });

  it("serves an index whose digest matches the exact individual response", async () => {
    const indexResponse = await createDocsStandardsResponse({
      request: new Request(`https://docs.example.com${DEFAULT_AGENT_SKILLS_INDEX_ROUTE}`),
      apiCatalog: catalog(),
      fallbackSkillDocument: generatedSkill,
    });
    const index = (await indexResponse?.json()) as {
      skills: Array<{ name: string; digest: string; url: string }>;
    };
    expect(indexResponse?.headers.get("content-type")).toContain("application/json");
    expect(index.skills).toHaveLength(1);

    const artifactResponse = await createDocsStandardsResponse({
      request: new Request(`https://docs.example.com${index.skills[0].url}`),
      apiCatalog: catalog(),
      fallbackSkillDocument: generatedSkill,
    });
    const artifact = await artifactResponse?.text();
    expect(artifact).toBe(generatedSkill);
    expect(index.skills[0].digest).toBe(
      `sha256:${createHash("sha256").update(artifact!, "utf8").digest("hex")}`,
    );
    expect(artifactResponse?.headers.get("link")).toContain('rel="collection"');
  });

  it("returns 404 for unknown or traversal-like artifact names", async () => {
    for (const name of ["missing", "%2e%2e%2fdocs"]) {
      const response = await createDocsStandardsResponse({
        request: new Request(`https://docs.example.com/.well-known/agent-skills/${name}/SKILL.md`),
        apiCatalog: catalog(),
        fallbackSkillDocument: generatedSkill,
      });
      expect(response?.status).toBe(404);
    }
  });

  it("returns 304 for a matching strong ETag", async () => {
    const first = await createDocsStandardsResponse({
      request: new Request(`https://docs.example.com${DEFAULT_AGENT_SKILLS_INDEX_ROUTE}`),
      apiCatalog: catalog(),
      fallbackSkillDocument: generatedSkill,
    });
    const response = await createDocsStandardsResponse({
      request: new Request(`https://docs.example.com${DEFAULT_AGENT_SKILLS_INDEX_ROUTE}`, {
        headers: { "If-None-Match": first!.headers.get("etag")! },
      }),
      apiCatalog: catalog(),
      fallbackSkillDocument: generatedSkill,
    });
    expect(response?.status).toBe(304);
    expect(await response?.text()).toBe("");
  });

  it("recognizes public and internal forwarding forms", () => {
    expect(
      resolveDocsStandardsDiscoveryRequest(
        new URL("https://docs.example.com/api/docs?format=api-catalog"),
      ),
    ).toEqual({ kind: "api-catalog" });
    expect(
      resolveDocsStandardsDiscoveryRequest(
        new URL("https://docs.example.com/api/docs?format=agent-skills"),
      ),
    ).toEqual({ kind: "agent-skills-index" });
    expect(
      resolveDocsStandardsDiscoveryRequest(
        new URL("https://docs.example.com/api/docs?format=agent-skill&name=docs"),
      ),
    ).toEqual({ kind: "agent-skill", name: "docs" });

    const customRoute = new URL("https://docs.example.com/api/internal/docs?format=agent-skills");
    expect(resolveDocsStandardsDiscoveryRequest(customRoute)).toBeNull();
    expect(
      resolveDocsStandardsDiscoveryRequest(customRoute, { apiRoute: "/api/internal/docs" }),
    ).toEqual({ kind: "agent-skills-index" });
  });

  it("serves query-form discovery from a custom mounted API route", async () => {
    const response = await createDocsStandardsResponse({
      request: new Request("https://docs.example.com/api/internal/docs?format=agent-skills"),
      apiRoute: "/api/internal/docs",
      apiCatalog: catalog(),
      fallbackSkillDocument: generatedSkill,
    });
    expect(response?.status).toBe(200);
    expect((await response!.json()).skills).toHaveLength(1);
  });
});
