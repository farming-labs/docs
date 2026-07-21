import {
  AGENT_SKILLS_DISCOVERY_SCHEMA_URI,
  API_CATALOG_MEDIA_TYPE,
  API_CATALOG_PROFILE_URI,
  DEFAULT_AGENT_FEEDBACK_ROUTE,
  DEFAULT_AGENT_SKILLS_INDEX_ROUTE,
  DEFAULT_AGENT_SKILLS_ROUTE_PREFIX,
  DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
  DEFAULT_AGENTS_MD_ROUTE,
  DEFAULT_API_CATALOG_ROUTE,
  DEFAULT_DOCS_CONFIG_ROUTE,
  DEFAULT_DOCS_DIAGNOSTICS_ROUTE,
  DEFAULT_LLMS_FULL_TXT_ROUTE,
  DEFAULT_LLMS_TXT_ROUTE,
  DEFAULT_MCP_WELL_KNOWN_ROUTE,
  DEFAULT_SKILL_MD_ROUTE,
} from "./agent.js";
import {
  httpLinkMatchesExpectation,
  parseHttpLinkHeader,
  splitHttpList,
  unquoteHttpValue,
} from "./http-link.js";
import { DEFAULT_SITEMAP_MD_ROUTE, DEFAULT_SITEMAP_XML_ROUTE } from "./sitemap.js";
import { DEFAULT_ROBOTS_TXT_ROUTE } from "./robots.js";

export const DOCS_AGENT_CONTRACT_VERSION = "1.1";

export type DocsAgentAdapter = "next" | "tanstack-start" | "sveltekit" | "astro" | "nuxt";

export type DocsAgentContractSurface =
  | "discovery"
  | "api-catalog"
  | "api-catalog-head"
  | "agent-skills-index"
  | "agent-skills-index-head"
  | "agent-skill"
  | "agent-skill-head"
  | "config"
  | "diagnostics"
  | "feedback-schema"
  | "markdown"
  | "markdown-accept"
  | "markdown-locale"
  | "markdown-missing"
  | "llms"
  | "llms-full"
  | "agents"
  | "skill"
  | "sitemap-xml"
  | "sitemap-markdown"
  | "robots"
  | "mcp";

export interface DocsAgentContractRequest {
  url: string;
  init?: RequestInit;
}

export interface DocsAgentContractExpectation {
  statuses: readonly number[];
  contentTypes: readonly string[];
  bodyIncludes?: readonly string[];
  bodyEmpty?: boolean;
  headerIncludes?: Readonly<Record<string, readonly string[]>>;
  linkRelations?: readonly { href: string; rel: string }[];
}

export interface DocsAgentContractCase {
  surface: DocsAgentContractSurface;
  request: DocsAgentContractRequest;
  expect: DocsAgentContractExpectation;
}

export interface DocsAgentConformanceCaseResult {
  surface: DocsAgentContractSurface;
  passed: boolean;
  status?: number;
  contentType?: string;
  issues: string[];
}

export interface DocsAgentConformanceReport {
  adapter: DocsAgentAdapter;
  contractVersion: typeof DOCS_AGENT_CONTRACT_VERSION;
  passed: boolean;
  cases: DocsAgentConformanceCaseResult[];
}

export interface RunDocsAgentConformanceOptions {
  adapter: DocsAgentAdapter;
  /** Origin used to construct requests. Defaults to http://localhost. */
  origin?: string;
  /** Public docs entry. Defaults to docs. */
  entry?: string;
  /** Locale fixture expected to render the word "Bonjour". Set false to skip. */
  locale?: string | false;
  handle(request: Request, surface: DocsAgentContractSurface): Response | Promise<Response>;
}

