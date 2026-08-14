import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { buildDocsAgentDiscoverySpec, compactDocsAgentDiscoverySpec } from "./agent.js";
import { exportAgentBundle } from "./cli/agent-export.js";
import { resolveDocsMcpConfig } from "./mcp.js";

const legacySchemaPath = new URL(
  "../../../website/public/schema/agent-manifest.v1.json",
  import.meta.url,
);
const schemaPath = new URL(
  "../../../website/public/schema/agent-manifest.v2.json",
  import.meta.url,
);
const legacySchema = JSON.parse(readFileSync(legacySchemaPath, "utf8")) as Record<string, unknown>;
const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateLegacy = ajv.compile(legacySchema);
const validate = ajv.compile(schema);

function buildManifest(overrides: Partial<Parameters<typeof buildDocsAgentDiscoverySpec>[0]> = {}) {
  return buildDocsAgentDiscoverySpec({
    origin: "https://docs.example.com",
    entry: "docs",
    mcp: resolveDocsMcpConfig(false),
    ...overrides,
  });
}

function expectValid(value: unknown) {
  const valid = validate(value);
  expect(validate.errors, JSON.stringify(validate.errors, null, 2)).toBeNull();
  expect(valid).toBe(true);
}

async function exportStaticManifest() {
  const rootDir = mkdtempSync(join(tmpdir(), "docs-agent-manifest-schema-"));

  try {
    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  contentDir: "docs",
  staticExport: true,
  nav: { title: "Example Docs" },
  metadata: { description: "Documentation for Example." },
  llmsTxt: { enabled: true, baseUrl: "https://docs.example.com" },
  sitemap: { enabled: true, baseUrl: "https://docs.example.com" },
  robots: { enabled: true },
};
`,
      "utf8",
    );
    mkdirSync(join(rootDir, "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "docs", "page.mdx"),
      `---
title: "Home"
description: "Start here"
---

# Home
`,
      "utf8",
    );
    await exportAgentBundle({ public: true, rootDir });

    return JSON.parse(
      readFileSync(join(rootDir, "public", ".well-known", "agent.json"), "utf8"),
    ) as unknown;
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

describe("Farming Labs agent manifest schema", () => {
  it("publishes a versioned Draft 2020-12 identity", () => {
    expect(schema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://docs.farming-labs.dev/schema/agent-manifest.v2.json",
    });

    const manifest = buildManifest();
    expect(manifest).toMatchObject({
      $schema: "https://docs.farming-labs.dev/schema/agent-manifest.v2.json",
      format: "farming-labs-agent-manifest.v2",
      version: "2",
      name: "@farming-labs/docs",
    });
    expect(manifest.api).not.toHaveProperty("agentCard");
    expectValid(manifest);
  });

  it("publishes a compact first-hop profile without skill file inventories", () => {
    const full = buildManifest({
      publishedSkills: [
        {
          name: "example",
          description: "Example skill",
          type: "skill-md",
          url: "/.well-known/agent-skills/example/SKILL.md",
          digest: `sha256:${"a".repeat(64)}`,
          content: "# Example",
          sha256: "a".repeat(64),
          skillDocument: "# Example",
          files: [
            {
              path: "references/setup.md",
              url: "/.well-known/agent-skills/example/references/setup.md",
              mediaType: "text/markdown; charset=utf-8",
              content: "# Setup",
              sha256: "b".repeat(64),
              digest: `sha256:${"b".repeat(64)}`,
            },
          ],
        },
      ],
    });
    const compact = compactDocsAgentDiscoverySpec(full);

    expect(compact).toMatchObject({
      profile: "compact",
      profiles: {
        full: "/.well-known/agent.json",
        compact: "/.well-known/agent.json?profile=compact",
      },
      skills: { published: [{ name: "example", fileCount: 1, files: [] }] },
    });
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(full).length);
    expectValid(compact);
  });

  it("keeps the published v1 schema immutable and valid for v1 manifests", () => {
    expect(legacySchema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://docs.farming-labs.dev/schema/agent-manifest.v1.json",
      properties: {
        $schema: { const: "https://docs.farming-labs.dev/schema/agent-manifest.v1.json" },
        format: { const: "farming-labs-agent-manifest.v1" },
        version: { const: "1" },
        markdown: {
          properties: {
            sectionDiscovery: {
              properties: {
                format: { const: "docs-markdown-sections.v1" },
              },
            },
          },
        },
      },
    });

    const current = buildManifest();
    const legacySearch: Record<string, unknown> = { ...current.search };
    for (const field of ["cursorParam", "nextCursorField", "hasMoreField", "totalField"]) {
      delete legacySearch[field];
    }
    const legacy = {
      ...current,
      $schema: "https://docs.farming-labs.dev/schema/agent-manifest.v1.json",
      format: "farming-labs-agent-manifest.v1",
      version: "1",
      search: legacySearch,
      markdown: {
        ...current.markdown,
        sectionDiscovery: {
          ...current.markdown.sectionDiscovery,
          format: "docs-markdown-sections.v1",
        },
      },
    };

    expect(validateLegacy(legacy), JSON.stringify(validateLegacy.errors, null, 2)).toBe(true);
    expect(validateLegacy(current)).toBe(false);
  });

  it("validates feature-rich, disabled-feature, and exported static manifests", async () => {
    expectValid(
      buildManifest({
        apiCatalog: false,
        llms: { enabled: false, baseUrl: "/" },
        search: false,
        sitemap: false,
        robots: false,
        openapi: false,
      }),
    );

    expectValid(
      buildManifest({
        mcp: resolveDocsMcpConfig({
          enabled: true,
          security: {
            authenticate: async () => ({ id: "agent" }),
            protectedResource: {
              authorizationServers: ["https://auth.example.com"],
              scopesSupported: ["docs:read"],
              requiredScopes: ["docs:read"],
            },
          },
        }),
        agentCard: {
          name: "Example agent",
          description: "Answers questions from the documentation.",
          supportedInterfaces: [{ url: "https://agent.example.com/a2a" }],
          skills: [
            {
              id: "docs",
              name: "Documentation",
              description: "Answers questions from the documentation.",
              tags: ["documentation"],
            },
          ],
        },
      }),
    );

    const exportedManifest = await exportStaticManifest();
    expect(exportedManifest).toMatchObject({
      staticBundle: {
        format: "farming-labs-agent-bundle.v1",
        manifest: "/.well-known/agent-bundle.json",
        check: "docs agent export --check",
      },
    });
    expectValid(exportedManifest);
  });

  it("advertises a complete backwards-compatible structured search contract", () => {
    const manifest = buildManifest();

    expect(manifest.search).toMatchObject({
      endpoint: "/api/docs?query={query}",
      agentEndpoint: "/api/docs?query={query}&audience=agent",
      structuredAgentEndpoint: "/api/docs?query={query}&audience=agent&response=structured",
      explainedAgentEndpoint:
        "/api/docs?query={query}&audience=agent&response=structured&explain=true",
      facetsEndpoint: "/api/docs?audience=agent&response=facets",
      responseParam: "response",
      structuredResponseValue: "structured",
      facetsResponseValue: "facets",
      responseFormat: "docs-search.v1",
      explainParam: "explain",
      explainValue: "true",
      explanationField: "explanation",
      explanationFormat: "docs-search-explanation.v1",
      facetsResponseFormat: "docs-search-facets.v1",
      filterParams: {
        framework: "framework",
        version: "version",
        package: "package",
        tags: "tags",
      },
      repeatedFilterParams: ["framework", "version", "package", "tags"],
      warningsField: "warnings",
      facetParam: "facet",
      limitParam: "limit",
      cursorParam: "cursor",
      nextCursorField: "nextCursor",
      hasMoreField: "hasMore",
      totalField: "total",
    });
    expectValid(manifest);

    const prePaginationSearch: Record<string, unknown> = { ...manifest.search };
    for (const field of ["cursorParam", "nextCursorField", "hasMoreField", "totalField"]) {
      delete prePaginationSearch[field];
    }
    expectValid({ ...manifest, search: prePaginationSearch });

    const legacySearch: Record<string, unknown> = { ...manifest.search };
    for (const field of [
      "structuredAgentEndpoint",
      "explainedAgentEndpoint",
      "facetsEndpoint",
      "responseParam",
      "structuredResponseValue",
      "facetsResponseValue",
      "responseFormat",
      "explainParam",
      "explainValue",
      "explanationField",
      "explanationFormat",
      "facetsResponseFormat",
      "filterParams",
      "repeatedFilterParams",
      "warningsField",
      "cursorParam",
      "nextCursorField",
      "hasMoreField",
      "totalField",
    ]) {
      delete legacySearch[field];
    }
    expectValid({ ...manifest, search: legacySearch });

    expect(
      validate({
        ...manifest,
        search: {
          ...manifest.search,
          responseFormat: "docs-search.v2",
        },
      }),
    ).toBe(false);

    const partialSearch: Record<string, unknown> = { ...manifest.search };
    delete partialSearch.warningsField;
    expect(validate({ ...manifest, search: partialSearch })).toBe(false);

    const partialFacets: Record<string, unknown> = { ...manifest.search };
    delete partialFacets.facetsResponseFormat;
    expect(validate({ ...manifest, search: partialFacets })).toBe(false);

    const partialPagination: Record<string, unknown> = { ...manifest.search };
    delete partialPagination.nextCursorField;
    expect(validate({ ...manifest, search: partialPagination })).toBe(false);

    const partialExplanation: Record<string, unknown> = { ...manifest.search };
    delete partialExplanation.explanationFormat;
    expect(validate({ ...manifest, search: partialExplanation })).toBe(false);

    const detachedPagination = {
      enabled: true,
      endpoint: "/api/docs?query={query}",
      agentEndpoint: "/api/docs?query={query}&audience=agent",
      method: "GET",
      queryParam: "query",
      localeParam: "locale",
      audienceParam: "audience",
      defaultAudience: "human",
      supportedAudiences: ["human", "agent"],
      cursorParam: "cursor",
      nextCursorField: "nextCursor",
      hasMoreField: "hasMore",
      totalField: "total",
    };
    expect(validate({ ...manifest, search: detachedPagination })).toBe(false);
  });

  it("advertises the body-free content synchronization contract", () => {
    const manifest = buildManifest();

    expect(manifest.capabilities.contentChanges).toBe(true);
    expect(manifest.api.contentChanges).toBe("/api/docs?audience=agent&response=changes");
    expect(manifest.contentChanges).toEqual({
      enabled: true,
      endpoint: "/api/docs?audience=agent&response=changes",
      method: "GET",
      audienceParam: "audience",
      defaultAudience: "agent",
      supportedAudiences: ["human", "agent"],
      responseParam: "response",
      responseValue: "changes",
      sinceParam: "since",
      format: "docs-content-changes.v1",
      generationField: "indexGeneration",
      resetRequiredField: "resetRequired",
      modes: ["snapshot", "delta", "reset"],
      bodyFree: true,
      etag: true,
    });
    expectValid(manifest);

    expect(
      validate({
        ...manifest,
        contentChanges: {
          ...manifest.contentChanges,
          format: "docs-content-changes.v2",
        },
      }),
    ).toBe(false);

    const disabled = buildManifest({ contentChanges: false });
    expect(disabled.capabilities.contentChanges).toBe(false);
    expect(disabled.api).not.toHaveProperty("contentChanges");
    expect(disabled.contentChanges).toMatchObject({ enabled: false, endpoint: null });
    expectValid(disabled);

    const legacyCapabilities: Record<string, boolean> = { ...manifest.capabilities };
    const legacyApi: Record<string, string> = { ...manifest.api };
    const preChangeFeed: Record<string, unknown> = {
      ...manifest,
      capabilities: legacyCapabilities,
      api: legacyApi,
    };
    delete preChangeFeed.contentChanges;
    delete legacyCapabilities.contentChanges;
    delete legacyApi.contentChanges;
    expectValid(preChangeFeed);
  });

  it("keeps Markdown section-discovery declarations synchronized", () => {
    const enabledManifest = buildManifest();
    const disabledManifest = buildManifest({
      markdown: { sectionDiscovery: false },
    });

    expectValid(enabledManifest);
    expectValid(disabledManifest);

    expect(
      validate({
        ...enabledManifest,
        capabilities: {
          ...enabledManifest.capabilities,
          markdownSectionDiscovery: false,
        },
      }),
    ).toBe(false);
    expect(
      validate({
        ...enabledManifest,
        markdown: {
          ...enabledManifest.markdown,
          sectionDiscovery: {
            ...enabledManifest.markdown.sectionDiscovery,
            enabled: false,
          },
        },
      }),
    ).toBe(false);

    const legacyCapabilities: Partial<typeof enabledManifest.capabilities> = {
      ...enabledManifest.capabilities,
    };
    const legacyMarkdown: Partial<typeof enabledManifest.markdown> = {
      ...enabledManifest.markdown,
    };
    delete legacyCapabilities.markdownSectionDiscovery;
    delete legacyMarkdown.sectionDiscovery;

    expect(validate({ ...enabledManifest, capabilities: legacyCapabilities })).toBe(false);
    expect(validate({ ...enabledManifest, markdown: legacyMarkdown })).toBe(false);
    expectValid({
      ...enabledManifest,
      capabilities: legacyCapabilities,
      markdown: legacyMarkdown,
    });
  });

  it("rejects wrong identities and A2A-only fields at the custom-manifest schema", () => {
    expect(validate({ ...buildManifest(), format: "agent-card" })).toBe(false);
    expect(validate({ ...buildManifest(), $schema: "https://example.com/schema.json" })).toBe(
      false,
    );
    expect(
      validate({
        ...buildManifest(),
        protocolVersion: "1.0",
        supportedInterfaces: [{ url: "https://agent.example.com/a2a" }],
      }),
    ).toBe(false);
  });
});
