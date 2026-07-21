import {
  DEFAULT_AGENT_FEEDBACK_ROUTE,
  DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
  DEFAULT_AGENTS_MD_ROUTE,
  DEFAULT_DOCS_CONFIG_ROUTE,
  DEFAULT_DOCS_DIAGNOSTICS_ROUTE,
  DEFAULT_LLMS_FULL_TXT_ROUTE,
  DEFAULT_LLMS_TXT_ROUTE,
  DEFAULT_MCP_WELL_KNOWN_ROUTE,
  DEFAULT_SKILL_MD_ROUTE,
} from "./agent.js";
import { DEFAULT_SITEMAP_MD_ROUTE, DEFAULT_SITEMAP_XML_ROUTE } from "./sitemap.js";
import { DEFAULT_ROBOTS_TXT_ROUTE } from "./robots.js";

export const DOCS_AGENT_CONTRACT_VERSION = "1.0";

export type DocsAgentAdapter =
  | "next"
  | "tanstack-start"
  | "farmjs"
  | "sveltekit"
  | "astro"
  | "nuxt";

export type DocsAgentContractSurface =
  | "discovery"
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
      expect: { statuses: [200], contentTypes: json },
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
    cases.splice(6, 0, {
      surface: "markdown-locale",
      request: { url: url(`/${entry}.md?lang=${encodeURIComponent(locale)}`) },
      expect: { statuses: [200], contentTypes: markdown, bodyIncludes: ["Bonjour"] },
    });
  }

  return cases;
}

function matchesContentType(actual: string, expected: readonly string[]): boolean {
  const [mediaType] = actual.split(";", 1);
  const normalized = mediaType?.trim().toLowerCase();

  if (!normalized) return false;

  return expected.some((value) => normalized === value.trim().toLowerCase());
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