function normalizeOrigin(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeEntry(value: string): string {
  return value.replace(/^\/+|\/+$/g, "") || "docs";
}

/**
 * The framework-neutral public surface every first-party adapter must implement.
 * Adapter tests consume this list so new routes and invariants are added once.
 */
export function createDocsAgentContractCases(
  options: {
    origin?: string;
    entry?: string;
    locale?: string | false;
  } = {},
): DocsAgentContractCase[] {
  const origin = normalizeOrigin(options.origin ?? "http://localhost");
  const entry = normalizeEntry(options.entry ?? "docs");
  const locale = options.locale === undefined ? "fr" : options.locale;
  const url = (route: string) => `${origin}${route.startsWith("/") ? route : `/${route}`}`;
  const markdown = ["text/markdown"] as const;
  const json = ["application/json"] as const;

  const cases: DocsAgentContractCase[] = [
    {
      surface: "discovery",
      request: { url: url(DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE) },
      expect: {
        statuses: [200],
        contentTypes: json,
        linkRelations: [
          { href: DEFAULT_API_CATALOG_ROUTE, rel: "api-catalog" },
          { href: DEFAULT_AGENT_SKILLS_INDEX_ROUTE, rel: "service-meta" },
        ],
      },
    },
    {
      surface: "api-catalog",
      request: { url: url(DEFAULT_API_CATALOG_ROUTE) },
      expect: {
        statuses: [200],
        contentTypes: [`${API_CATALOG_MEDIA_TYPE}; profile="${API_CATALOG_PROFILE_URI}"`],
        bodyIncludes: [
          "linkset",
          DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
          DEFAULT_AGENT_SKILLS_INDEX_ROUTE,
        ],
        linkRelations: [{ href: DEFAULT_API_CATALOG_ROUTE, rel: "api-catalog" }],
      },
    },
    {
      surface: "api-catalog-head",
      request: { url: url(DEFAULT_API_CATALOG_ROUTE), init: { method: "HEAD" } },
      expect: {
        statuses: [200],
        contentTypes: [`${API_CATALOG_MEDIA_TYPE}; profile="${API_CATALOG_PROFILE_URI}"`],
        bodyEmpty: true,
        linkRelations: [{ href: DEFAULT_API_CATALOG_ROUTE, rel: "api-catalog" }],
      },
    },
    {
      surface: "agent-skills-index",
      request: { url: url(DEFAULT_AGENT_SKILLS_INDEX_ROUTE) },
      expect: {
        statuses: [200],
        contentTypes: json,
        bodyIncludes: [
          "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
          `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/docs/SKILL.md`,
          "sha256:",
        ],
        linkRelations: [
          {
            href: `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/docs/SKILL.md`,
            rel: "item",
          },
          { href: DEFAULT_API_CATALOG_ROUTE, rel: "api-catalog" },
        ],
      },
    },
    {
      surface: "agent-skills-index-head",
      request: { url: url(DEFAULT_AGENT_SKILLS_INDEX_ROUTE), init: { method: "HEAD" } },
      expect: {
        statuses: [200],
        contentTypes: json,
        bodyEmpty: true,
        linkRelations: [{ href: DEFAULT_API_CATALOG_ROUTE, rel: "api-catalog" }],
      },
    },
    {
      surface: "agent-skill",
      request: { url: url(`${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/docs/SKILL.md`) },
      expect: {
        statuses: [200],
        contentTypes: markdown,
        bodyIncludes: ["name: docs"],
        linkRelations: [
          { href: DEFAULT_AGENT_SKILLS_INDEX_ROUTE, rel: "collection" },
          { href: DEFAULT_API_CATALOG_ROUTE, rel: "api-catalog" },
        ],
      },
    },
    {
      surface: "agent-skill-head",
      request: {
        url: url(`${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/docs/SKILL.md`),
        init: { method: "HEAD" },
      },
      expect: {
        statuses: [200],
        contentTypes: markdown,
        bodyEmpty: true,
        linkRelations: [
          { href: DEFAULT_AGENT_SKILLS_INDEX_ROUTE, rel: "collection" },
          { href: DEFAULT_API_CATALOG_ROUTE, rel: "api-catalog" },
        ],
      },
    },
    {
      surface: "config",
      request: { url: url(DEFAULT_DOCS_CONFIG_ROUTE) },
      expect: { statuses: [200], contentTypes: json, bodyIncludes: ["docs-config-map.v1"] },
    },
    {
      surface: "diagnostics",
      request: { url: url(DEFAULT_DOCS_DIAGNOSTICS_ROUTE) },
      expect: { statuses: [200], contentTypes: json, bodyIncludes: ["docs-diagnostics.v1"] },
    },
    {
      surface: "feedback-schema",
      request: { url: url(`${DEFAULT_AGENT_FEEDBACK_ROUTE}/schema`) },
      expect: { statuses: [200], contentTypes: ["application/schema+json"] },
    },
    {
      surface: "markdown",
      request: { url: url(`/${entry}.md`) },
      expect: { statuses: [200], contentTypes: markdown, bodyIncludes: ["Introduction"] },
    },
    {
      surface: "markdown-accept",
      request: {
        url: url(`/${entry}`),
        init: { headers: { Accept: "text/markdown" } },
      },
      expect: { statuses: [200], contentTypes: markdown, bodyIncludes: ["Introduction"] },
    },
    {
      surface: "markdown-missing",
      request: { url: url(`/${entry}/missing.md`) },
      // 200 is the legacy recovery-document behavior. The HTTP semantics contract may move it to
      // 404 without making the recovery body disappear.
      expect: { statuses: [200, 404], contentTypes: markdown, bodyIncludes: ["not found"] },
    },
    {
      surface: "llms",
      request: { url: url(DEFAULT_LLMS_TXT_ROUTE) },
      expect: { statuses: [200], contentTypes: ["text/plain"], bodyIncludes: ["Introduction"] },
    },
    {
      surface: "llms-full",
      request: { url: url(DEFAULT_LLMS_FULL_TXT_ROUTE) },
      expect: { statuses: [200], contentTypes: ["text/plain"], bodyIncludes: ["Introduction"] },
    },
    {
      surface: "agents",
      request: { url: url(DEFAULT_AGENTS_MD_ROUTE) },
      expect: { statuses: [200], contentTypes: markdown, bodyIncludes: ["AGENTS.md"] },
    },
    {
      surface: "skill",
      request: { url: url(DEFAULT_SKILL_MD_ROUTE) },
      expect: { statuses: [200], contentTypes: markdown, bodyIncludes: ["name:"] },
    },
    {
      surface: "sitemap-xml",
      request: { url: url(DEFAULT_SITEMAP_XML_ROUTE) },
      expect: {
        statuses: [200],
        contentTypes: ["application/xml", "text/xml"],
        bodyIncludes: ["<urlset"],
      },
    },
    {
      surface: "sitemap-markdown",
      request: { url: url(DEFAULT_SITEMAP_MD_ROUTE) },
      expect: { statuses: [200], contentTypes: markdown, bodyIncludes: ["Introduction"] },
    },
    {
      surface: "robots",
      request: { url: url(DEFAULT_ROBOTS_TXT_ROUTE) },
      expect: { statuses: [200], contentTypes: ["text/plain"], bodyIncludes: ["User-agent:"] },
    },
    {
      surface: "mcp",
      request: {
        url: url(DEFAULT_MCP_WELL_KNOWN_ROUTE),
        init: {
          method: "POST",
          headers: {
            Accept: "application/json, text/event-stream",
            "Content-Type": "application/json",
            "MCP-Protocol-Version": "2025-11-25",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "initialize",
            params: {
              protocolVersion: "2025-11-25",
              capabilities: {},
              clientInfo: { name: "agent-conformance", version: DOCS_AGENT_CONTRACT_VERSION },
            },
          }),
        },
      },
      expect: {
        statuses: [200],
        contentTypes: ["application/json", "text/event-stream"],
        bodyIncludes: ["serverInfo", "protocolVersion"],
      },
    },
  ];

  if (locale) {
    const markdownMissingIndex = cases.findIndex(
      (contractCase) => contractCase.surface === "markdown-missing",
    );
    cases.splice(markdownMissingIndex, 0, {
      surface: "markdown-locale",
      request: { url: url(`/${entry}.md?lang=${encodeURIComponent(locale)}`) },
      expect: { statuses: [200], contentTypes: markdown, bodyIncludes: ["Bonjour"] },
    });
  }

  return cases;
}

