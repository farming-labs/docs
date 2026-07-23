import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AGENT_SKILLS_DISCOVERY_SCHEMA_URI,
  API_CATALOG_MEDIA_TYPE,
  API_CATALOG_PROFILE_URI,
  DEFAULT_AGENT_SKILLS_INDEX_ROUTE,
  DEFAULT_A2A_AGENT_CARD_ROUTE,
  DEFAULT_LEGACY_SKILLS_INDEX_ROUTE,
  DEFAULT_API_CATALOG_ROUTE,
  buildDocsA2AAgentCard,
  buildDocsAgentSkillsIndex,
  buildDocsApiCatalog,
  createDocsStandardsResponse,
  resolveDocsPublishedAgentSkill,
  resolveDocsStandardsDiscoveryRequest,
  type DocsPublishedAgentSkill,
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
    protectedResourceMetadataRoutes: ["/.well-known/oauth-protected-resource/api/docs/mcp"],
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
    expect(result.linkset[0]["service-meta"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "https://docs.example.com/.well-known/oauth-protected-resource/api/docs/mcp",
          type: "application/json",
        }),
      ]),
    );
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

  it("serves configured archives, direct files, and the relative-path compatibility index", async () => {
    const archive = new Uint8Array([31, 139, 8, 0, 1, 2, 3]);
    const archiveHash = createHash("sha256").update(archive).digest("hex");
    const skillDocument = "---\nname: packaged\ndescription: Use packaged docs.\n---\n";
    const fileHash = createHash("sha256").update(skillDocument).digest("hex");
    const published: DocsPublishedAgentSkill = {
      name: "packaged",
      type: "archive",
      description: "Use packaged docs.",
      url: "/.well-known/agent-skills/packaged.tar.gz",
      digest: `sha256:${archiveHash}`,
      content: archive,
      sha256: archiveHash,
      skillDocument,
      files: [
        {
          path: "SKILL.md",
          url: "/.well-known/agent-skills/packaged/SKILL.md",
          mediaType: "text/markdown",
          content: skillDocument,
          sha256: fileHash,
          digest: `sha256:${fileHash}`,
        },
      ],
    };
    const options = { fallbackSkillDocument: generatedSkill, publishedSkills: [published] };

    const indexResponse = await createDocsStandardsResponse({
      ...options,
      request: new Request(`https://docs.example.com${DEFAULT_AGENT_SKILLS_INDEX_ROUTE}`),
    });
    const index = await indexResponse!.json();
    expect(index.skills.find((skill: { name: string }) => skill.name === "packaged")).toEqual({
      name: "packaged",
      type: "archive",
      description: "Use packaged docs.",
      url: "/.well-known/agent-skills/packaged.tar.gz",
      digest: `sha256:${archiveHash}`,
    });

    const archiveResponse = await createDocsStandardsResponse({
      ...options,
      request: new Request("https://docs.example.com/api/docs?format=agent-skill&name=packaged"),
    });
    expect(archiveResponse?.headers.get("content-type")).toBe("application/gzip");
    expect(new Uint8Array(await archiveResponse!.arrayBuffer())).toEqual(archive);

    const archiveOnlyResponse = await createDocsStandardsResponse({
      ...options,
      request: new Request(
        "https://docs.example.com/api/docs?format=agent-skill-archive&name=packaged",
      ),
    });
    expect(new Uint8Array(await archiveOnlyResponse!.arrayBuffer())).toEqual(archive);
    const simpleArchiveResponse = await createDocsStandardsResponse({
      ...options,
      request: new Request(
        "https://docs.example.com/api/docs?format=agent-skill-archive&name=docs",
      ),
    });
    expect(simpleArchiveResponse?.status).toBe(404);

    const fileResponse = await createDocsStandardsResponse({
      ...options,
      request: new Request("https://docs.example.com/.well-known/agent-skills/packaged/SKILL.md"),
    });
    expect(await fileResponse?.text()).toBe(skillDocument);

    const legacyResponse = await createDocsStandardsResponse({
      ...options,
      request: new Request(`https://docs.example.com${DEFAULT_LEGACY_SKILLS_INDEX_ROUTE}`),
    });
    expect((await legacyResponse!.json()).skills).toContainEqual({
      name: "packaged",
      description: "Use packaged docs.",
      files: ["SKILL.md"],
    });
  });

  it("publishes an Agent Card only for explicit real interface metadata", async () => {
    const absent = await createDocsStandardsResponse({
      request: new Request(`https://docs.example.com${DEFAULT_A2A_AGENT_CARD_ROUTE}`),
      fallbackSkillDocument: generatedSkill,
    });
    expect(absent?.status).toBe(404);

    const present = await createDocsStandardsResponse({
      request: new Request(`https://docs.example.com${DEFAULT_A2A_AGENT_CARD_ROUTE}`),
      fallbackSkillDocument: generatedSkill,
      agentCard: {
        interfaceUrl: "https://agent.example.com/a2a",
        name: "Example agent",
        description: "Answers documentation questions.",
        documentationUrl: "https://docs.example.com",
        provider: { organization: "Example", url: "https://example.com" },
      },
    });
    const card = await present!.json();
    expect(card).toMatchObject({
      name: "Example agent",
      description: "Answers documentation questions.",
      supportedInterfaces: [
        {
          url: "https://agent.example.com/a2a",
          protocolBinding: "HTTP+JSON",
          protocolVersion: "0.3",
        },
      ],
      version: "1.0.0",
      provider: { organization: "Example", url: "https://example.com/" },
      documentationUrl: "https://docs.example.com/",
      capabilities: {
        streaming: false,
        pushNotifications: false,
      },
      defaultInputModes: ["text/plain"],
      defaultOutputModes: ["text/plain"],
      skills: [
        {
          id: "docs",
          name: "docs",
          description: "Use the Example documentation.",
          tags: ["documentation"],
        },
      ],
    });
    expect(card).not.toHaveProperty("url");
    expect(card).not.toHaveProperty("protocolVersion");
    expect(card).not.toHaveProperty("preferredTransport");
    expect(card.skills[0]).not.toHaveProperty("url");
  });
});

