import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { runAgentSurfaceSmoke } from "./smoke-agent-surfaces.mjs";

const BASE_URL = "https://deployment.example.com";
const AGENT_SKILLS_SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
const API_CATALOG_PROFILE = "https://www.rfc-editor.org/info/rfc9727";
const API_CATALOG_ROUTE = "/.well-known/api-catalog";
const AGENT_SKILLS_INDEX_ROUTE = "/.well-known/agent-skills/index.json";
const LEGACY_SKILLS_INDEX_ROUTE = "/.well-known/skills/index.json";

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
      return jsonResponse(method, manifest);
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
    if (url.pathname === "/.well-known/agent-card.json") {
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