function parseParameterizedValue(value: string): {
  value: string;
  parameters: ReadonlyMap<string, string>;
} | null {
  const [rawValue, ...rawParameters] = splitHttpList(value, ";");
  const normalizedValue = rawValue?.trim().toLowerCase();
  if (!normalizedValue) return null;

  const parameters = new Map<string, string>();
  for (const rawParameter of rawParameters) {
    const separator = rawParameter.indexOf("=");
    if (separator < 0) continue;
    const name = rawParameter.slice(0, separator).trim().toLowerCase();
    if (!name) continue;
    parameters.set(name, unquoteHttpValue(rawParameter.slice(separator + 1)));
  }
  return { value: normalizedValue, parameters };
}

function matchesContentType(actual: string, expected: readonly string[]): boolean {
  const parsedActual = parseParameterizedValue(actual);
  if (!parsedActual) return false;

  return expected.some((value) => {
    const parsedExpected = parseParameterizedValue(value);
    if (!parsedExpected || parsedExpected.value !== parsedActual.value) return false;
    return [...parsedExpected.parameters].every(
      ([name, expectedValue]) => parsedActual.parameters.get(name) === expectedValue,
    );
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function sha256Utf8(content: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(content),
  );
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function validateAgentSkillsIndex(
  content: string,
  indexUrl: string,
  handle: RunDocsAgentConformanceOptions["handle"],
): Promise<string[]> {
  const issues: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return ["Agent Skills index did not contain valid JSON"];
  }

  const root = asRecord(parsed);
  if (root?.$schema !== AGENT_SKILLS_DISCOVERY_SCHEMA_URI) {
    issues.push(`Agent Skills index did not declare ${AGENT_SKILLS_DISCOVERY_SCHEMA_URI}`);
  }
  if (!Array.isArray(root?.skills) || root.skills.length === 0) {
    issues.push("Agent Skills index did not declare any skills");
    return issues;
  }
  const seenNames = new Set<string>();
  const origin = new URL(indexUrl).origin;
  for (const rawSkill of root.skills) {
    const skill = asRecord(rawSkill);
    const name = skill?.name;
    const description = skill?.description;
    const artifactRoute = skill?.url;
    const digest = skill?.digest;
    if (
      !isNonEmptyString(name) ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name) ||
      name.length > 64 ||
      skill?.type !== "skill-md" ||
      !isNonEmptyString(description) ||
      description.length > 1024 ||
      !isNonEmptyString(artifactRoute) ||
      typeof digest !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(digest)
    ) {
      issues.push("Agent Skills index contained an invalid skill entry");
      continue;
    }
    if (seenNames.has(name)) {
      issues.push(`Agent Skills index declared duplicate skill ${JSON.stringify(name)}`);
      continue;
    }
    seenNames.add(name);

    let artifactUrl: URL;
    try {
      artifactUrl = new URL(artifactRoute, indexUrl);
    } catch {
      issues.push(`Agent Skills artifact URL for ${JSON.stringify(name)} was invalid`);
      continue;
    }
    const expectedPath = `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/${name}/SKILL.md`;
    if (artifactUrl.origin !== origin || !artifactUrl.pathname.endsWith(expectedPath)) {
      issues.push(
        `Agent Skills artifact URL for ${JSON.stringify(name)} did not resolve to same-origin ${expectedPath}`,
      );
      continue;
    }

    try {
      const response = await handle(new Request(artifactUrl), "agent-skill");
      const artifact = await response.text();
      if (response.status !== 200) {
        issues.push(
          `Agent Skills artifact ${JSON.stringify(artifactRoute)} returned status ${response.status}`,
        );
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!matchesContentType(contentType, ["text/markdown"])) {
        issues.push(
          `Agent Skills artifact ${JSON.stringify(artifactRoute)} returned content-type ${contentType || "<missing>"}`,
        );
      }
      const actualDigest = `sha256:${await sha256Utf8(artifact)}`;
      if (actualDigest !== digest) {
        issues.push(
          `Agent Skills artifact ${JSON.stringify(artifactRoute)} digest ${actualDigest} did not match ${digest}`,
        );
      }
    } catch (error) {
      issues.push(
        `Agent Skills artifact ${JSON.stringify(artifactRoute)} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return issues;
}

export async function runDocsAgentConformance(
  options: RunDocsAgentConformanceOptions,
): Promise<DocsAgentConformanceReport> {
  const cases = createDocsAgentContractCases(options);
  const results: DocsAgentConformanceCaseResult[] = [];

  for (const contractCase of cases) {
    const issues: string[] = [];

    try {
      const response = await options.handle(
        new Request(contractCase.request.url, contractCase.request.init),
        contractCase.surface,
      );
      const contentType = response.headers.get("content-type") ?? "";
      const body = await response.text();

      if (!contractCase.expect.statuses.includes(response.status)) {
        issues.push(
          `expected status ${contractCase.expect.statuses.join(" or ")}, received ${response.status}`,
        );
      }

      if (!matchesContentType(contentType, contractCase.expect.contentTypes)) {
        issues.push(
          `expected content-type ${contractCase.expect.contentTypes.join(" or ")}, received ${contentType || "<missing>"}`,
        );
      }

      for (const requiredText of contractCase.expect.bodyIncludes ?? []) {
        if (!body.toLowerCase().includes(requiredText.toLowerCase())) {
          issues.push(`response body did not include ${JSON.stringify(requiredText)}`);
        }
      }

      if (contractCase.expect.bodyEmpty && body !== "") {
        issues.push(`expected an empty response body, received ${body.length} characters`);
      }

      if (contractCase.surface === "agent-skills-index") {
        issues.push(
          ...(await validateAgentSkillsIndex(body, contractCase.request.url, options.handle)),
        );
      }

      for (const [header, requiredValues] of Object.entries(
        contractCase.expect.headerIncludes ?? {},
      )) {
        const actual = response.headers.get(header) ?? "";
        for (const requiredValue of requiredValues) {
          if (!actual.toLowerCase().includes(requiredValue.toLowerCase())) {
            issues.push(
              `response header ${JSON.stringify(header)} did not include ${JSON.stringify(requiredValue)}`,
            );
          }
        }
      }

      const parsedLinks = parseHttpLinkHeader(response.headers.get("link"));
      for (const expectation of contractCase.expect.linkRelations ?? []) {
        if (!httpLinkMatchesExpectation(parsedLinks, expectation, contractCase.request.url)) {
          issues.push(
            `response Link header did not include ${JSON.stringify(expectation.href)} with rel=${JSON.stringify(expectation.rel)} in the same link-value`,
          );
        }
      }

      results.push({
        surface: contractCase.surface,
        passed: issues.length === 0,
        status: response.status,
        contentType,
        issues,
      });
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
      results.push({ surface: contractCase.surface, passed: false, issues });
    }
  }

  return {
    adapter: options.adapter,
    contractVersion: DOCS_AGENT_CONTRACT_VERSION,
    passed: results.every((result) => result.passed),
    cases: results,
  };
}
