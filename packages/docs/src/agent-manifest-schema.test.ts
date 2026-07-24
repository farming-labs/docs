import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { buildDocsAgentDiscoverySpec } from "./agent.js";
import { exportAgentBundle } from "./cli/agent-export.js";
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

async function exportStaticManifest() {
  const originalCwd = process.cwd();
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
    process.chdir(rootDir);
    await exportAgentBundle({ public: true });

    return JSON.parse(
      readFileSync(join(rootDir, "public", ".well-known", "agent.json"), "utf8"),
    ) as unknown;
  } finally {
    process.chdir(originalCwd);
    rmSync(rootDir, { recursive: true, force: true });
  }
}

describe("Farming Labs agent manifest schema", () => {
  it("publishes an immutable Draft 2020-12 identity", () => {
    expect(schema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://docs.farming-labs.dev/schema/agent-manifest.v1.json",
    });

    const manifest = buildManifest();
    expect(manifest).toMatchObject({
      $schema: "https://docs.farming-labs.dev/schema/agent-manifest.v1.json",
      format: "farming-labs-agent-manifest.v1",
      version: "1",
      name: "@farming-labs/docs",
    });
    expect(manifest.api).not.toHaveProperty("agentCard");
    expectValid(manifest);
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
