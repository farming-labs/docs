#!/usr/bin/env node

import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BASE_URL = "https://docs.farming-labs.dev";
const AGENT_SKILLS_SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
const API_CATALOG_PROFILE = "https://www.rfc-editor.org/info/rfc9727";
const API_CATALOG_ROUTE = "/.well-known/api-catalog";
const AGENT_SKILLS_INDEX_ROUTE = "/.well-known/agent-skills/index.json";
const LEGACY_SKILLS_INDEX_ROUTE = "/.well-known/skills/index.json";
const AGENT_CARD_ROUTE = "/.well-known/agent-card.json";
const MCP_ROUTES = ["/mcp", "/.well-known/mcp"];
const MCP_PROTOCOL_VERSION = "2025-06-18";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_ATTEMPTS = 3;
const MAX_RESPONSE_BYTES = 20 * 1024 * 1024;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function asRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePositiveInteger(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid smoke-test base URL: ${JSON.stringify(value)}`);
  }
  assert(url.protocol === "http:" || url.protocol === "https:", "Base URL must use HTTP(S)");
  assert(!url.username && !url.password, "Base URL must not contain credentials");
  assert(url.pathname === "/" || url.pathname === "", "Base URL must not contain a path");
  assert(!url.search && !url.hash, "Base URL must not contain a query or fragment");
  return url.origin;
}

function mediaType(response) {
  return (response.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function responsePreview(bytes) {
  return new TextDecoder().decode(bytes.slice(0, 300)).replace(/\s+/g, " ").trim();
}

function formatStatusExpectation(statuses) {
  return statuses.length === 1 ? String(statuses[0]) : statuses.join(" or ");
}

function includesLinkRelation(response, relation) {
  const link = response.headers.get("link") ?? "";
  return new RegExp(
    `(?:^|[,;]\\s*)rel=(?:"[^"]*\\b${relation}\\b[^"]*"|${relation})(?:[,;]|$)`,
    "i",
  ).test(link);
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function validateSafeSkillPath(path) {
  assert(isNonEmptyString(path), "Skill file path was empty");
  assert(!path.startsWith("/"), `Skill file path must be relative: ${JSON.stringify(path)}`);
  assert(
    !path.split("/").some((segment) => !segment || segment === "." || segment === ".."),
    `Skill file path was unsafe: ${JSON.stringify(path)}`,
  );
  assert(
    path === "SKILL.md" || /^(?:references|scripts|assets)\//u.test(path),
    `Skill file path was outside the portable skill surface: ${JSON.stringify(path)}`,
  );
}

function parseExpectedSkillNames(value) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
}

function createRequester({ baseUrl, fetchImpl, timeoutMs, attempts }) {
  return async function request(target, init = {}, expectedStatuses = [200]) {
    const url = new URL(target, `${baseUrl}/`);
    const headers = new Headers(init.headers);
    if (!headers.has("accept")) headers.set("accept", "*/*");
    headers.set("cache-control", "no-cache");
    headers.set("user-agent", "farming-labs-agent-surface-smoke/1.0");

    let response;
    let requestError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      response = undefined;
      try {
        response = await fetchImpl(url, {
          ...init,
          headers,
          redirect: "follow",
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status < 500 || attempt === attempts) break;
        await response.arrayBuffer();
      } catch (error) {
        requestError = error;
        if (attempt === attempts) break;
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
    }

    if (!response) {
      throw new Error(
        `${url} could not be fetched: ${requestError instanceof Error ? requestError.message : String(requestError)}`,
      );
    }

    const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "0", 10);
    assert(
      !Number.isFinite(declaredLength) || declaredLength <= MAX_RESPONSE_BYTES,
      `${url} declared an unexpectedly large ${declaredLength}-byte response`,
    );
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert(
      bytes.byteLength <= MAX_RESPONSE_BYTES,
      `${url} returned more than ${MAX_RESPONSE_BYTES} bytes`,
    );
    if (!expectedStatuses.includes(response.status)) {
      const preview = responsePreview(bytes);
      throw new Error(
        `${url.pathname} expected status ${formatStatusExpectation(expectedStatuses)}, received ${response.status}${preview ? `: ${preview}` : ""}`,
      );
    }
    return { bytes, response, url };
  };
}

async function readJson(request, route, expectedStatuses = [200]) {
  const result = await request(
    route,
    { headers: { accept: "application/json, application/linkset+json" } },
    expectedStatuses,
  );
  const type = mediaType(result.response);
  assert(
    type === "application/json" || type.endsWith("+json"),
    `${result.url.pathname} returned ${type || "no content-type"}, expected JSON`,
  );
  try {
    return { ...result, json: JSON.parse(new TextDecoder().decode(result.bytes)) };
  } catch {
    throw new Error(`${result.url.pathname} did not return valid JSON`);
  }
}

function validateManifest(json, route) {
  const manifest = asRecord(json);
  assert(manifest, `${route} did not return a JSON object`);
  assert(manifest.version === "1", `${route} did not declare agent manifest version 1`);
  assert(isNonEmptyString(manifest.name), `${route} did not declare a name`);

  const capabilities = asRecord(manifest.capabilities);
  const api = asRecord(manifest.api);
  const apiCatalog = asRecord(manifest.apiCatalog);
  const skills = asRecord(manifest.skills);
  const discovery = asRecord(skills?.discovery);
  const mcp = asRecord(manifest.mcp);
  assert(capabilities?.agentSkillsDiscovery === true, `${route} did not enable skill discovery`);
  assert(capabilities?.mcp === true, `${route} did not enable MCP`);
  assert(
    api?.agentSkillsIndex === AGENT_SKILLS_INDEX_ROUTE,
    `${route} advertised the wrong skill index`,
  );
  assert(
    api?.legacySkillsIndex === LEGACY_SKILLS_INDEX_ROUTE,
    `${route} omitted legacy skill discovery`,
  );
  assert(apiCatalog?.enabled === true, `${route} did not enable the RFC 9727 API catalog`);
  assert(
    apiCatalog?.route === API_CATALOG_ROUTE,
    `${route} advertised the wrong API catalog route`,
  );
  assert(
    discovery?.schema === AGENT_SKILLS_SCHEMA,
    `${route} advertised the wrong Agent Skills schema`,
  );
  assert(
    discovery?.index === AGENT_SKILLS_INDEX_ROUTE,
    `${route} advertised the wrong skill index`,
  );
  assert(
    discovery?.legacyIndex === LEGACY_SKILLS_INDEX_ROUTE,
    `${route} omitted the legacy skill index`,
  );
  assert(
    Array.isArray(mcp?.publicEndpoints) &&
      MCP_ROUTES.every((path) => mcp.publicEndpoints.includes(path)),
    `${route} did not advertise both public MCP endpoints`,
  );
  return manifest;
}

async function validateApiCatalog(request) {
  const catalog = await readJson(request, API_CATALOG_ROUTE);
  assert(
    mediaType(catalog.response) === "application/linkset+json",
    `${API_CATALOG_ROUTE} did not return application/linkset+json`,
  );
  assert(
    (catalog.response.headers.get("content-type") ?? "").includes(
      `profile="${API_CATALOG_PROFILE}"`,
    ),
    `${API_CATALOG_ROUTE} did not declare the RFC 9727 profile`,
  );
  assert(
    includesLinkRelation(catalog.response, "api-catalog"),
    `${API_CATALOG_ROUTE} omitted its Link relation`,
  );
  const root = asRecord(catalog.json);
  assert(
    Array.isArray(root?.linkset) && root.linkset.length > 0,
    `${API_CATALOG_ROUTE} had no linkset entries`,
  );
  const serialized = JSON.stringify(catalog.json);
  for (const route of ["/.well-known/agent.json", AGENT_SKILLS_INDEX_ROUTE, "/api/docs"]) {
    assert(serialized.includes(route), `${API_CATALOG_ROUTE} did not advertise ${route}`);
  }

  const head = await request(API_CATALOG_ROUTE, { method: "HEAD" });
  assert(head.bytes.byteLength === 0, `${API_CATALOG_ROUTE} HEAD returned a body`);
  assert(
    mediaType(head.response) === "application/linkset+json",
    `${API_CATALOG_ROUTE} HEAD returned the wrong content-type`,
  );
  assert(
    (head.response.headers.get("content-type") ?? "").includes(`profile="${API_CATALOG_PROFILE}"`),
    `${API_CATALOG_ROUTE} HEAD did not declare the RFC 9727 profile`,
  );
}

function validateModernSkillIndex(json, expectedSkillNames) {
  const root = asRecord(json);
  assert(root?.$schema === AGENT_SKILLS_SCHEMA, "Agent Skills index declared the wrong schema");
  assert(
    Array.isArray(root.skills) && root.skills.length > 0,
    "Agent Skills index did not publish any skills",
  );

  const seen = new Set();
  const skills = root.skills.map((value) => {
    const skill = asRecord(value);
    assert(skill, "Agent Skills index contained a non-object entry");
    assert(
      isNonEmptyString(skill.name) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(skill.name),
      "Agent Skills index contained an invalid name",
    );
    assert(!seen.has(skill.name), `Agent Skills index duplicated ${JSON.stringify(skill.name)}`);
    seen.add(skill.name);
    assert(isNonEmptyString(skill.description), `Agent Skill ${skill.name} had no description`);
    assert(
      skill.type === "skill-md" || skill.type === "archive",
      `Agent Skill ${skill.name} had an invalid type`,
    );
    assert(isNonEmptyString(skill.url), `Agent Skill ${skill.name} had no artifact URL`);
    assert(
      /^sha256:[0-9a-f]{64}$/u.test(skill.digest),
      `Agent Skill ${skill.name} had an invalid digest`,
    );
    return skill;
  });

  for (const name of expectedSkillNames) {
    assert(
      seen.has(name),
      `Agent Skills index did not publish configured skill ${JSON.stringify(name)}`,
    );
  }
  return skills;
}

async function validateModernSkillArtifact(request, baseUrl, skill) {
  const artifactUrl = new URL(skill.url, `${baseUrl}/`);
  assert(
    artifactUrl.origin === baseUrl,
    `Agent Skill ${skill.name} used a cross-origin artifact URL`,
  );
  assert(
    artifactUrl.pathname.startsWith("/.well-known/agent-skills/"),
    `Agent Skill ${skill.name} used an unexpected artifact path`,
  );
  const artifact = await request(artifactUrl);
  const expectedType = skill.type === "archive" ? "application/gzip" : "text/markdown";
  assert(
    mediaType(artifact.response) === expectedType,
    `${skill.url} returned the wrong content-type`,
  );
  assert(
    `sha256:${sha256(artifact.bytes)}` === skill.digest,
    `${skill.url} did not match its published digest`,
  );
  assert(
    includesLinkRelation(artifact.response, "collection"),
    `${skill.url} omitted its collection Link`,
  );

  const head = await request(artifactUrl, { method: "HEAD" });
  assert(head.bytes.byteLength === 0, `${skill.url} HEAD returned a body`);
  assert(
    mediaType(head.response) === expectedType,
    `${skill.url} HEAD returned the wrong content-type`,
  );
  assert(
    head.response.headers.get("etag") === `"${skill.digest.slice("sha256:".length)}"`,
    `${skill.url} HEAD did not expose the indexed digest as its ETag`,
  );
}

function validateManifestPublishedSkills(manifest, modernNames, expectedSkillNames) {
  const skills = asRecord(manifest.skills);
  assert(Array.isArray(skills?.published), "Agent manifest did not include its published skills");
  const files = [];
  for (const value of skills.published) {
    const skill = asRecord(value);
    assert(
      skill && isNonEmptyString(skill.name),
      "Agent manifest contained an invalid published skill",
    );
    assert(
      modernNames.has(skill.name),
      `Agent manifest skill ${skill.name} was absent from the Agent Skills index`,
    );
    assert(
      Array.isArray(skill.files) && skill.files.length > 0,
      `Agent manifest skill ${skill.name} had no files`,
    );
    for (const rawFile of skill.files) {
      const file = asRecord(rawFile);
      assert(
        file && isNonEmptyString(file.path),
        `Agent manifest skill ${skill.name} had an invalid file`,
      );
      validateSafeSkillPath(file.path);
      assert(
        isNonEmptyString(file.url),
        `Agent manifest file ${skill.name}/${file.path} had no URL`,
      );
      assert(
        /^sha256:[0-9a-f]{64}$/u.test(file.digest),
        `Agent manifest file ${skill.name}/${file.path} had an invalid digest`,
      );
      files.push({ ...file, name: skill.name });
    }
  }
  const publishedNames = new Set(skills.published.map((value) => asRecord(value)?.name));
  for (const name of expectedSkillNames) {
    assert(
      publishedNames.has(name),
      `Agent manifest did not publish the configured file map for ${JSON.stringify(name)}`,
    );
  }
  return files;
}

async function validateManifestSkillFile(request, baseUrl, file) {
  const url = new URL(file.url, `${baseUrl}/`);
  assert(
    url.origin === baseUrl,
    `Agent Skill file ${file.name}/${file.path} used a cross-origin URL`,
  );
  assert(
    url.pathname.startsWith(`/.well-known/agent-skills/${encodeURIComponent(file.name)}/`),
    `Agent Skill file ${file.name}/${file.path} used an unexpected URL`,
  );
  const result = await request(url);
  assert(
    `sha256:${sha256(result.bytes)}` === file.digest,
    `Agent Skill file ${file.name}/${file.path} did not match its published digest`,
  );
}

function validateLegacySkillIndex(json, modernNames) {
  const root = asRecord(json);
  assert(
    Array.isArray(root?.skills) && root.skills.length > 0,
    "Legacy skill index did not publish any skills",
  );
  const seen = new Set();
  const files = [];
  for (const value of root.skills) {
    const skill = asRecord(value);
    assert(skill && isNonEmptyString(skill.name), "Legacy skill index contained an invalid skill");
    assert(!seen.has(skill.name), `Legacy skill index duplicated ${JSON.stringify(skill.name)}`);
    seen.add(skill.name);
    assert(
      modernNames.has(skill.name),
      `Legacy skill ${skill.name} was absent from the modern index`,
    );
    assert(
      Array.isArray(skill.files) && skill.files.includes("SKILL.md"),
      `Legacy skill ${skill.name} omitted SKILL.md`,
    );
    for (const path of skill.files) {
      validateSafeSkillPath(path);
      files.push({ name: skill.name, path });
    }
  }
  assert(
    modernNames.size === seen.size && [...modernNames].every((name) => seen.has(name)),
    "Modern and legacy skill indexes did not publish the same skills",
  );
  return files;
}

async function validateLegacySkillFile(request, file, expectedDigests) {
  const route = `/.well-known/skills/${encodeURIComponent(file.name)}/${encodePath(file.path)}`;
  const result = await request(route);
  if (file.path === "SKILL.md") {
    assert(
      mediaType(result.response) === "text/markdown",
      `${route} returned the wrong content-type`,
    );
  }
  const expectedDigest = expectedDigests.get(`${file.name}/${file.path}`);
  if (expectedDigest) {
    assert(
      `sha256:${sha256(result.bytes)}` === expectedDigest,
      `${route} did not match the modern skill file`,
    );
  }
}

function parseMcpResponse(response, bytes) {
  const text = new TextDecoder().decode(bytes);
  if (mediaType(response) === "application/json") {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("MCP initialize response did not contain valid JSON");
    }
  }

  assert(
    mediaType(response) === "text/event-stream",
    "MCP initialize returned an unsupported content-type",
  );
  for (const event of text.split(/\r?\n\r?\n/u)) {
    const data = event
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trimStart())
      .join("\n");
    if (!data) continue;
    try {
      const parsed = JSON.parse(data);
      if (asRecord(parsed)?.id === 1) return parsed;
    } catch {
      // Ignore keepalives or non-JSON events while looking for the initialize response.
    }
  }
  throw new Error("MCP event stream did not contain the initialize response");
}

async function validateMcp(request, route) {
  const result = await request(route, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_PROTOCOL_VERSION,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "agent-surface-smoke", version: "1.0.0" },
      },
    }),
  });
  const payload = asRecord(parseMcpResponse(result.response, result.bytes));
  assert(
    payload?.jsonrpc === "2.0" && payload.id === 1,
    `${route} returned an invalid JSON-RPC response`,
  );
  assert(!payload.error, `${route} rejected MCP initialize: ${JSON.stringify(payload.error)}`);
  const initialized = asRecord(payload.result);
  assert(asRecord(initialized?.serverInfo), `${route} initialize response omitted serverInfo`);
  assert(
    isNonEmptyString(initialized?.protocolVersion),
    `${route} initialize response omitted protocolVersion`,
  );
}

async function validateWellKnownText(request, route, expectedType, requiredText) {
  const result = await request(route);
  assert(mediaType(result.response) === expectedType, `${route} returned the wrong content-type`);
  const text = new TextDecoder().decode(result.bytes);
  assert(text.trim().length > 0, `${route} returned an empty document`);
  if (requiredText)
    assert(text.includes(requiredText), `${route} did not include ${JSON.stringify(requiredText)}`);
}

function createRecorder(log) {
  const failures = [];
  let passed = 0;
  return {
    failures,
    get passed() {
      return passed;
    },
    async check(label, callback) {
      try {
        const result = await callback();
        passed += 1;
        log(`✓ ${label}`);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push({ label, message });
        log(`✗ ${label}: ${message}`);
        return undefined;
      }
    },
  };
}

export async function runAgentSurfaceSmoke(options = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const expectedSkillNames = new Set(options.expectedSkillNames ?? []);
  const log = options.log ?? console.log;
  const request = createRequester({
    baseUrl,
    fetchImpl: options.fetchImpl ?? globalThis.fetch,
    timeoutMs,
    attempts,
  });
  const recorder = createRecorder(log);

  log(`Agent surface smoke test: ${baseUrl}`);

  const manifest = await recorder.check("agent manifest /.well-known/agent.json", async () => {
    const result = await readJson(request, "/.well-known/agent.json");
    return validateManifest(result.json, "/.well-known/agent.json");
  });
  await Promise.all([
    recorder.check("agent manifest /.well-known/agent", async () => {
      const result = await readJson(request, "/.well-known/agent");
      validateManifest(result.json, "/.well-known/agent");
    }),
    recorder.check("agent manifest /api/docs/agent/spec", async () => {
      const result = await readJson(request, "/api/docs/agent/spec");
      validateManifest(result.json, "/api/docs/agent/spec");
    }),
    recorder.check("RFC 9727 API catalog", () => validateApiCatalog(request)),
  ]);

  const modernIndex = await recorder.check("Agent Skills v0.2 index", async () => {
    const result = await readJson(request, AGENT_SKILLS_INDEX_ROUTE);
    const head = await request(AGENT_SKILLS_INDEX_ROUTE, { method: "HEAD" });
    assert(head.bytes.byteLength === 0, `${AGENT_SKILLS_INDEX_ROUTE} HEAD returned a body`);
    return validateModernSkillIndex(result.json, expectedSkillNames);
  });
  const modernNames = new Set((modernIndex ?? []).map((skill) => skill.name));
  const expectedFileDigests = new Map(
    (modernIndex ?? [])
      .filter((skill) => skill.type === "skill-md")
      .map((skill) => [`${skill.name}/SKILL.md`, skill.digest]),
  );

  if (modernIndex) {
    await Promise.all(
      modernIndex.map((skill) =>
        recorder.check(`Agent Skill artifact ${skill.name}`, () =>
          validateModernSkillArtifact(request, baseUrl, skill),
        ),
      ),
    );
  }

  let manifestFiles = [];
  if (manifest && modernIndex) {
    const files = await recorder.check("agent manifest published-skill file map", async () =>
      validateManifestPublishedSkills(manifest, modernNames, expectedSkillNames),
    );
    manifestFiles = files ?? [];
    for (const file of manifestFiles) {
      expectedFileDigests.set(`${file.name}/${file.path}`, file.digest);
    }
    await Promise.all(
      manifestFiles.map((file) =>
        recorder.check(`Agent Skill file ${file.name}/${file.path}`, () =>
          validateManifestSkillFile(request, baseUrl, file),
        ),
      ),
    );
  }

  const legacyFiles = await recorder.check("legacy Agent Skills index", async () => {
    const result = await readJson(request, LEGACY_SKILLS_INDEX_ROUTE);
    const head = await request(LEGACY_SKILLS_INDEX_ROUTE, { method: "HEAD" });
    assert(head.bytes.byteLength === 0, `${LEGACY_SKILLS_INDEX_ROUTE} HEAD returned a body`);
    return validateLegacySkillIndex(result.json, modernNames);
  });
  if (legacyFiles) {
    await Promise.all(
      legacyFiles.map((file) =>
        recorder.check(`legacy Agent Skill file ${file.name}/${file.path}`, () =>
          validateLegacySkillFile(request, file, expectedFileDigests),
        ),
      ),
    );
  }

  await recorder.check("optional A2A agent card", async () => {
    const advertised = isNonEmptyString(asRecord(manifest?.api)?.agentCard);
    const result = advertised
      ? await readJson(request, AGENT_CARD_ROUTE)
      : await request(AGENT_CARD_ROUTE, {}, [404]);
    if (advertised) {
      const card = asRecord(result.json);
      assert(
        card && isNonEmptyString(card.name),
        `${AGENT_CARD_ROUTE} returned an invalid A2A card`,
      );
    }
  });

  await Promise.all(
    MCP_ROUTES.map((route) =>
      recorder.check(`MCP initialize ${route}`, () => validateMcp(request, route)),
    ),
  );

  await Promise.all([
    recorder.check("well-known site skill", () =>
      validateWellKnownText(request, "/.well-known/skill.md", "text/markdown", "name:"),
    ),
    recorder.check("well-known AGENTS.md", () =>
      validateWellKnownText(request, "/.well-known/AGENTS.md", "text/markdown"),
    ),
    recorder.check("well-known AGENT.md", () =>
      validateWellKnownText(request, "/.well-known/AGENT.md", "text/markdown"),
    ),
    recorder.check("well-known llms.txt", () =>
      validateWellKnownText(request, "/.well-known/llms.txt", "text/plain"),
    ),
    recorder.check("well-known llms-full.txt", () =>
      validateWellKnownText(request, "/.well-known/llms-full.txt", "text/plain"),
    ),
    recorder.check("well-known Markdown sitemap", () =>
      validateWellKnownText(request, "/.well-known/sitemap.md", "text/markdown"),
    ),
  ]);

  if (recorder.failures.length > 0) {
    const error = new Error(
      `${recorder.failures.length} agent surface smoke check${recorder.failures.length === 1 ? "" : "s"} failed`,
    );
    error.failures = recorder.failures;
    throw error;
  }

  log(`Passed ${recorder.passed} agent surface smoke checks.`);
  return { baseUrl, checks: recorder.passed, passed: true };
}

async function main() {
  const baseUrl = process.argv[2] || process.env.DOCS_SMOKE_BASE_URL || DEFAULT_BASE_URL;
  const expectedSkillNames = parseExpectedSkillNames(process.env.DOCS_SMOKE_EXPECT_SKILLS);
  try {
    await runAgentSurfaceSmoke({
      baseUrl,
      expectedSkillNames,
      timeoutMs: parsePositiveInteger(process.env.DOCS_SMOKE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
      attempts: parsePositiveInteger(process.env.DOCS_SMOKE_ATTEMPTS, DEFAULT_ATTEMPTS),
    });
  } catch (error) {
    console.error(
      `Agent surface smoke test failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isDirectExecution) await main();
