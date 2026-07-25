import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { runAgentSurfaceSmoke } from "./smoke-agent-surfaces.mjs";

const BASE_URL = "https://deployment.example.com";
const AGENT_SKILLS_SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
const AGENT_MANIFEST_FORMAT = "farming-labs-agent-manifest.v1";
const AGENT_MANIFEST_SCHEMA = "https://docs.farming-labs.dev/schema/agent-manifest.v1.json";
const AGENT_MANIFEST_SCHEMA_MEDIA_TYPE = "application/schema+json";
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

function cachedResponse(method, body, requestHeaders, options = {}) {
  const etag = options.etag ?? `"${digest(body)}"`;
  const cacheControl = options.cacheControl ?? "public, max-age=0";
  const headers = new Headers(options.headers);
  headers.set("cache-control", cacheControl);
  headers.set("etag", etag);
  const requestedEtag = requestHeaders.get("if-none-match")?.replace(/^W\//u, "");
  if (requestedEtag === etag.replace(/^W\//u, "")) {
    return response("HEAD", "", {
      status: 304,
      headers: {
        "cache-control": cacheControl,
        etag: options.notModifiedEtag ?? etag,
      },
    });
  }
  return response(method, body, {
    contentType: options.contentType,
    headers,
  });
}

function createFixtureFetch(options = {}) {
  const calls = [];
  const streamState = { aborted: false, cancelled: false, pulls: 0 };
  const canonicalBaseUrl = options.canonicalBaseUrl ?? BASE_URL;
  const manifest = {
    $schema: AGENT_MANIFEST_SCHEMA,
    format: AGENT_MANIFEST_FORMAT,
    version: "1",
    name: "@farming-labs/docs",
    site: { baseUrl: canonicalBaseUrl, entry: "docs" },
    capabilities: {
      agentFeedback: true,
      agentSkillsDiscovery: true,
      markdownRoutes: true,
      mcp: true,
      robots: true,
      search: true,
      sitemap: true,
    },
    api: {
      agentSkillsIndex: AGENT_SKILLS_INDEX_ROUTE,
      agentSpecDefault: "/.well-known/agent.json",
      diagnostics: "/api/docs?format=diagnostics",
      legacySkillsIndex: LEGACY_SKILLS_INDEX_ROUTE,
    },
    apiCatalog: { enabled: true, route: API_CATALOG_ROUTE },
    config: {
      endpoint: "/api/docs?format=config",
      format: "docs-config-map.v1",
    },
    markdown: {
      enabled: true,
      rootPage: "/docs.md",
    },
    llms: {
      enabled: true,
      defaultTxt: "/llms.txt",
      defaultFull: "/llms-full.txt",
    },
    sitemap: {
      enabled: true,
      xml: { enabled: true, route: "/sitemap.xml" },
      markdown: {
        enabled: true,
        route: "/sitemap.md",
        docsRoute: "/docs/sitemap.md",
      },
    },
    robots: { enabled: true, route: "/robots.txt" },
    search: {
      enabled: true,
      endpoint: "/api/docs?query={query}",
      agentEndpoint: "/api/docs?query={query}&audience=agent",
    },
    agents: {
      enabled: true,
      route: "/AGENTS.md",
      aliases: ["/AGENT.md"],
    },
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
      route: "/skill.md",
    },
    mcp: {
      canonicalEndpoint: "/api/docs/mcp",
      publicEndpoints: ["/mcp", "/.well-known/mcp"],
    },
    feedback: {
      enabled: true,
      schema: "/api/docs/agent/feedback/schema",
    },
  };
  if (options.agentCard) manifest.api.agentCard = AGENT_CARD_ROUTE;
  if (options.missingCanonicalMcp) delete manifest.mcp.canonicalEndpoint;
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
    const requestHeaders = new Headers(init.headers);
    calls.push({
      accept: requestHeaders.get("accept"),
      ifNoneMatch: requestHeaders.get("if-none-match"),
      method,
      pathname: url.pathname,
      search: url.search,
    });

    if (
      url.pathname === "/.well-known/agent.json" ||
      url.pathname === "/.well-known/agent" ||
      url.pathname === "/api/docs/agent/spec"
    ) {
      return jsonResponse(method, manifest, {
        headers: {
          "cache-control": "public, max-age=0",
          link:
            options.manifestLink ??
            `<${AGENT_MANIFEST_SCHEMA}>; rel="describedby"; type="${AGENT_MANIFEST_SCHEMA_MEDIA_TYPE}"`,
        },
      });
    }
    if (url.pathname === AGENT_MANIFEST_SCHEMA_ROUTE) {
      if (
        options.strictSchemaNegotiation &&
        requestHeaders.get("accept") !== AGENT_MANIFEST_SCHEMA_MEDIA_TYPE
      ) {
        return response(method, "Not Acceptable", {
          status: 406,
          contentType: "text/plain; charset=utf-8",
        });
      }
      return jsonResponse(
        method,
        {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          $id: AGENT_MANIFEST_SCHEMA,
          properties: {
            format: { const: AGENT_MANIFEST_FORMAT },
          },
        },
        { contentType: `${AGENT_MANIFEST_SCHEMA_MEDIA_TYPE}; charset=utf-8` },
      );
    }
    if (url.pathname === API_CATALOG_ROUTE) {
      const value = {
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
      };
      return cachedResponse(method, `${JSON.stringify(value)}\n`, requestHeaders, {
        contentType: `application/linkset+json; profile="${API_CATALOG_PROFILE}"; charset=utf-8`,
        headers: {
          link:
            options.apiCatalogLink ??
            `<${API_CATALOG_ROUTE}>; rel="api-catalog"; type="application/linkset+json"`,
        },
      });
    }
    if (url.pathname === AGENT_SKILLS_INDEX_ROUTE) {
      const links = modernIndex.skills
        .map(
          (skill) =>
            `<${skill.url}>; rel="item"; type="${skill.type === "archive" ? "application/gzip" : "text/markdown"}"`,
        )
        .join(", ");
      return cachedResponse(method, `${JSON.stringify(modernIndex)}\n`, requestHeaders, {
        contentType: "application/json; charset=utf-8",
        headers: { link: links },
      });
    }
    if (url.pathname === LEGACY_SKILLS_INDEX_ROUTE) {
      return cachedResponse(method, `${JSON.stringify(legacyIndex)}\n`, requestHeaders, {
        contentType: "application/json; charset=utf-8",
      });
    }
    if (url.pathname === "/.well-known/agent-skills/docs/SKILL.md") {
      return cachedResponse(method, docsDocument, requestHeaders, {
        cacheControl:
          options.docsArtifactHeadCacheMismatch && method === "HEAD"
            ? "public, max-age=60"
            : undefined,
        contentType: "text/markdown; charset=utf-8",
        etag: `W/"${docsDigest}"`,
        notModifiedEtag: options.docsArtifactNotModifiedEtag,
        headers: {
          link: `<${AGENT_SKILLS_INDEX_ROUTE}>; rel="collection"; type="application/json"`,
        },
      });
    }
    if (url.pathname === "/.well-known/agent-skills/portable.tar.gz") {
      return cachedResponse(
        method,
        options.corruptArchive ? new Uint8Array([0]) : portableArchive,
        requestHeaders,
        {
          contentType: "application/gzip",
          etag: `"${portableArchiveDigest}"`,
          headers: {
            link: `<${AGENT_SKILLS_INDEX_ROUTE}>; rel="collection"; type="application/json"`,
          },
        },
      );
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
    if (
      url.pathname === "/mcp" ||
      url.pathname === "/.well-known/mcp" ||
      url.pathname === "/api/docs/mcp"
    ) {
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
    if (url.pathname === "/api/docs/agent/feedback/schema") {
      return jsonResponse(
        method,
        {
          type: "object",
          properties: { helpful: { type: "boolean" } },
        },
        { contentType: "application/schema+json; charset=utf-8" },
      );
    }
    if (url.pathname === "/api/docs" && url.searchParams.get("format") === "config") {
      return jsonResponse(method, { format: "docs-config-map.v1" });
    }
    if (url.pathname === "/api/docs" && url.searchParams.get("format") === "diagnostics") {
      return jsonResponse(method, { format: "docs-diagnostics.v1", ok: true });
    }
    if (url.pathname === "/api/docs" && url.searchParams.has("query")) {
      return jsonResponse(method, [
        {
          id: "/docs/installation",
          url: "/docs/installation",
          content: "Installation",
        },
      ]);
    }
    if (url.pathname === "/docs" && requestHeaders.get("accept") === "text/markdown") {
      return response(method, "# Introduction\n", {
        contentType: "text/markdown; charset=utf-8",
        headers: {
          link: `<${canonicalBaseUrl}/docs>; rel="canonical"`,
          vary: "Accept",
        },
      });
    }
    if (url.pathname === "/docs") {
      return response(method, "<!doctype html><title>Introduction</title>", {
        contentType: "text/html; charset=utf-8",
      });
    }
    if (url.pathname === "/docs.md") {
      return response(method, options.explicitMarkdownBody ?? "# Introduction\n", {
        contentType: "text/markdown; charset=utf-8",
        headers: { link: `<${canonicalBaseUrl}/docs>; rel="canonical"` },
      });
    }
    if (url.pathname === "/robots.txt") {
      const rootMcpAllow = options.robotsOmitRootMcp ? "" : "Allow: /mcp\n";
      return response(
        method,
        `User-agent: *
Allow: /.well-known/agent.json
Allow: /.well-known/api-catalog
Allow: /.well-known/agent-skills/index.json
${rootMcpAllow}Allow: /.well-known/mcp
Sitemap: ${BASE_URL}/sitemap.xml
`,
        { contentType: "text/plain; charset=utf-8" },
      );
    }
    if (url.pathname === "/sitemap.xml") {
      return response(
        method,
        `<?xml version="1.0"?><urlset><url><loc>${BASE_URL}/docs</loc></url></urlset>`,
        { contentType: "application/xml; charset=utf-8" },
      );
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
      "/skill.md": ["text/markdown", docsDocument],
      "/AGENTS.md": ["text/markdown", "# AGENTS.md\n"],
      "/AGENT.md": ["text/markdown", "# AGENT.md\n"],
      "/llms.txt": ["text/plain", "# Documentation\n"],
      "/llms-full.txt": ["text/plain", "# Full documentation\n"],
      "/sitemap.md": ["text/markdown", "# Sitemap\n"],
      "/docs/sitemap.md": ["text/markdown", "# Documentation sitemap\n"],
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
  assert(fixture.calls.some((call) => call.method === "POST" && call.pathname === "/api/docs/mcp"));
  assert(
    fixture.calls.some(
      (call) =>
        call.pathname === "/docs" && call.accept === "text/markdown" && call.method === "GET",
    ),
  );
  assert(
    fixture.calls.some(
      (call) => call.pathname === "/api/docs" && call.search.includes("audience=agent"),
    ),
  );
  assert(fixture.calls.some((call) => call.pathname === "/robots.txt"));
  assert(fixture.calls.some((call) => call.pathname === "/sitemap.xml"));
  assert(fixture.calls.some((call) => call.ifNoneMatch));
});

test("rejects stale typed API catalog Link metadata", async () => {
  const fixture = createFixtureFetch({
    apiCatalogLink: `<${API_CATALOG_ROUTE}>; rel="api-catalog"; type="application/json"`,
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
      const failure = error.failures.find(({ label }) => label === "RFC 9727 API catalog");
      assert.match(failure?.message ?? "", /omitted its typed api-catalog Link relation/u);
      return true;
    },
  );
});

test("rejects a hashed skill artifact with mismatched HEAD cache metadata", async () => {
  const fixture = createFixtureFetch({ docsArtifactHeadCacheMismatch: true });
  await assert.rejects(
    runAgentSurfaceSmoke({
      attempts: 1,
      baseUrl: BASE_URL,
      expectedSkillNames: ["portable"],
      fetchImpl: fixture.fetch,
      log() {},
    }),
    (error) => {
      const failure = error.failures.find(({ label }) => label === "Agent Skill artifact docs");
      assert.match(failure?.message ?? "", /HEAD returned different cache metadata/u);
      return true;
    },
  );
});

test("rejects a hashed skill artifact whose 304 changes ETag strength", async () => {
  const fixture = createFixtureFetch({
    docsArtifactNotModifiedEtag: `"${docsDigest}"`,
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
      const failure = error.failures.find(({ label }) => label === "Agent Skill artifact docs");
      assert.match(failure?.message ?? "", /304 returned a different ETag/u);
      return true;
    },
  );
});

test("rejects a missing advertised canonical MCP endpoint", async () => {
  const fixture = createFixtureFetch({ missingCanonicalMcp: true });
  await assert.rejects(
    runAgentSurfaceSmoke({
      attempts: 1,
      baseUrl: BASE_URL,
      expectedSkillNames: ["portable"],
      fetchImpl: fixture.fetch,
      log() {},
    }),
    (error) => {
      const failure = error.failures.find(
        ({ label }) => label === "advertised canonical MCP endpoint",
      );
      assert.match(failure?.message ?? "", /canonical MCP endpoint was not advertised/u);
      return true;
    },
  );
});

test("rejects explicit Markdown that drifts from content negotiation", async () => {
  const fixture = createFixtureFetch({ explicitMarkdownBody: "# Stale documentation\n" });
  await assert.rejects(
    runAgentSurfaceSmoke({
      attempts: 1,
      baseUrl: BASE_URL,
      expectedSkillNames: ["portable"],
      fetchImpl: fixture.fetch,
      log() {},
    }),
    (error) => {
      const failure = error.failures.find(
        ({ label }) => label === "advertised Markdown negotiation",
      );
      assert.match(failure?.message ?? "", /differed from the negotiated Markdown/u);
      return true;
    },
  );
});

test("accepts a preview whose Markdown links to its advertised production canonical", async () => {
  const fixture = createFixtureFetch({ canonicalBaseUrl: "https://docs.example.com" });
  const result = await runAgentSurfaceSmoke({
    attempts: 1,
    baseUrl: BASE_URL,
    expectedSkillNames: ["portable"],
    fetchImpl: fixture.fetch,
    log() {},
  });
  assert.equal(result.passed, true);
});

test("requires exact robots.txt coverage for both MCP routes", async () => {
  const fixture = createFixtureFetch({ robotsOmitRootMcp: true });
  await assert.rejects(
    runAgentSurfaceSmoke({
      attempts: 1,
      baseUrl: BASE_URL,
      expectedSkillNames: ["portable"],
      fetchImpl: fixture.fetch,
      log() {},
    }),
    (error) => {
      const failure = error.failures.find(({ label }) => label === "advertised robots.txt");
      assert.match(failure?.message ?? "", /did not cover \/mcp/u);
      return true;
    },
  );
});

for (const [name, manifestLink] of [
  [
    "describedby relation on another Link entry",
    `<${AGENT_MANIFEST_SCHEMA}>; rel="alternate"; type="${AGENT_MANIFEST_SCHEMA_MEDIA_TYPE}", <https://example.com/other>; rel="describedby"`,
  ],
  [
    "schema media type on another Link entry",
    `<${AGENT_MANIFEST_SCHEMA}>; rel="describedby", <https://example.com/other>; rel="alternate"; type="${AGENT_MANIFEST_SCHEMA_MEDIA_TYPE}"`,
  ],
]) {
  test(`rejects a manifest with the ${name}`, async () => {
    const fixture = createFixtureFetch({ manifestLink });
    await assert.rejects(
      runAgentSurfaceSmoke({
        attempts: 1,
        baseUrl: BASE_URL,
        expectedSkillNames: ["portable"],
        fetchImpl: fixture.fetch,
        log() {},
      }),
      (error) => {
        const manifestFailures = error.failures.filter(({ label }) =>
          label.startsWith("agent manifest "),
        );
        assert.equal(manifestFailures.length, 3);
        for (const failure of manifestFailures) {
          assert.match(
            failure.message,
            /did not link the manifest schema as rel="describedby" with type="application\/schema\+json"/u,
          );
        }
        return true;
      },
    );
  });
}

test("requests the manifest schema with application/schema+json", async () => {
  const fixture = createFixtureFetch({ strictSchemaNegotiation: true });
  const result = await runAgentSurfaceSmoke({
    attempts: 1,
    baseUrl: BASE_URL,
    expectedSkillNames: ["portable"],
    fetchImpl: fixture.fetch,
    log() {},
  });

  assert.equal(result.passed, true);
  const schemaCall = fixture.calls.find(
    (call) => call.method === "GET" && call.pathname === AGENT_MANIFEST_SCHEMA_ROUTE,
  );
  assert.equal(schemaCall?.accept, AGENT_MANIFEST_SCHEMA_MEDIA_TYPE);
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
