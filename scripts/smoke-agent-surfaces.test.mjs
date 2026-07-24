import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { runAgentSurfaceSmoke } from "./smoke-agent-surfaces.mjs";

const BASE_URL = "https://deployment.example.com";
const AGENT_SKILLS_SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
const AGENT_MANIFEST_FORMAT = "farming-labs-agent-manifest.v1";
const AGENT_MANIFEST_SCHEMA = "https://docs.farming-labs.dev/schema/agent-manifest.v1.json";
const AGENT_MANIFEST_SCHEMA_ROUTE = "/schema/agent-manifest.v1.json";
const API_CATALOG_PROFILE = "https://www.rfc-editor.org/info/rfc9727";
const API_CATALOG_ROUTE = "/.well-known/api-catalog";
const AGENT_SKILLS_INDEX_ROUTE = "/.well-known/agent-skills/index.json";
const LEGACY_SKILLS_INDEX_ROUTE = "/.well-known/skills/index.json";
const AGENT_CARD_ROUTE = "/.well-known/agent-card.json";

const docsDocument = `---
name: docs
description: Use the site documentation.
---

# Documentation
`;
const portableDocument = `---
name: portable
description: Use the portable workflow.
---

# Portable workflow
`;
const portableArchive = new Uint8Array([31, 139, 8, 0, 1, 2, 3, 4]);

function digest(content) {
  return createHash("sha256").update(content).digest("hex");
}

const docsDigest = digest(docsDocument);
const portableDocumentDigest = digest(portableDocument);
const portableArchiveDigest = digest(portableArchive);

function jsonResponse(method, value, options = {}) {
  return response(method, `${JSON.stringify(value)}\n`, {
    contentType: "application/json; charset=utf-8",
    ...options,
  });
}

function response(method, body, options = {}) {
  const headers = new Headers(options.headers);
  if (options.contentType) headers.set("content-type", options.contentType);
  return new Response(method === "HEAD" ? null : body, {
    status: options.status ?? 200,
    headers,
  });
}

