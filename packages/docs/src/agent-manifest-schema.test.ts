import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import {
  buildDocsAgentDiscoverySpec,
  DOCS_AGENT_MANIFEST_FORMAT,
  DOCS_AGENT_MANIFEST_SCHEMA_URI,
} from "./agent.js";
import { resolveDocsMcpConfig } from "./mcp.js";

const schemaPath = new URL(
  "../../../website/public/schema/agent-manifest.v1.json",
  import.meta.url,
);
const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
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

describe("Farming Labs agent manifest schema", () => {
  it("publishes an immutable Draft 2020-12 identity", () => {
    expect(schema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: DOCS_AGENT_MANIFEST_SCHEMA_URI,
    });

    const manifest = buildManifest();
    expect(manifest).toMatchObject({
      $schema: DOCS_AGENT_MANIFEST_SCHEMA_URI,
      format: DOCS_AGENT_MANIFEST_FORMAT,
      version: "1",
      name: "@farming-labs/docs",
    });
    expect(manifest.api).not.toHaveProperty("agentCard");
    expectValid(manifest);
  });

  it("validates feature-rich, disabled-feature, and static-export manifests", () => {
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

    expectValid({
      ...buildManifest({ origin: "/" }),
      staticBundle: {
        format: "farming-labs-agent-bundle.v1",
        manifest: "/.well-known/agent-bundle.json",
        check: "docs agent export --check",
      },
    });
  });

  it("rejects wrong identities and an A2A Agent Card at the custom-manifest schema", () => {
    expect(validate({ ...buildManifest(), format: "agent-card" })).toBe(false);
    expect(validate({ ...buildManifest(), $schema: "https://example.com/schema.json" })).toBe(
      false,
    );
    expect(
      validate({
        protocolVersion: "1.0",
        name: "Example agent",
        description: "A real callable agent.",
        supportedInterfaces: [{ url: "https://agent.example.com/a2a" }],
      }),
    ).toBe(false);
  });
});