describe("A2A v1 Agent Cards", () => {
  const validOptions = {
    name: "Example agent",
    description: "Answers documentation questions.",
    supportedInterfaces: [{ url: "https://agent.example.com/a2a" }],
    skills: [
      {
        id: "docs",
        name: "Documentation",
        description: "Search the documentation.",
        tags: ["documentation"],
      },
    ],
  } satisfies Parameters<typeof buildDocsA2AAgentCard>[0];

  it("keeps the historical shorthand default inside the strict v1 shape", () => {
    const card = buildDocsA2AAgentCard(
      {
        name: "Compatibility agent",
        description: "Implements an older A2A protocol interface.",
        interfaceUrl: "https://agent.example.com/a2a",
        protocolBinding: "JSONRPC",
      },
      [
        {
          name: "docs",
          type: "skill-md",
          description: "Use the documentation.",
          url: "/.well-known/agent-skills/docs/SKILL.md",
          digest: `sha256:${"0".repeat(64)}`,
          sha256: "0".repeat(64),
          content: generatedSkill,
          skillDocument: generatedSkill,
          files: [],
        },
      ],
    );

    expect(card.supportedInterfaces).toEqual([
      {
        url: "https://agent.example.com/a2a",
        protocolBinding: "JSONRPC",
        protocolVersion: "0.3",
      },
    ]);
    expect(card).not.toHaveProperty("protocolVersion");
    expect(card).not.toHaveProperty("preferredTransport");
    expect(card).not.toHaveProperty("url");
  });

  it("preserves interface preference and publishes configured capabilities, skills, and security", () => {
    const card = buildDocsA2AAgentCard(
      {
        name: "Example agent",
        description: "Answers documentation questions.",
        supportedInterfaces: [
          {
            url: "https://agent.example.com/rpc",
            protocolBinding: "JSONRPC",
            protocolVersion: "1.0",
            tenant: "acme",
          },
          {
            url: "wss://agent.example.com/events",
            protocolBinding: "https://agent.example.com/bindings/events",
            protocolVersion: "1.1",
          },
        ],
        capabilities: {
          streaming: true,
          pushNotifications: true,
          extendedAgentCard: true,
          extensions: [
            {
              uri: "https://agent.example.com/extensions/audit",
              description: "Includes an audit record with each result.",
              required: true,
              params: { level: "full" },
            },
          ],
        },
        defaultInputModes: ["application/json"],
        defaultOutputModes: ["application/json", "text/event-stream"],
        securitySchemes: {
          bearer: {
            httpAuthSecurityScheme: {
              description: "A signed access token.",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
        securityRequirements: [{ schemes: { bearer: { list: [] } } }],
        skills: [
          {
            id: "search-docs",
            name: "Search documentation",
            description: "Find relevant documentation pages.",
            tags: ["documentation", "search"],
            examples: ["Find the authentication guide."],
            inputModes: ["application/json"],
            outputModes: ["application/json"],
            securityRequirements: [{ schemes: { bearer: { list: [] } } }],
          },
        ],
      },
      [],
    );

    expect(card).toEqual({
      name: "Example agent",
      description: "Answers documentation questions.",
      supportedInterfaces: [
        {
          url: "https://agent.example.com/rpc",
          protocolBinding: "JSONRPC",
          protocolVersion: "1.0",
          tenant: "acme",
        },
        {
          url: "wss://agent.example.com/events",
          protocolBinding: "https://agent.example.com/bindings/events",
          protocolVersion: "1.1",
        },
      ],
      version: "1.0.0",
      capabilities: {
        streaming: true,
        pushNotifications: true,
        extendedAgentCard: true,
        extensions: [
          {
            uri: "https://agent.example.com/extensions/audit",
            description: "Includes an audit record with each result.",
            required: true,
            params: { level: "full" },
          },
        ],
      },
      defaultInputModes: ["application/json"],
      defaultOutputModes: ["application/json", "text/event-stream"],
      skills: [
        {
          id: "search-docs",
          name: "Search documentation",
          description: "Find relevant documentation pages.",
          tags: ["documentation", "search"],
          examples: ["Find the authentication guide."],
          inputModes: ["application/json"],
          outputModes: ["application/json"],
          securityRequirements: [{ schemes: { bearer: { list: [] } } }],
        },
      ],
      securitySchemes: {
        bearer: {
          httpAuthSecurityScheme: {
            description: "A signed access token.",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      securityRequirements: [{ schemes: { bearer: { list: [] } } }],
    });
  });

  it("rejects empty, malformed, and duplicate interface declarations", () => {
    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          interfaceUrl: "https://agent.example.com/legacy",
        } as unknown as Parameters<typeof buildDocsA2AAgentCard>[0],
        [],
      ),
    ).toThrow("supportedInterfaces cannot be combined");

    const withoutSkills = {
      name: validOptions.name,
      description: validOptions.description,
      supportedInterfaces: validOptions.supportedInterfaces,
    };
    expect(() =>
      buildDocsA2AAgentCard(
        withoutSkills as unknown as Parameters<typeof buildDocsA2AAgentCard>[0],
        [],
      ),
    ).toThrow("skills is required with supportedInterfaces");

    expect(() => buildDocsA2AAgentCard({ ...validOptions, supportedInterfaces: [] }, [])).toThrow(
      "supportedInterfaces must contain at least one interface",
    );

    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          supportedInterfaces: [{ url: "https://agent.example.com/a2a", protocolVersion: "1" }],
        },
        [],
      ),
    ).toThrow("protocolVersion must use A2A major.minor form");

    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          supportedInterfaces: [
            { url: "https://agent.example.com/a2a", protocolBinding: "custom" },
          ],
        },
        [],
      ),
    ).toThrow("protocolBinding must be a core A2A binding or an absolute URI");

    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          supportedInterfaces: [{ url: "http://agent.example.com/a2a" }],
        },
        [],
      ),
    ).toThrow("must use HTTPS for core A2A bindings");

    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          supportedInterfaces: [
            {
              url: "file:///tmp/agent.sock",
              protocolBinding: "https://agent.example.com/bindings/custom",
            },
          ],
        },
        [],
      ),
    ).toThrow("must use a secure binding-appropriate URL");

    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          supportedInterfaces: [
            { url: "https://agent.example.com/a2a" },
            { url: "https://agent.example.com/a2a" },
          ],
        },
        [],
      ),
    ).toThrow("supportedInterfaces must not contain duplicate interfaces");
  });

  it("permits loopback HTTP during development and requires absolute secure metadata URLs", () => {
    const card = buildDocsA2AAgentCard(
      {
        ...validOptions,
        supportedInterfaces: [{ url: "http://localhost:3200/a2a" }],
        documentationUrl: "http://127.0.0.1:3200/docs",
      },
      [],
    );
    expect(card.supportedInterfaces[0]?.url).toBe("http://localhost:3200/a2a");
    expect(card.documentationUrl).toBe("http://127.0.0.1:3200/docs");

    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          documentationUrl: "docs.example.com",
        },
        [],
      ),
    ).toThrow("agent.a2a.documentationUrl must be an absolute URL");
  });

  it("rejects duplicate skill IDs", () => {
    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          skills: [
            validOptions.skills[0],
            { ...validOptions.skills[0], name: "Duplicate documentation skill" },
          ],
        },
        [],
      ),
    ).toThrow("agent.a2a.skills[1].id must be unique");
  });

  it("rejects undefined card and skill security scheme references", () => {
    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          securityRequirements: [{ schemes: { missing: { list: [] } } }],
        },
        [],
      ),
    ).toThrow('references undefined security scheme "missing"');

    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          skills: [
            {
              ...validOptions.skills[0],
              securityRequirements: [{ schemes: { missing: { list: [] } } }],
            },
          ],
        },
        [],
      ),
    ).toThrow('references undefined security scheme "missing"');
  });

  it("rejects security keys that collide after trimming", () => {
    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          securitySchemes: {
            bearer: { httpAuthSecurityScheme: { scheme: "bearer" } },
            " bearer ": { httpAuthSecurityScheme: { scheme: "basic" } },
          },
        },
        [],
      ),
    ).toThrow("securitySchemes must not contain duplicate keys after trimming");

    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          securitySchemes: {
            bearer: { httpAuthSecurityScheme: { scheme: "bearer" } },
          },
          securityRequirements: [
            {
              schemes: {
                bearer: { list: [] },
                " bearer ": { list: [] },
              },
            },
          ],
        },
        [],
      ),
    ).toThrow("schemes must not contain duplicate keys after trimming");

    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          securitySchemes: {
            oauth: {
              oauth2SecurityScheme: {
                flows: {
                  clientCredentials: {
                    tokenUrl: "https://auth.example.com/token",
                    scopes: {
                      "docs.read": "Read documentation",
                      " docs.read ": "Overlapping scope",
                    },
                  },
                },
              },
            },
          },
        },
        [],
      ),
    ).toThrow("scopes must not contain duplicate keys after trimming");
  });

  it("preserves __proto__ security and OAuth scope keys as data", () => {
    const card = buildDocsA2AAgentCard(
      {
        ...validOptions,
        securitySchemes: {
          ["__proto__"]: {
            oauth2SecurityScheme: {
              flows: {
                clientCredentials: {
                  tokenUrl: "https://auth.example.com/token",
                  scopes: { ["__proto__"]: "Prototype-named scope" },
                },
              },
            },
          },
        },
        securityRequirements: [
          {
            schemes: {
              ["__proto__"]: { list: ["__proto__"] },
            },
          },
        ],
      },
      [],
    );

    expect(Object.hasOwn(card.securitySchemes ?? {}, "__proto__")).toBe(true);
    expect(
      Object.hasOwn(
        card.securitySchemes?.["__proto__"].oauth2SecurityScheme?.flows.clientCredentials?.scopes ??
          {},
        "__proto__",
      ),
    ).toBe(true);
    expect(Object.hasOwn(card.securityRequirements?.[0]?.schemes ?? {}, "__proto__")).toBe(true);
  });

  it("requires security metadata for extended cards and TLS for OAuth endpoints", () => {
    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          capabilities: { extendedAgentCard: true },
        },
        [],
      ),
    ).toThrow("extendedAgentCard requires a configured security scheme");

    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          capabilities: { extendedAgentCard: true },
          securitySchemes: {
            bearer: {
              httpAuthSecurityScheme: { scheme: "bearer" },
            },
          },
        },
        [],
      ),
    ).toThrow("and a non-empty security requirement");

    expect(() =>
      buildDocsA2AAgentCard(
        {
          ...validOptions,
          securitySchemes: {
            oauth: {
              oauth2SecurityScheme: {
                flows: {
                  clientCredentials: {
                    tokenUrl: "http://auth.example.com/token",
                    scopes: { "docs.read": "Read documentation" },
                  },
                },
              },
            },
          },
        },
        [],
      ),
    ).toThrow("tokenUrl must use HTTPS");
  });
});