function createFixtureFetch(options = {}) {
  const calls = [];
  const streamState = { aborted: false, cancelled: false, pulls: 0 };
  const manifest = {
    $schema: AGENT_MANIFEST_SCHEMA,
    format: AGENT_MANIFEST_FORMAT,
    version: "1",
    name: "@farming-labs/docs",
    capabilities: { agentSkillsDiscovery: true, mcp: true },
    api: {
      agentSkillsIndex: AGENT_SKILLS_INDEX_ROUTE,
      legacySkillsIndex: LEGACY_SKILLS_INDEX_ROUTE,
    },
    apiCatalog: { enabled: true, route: API_CATALOG_ROUTE },
    skills: {
      discovery: {
        schema: AGENT_SKILLS_SCHEMA,
        index: AGENT_SKILLS_INDEX_ROUTE,
        legacyIndex: LEGACY_SKILLS_INDEX_ROUTE,
      },
      published: [
        {
          name: "portable",
          type: "archive",
          description: "Use the portable workflow.",
          url: "/.well-known/agent-skills/portable.tar.gz",
          digest: `sha256:${portableArchiveDigest}`,
          files: [
            {
              path: "SKILL.md",
              url: "/.well-known/agent-skills/portable/SKILL.md",
              digest: `sha256:${portableDocumentDigest}`,
            },
          ],
        },
      ],
    },
    mcp: {
      publicEndpoints: ["/mcp", "/.well-known/mcp"],
    },
  };
  if (options.agentCard) manifest.api.agentCard = AGENT_CARD_ROUTE;
  const agentCard = {
    name: "Fixture docs agent",
    description: "Answers questions from the fixture documentation.",
    supportedInterfaces: [
      {
        url: `${BASE_URL}/a2a`,
        protocolBinding: "HTTP+JSON",
        protocolVersion: "1.0",
      },
    ],
    provider: { organization: "Example", url: "https://example.com/" },
    version: "1.0.0",
    documentationUrl: `${BASE_URL}/docs`,
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extensions: [
        {
          uri: "https://example.com/a2a/extensions/citations",
          description: "Returns documentation citations.",
          required: false,
          params: { format: "url" },
        },
      ],
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [
      {
        id: "docs",
        name: "Documentation",
        description: "Answers questions from the documentation.",
        tags: ["documentation"],
        examples: ["How do I install the package?"],
        securityRequirements: [{ schemes: { bearer: { list: ["docs.read"] } } }],
      },
    ],
    securitySchemes: options.invalidAgentSecurity
      ? { bearer: { type: "http", scheme: "bearer" } }
      : {
          bearer: {
            httpAuthSecurityScheme: {
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
    securityRequirements: [{ schemes: { bearer: { list: ["docs.read"] } } }],
    ...(options.invalidAgentCard ? { url: `${BASE_URL}/a2a` } : {}),
  };
  if (options.duplicateAgentInterfaces) {
    agentCard.supportedInterfaces.push({
      ...agentCard.supportedInterfaces[0],
      url: "https://deployment.example.com:443/a2a",
    });
  }
  if (options.customProtocolBinding) {
    agentCard.supportedInterfaces[0].protocolBinding = options.customProtocolBinding;
  }
  const agentCardEtag = `"${digest(`${JSON.stringify(agentCard)}\n`)}"`;
  const modernIndex = {
    $schema: AGENT_SKILLS_SCHEMA,
    skills: [
      {
        name: "docs",
        type: "skill-md",
        description: "Use the site documentation.",
        url: "/.well-known/agent-skills/docs/SKILL.md",
        digest: `sha256:${docsDigest}`,
      },
      {
        name: "portable",
        type: "archive",
        description: "Use the portable workflow.",
        url: "/.well-known/agent-skills/portable.tar.gz",
        digest: `sha256:${portableArchiveDigest}`,
      },
    ],
  };
  const legacyIndex = {
    skills: [
      { name: "docs", description: "Use the site documentation.", files: ["SKILL.md"] },
      { name: "portable", description: "Use the portable workflow.", files: ["SKILL.md"] },
    ],
  };

  async function fixtureResponse(input, init = {}) {
    const url = new URL(input);
    const method = init.method ?? "GET";
    calls.push({ method, pathname: url.pathname });

    if (
      url.pathname === "/.well-known/agent.json" ||
      url.pathname === "/.well-known/agent" ||
      url.pathname === "/api/docs/agent/spec"
    ) {
      return jsonResponse(method, manifest, {
        headers: {
          link: `<${AGENT_MANIFEST_SCHEMA}>; rel="describedby"; type="application/schema+json"`,
        },
      });
    }
    if (url.pathname === AGENT_MANIFEST_SCHEMA_ROUTE) {
      return jsonResponse(
        method,
        {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          $id: AGENT_MANIFEST_SCHEMA,
          properties: {
            format: { const: AGENT_MANIFEST_FORMAT },
          },
        },
        { contentType: "application/schema+json; charset=utf-8" },
      );
    }
    if (url.pathname === API_CATALOG_ROUTE) {
      return jsonResponse(
        method,
        {
          linkset: [
            {
              anchor: `${BASE_URL}${API_CATALOG_ROUTE}`,
              item: [{ href: `${BASE_URL}/api/docs` }],
              "service-meta": [
                { href: `${BASE_URL}/.well-known/agent.json` },
                { href: `${BASE_URL}${AGENT_SKILLS_INDEX_ROUTE}` },
              ],
            },
          ],
        },
        {
          contentType: `application/linkset+json; profile="${API_CATALOG_PROFILE}"; charset=utf-8`,
          headers: { link: `<${API_CATALOG_ROUTE}>; rel="api-catalog"` },
        },
      );
    }
    if (url.pathname === AGENT_SKILLS_INDEX_ROUTE) {
      return jsonResponse(method, modernIndex);
    }
    if (url.pathname === LEGACY_SKILLS_INDEX_ROUTE) {
      return jsonResponse(method, legacyIndex);
    }
    if (url.pathname === "/.well-known/agent-skills/docs/SKILL.md") {
      return response(method, docsDocument, {
        contentType: "text/markdown; charset=utf-8",
        headers: {
          etag: `W/"${docsDigest}"`,
          link: `<${AGENT_SKILLS_INDEX_ROUTE}>; rel="collection"`,
        },
      });
    }
    if (url.pathname === "/.well-known/agent-skills/portable.tar.gz") {
      return response(method, options.corruptArchive ? new Uint8Array([0]) : portableArchive, {
        contentType: "application/gzip",
        headers: {
          etag: `"${portableArchiveDigest}"`,
          link: `<${AGENT_SKILLS_INDEX_ROUTE}>; rel="collection"`,
        },
      });
    }
    if (url.pathname === "/.well-known/agent-skills/portable/SKILL.md") {
      return response(method, portableDocument, { contentType: "text/markdown; charset=utf-8" });
    }
    if (url.pathname === "/.well-known/skills/docs/SKILL.md") {
      return response(method, docsDocument, { contentType: "text/markdown; charset=utf-8" });
    }
    if (url.pathname === "/.well-known/skills/portable/SKILL.md") {
      return response(method, portableDocument, { contentType: "text/markdown; charset=utf-8" });
    }
    if (url.pathname === AGENT_CARD_ROUTE && options.agentCard) {
      const headers = {
        "cache-control": options.agentCardCacheControl ?? "public, max-age=0, s-maxage=3600",
        etag: agentCardEtag,
      };
      if (new Headers(init.headers).get("if-none-match") === agentCardEtag) {
        const notModifiedHeaders = { ...headers };
        if (options.notModifiedEtag === null) delete notModifiedHeaders.etag;
        else if (options.notModifiedEtag !== undefined) {
          notModifiedHeaders.etag = options.notModifiedEtag;
        }
        if (options.notModifiedCacheControl === null) {
          delete notModifiedHeaders["cache-control"];
        } else if (options.notModifiedCacheControl !== undefined) {
          notModifiedHeaders["cache-control"] = options.notModifiedCacheControl;
        }
        return response("HEAD", "", { status: 304, headers: notModifiedHeaders });
      }
      return jsonResponse(method, agentCard, { headers });
    }
    if (url.pathname === AGENT_CARD_ROUTE) {
      return response(method, "Not Found", { status: 404, contentType: "text/plain" });
    }
    if (url.pathname === "/mcp" || url.pathname === "/.well-known/mcp") {
      return jsonResponse(method, {
        jsonrpc: "2.0",
        id: 1,
        result: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          serverInfo: { name: "Fixture docs", version: "1.0.0" },
        },
      });
    }

    if (url.pathname === "/.well-known/skill.md" && options.oversizedStream) {
      init.signal?.addEventListener(
        "abort",
        () => {
          streamState.aborted = true;
        },
        { once: true },
      );
      const body = new ReadableStream({
        pull(controller) {
          streamState.pulls += 1;
          if (streamState.pulls > 100) {
            controller.close();
            return;
          }
          controller.enqueue(new Uint8Array(48 * 1024));
        },
        cancel() {
          streamState.cancelled = true;
        },
      });
      return response(method, body, { contentType: "text/markdown; charset=utf-8" });
    }

    const textRoutes = {
      "/.well-known/skill.md": ["text/markdown", docsDocument],
      "/.well-known/AGENTS.md": ["text/markdown", "# AGENTS.md\n"],
      "/.well-known/AGENT.md": ["text/markdown", "# AGENT.md\n"],
      "/.well-known/llms.txt": ["text/plain", "# Documentation\n"],
      "/.well-known/llms-full.txt": ["text/plain", "# Full documentation\n"],
      "/.well-known/sitemap.md": ["text/markdown", "# Sitemap\n"],
    };
    const textRoute = textRoutes[url.pathname];
    if (textRoute) return response(method, textRoute[1], { contentType: textRoute[0] });
    return response(method, "Not Found", { status: 404, contentType: "text/plain" });
  }

  async function fixtureFetch(input, init = {}) {
    const requestedUrl = new URL(input);
    const result = await fixtureResponse(input, init);
    const finalUrl =
      options.crossOriginRedirectPath === requestedUrl.pathname
        ? new URL(requestedUrl.pathname, "https://redirect.example.net").href
        : requestedUrl.href;
    Object.defineProperty(result, "url", { configurable: true, value: finalUrl });
    return result;
  }

  return { calls, fetch: fixtureFetch, streamState };
}

async function expectAgentCardFailure(options, expectedMessage) {
  const fixture = createFixtureFetch({ ...options, agentCard: true });
  await assert.rejects(
    runAgentSurfaceSmoke({
      attempts: 1,
      baseUrl: BASE_URL,
      expectedSkillNames: ["portable"],
      fetchImpl: fixture.fetch,
      log() {},
    }),
    (error) => {
      assert.equal(error.failures.length, 1);
      assert.equal(error.failures[0].label, "optional A2A agent card");
      assert.match(error.failures[0].message, expectedMessage);
      return true;
    },
  );
}

test("smoke-checks deployed discovery, skills, MCP, and well-known aliases", async () => {
  const fixture = createFixtureFetch();
  const result = await runAgentSurfaceSmoke({
    attempts: 1,
    baseUrl: BASE_URL,
    expectedSkillNames: ["portable"],
    fetchImpl: fixture.fetch,
    log() {},
  });

  assert.equal(result.passed, true);
  assert(
    fixture.calls.some((call) => call.method === "HEAD" && call.pathname === API_CATALOG_ROUTE),
  );
  assert(fixture.calls.some((call) => call.method === "POST" && call.pathname === "/mcp"));
  assert(
    fixture.calls.some((call) => call.pathname === "/.well-known/agent-skills/portable/SKILL.md"),
  );
  assert(fixture.calls.some((call) => call.pathname === AGENT_MANIFEST_SCHEMA_ROUTE));
});

test("fails when an indexed Agent Skill artifact does not match its digest", async () => {
  const fixture = createFixtureFetch({ corruptArchive: true });
  await assert.rejects(
    runAgentSurfaceSmoke({
      attempts: 1,
      baseUrl: BASE_URL,
      expectedSkillNames: ["portable"],
      fetchImpl: fixture.fetch,
      log() {},
    }),
    /1 agent surface smoke check failed/u,
  );
});

test("validates an advertised strict A2A v1 Agent Card and its cache contract", async () => {
  const fixture = createFixtureFetch({ agentCard: true });
  const result = await runAgentSurfaceSmoke({
    attempts: 1,
    baseUrl: BASE_URL,
    expectedSkillNames: ["portable"],
    fetchImpl: fixture.fetch,
    log() {},
  });

  assert.equal(result.passed, true);
  assert(
    fixture.calls.some((call) => call.method === "HEAD" && call.pathname === AGENT_CARD_ROUTE),
  );
});

test("rejects a legacy or hybrid A2A Agent Card", async () => {
  const fixture = createFixtureFetch({ agentCard: true, invalidAgentCard: true });
  await assert.rejects(
    runAgentSurfaceSmoke({
      attempts: 1,
      baseUrl: BASE_URL,
      expectedSkillNames: ["portable"],
      fetchImpl: fixture.fetch,
      log() {},
    }),
    (error) => {
      assert.equal(error.failures.length, 1);
      assert.match(error.failures[0].message, /unsupported field "url"/u);
      return true;
    },
  );
});

test("rejects malformed nested A2A security metadata", async () => {
  const fixture = createFixtureFetch({ agentCard: true, invalidAgentSecurity: true });
  await assert.rejects(
    runAgentSurfaceSmoke({
      attempts: 1,
      baseUrl: BASE_URL,
      expectedSkillNames: ["portable"],
      fetchImpl: fixture.fetch,
      log() {},
    }),
    (error) => {
      assert.equal(error.failures.length, 1);
      assert.match(error.failures[0].message, /unsupported field "type"/u);
      return true;
    },
  );
});

test("rejects duplicate A2A supported interface tuples", async () => {
  await expectAgentCardFailure(
    { duplicateAgentInterfaces: true },
    /duplicated supported interface/u,
  );
});

test("rejects a custom A2A protocol binding that is not an absolute URI", async () => {
  await expectAgentCardFailure(
    { customProtocolBinding: "custom" },
    /protocol binding was not an absolute URI/u,
  );
});

for (const [name, cacheControl, expectedMessage] of [
  ["private", "private, max-age=0, s-maxage=3600", /did not declare public caching/u],
  ["no-store", "public, no-store, max-age=0, s-maxage=3600", /disabled public caching/u],
  [
    "missing shared-cache lifetime",
    "public, max-age=3600",
    /omitted a numeric shared-cache max-age/u,
  ],
]) {
  test(`rejects ${name} A2A Agent Card cache metadata`, async () => {
    await expectAgentCardFailure({ agentCardCacheControl: cacheControl }, expectedMessage);
  });
}

for (const [name, options, expectedMessage] of [
  ["missing ETag", { notModifiedEtag: null }, /304 returned a different ETag/u],
  [
    "changed cache metadata",
    { notModifiedCacheControl: "public, max-age=0, s-maxage=60" },
    /304 returned different cache metadata/u,
  ],
]) {
  test(`rejects an A2A Agent Card 304 with ${name}`, async () => {
    await expectAgentCardFailure(options, expectedMessage);
  });
}

test("fails when a followed redirect leaves the deployment origin", async () => {
  const fixture = createFixtureFetch({
    crossOriginRedirectPath: "/.well-known/agent-skills/docs/SKILL.md",
  });
  await assert.rejects(
    runAgentSurfaceSmoke({
      attempts: 1,
      baseUrl: BASE_URL,
      expectedSkillNames: ["portable"],
      fetchImpl: fixture.fetch,
      log() {},
    }),
    (error) => {
      assert.equal(error.failures.length, 1);
      assert.match(error.failures[0].message, /redirected to cross-origin response/u);
      return true;
    },
  );
});

test("aborts and cancels a response stream as soon as it exceeds the size cap", async () => {
  const fixture = createFixtureFetch({ oversizedStream: true });
  await assert.rejects(
    runAgentSurfaceSmoke({
      attempts: 1,
      baseUrl: BASE_URL,
      expectedSkillNames: ["portable"],
      fetchImpl: fixture.fetch,
      log() {},
      maxResponseBytes: 64 * 1024,
    }),
    (error) => {
      assert.equal(error.failures.length, 1);
      assert.match(error.failures[0].message, /returned more than 65536 bytes/u);
      return true;
    },
  );
  assert.equal(fixture.streamState.aborted, true);
  assert.equal(fixture.streamState.cancelled, true);
  assert(fixture.streamState.pulls < 10, "the oversized response was not fully consumed");
});
