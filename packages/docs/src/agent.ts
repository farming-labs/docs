import type {
  DocsConfig,
  DocsRobotsConfig,
  DocsAgentFeedbackContext,
  DocsAgentFeedbackData,
  DocsSearchConfig,
  DocsSearchSourcePage,
  FeedbackConfig,
  LlmsTxtConfig,
  LlmsTxtMaxCharsConfig,
  LlmsTxtMaxCharsMode,
  LlmsTxtSectionConfig,
  ResolvedDocsRelatedLink,
} from "./types.js";
import type { ResolvedDocsI18n } from "./i18n.js";
import type { DocsMcpPage, DocsMcpResolvedConfig } from "./mcp.js";
import { renderDocsRelatedMarkdownLines } from "./related.js";
import {
  DEFAULT_SITEMAP_MD_DOCS_ROUTE,
  DEFAULT_SITEMAP_MD_ROUTE,
  DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE,
  DEFAULT_SITEMAP_XML_ROUTE,
  resolveDocsSitemapConfig,
  resolveDocsSitemapRequest,
} from "./sitemap.js";
import type { DocsSitemapConfig } from "./types.js";

export const DEFAULT_DOCS_API_ROUTE = "/api/docs";
export const DEFAULT_DOCS_CONFIG_FORMAT = "docs-config-map.v1";
export const DEFAULT_DOCS_CONFIG_ROUTE = `${DEFAULT_DOCS_API_ROUTE}?format=config`;
export const DEFAULT_DOCS_DIAGNOSTICS_FORMAT = "docs-diagnostics.v1";
export const DEFAULT_DOCS_DIAGNOSTICS_ROUTE = `${DEFAULT_DOCS_API_ROUTE}?format=diagnostics`;
export const DEFAULT_OPENAPI_SCHEMA_ROUTE = `${DEFAULT_DOCS_API_ROUTE}?format=openapi`;
export const DEFAULT_AGENT_SPEC_ROUTE = "/api/docs/agent/spec";
export const DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE = "/.well-known/agent";
export const DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE = "/.well-known/agent.json";
export const DEFAULT_MCP_ROUTE = "/api/docs/mcp";
export const DEFAULT_MCP_PUBLIC_ROUTE = "/mcp";
export const DEFAULT_MCP_WELL_KNOWN_ROUTE = "/.well-known/mcp";
export const DEFAULT_LLMS_TXT_ROUTE = "/llms.txt";
export const DEFAULT_LLMS_FULL_TXT_ROUTE = "/llms-full.txt";
export const DEFAULT_LLMS_TXT_WELL_KNOWN_ROUTE = "/.well-known/llms.txt";
export const DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE = "/.well-known/llms-full.txt";
export const DEFAULT_LLMS_TXT_MAX_CHARS = 50_000;
export const DEFAULT_SKILL_MD_ROUTE = "/skill.md";
export const DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE = "/.well-known/skill.md";
export const DEFAULT_AGENTS_MD_ROUTE = "/AGENTS.md";
export const DEFAULT_AGENTS_MD_WELL_KNOWN_ROUTE = "/.well-known/AGENTS.md";
export const DEFAULT_AGENT_MD_ROUTE = "/AGENT.md";
export const DEFAULT_AGENT_MD_WELL_KNOWN_ROUTE = "/.well-known/AGENT.md";
const DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE = "/robots.txt";
export const DEFAULT_AGENT_FEEDBACK_ROUTE = "/api/docs/agent/feedback";
export const DEFAULT_AGENT_FEEDBACK_PAYLOAD_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    task: {
      type: "string",
      description: "Short description of what the agent was trying to do.",
    },
    understanding: {
      type: "string",
      description: 'How well the docs supported the task, e.g. "partial" or "clear".',
    },
    outcome: {
      type: "string",
      description: 'What happened after reading the docs, e.g. "implemented" or "blocked".',
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Confidence score from 0 to 1.",
    },
    neededCodeReading: {
      type: "boolean",
      description: "Whether the agent still needed to inspect repository code.",
    },
    missingContext: {
      type: "array",
      items: { type: "string" },
      description: "Important details the docs did not provide clearly enough.",
    },
    docIssues: {
      type: "array",
      items: { type: "string" },
      description: "Specific documentation problems encountered during the task.",
    },
    suggestedImprovement: {
      type: "string",
      description: "Concrete suggestion for improving the docs page or examples.",
    },
  },
  required: ["task", "outcome"],
};
const DEFAULT_DOCS_DIAGNOSTICS_MCP_TOOLS = {
  listDocs: true,
  listPages: true,
  readPage: true,
  searchDocs: true,
  getNavigation: true,
  getCodeExamples: true,
  getConfigSchema: true,
  getContext: true,
} satisfies DocsMcpResolvedConfig["tools"];
export const DOCS_MARKDOWN_SIGNATURE_AGENT_HEADER = "Signature-Agent";
const DOCS_AI_AGENT_USER_AGENT_PATTERNS = [
  "claudebot",
  "claude-searchbot",
  "claude-user",
  "anthropic-ai",
  "claude-web",
  "chatgpt",
  "gptbot",
  "oai-searchbot",
  "openai",
  "gemini",
  "bard",
  "google-cloudvertexbot",
  "google-extended",
  "meta-externalagent",
  "meta-externalfetcher",
  "meta-webindexer",
  "perplexity",
  "youbot",
  "you.com",
  "deepseekbot",
  "cursor",
  "github-copilot",
  "codeium",
  "tabnine",
  "sourcegraph",
  "cohere-ai",
  "bytespider",
  "amazonbot",
  "ai2bot",
  "diffbot",
  "omgili",
  "omgilibot",
] as const;
const DOCS_TRADITIONAL_BOT_USER_AGENT_PATTERNS = [
  "googlebot",
  "bingbot",
  "yandexbot",
  "baiduspider",
  "duckduckbot",
  "slurp",
  "msnbot",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "pingdom",
  "uptimerobot",
  "newrelic",
  "datadog",
  "statuspage",
  "site24x7",
  "applebot",
] as const;
const DOCS_BOT_LIKE_USER_AGENT_PATTERN = /bot|agent|fetch|crawl|spider|search/i;
const DOCS_BOT_LIKE_USER_AGENT_TERMS = ["bot", "agent", "fetch", "crawl", "spider", "search"];
export const DOCS_AI_AGENT_USER_AGENT_HEADER_PATTERN = buildDocsUserAgentHeaderPattern(
  DOCS_AI_AGENT_USER_AGENT_PATTERNS,
);
export const DOCS_TRADITIONAL_BOT_USER_AGENT_HEADER_PATTERN = buildDocsUserAgentHeaderPattern(
  DOCS_TRADITIONAL_BOT_USER_AGENT_PATTERNS,
);
export const DOCS_BOT_LIKE_USER_AGENT_HEADER_PATTERN = buildDocsUserAgentHeaderPattern(
  DOCS_BOT_LIKE_USER_AGENT_TERMS,
);
const DOCS_LLMS_TXT_DIRECTIVE_LINE = "LLM index: /llms.txt";

const DOCS_MCP_SERVICE_SUBDOMAIN_LABELS = new Set([
  "api",
  "developer",
  "developers",
  "dev",
  "docs",
  "help",
  "mcp",
  "reference",
]);
const COMMON_SECOND_LEVEL_PUBLIC_SUFFIX_LABELS = new Set([
  "ac",
  "co",
  "com",
  "edu",
  "go",
  "gov",
  "mil",
  "ne",
  "net",
  "or",
  "org",
]);

export interface DocsMcpEndpointCandidate {
  baseUrl: string;
  route: string;
  url: string;
  label: string;
}

export interface DocsMcpEndpointCandidateOptions {
  includeOriginFallback?: boolean;
  includeRootDomainFallback?: boolean;
  includeMcpSubdomainFallback?: boolean;
}

export interface DocsAgentFeedbackResolvedConfig {
  enabled: boolean;
  route: string;
  schemaRoute: string;
  payloadSchema: Record<string, unknown>;
  schema: Record<string, unknown>;
  onFeedback?: (data: DocsAgentFeedbackData) => void | Promise<void>;
}

export interface DocsAgentFeedbackRequest {
  kind: "schema" | "submit";
}

export interface DocsAgentFeedbackDiscoveryConfig {
  enabled?: boolean;
  route?: string;
  schemaRoute?: string;
}

export interface DocsLlmsDiscoveryConfig {
  enabled?: boolean;
  baseUrl?: string;
  siteTitle?: string;
  siteDescription?: string;
  maxChars?: LlmsTxtMaxCharsConfig;
  sections?: LlmsTxtSectionConfig[];
  openapi?: boolean | DocsOpenApiDiscoveryConfig;
}

export interface DocsOpenApiDiscoveryConfig {
  enabled?: boolean;
  url?: string;
  source?: "generated" | "configured";
  specUrl?: string;
  apiReferencePath?: string;
}

export interface DocsOpenApiResolvedDiscoveryConfig {
  enabled: boolean;
  url?: string;
  source?: "generated" | "configured";
  specUrl?: string;
  apiReferencePath?: string;
}

export type DocsConfigMapJsonPrimitive = string | number | boolean | null;

export type DocsConfigMapJsonValue =
  | DocsConfigMapJsonPrimitive
  | DocsConfigMapJsonValue[]
  | { [key: string]: DocsConfigMapJsonValue };

export interface DocsConfigMapPointer {
  /** Dot-path form for humans and TypeScript users, e.g. `mcp.tools.readPage`. */
  path: string;
  /** Coarse value kind at this pointer. */
  kind: string;
}

export interface DocsConfigMap {
  schemaVersion: 1;
  format: typeof DEFAULT_DOCS_CONFIG_FORMAT;
  source: {
    /** Best-effort source label; adapters only receive the runtime config object. */
    file: string;
    /** Best-effort language hint based on serializing the runtime config object. */
    language: "ts" | "tsx";
  };
  serialization: {
    mode: "json-safe";
    redacted: string;
    nonSerializable: "described";
  };
  values: { [key: string]: DocsConfigMapJsonValue };
  /** RFC 6901 JSON Pointer index for mapping response values back to docs.config paths. */
  pointers: Record<string, DocsConfigMapPointer>;
}

export type DocsDiagnosticsStatus = "enabled" | "disabled";
export type DocsDiagnosticsIssueSeverity = "warning" | "error";

export interface DocsDiagnosticsIssue {
  severity: DocsDiagnosticsIssueSeverity;
  code: string;
  path?: string;
  message: string;
}

export interface DocsDiagnosticsFeature {
  status: DocsDiagnosticsStatus;
  reason?: string;
  route?: string | null;
  routes?: Record<string, string | null>;
  provider?: string;
  mode?: string;
  transport?: "GET" | "POST" | "GET/POST";
  tools?: Record<string, boolean>;
  human?: boolean;
  agent?: boolean;
}

export interface DocsDiagnostics {
  schemaVersion: 1;
  format: typeof DEFAULT_DOCS_DIAGNOSTICS_FORMAT;
  ok: boolean;
  adapter: string | null;
  routes: {
    docs: string;
    api: string;
    config: string;
    diagnostics: string;
    agentSpec: string;
    agents: string;
    skill: string;
    search: string | null;
    askAi: string | null;
    mcp: string | null;
    llmsTxt: string | null;
    llmsFullTxt: string | null;
    sitemapXml: string | null;
    sitemapMarkdown: string | null;
    robots: string | null;
    openapi: string | null;
    apiReference: string | null;
  };
  features: {
    staticExport: DocsDiagnosticsFeature;
    config: DocsDiagnosticsFeature;
    diagnostics: DocsDiagnosticsFeature;
    search: DocsDiagnosticsFeature;
    ai: DocsDiagnosticsFeature;
    mcp: DocsDiagnosticsFeature;
    feedback: DocsDiagnosticsFeature;
    llmsTxt: DocsDiagnosticsFeature;
    sitemap: DocsDiagnosticsFeature;
    robots: DocsDiagnosticsFeature;
    apiReference: DocsDiagnosticsFeature;
    agents: DocsDiagnosticsFeature;
    skills: DocsDiagnosticsFeature;
    locales: DocsDiagnosticsFeature;
  };
  warnings: DocsDiagnosticsIssue[];
  errors: DocsDiagnosticsIssue[];
}

export interface DocsDiagnosticsOptions {
  adapter?: string;
  entry?: string;
  i18n?: ResolvedDocsI18n | null;
  mcp?: DocsMcpResolvedConfig;
  feedback?: DocsAgentFeedbackDiscoveryConfig;
  openapi?: boolean | DocsOpenApiDiscoveryConfig;
}

const DOCS_CONFIG_MAP_TOP_LEVEL_KEYS = [
  "entry",
  "docsPath",
  "contentDir",
  "i18n",
  "staticExport",
  "theme",
  "analytics",
  "telemetry",
  "cloud",
  "observability",
  "github",
  "nav",
  "themeToggle",
  "breadcrumb",
  "sidebar",
  "components",
  "onCopyClick",
  "codeBlocks",
  "feedback",
  "mcp",
  "icons",
  "pageActions",
  "search",
  "lastUpdated",
  "readingTime",
  "ai",
  "ordering",
  "llmsTxt",
  "sitemap",
  "robots",
  "changelog",
  "apiReference",
  "agent",
  "review",
  "metadata",
  "og",
] as const satisfies readonly (keyof DocsConfig)[];

export interface DocsLlmsTxtResolvedMaxChars {
  mode: LlmsTxtMaxCharsMode;
  chars: number;
}

export interface DocsLlmsTxtResolvedSection {
  title: string;
  description?: string;
  match: string[];
  route: string;
  fullRoute: string;
  maxChars: DocsLlmsTxtResolvedMaxChars;
}

export interface DocsLlmsTxtRequest {
  format: "llms" | "llms-full";
  section?: DocsLlmsTxtResolvedSection;
}

export interface DocsLlmsTxtPageInput {
  url: string;
  /** Override the Markdown link emitted in llms.txt. */
  markdownUrl?: string;
  title: string;
  description?: string;
  content: string;
}

export interface DocsLlmsTxtGeneratedSection extends DocsLlmsTxtResolvedSection {
  llmsTxt: string;
  llmsFullTxt: string;
}

export interface DocsLlmsTxtGeneratedContent {
  llmsTxt: string;
  llmsFullTxt: string;
  maxChars: DocsLlmsTxtResolvedMaxChars;
  sections: DocsLlmsTxtGeneratedSection[];
}

export interface DocsLlmsTxtSelectedContent {
  content: string;
  label: string;
  maxChars: DocsLlmsTxtResolvedMaxChars;
}

export interface DocsLlmsTxtMaxCharsIssue {
  mode: Exclude<LlmsTxtMaxCharsMode, "off">;
  chars: number;
  actual: number;
  label: string;
  message: string;
}

export interface DocsAgentDiscoverySpecOptions {
  origin: string;
  entry?: string;
  i18n?: ResolvedDocsI18n | null;
  search?: boolean | DocsSearchConfig;
  mcp: DocsMcpResolvedConfig;
  feedback?: DocsAgentFeedbackDiscoveryConfig;
  llms?: DocsLlmsDiscoveryConfig;
  sitemap?: boolean | DocsSitemapConfig;
  robots?: boolean | DocsRobotsConfig;
  openapi?: boolean | DocsOpenApiDiscoveryConfig;
  markdown?: {
    acceptHeader?: boolean;
    signatureAgentHeader?: boolean;
  };
}

export interface DocsSkillDocumentOptions {
  origin: string;
  entry?: string;
  search?: boolean | DocsSearchConfig;
  mcp: DocsMcpResolvedConfig;
  feedback?: DocsAgentFeedbackDiscoveryConfig;
  llms?: DocsLlmsDiscoveryConfig;
  sitemap?: boolean | DocsSitemapConfig;
  robots?: boolean | DocsRobotsConfig;
  openapi?: boolean | DocsOpenApiDiscoveryConfig;
  markdown?: {
    acceptHeader?: boolean;
    signatureAgentHeader?: boolean;
  };
}

export interface DocsAgentsDocumentOptions extends DocsSkillDocumentOptions {}

export interface DocsMarkdownPage {
  slug?: string;
  url: string;
  title: string;
  description?: string;
  /** Override the public Markdown representation URL when it differs from `${url}.md`. */
  markdownUrl?: string;
  lastModified?: string;
  lastmod?: string;
  related?: ResolvedDocsRelatedLink[];
  content: string;
  rawContent?: string;
  agentContent?: string;
  agentRawContent?: string;
  agentFallbackContent?: string;
  agentFallbackRawContent?: string;
}

export interface DocsMarkdownDocumentOptions {
  llms?: boolean | DocsLlmsDiscoveryConfig | LlmsTxtConfig;
  origin?: string;
  sitemap?: boolean | DocsSitemapConfig;
}

export interface DocsMarkdownNotFoundOptions {
  entry?: string;
  requestedPath: string;
  origin?: string;
  pages?: DocsMarkdownPage[];
  sitemap?: boolean | DocsSitemapConfig;
}

export interface DocsMarkdownRecoveryMatch {
  title: string;
  url: string;
  markdownUrl: string;
  description?: string;
  confidence: number;
}

export interface DocsMarkdownRecoveryResult {
  matches: DocsMarkdownRecoveryMatch[];
  redirect?: DocsMarkdownRecoveryMatch;
}

export interface DocsMarkdownCanonicalUrlOptions {
  origin: string;
  entry?: string;
  requestedPath: string;
  locale?: string | null;
}

export interface DocsMarkdownResponseOptions extends DocsMarkdownNotFoundOptions {
  request: Request;
  document: string | null;
  /** Override the human-readable canonical URL, for example when docsPath differs from entry. */
  canonicalUrl?: string;
  /** Override the selected Markdown representation URL. */
  contentLocation?: string;
  locale?: string | null;
  /** Exact source modification timestamp. Date-only values are intentionally ignored. */
  lastModified?: string | Date | null;
  cacheControl?: string;
}

export function normalizeDocsPathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function normalizeDocsUrlPath(value: string): string {
  const normalized = value.replace(/\/+/g, "/");
  if (normalized === "/") return normalized;
  return normalized.replace(/\/+$/, "");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isDocsConfigRequest(url: URL): boolean {
  return url.searchParams.get("format")?.trim() === "config";
}

export function isDocsDiagnosticsRequest(url: URL): boolean {
  return url.searchParams.get("format")?.trim() === "diagnostics";
}

export function buildDocsConfigMap(
  config: DocsConfig | Record<string, unknown>,
  options: { file?: string } = {},
): DocsConfigMap {
  const pointers: Record<string, DocsConfigMapPointer> = {};
  const values = serializeDocsConfigMapValue(
    pickDocsConfigMapValues(config),
    [],
    new WeakSet(),
    pointers,
  );
  const mappedValues = isPlainObject(values) ? values : {};
  const language = containsDocsConfigKind(mappedValues, "jsx") ? "tsx" : "ts";

  return {
    schemaVersion: 1,
    format: DEFAULT_DOCS_CONFIG_FORMAT,
    source: {
      file: options.file ?? (language === "tsx" ? "docs.config.tsx" : "docs.config.ts"),
      language,
    },
    serialization: {
      mode: "json-safe",
      redacted:
        "Scalar values under secret-like keys such as apiKey, token, secret, password, authorization, and credential are redacted unless the key ends with Env.",
      nonSerializable: "described",
    },
    values: mappedValues,
    pointers,
  };
}

export function buildDocsDiagnostics(
  config: DocsConfig | Record<string, unknown>,
  options: DocsDiagnosticsOptions = {},
): DocsDiagnostics {
  const input = config as Record<string, unknown>;
  const entry = normalizeDocsPathSegment(stringConfigValue(input.entry) ?? options.entry ?? "docs");
  const docsRoute = routeFromConfigPath(stringConfigValue(input.docsPath) ?? entry);
  const staticExport = input.staticExport === true;
  const i18n = options.i18n ?? null;
  const localesEnabled = Boolean(i18n?.locales.length);
  const search = resolveDocsDiagnosticsSearch(input.search, staticExport);
  const ai = resolveDocsDiagnosticsAi(input.ai, staticExport);
  const llms = resolveDocsDiagnosticsLlms(input.llmsTxt);
  const sitemapConfig = resolveDocsSitemapConfig(input.sitemap as boolean | DocsSitemapConfig);
  const robotsEnabled = isRobotsDiscoveryEnabled(input.robots as boolean | DocsRobotsConfig);
  const openapiConfig = resolveDocsOpenApiDiscoveryConfig(
    options.openapi ?? (input.apiReference as boolean | DocsOpenApiDiscoveryConfig),
  );
  const apiReferenceRoute = resolveDocsDiagnosticsApiReferenceRoute(input.apiReference);
  const mcp = options.mcp ?? resolveDocsDiagnosticsMcp(input.mcp);
  const feedback = options.feedback ?? resolveDocsAgentFeedbackConfig(input.feedback as any);
  const agentFeedbackEnabled = feedback.enabled === true;
  const agentFeedbackRoute = feedback.route ?? DEFAULT_AGENT_FEEDBACK_ROUTE;
  const agentFeedbackSchemaRoute = feedback.schemaRoute ?? `${agentFeedbackRoute}/schema`;
  const humanFeedback = isDocsDiagnosticsHumanFeedbackEnabled(input.feedback);
  const warnings: DocsDiagnosticsIssue[] = [];
  const errors: DocsDiagnosticsIssue[] = [];

  if (staticExport) {
    warnings.push({
      severity: "warning",
      code: "static-export-runtime-api",
      path: "/staticExport",
      message:
        "staticExport is enabled; runtime API-backed capabilities are unavailable in production static export builds.",
    });
  }

  if (staticExport && ai.configured) {
    errors.push({
      severity: "error",
      code: "ai-static-export",
      path: "/ai/enabled",
      message:
        "Ask AI requires the runtime /api/docs POST handler and will not run in static export builds.",
    });
  }

  if (ai.enabled && !search.enabled) {
    warnings.push({
      severity: "warning",
      code: "ai-without-search",
      path: "/ai",
      message:
        "Ask AI is enabled while docs search is disabled, so retrieval context may be unavailable.",
    });
  }

  const adapter = options.adapter?.trim() || null;
  if (adapter && adapter !== "next") {
    if (!stringConfigValue(input.contentDir)) {
      warnings.push({
        severity: "warning",
        code: "missing-content-dir",
        path: "/contentDir",
        message: `${adapter} docs usually need contentDir so the server can find markdown content.`,
      });
    }

    if (!isPlainObject(input.nav)) {
      warnings.push({
        severity: "warning",
        code: "missing-nav",
        path: "/nav",
        message: `${adapter} docs usually need nav.title and nav.url for sidebar branding and root navigation.`,
      });
    }
  }

  validateDocsDiagnosticsSearchConfig(input.search, errors);

  const diagnostics: DocsDiagnostics = {
    schemaVersion: 1,
    format: DEFAULT_DOCS_DIAGNOSTICS_FORMAT,
    ok: errors.length === 0,
    adapter,
    routes: {
      docs: docsRoute,
      api: DEFAULT_DOCS_API_ROUTE,
      config: DEFAULT_DOCS_CONFIG_ROUTE,
      diagnostics: DEFAULT_DOCS_DIAGNOSTICS_ROUTE,
      agentSpec: DEFAULT_AGENT_SPEC_ROUTE,
      agents: `${DEFAULT_DOCS_API_ROUTE}?format=agents`,
      skill: `${DEFAULT_DOCS_API_ROUTE}?format=skill`,
      search: search.enabled ? `${DEFAULT_DOCS_API_ROUTE}?query={query}` : null,
      askAi: ai.enabled ? DEFAULT_DOCS_API_ROUTE : null,
      mcp: mcp.enabled ? mcp.route : null,
      llmsTxt: llms.enabled ? DEFAULT_LLMS_TXT_ROUTE : null,
      llmsFullTxt: llms.enabled ? DEFAULT_LLMS_FULL_TXT_ROUTE : null,
      sitemapXml:
        sitemapConfig.enabled && sitemapConfig.xml.enabled ? sitemapConfig.xml.route : null,
      sitemapMarkdown:
        sitemapConfig.enabled && sitemapConfig.markdown.enabled
          ? sitemapConfig.markdown.route
          : null,
      robots: robotsEnabled ? DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE : null,
      openapi: openapiConfig.enabled ? (openapiConfig.url ?? DEFAULT_OPENAPI_SCHEMA_ROUTE) : null,
      apiReference: openapiConfig.enabled ? apiReferenceRoute : null,
    },
    features: {
      staticExport: {
        status: staticExport ? "enabled" : "disabled",
      },
      config: {
        status: "enabled",
        route: DEFAULT_DOCS_CONFIG_ROUTE,
      },
      diagnostics: {
        status: "enabled",
        route: DEFAULT_DOCS_DIAGNOSTICS_ROUTE,
      },
      search: {
        status: search.enabled ? "enabled" : "disabled",
        reason: search.reason,
        route: search.enabled ? `${DEFAULT_DOCS_API_ROUTE}?query={query}` : null,
        provider: search.provider,
        transport: "GET",
      },
      ai: {
        status: ai.enabled ? "enabled" : "disabled",
        reason: ai.reason,
        route: ai.enabled ? DEFAULT_DOCS_API_ROUTE : null,
        mode: ai.mode,
        transport: "POST",
      },
      mcp: {
        status: mcp.enabled ? "enabled" : "disabled",
        route: mcp.enabled ? mcp.route : null,
        transport: "GET/POST",
        tools: mcp.tools as Record<string, boolean>,
      },
      feedback: {
        status: agentFeedbackEnabled || humanFeedback ? "enabled" : "disabled",
        human: humanFeedback,
        agent: agentFeedbackEnabled,
        routes: {
          agentSubmit: agentFeedbackEnabled ? agentFeedbackRoute : null,
          agentSchema: agentFeedbackEnabled ? agentFeedbackSchemaRoute : null,
        },
      },
      llmsTxt: {
        status: llms.enabled ? "enabled" : "disabled",
        reason: llms.reason,
        routes: {
          txt: llms.enabled ? DEFAULT_LLMS_TXT_ROUTE : null,
          full: llms.enabled ? DEFAULT_LLMS_FULL_TXT_ROUTE : null,
          wellKnownTxt: llms.enabled ? DEFAULT_LLMS_TXT_WELL_KNOWN_ROUTE : null,
          wellKnownFull: llms.enabled ? DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE : null,
        },
      },
      sitemap: {
        status: sitemapConfig.enabled ? "enabled" : "disabled",
        routes: {
          xml: sitemapConfig.enabled && sitemapConfig.xml.enabled ? sitemapConfig.xml.route : null,
          markdown:
            sitemapConfig.enabled && sitemapConfig.markdown.enabled
              ? sitemapConfig.markdown.route
              : null,
          docsMarkdown:
            sitemapConfig.enabled && sitemapConfig.markdown.enabled
              ? (sitemapConfig.markdown.docsRoute ?? null)
              : null,
          wellKnownMarkdown:
            sitemapConfig.enabled && sitemapConfig.markdown.enabled
              ? sitemapConfig.markdown.wellKnownRoute
              : null,
        },
      },
      robots: {
        status: robotsEnabled ? "enabled" : "disabled",
        route: robotsEnabled ? DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE : null,
      },
      apiReference: {
        status: openapiConfig.enabled ? "enabled" : "disabled",
        route: openapiConfig.enabled ? apiReferenceRoute : null,
        routes: {
          openapi: openapiConfig.enabled
            ? (openapiConfig.url ?? DEFAULT_OPENAPI_SCHEMA_ROUTE)
            : null,
        },
        provider: openapiConfig.source,
      },
      agents: {
        status: "enabled",
        routes: {
          default: DEFAULT_AGENTS_MD_ROUTE,
          wellKnown: DEFAULT_AGENTS_MD_WELL_KNOWN_ROUTE,
          api: `${DEFAULT_DOCS_API_ROUTE}?format=agents`,
        },
      },
      skills: {
        status: "enabled",
        routes: {
          default: DEFAULT_SKILL_MD_ROUTE,
          wellKnown: DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE,
          api: `${DEFAULT_DOCS_API_ROUTE}?format=skill`,
        },
      },
      locales: {
        status: localesEnabled ? "enabled" : "disabled",
        provider: localesEnabled ? "query-param" : undefined,
      },
    },
    warnings,
    errors,
  };

  return diagnostics;
}

function pickDocsConfigMapValues(
  config: DocsConfig | Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {};

  for (const key of DOCS_CONFIG_MAP_TOP_LEVEL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(config, key)) {
      output[key] = config[key];
    }
  }

  return output;
}

function serializeDocsConfigMapValue(
  value: unknown,
  path: string[],
  seen: WeakSet<object>,
  pointers: Record<string, DocsConfigMapPointer>,
  depth = 0,
): DocsConfigMapJsonValue | undefined {
  const key = path.at(-1) ?? "";
  const pointerPath = toDocsConfigJsonPointer(path);
  const setPointer = (kind: string) => {
    if (path.length > 0) {
      pointers[pointerPath] = {
        path: toDocsConfigDotPath(path),
        kind,
      };
    }
  };

  if (value === undefined) return undefined;

  if (shouldRedactDocsConfigKey(key) && value !== null && typeof value !== "object") {
    setPointer("secret");
    return {
      $kind: "secret",
      value: "[redacted]",
    };
  }

  if (value === null || typeof value === "string" || typeof value === "boolean") {
    setPointer(typeof value);
    return value;
  }

  if (typeof value === "number") {
    setPointer("number");
    return Number.isFinite(value) ? value : String(value);
  }

  if (typeof value === "bigint") {
    setPointer("bigint");
    return {
      $kind: "bigint",
      value: value.toString(),
    };
  }

  if (typeof value === "symbol") {
    setPointer("symbol");
    return {
      $kind: "symbol",
      value: String(value),
    };
  }

  if (typeof value === "function") {
    setPointer("function");
    return {
      $kind: "function",
      name: getDocsConfigFunctionName(value),
    };
  }

  if (value instanceof Date) {
    setPointer("date");
    return {
      $kind: "date",
      value: value.toISOString(),
    };
  }

  if (value instanceof URL) {
    setPointer("url");
    return value.toString();
  }

  if (depth >= 10) {
    setPointer("truncated");
    return {
      $kind: "truncated",
      reason: "Exceeded max depth of 10.",
    };
  }

  if (Array.isArray(value)) {
    setPointer("array");
    return value
      .map((entry, index) =>
        serializeDocsConfigMapValue(entry, [...path, String(index)], seen, pointers, depth + 1),
      )
      .filter((entry): entry is DocsConfigMapJsonValue => entry !== undefined);
  }

  if (isDocsConfigReactElement(value)) {
    setPointer("jsx");
    return {
      $kind: "jsx",
      component: getDocsConfigReactElementName(value),
    };
  }

  if (seen.has(value)) {
    setPointer("circular");
    return {
      $kind: "circular",
    };
  }

  seen.add(value);

  const output: { [key: string]: DocsConfigMapJsonValue } = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    const serialized = serializeDocsConfigMapValue(
      childValue,
      [...path, childKey],
      seen,
      pointers,
      depth + 1,
    );
    if (serialized !== undefined) output[childKey] = serialized;
  }

  seen.delete(value);

  if (path.length === 1 && path[0] === "theme") {
    setPointer("theme");
    return {
      $kind: "theme",
      ...output,
    };
  }

  setPointer("object");
  return output;
}

function shouldRedactDocsConfigKey(key: string): boolean {
  const normalized = key.replace(/[-_]/g, "").toLowerCase();
  if (!normalized || normalized === "env" || normalized.endsWith("env")) return false;

  return (
    normalized.includes("apikey") ||
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("authorization") ||
    normalized.includes("credential")
  );
}

function isDocsConfigReactElement(value: unknown): value is { type?: unknown; $$typeof?: unknown } {
  if (!isPlainObject(value) || !("$$typeof" in value)) return false;
  return String(value.$$typeof).includes("react.");
}

function getDocsConfigReactElementName(value: { type?: unknown }): string {
  const type = value.type;
  if (typeof type === "string") return type;
  if (typeof type === "function") return getDocsConfigFunctionName(type);

  if (isPlainObject(type)) {
    const displayName = type.displayName;
    if (typeof displayName === "string") return displayName;

    const render = type.render;
    if (typeof render === "function") return getDocsConfigFunctionName(render);
  }

  return "unknown";
}

function getDocsConfigFunctionName(value: Function): string {
  const displayName = (value as { displayName?: unknown }).displayName;
  return typeof displayName === "string" ? displayName : value.name || "anonymous";
}

function toDocsConfigJsonPointer(path: string[]): string {
  return path.length === 0 ? "" : `/${path.map(escapeDocsConfigJsonPointerPart).join("/")}`;
}

function escapeDocsConfigJsonPointerPart(value: string): string {
  return value.replace(/~/g, "~0").replace(/\//g, "~1");
}

function toDocsConfigDotPath(path: string[]): string {
  return path
    .map((part, index) => (/^\d+$/.test(part) ? `[${part}]` : index === 0 ? part : `.${part}`))
    .join("");
}

function containsDocsConfigKind(value: DocsConfigMapJsonValue, kind: string): boolean {
  if (!isPlainObject(value)) {
    if (!Array.isArray(value)) return false;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => containsDocsConfigKind(entry, kind));
  }

  if (value["$kind"] === kind) return true;

  return Object.values(value).some((entry) => containsDocsConfigKind(entry, kind));
}

function stringConfigValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function routeFromConfigPath(value: string): string {
  const normalized = normalizeDocsPathSegment(value);
  return normalized ? `/${normalized}` : "/";
}

interface ResolvedDocsDiagnosticsSearch {
  enabled: boolean;
  configured: boolean;
  provider?: string;
  reason?: string;
}

function resolveDocsDiagnosticsSearch(
  search: unknown,
  staticExport: boolean,
): ResolvedDocsDiagnosticsSearch {
  const provider = isPlainObject(search) ? stringConfigValue(search.provider) : "simple";
  const configured =
    search !== false &&
    !(isPlainObject(search) && (search as { enabled?: unknown }).enabled === false);

  if (staticExport) {
    return {
      enabled: false,
      configured,
      provider,
      reason: "static-export",
    };
  }

  if (!configured) {
    return {
      enabled: false,
      configured,
      provider,
      reason: "configured-disabled",
    };
  }

  return {
    enabled: true,
    configured,
    provider,
  };
}

interface ResolvedDocsDiagnosticsAi {
  enabled: boolean;
  configured: boolean;
  mode?: string;
  reason?: string;
}

function resolveDocsDiagnosticsAi(ai: unknown, staticExport: boolean): ResolvedDocsDiagnosticsAi {
  const configured = isPlainObject(ai) && ai.enabled === true;
  const mode = isPlainObject(ai) ? stringConfigValue(ai.mode) : undefined;

  if (!configured) {
    return {
      enabled: false,
      configured,
      reason: "not-configured",
    };
  }

  if (staticExport) {
    return {
      enabled: false,
      configured,
      mode,
      reason: "static-export",
    };
  }

  return {
    enabled: true,
    configured,
    mode,
  };
}

function resolveDocsDiagnosticsLlms(llmsTxt: unknown): {
  enabled: boolean;
  reason?: string;
} {
  const enabled =
    llmsTxt !== false &&
    !(isPlainObject(llmsTxt) && (llmsTxt as { enabled?: unknown }).enabled === false);

  return enabled
    ? { enabled: true }
    : {
        enabled: false,
        reason: "configured-disabled",
      };
}

function resolveDocsDiagnosticsMcp(mcp: unknown): DocsMcpResolvedConfig {
  const config = isPlainObject(mcp) ? mcp : {};
  const tools = isPlainObject(config.tools) ? config.tools : {};

  return {
    enabled: typeof mcp === "boolean" ? mcp : config.enabled !== false,
    route: normalizeDocsDiagnosticsMcpRoute(config.route),
    name: stringConfigValue(config.name) ?? "Documentation",
    version: stringConfigValue(config.version) ?? "0.0.0",
    tools: {
      ...DEFAULT_DOCS_DIAGNOSTICS_MCP_TOOLS,
      listDocs: tools.listDocs !== false,
      listPages: tools.listPages !== false,
      readPage: tools.readPage !== false,
      searchDocs: tools.searchDocs !== false,
      getNavigation: tools.getNavigation !== false,
      getCodeExamples: tools.getCodeExamples !== false,
      getConfigSchema: tools.getConfigSchema !== false,
      getContext: tools.getContext !== false,
    },
  };
}

function normalizeDocsDiagnosticsMcpRoute(route: unknown): string {
  const value = stringConfigValue(route);
  if (!value) return DEFAULT_MCP_ROUTE;

  const normalized = `/${value}`.replace(/\/+/g, "/");
  return normalized !== "/" ? normalized.replace(/\/+$/, "") : DEFAULT_MCP_ROUTE;
}

function isDocsDiagnosticsHumanFeedbackEnabled(feedback: unknown): boolean {
  return feedback === true || (isPlainObject(feedback) && feedback.enabled !== false);
}

function resolveDocsDiagnosticsApiReferenceRoute(apiReference: unknown): string {
  if (isPlainObject(apiReference)) {
    return routeFromConfigPath(stringConfigValue(apiReference.path) ?? "api-reference");
  }

  return "/api-reference";
}

function validateDocsDiagnosticsSearchConfig(
  search: unknown,
  errors: DocsDiagnosticsIssue[],
): void {
  if (!isPlainObject(search) || search.enabled === false) return;

  const provider = stringConfigValue(search.provider) ?? "simple";
  const requireString = (key: string) => {
    if (!stringConfigValue(search[key])) {
      errors.push({
        severity: "error",
        code: `missing-search-${key.replace(/[A-Z]/g, (value) => `-${value.toLowerCase()}`)}`,
        path: `/search/${key}`,
        message: `Search provider "${provider}" requires search.${key}.`,
      });
    }
  };

  if (provider === "algolia") {
    requireString("appId");
    requireString("indexName");
    requireString("searchApiKey");
  }

  if (provider === "typesense") {
    requireString("baseUrl");
    requireString("collection");
    requireString("apiKey");
  }

  if (provider === "mcp") {
    requireString("endpoint");
  }

  if (provider === "custom" && !("adapter" in search)) {
    errors.push({
      severity: "error",
      code: "missing-search-adapter",
      path: "/search/adapter",
      message: 'Search provider "custom" requires search.adapter.',
    });
  }
}

function normalizeDocsAgentFeedbackRoute(
  route?: string,
  fallback = DEFAULT_AGENT_FEEDBACK_ROUTE,
): string {
  if (!route || route.trim().length === 0) return fallback;

  const normalized = `/${route}`.replace(/\/+/g, "/");
  return normalized !== "/" ? normalized.replace(/\/+$/, "") : fallback;
}

export function buildDocsAgentFeedbackSchema(
  payloadSchema: Record<string, unknown>,
): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      context: {
        type: "object",
        additionalProperties: false,
        properties: {
          page: { type: "string" },
          url: { type: "string" },
          slug: { type: "string" },
          locale: { type: "string" },
          source: { type: "string" },
        },
      },
      payload: payloadSchema,
    },
    required: ["payload"],
  };
}

export function resolveDocsAgentFeedbackConfig(
  feedback?: boolean | FeedbackConfig,
): DocsAgentFeedbackResolvedConfig {
  const route = normalizeDocsAgentFeedbackRoute();
  const enabled = {
    enabled: true,
    route,
    schemaRoute: `${route}/schema`,
    payloadSchema: DEFAULT_AGENT_FEEDBACK_PAYLOAD_SCHEMA,
    schema: buildDocsAgentFeedbackSchema(DEFAULT_AGENT_FEEDBACK_PAYLOAD_SCHEMA),
  } satisfies DocsAgentFeedbackResolvedConfig;
  const disabled = {
    enabled: false,
    route,
    schemaRoute: `${route}/schema`,
    payloadSchema: DEFAULT_AGENT_FEEDBACK_PAYLOAD_SCHEMA,
    schema: buildDocsAgentFeedbackSchema(DEFAULT_AGENT_FEEDBACK_PAYLOAD_SCHEMA),
  } satisfies DocsAgentFeedbackResolvedConfig;

  if (feedback === false) return disabled;
  if (!feedback || feedback === true || typeof feedback !== "object") return enabled;

  const agent = feedback.agent;
  if (agent === false) return disabled;
  if (!agent) return enabled;
  if (agent === true) return enabled;

  const resolvedRoute = normalizeDocsAgentFeedbackRoute(agent.route, route);
  const resolvedSchemaRoute = normalizeDocsAgentFeedbackRoute(
    agent.schemaRoute,
    `${resolvedRoute}/schema`,
  );
  const payloadSchema = agent.schema ?? DEFAULT_AGENT_FEEDBACK_PAYLOAD_SCHEMA;

  return {
    enabled: agent.enabled !== false,
    route: resolvedRoute,
    schemaRoute: resolvedSchemaRoute,
    payloadSchema,
    schema: buildDocsAgentFeedbackSchema(payloadSchema),
    onFeedback: agent.onFeedback,
  };
}

export function resolveDocsAgentFeedbackRequest(
  url: URL,
  feedback: DocsAgentFeedbackResolvedConfig,
): DocsAgentFeedbackRequest | null {
  if (!feedback.enabled) return null;

  const feedbackMode = url.searchParams.get("feedback")?.trim();
  const schemaMode = url.searchParams.get("schema")?.trim();
  if (feedbackMode === "agent") {
    return {
      kind: schemaMode === "1" || schemaMode === "true" ? "schema" : "submit",
    };
  }

  const pathname = normalizeDocsUrlPath(url.pathname);
  if (pathname === feedback.schemaRoute) return { kind: "schema" };
  if (pathname === feedback.route) return { kind: "submit" };

  return null;
}

function normalizeDocsAgentFeedbackContext(value: unknown): DocsAgentFeedbackContext | undefined {
  if (!isPlainObject(value)) return undefined;

  const context: DocsAgentFeedbackContext = {};
  if (typeof value.page === "string") context.page = value.page;
  if (typeof value.url === "string") context.url = value.url;
  if (typeof value.slug === "string") context.slug = value.slug;
  if (typeof value.locale === "string") context.locale = value.locale;
  if (typeof value.source === "string") context.source = value.source;

  return Object.keys(context).length > 0 ? context : undefined;
}

export async function parseDocsAgentFeedbackData(
  request: Request,
): Promise<{ ok: true; data: DocsAgentFeedbackData } | { ok: false; response: Response }> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      response: Response.json({ error: "Agent feedback body must be valid JSON" }, { status: 400 }),
    };
  }

  if (!isPlainObject(body)) {
    return {
      ok: false,
      response: Response.json({ error: "Agent feedback body must be an object" }, { status: 400 }),
    };
  }

  if (!isPlainObject(body.payload)) {
    return {
      ok: false,
      response: Response.json(
        { error: "Agent feedback body must include a payload object" },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    data: {
      context: normalizeDocsAgentFeedbackContext(body.context),
      payload: body.payload,
    },
  };
}

export function validateDocsAgentFeedbackPayload(
  value: unknown,
  schema: Record<string, unknown>,
  valuePath = "payload",
): string | undefined {
  const schemaType = typeof schema.type === "string" ? schema.type : undefined;

  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => Object.is(entry, value))) {
    return `${valuePath} must be one of the configured enum values`;
  }

  if (schemaType === "object" || (!schemaType && (schema.properties || schema.required))) {
    if (!isPlainObject(value)) return `${valuePath} must be an object`;

    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required)
      ? schema.required.filter((entry): entry is string => typeof entry === "string")
      : [];

    for (const key of required) {
      if (!(key in value)) return `${valuePath}.${key} is required`;
    }

    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) return `${valuePath}.${key} is not allowed`;
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (!(key in value)) continue;
      if (!isPlainObject(propertySchema)) continue;

      const error = validateDocsAgentFeedbackPayload(
        value[key],
        propertySchema,
        `${valuePath}.${key}`,
      );
      if (error) return error;
    }

    return undefined;
  }

  if (schemaType === "array") {
    if (!Array.isArray(value)) return `${valuePath} must be an array`;
    if (!isPlainObject(schema.items)) return undefined;

    for (const [index, item] of value.entries()) {
      const error = validateDocsAgentFeedbackPayload(item, schema.items, `${valuePath}[${index}]`);
      if (error) return error;
    }

    return undefined;
  }

  if (schemaType === "string") {
    if (typeof value !== "string") return `${valuePath} must be a string`;

    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      return `${valuePath} must be at least ${schema.minLength} characters`;
    }

    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      return `${valuePath} must be at most ${schema.maxLength} characters`;
    }

    return undefined;
  }

  if (schemaType === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return `${valuePath} must be a number`;
    }

    if (typeof schema.minimum === "number" && value < schema.minimum) {
      return `${valuePath} must be >= ${schema.minimum}`;
    }

    if (typeof schema.maximum === "number" && value > schema.maximum) {
      return `${valuePath} must be <= ${schema.maximum}`;
    }

    return undefined;
  }

  if (schemaType === "boolean") {
    if (typeof value !== "boolean") return `${valuePath} must be a boolean`;
    return undefined;
  }

  return undefined;
}

export function toDocsMarkdownUrl(url: string, options: { locale?: string } = {}): string {
  const [withoutHash, hash = ""] = url.split("#", 2);
  const [pathname, query = ""] = withoutHash.split("?", 2);
  const normalizedPath = normalizeDocsUrlPath(pathname || "/");
  const markdownPath = normalizedPath.endsWith(".md") ? normalizedPath : `${normalizedPath}.md`;
  const params = new URLSearchParams(query);
  if (options.locale && !params.has("lang")) params.set("lang", options.locale);
  const search = params.toString();
  return `${markdownPath}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

export function resolveDocsMarkdownCanonicalUrl({
  origin,
  entry = "docs",
  requestedPath,
  locale,
}: DocsMarkdownCanonicalUrlOptions): string {
  const normalizedEntry = normalizeDocsPathSegment(entry) || "docs";
  const pathname = normalizeRequestedMarkdownPath(normalizedEntry, requestedPath);
  const canonicalUrl = new URL(pathname, origin);
  if (locale) canonicalUrl.searchParams.set("lang", locale);
  return canonicalUrl.toString();
}

export function getDocsMarkdownCanonicalLinkHeader(
  options: DocsMarkdownCanonicalUrlOptions,
): string {
  return `<${resolveDocsMarkdownCanonicalUrl(options)}>; rel="canonical"`;
}

function joinDocsPublicRoute(prefix: string, suffix: string): string {
  const normalizedPrefix = normalizeDocsUrlPath(`/${normalizeDocsPathSegment(prefix)}`);
  const normalizedSuffix = `/${normalizeDocsPathSegment(suffix)}`;
  if (normalizedPrefix === "/") return normalizedSuffix;
  return normalizeDocsUrlPath(`${normalizedPrefix}${normalizedSuffix}`);
}

function normalizeLlmsTxtMatch(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "/";
  return normalizeDocsUrlPath(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
}

function llmsTxtMatchPrefix(value: string): string {
  const normalized = normalizeLlmsTxtMatch(value);
  const wildcardIndex = normalized.indexOf("*");
  const withoutWildcard = wildcardIndex >= 0 ? normalized.slice(0, wildcardIndex) : normalized;
  return normalizeDocsUrlPath(withoutWildcard.replace(/\/+$/, "") || "/");
}

function deriveLlmsTxtSectionRoute(match: string[]): string {
  const prefix = llmsTxtMatchPrefix(match[0] ?? "/");
  return joinDocsPublicRoute(prefix, "llms.txt");
}

function deriveLlmsTxtSectionFullRoute(route: string): string {
  const normalized = normalizeDocsUrlPath(route);
  if (normalized.endsWith("/llms.txt")) {
    return `${normalized.slice(0, -"/llms.txt".length)}/llms-full.txt`;
  }
  return joinDocsPublicRoute(normalized, "llms-full.txt");
}

function resolveDocsBaseLlmsTxtRoute(basePath?: string): string | null {
  if (!basePath) return null;
  return joinDocsPublicRoute(normalizeDocsPathSegment(basePath) || "docs", "llms.txt");
}

function resolveDocsBaseLlmsFullTxtRoute(basePath?: string): string | null {
  const route = resolveDocsBaseLlmsTxtRoute(basePath);
  return route ? deriveLlmsTxtSectionFullRoute(route) : null;
}

function normalizeLlmsTxtMaxChars(
  value: LlmsTxtMaxCharsConfig | undefined,
  fallback?: DocsLlmsTxtResolvedMaxChars,
): DocsLlmsTxtResolvedMaxChars {
  const mode = value?.mode ?? fallback?.mode ?? "warn";
  const chars = value?.chars ?? fallback?.chars ?? DEFAULT_LLMS_TXT_MAX_CHARS;
  return {
    mode,
    chars: Number.isFinite(chars) && chars > 0 ? Math.floor(chars) : DEFAULT_LLMS_TXT_MAX_CHARS,
  };
}

export function resolveDocsLlmsTxtSections(
  llms?: boolean | DocsLlmsDiscoveryConfig | LlmsTxtConfig,
): DocsLlmsTxtResolvedSection[] {
  if (!llms || typeof llms !== "object" || !Array.isArray(llms.sections)) return [];

  const rootMaxChars = normalizeLlmsTxtMaxChars(llms.maxChars);
  return llms.sections.flatMap((section) => {
    const match = (Array.isArray(section.match) ? section.match : [section.match])
      .map(normalizeLlmsTxtMatch)
      .filter(Boolean);
    if (match.length === 0) return [];

    const route = deriveLlmsTxtSectionRoute(match);
    const resolved: DocsLlmsTxtResolvedSection = {
      title: section.title,
      match,
      route,
      fullRoute: deriveLlmsTxtSectionFullRoute(route),
      maxChars: normalizeLlmsTxtMaxChars(section.maxChars, rootMaxChars),
    };
    if (section.description !== undefined) resolved.description = section.description;
    return [resolved];
  });
}

export function matchesDocsLlmsTxtSection(pageUrl: string, section: DocsLlmsTxtResolvedSection) {
  const pathname = normalizeDocsUrlPath(pageUrl.split(/[?#]/, 1)[0] || "/");
  return section.match.some((pattern) => {
    const normalized = normalizeLlmsTxtMatch(pattern);
    if (normalized.endsWith("/**")) {
      const prefix = normalizeDocsUrlPath(normalized.slice(0, -"/**".length) || "/");
      if (prefix === "/") return true;
      return pathname === prefix || pathname.startsWith(`${prefix}/`);
    }
    if (normalized.endsWith("/*")) {
      const prefix = normalizeDocsUrlPath(normalized.slice(0, -"/*".length) || "/");
      if (prefix === "/") {
        const directChild = pathname.slice(1);
        return directChild.length > 0 && !directChild.includes("/");
      }
      if (!pathname.startsWith(`${prefix}/`)) return false;
      return !pathname.slice(prefix.length + 1).includes("/");
    }
    return pathname === normalized;
  });
}

export function resolveDocsLlmsTxtRequest(
  url: URL,
  llms?: boolean | DocsLlmsDiscoveryConfig | LlmsTxtConfig,
  basePath?: string,
): DocsLlmsTxtRequest | null {
  const pathname = normalizeDocsUrlPath(url.pathname);
  const sections = resolveDocsLlmsTxtSections(llms);

  for (const section of sections) {
    if (pathname === section.route) return { format: "llms", section };
    if (pathname === section.fullRoute) return { format: "llms-full", section };
  }

  const format = url.searchParams.get("format");
  if (pathname === DEFAULT_DOCS_API_ROUTE && (format === "llms" || format === "llms-full")) {
    const sectionRoute = url.searchParams.get("section")?.trim();
    const normalizedSectionRoute = sectionRoute ? normalizeDocsUrlPath(sectionRoute) : undefined;
    const section = normalizedSectionRoute
      ? (sections.find(
          (candidate) =>
            candidate.route === normalizedSectionRoute ||
            candidate.fullRoute === normalizedSectionRoute,
        ) ?? {
          title: "",
          match: [],
          route: normalizedSectionRoute,
          fullRoute: normalizedSectionRoute,
          maxChars: normalizeLlmsTxtMaxChars(undefined),
        })
      : undefined;
    return { format, section };
  }

  if (pathname === DEFAULT_LLMS_TXT_ROUTE || pathname === DEFAULT_LLMS_TXT_WELL_KNOWN_ROUTE) {
    return { format: "llms" };
  }

  if (pathname === resolveDocsBaseLlmsTxtRoute(basePath)) {
    return { format: "llms" };
  }

  if (
    pathname === DEFAULT_LLMS_FULL_TXT_ROUTE ||
    pathname === DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE
  ) {
    return { format: "llms-full" };
  }

  if (pathname === resolveDocsBaseLlmsFullTxtRoute(basePath)) {
    return { format: "llms-full" };
  }

  return null;
}

function renderLlmsTxtPageList(pages: DocsLlmsTxtPageInput[], baseUrl: string): string {
  let content = "";
  for (const page of pages) {
    content += `- [${page.title}](${baseUrl}${page.markdownUrl ?? toDocsMarkdownUrl(page.url)})`;
    if (page.description) content += `: ${page.description}`;
    content += "\n";
  }
  return content;
}

function resolveDocsResourceUrl(baseUrl: string, url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `${baseUrl}${normalized}`;
}

function renderLlmsFullTxtPages(pages: DocsLlmsTxtPageInput[], baseUrl: string): string {
  let content = "";
  for (const page of pages) {
    content += `## ${page.title}\n\n`;
    content += `URL: ${baseUrl}${page.url}\n\n`;
    if (page.description) content += `${page.description}\n\n`;
    content += `${page.content}\n\n---\n\n`;
  }
  return content;
}

export function renderDocsLlmsTxt(
  pages: DocsLlmsTxtPageInput[],
  options: DocsLlmsDiscoveryConfig = {},
): DocsLlmsTxtGeneratedContent {
  const siteTitle = options.siteTitle ?? "Documentation";
  const siteDescription = options.siteDescription;
  const baseUrl = options.baseUrl ?? "";
  const maxChars = normalizeLlmsTxtMaxChars(options.maxChars);
  const sections = resolveDocsLlmsTxtSections(options);
  const openapi = resolveDocsOpenApiDiscoveryConfig(options.openapi);
  const matchedPageUrls = new Set<string>();

  const generatedSections = sections.map((section) => {
    const sectionPages = pages.filter((page) => matchesDocsLlmsTxtSection(page.url, section));
    for (const page of sectionPages) matchedPageUrls.add(normalizeDocsUrlPath(page.url));

    let llmsTxt = `# ${siteTitle} - ${section.title}\n\n`;
    if (section.description) llmsTxt += `> ${section.description}\n\n`;
    else if (siteDescription) llmsTxt += `> ${siteDescription}\n\n`;
    llmsTxt += "## Pages\n\n";
    llmsTxt += renderLlmsTxtPageList(sectionPages, baseUrl);

    let llmsFullTxt = `# ${siteTitle} - ${section.title}\n\n`;
    if (section.description) llmsFullTxt += `> ${section.description}\n\n`;
    else if (siteDescription) llmsFullTxt += `> ${siteDescription}\n\n`;
    llmsFullTxt += renderLlmsFullTxtPages(sectionPages, baseUrl);

    return {
      ...section,
      llmsTxt,
      llmsFullTxt,
    };
  });

  const rootPages =
    generatedSections.length > 0
      ? pages.filter((page) => !matchedPageUrls.has(normalizeDocsUrlPath(page.url)))
      : pages;

  let llmsTxt = `# ${siteTitle}\n\n`;
  if (siteDescription) llmsTxt += `> ${siteDescription}\n\n`;
  if (generatedSections.length > 0) {
    llmsTxt += "## Sections\n\n";
    for (const section of generatedSections) {
      llmsTxt += `- [${section.title}](${baseUrl}${section.route})`;
      if (section.description) llmsTxt += `: ${section.description}`;
      llmsTxt += "\n";
    }
    llmsTxt += "\n";
  }
  if (openapi.enabled && openapi.url) {
    llmsTxt += "## API Schemas\n\n";
    llmsTxt += `- [OpenAPI schema](${resolveDocsResourceUrl(
      baseUrl,
      openapi.url,
    )}): Machine-readable API schema for tool use and API clients`;
    if (openapi.apiReferencePath) {
      llmsTxt += `; rendered API reference at ${resolveDocsResourceUrl(
        baseUrl,
        openapi.apiReferencePath,
      )}`;
    }
    llmsTxt += "\n\n";
  }
  if (rootPages.length > 0 || generatedSections.length === 0) {
    llmsTxt += "## Pages\n\n";
    llmsTxt += renderLlmsTxtPageList(rootPages, baseUrl);
  }

  let llmsFullTxt = `# ${siteTitle}\n\n`;
  if (siteDescription) llmsFullTxt += `> ${siteDescription}\n\n`;
  llmsFullTxt += renderLlmsFullTxtPages(pages, baseUrl);

  return {
    llmsTxt,
    llmsFullTxt,
    maxChars,
    sections: generatedSections,
  };
}

export function selectDocsLlmsTxtContent(
  content: DocsLlmsTxtGeneratedContent,
  request: DocsLlmsTxtRequest,
): DocsLlmsTxtSelectedContent | null {
  if (request.section) {
    const section = content.sections.find(
      (candidate) => candidate.route === request.section?.route,
    );
    if (!section) return null;
    return {
      content: request.format === "llms-full" ? section.llmsFullTxt : section.llmsTxt,
      label: request.format === "llms-full" ? section.fullRoute : section.route,
      maxChars:
        request.format === "llms-full" ? { ...section.maxChars, mode: "off" } : section.maxChars,
    };
  }

  return {
    content: request.format === "llms-full" ? content.llmsFullTxt : content.llmsTxt,
    label: request.format === "llms-full" ? DEFAULT_LLMS_FULL_TXT_ROUTE : DEFAULT_LLMS_TXT_ROUTE,
    maxChars:
      request.format === "llms-full" ? { ...content.maxChars, mode: "off" } : content.maxChars,
  };
}

export function getDocsLlmsTxtMaxCharsIssue(
  label: string,
  content: string,
  maxChars: DocsLlmsTxtResolvedMaxChars,
): DocsLlmsTxtMaxCharsIssue | null {
  if (maxChars.mode === "off" || content.length <= maxChars.chars) return null;
  return {
    mode: maxChars.mode,
    chars: maxChars.chars,
    actual: content.length,
    label,
    message: `${label} is ${content.length.toLocaleString()} chars, above the configured ${maxChars.chars.toLocaleString()} char llms.txt budget.`,
  };
}

export function isDocsAgentDiscoveryRequest(url: URL): boolean {
  const pathname = normalizeDocsUrlPath(url.pathname);
  if (pathname === DEFAULT_DOCS_API_ROUTE && url.searchParams.get("agent")?.trim() === "spec") {
    return true;
  }

  return (
    pathname === DEFAULT_AGENT_SPEC_ROUTE ||
    pathname === DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE ||
    pathname === DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE
  );
}

export function isDocsMcpRequest(url: URL): boolean {
  const pathname = normalizeDocsUrlPath(url.pathname);
  return (
    pathname === DEFAULT_MCP_ROUTE ||
    pathname === DEFAULT_MCP_PUBLIC_ROUTE ||
    pathname === DEFAULT_MCP_WELL_KNOWN_ROUTE
  );
}

export function buildDocsMcpEndpointCandidates(
  baseUrl: string,
  routes: readonly string[] = [DEFAULT_MCP_PUBLIC_ROUTE, DEFAULT_MCP_WELL_KNOWN_ROUTE],
  options: DocsMcpEndpointCandidateOptions = {},
): DocsMcpEndpointCandidate[] {
  const includeOriginFallback = options.includeOriginFallback !== false;
  const includeRootDomainFallback = options.includeRootDomainFallback !== false;
  const includeMcpSubdomainFallback = options.includeMcpSubdomainFallback !== false;
  const base = new URL(baseUrl);
  const primaryOrigin = base.origin;
  const seen = new Set<string>();
  const candidates: DocsMcpEndpointCandidate[] = [];

  const addCandidate = (candidateBaseUrl: string, route: string) => {
    const resolved = resolveDocsMcpCandidateUrl(candidateBaseUrl, route);
    if (seen.has(resolved.url)) return;
    seen.add(resolved.url);
    candidates.push({
      ...resolved,
      label: formatDocsMcpCandidateLabel(resolved.url, primaryOrigin),
    });
  };

  for (const route of routes) {
    addCandidate(baseUrl, route);
  }

  const originBaseUrl = primaryOrigin;
  if (includeOriginFallback && originBaseUrl !== baseUrl.replace(/\/+$/, "")) {
    for (const route of routes) {
      addCandidate(originBaseUrl, route);
    }
  }

  if (includeRootDomainFallback) {
    for (const rootDomainBaseUrl of toDocsRootDomainBaseUrls(base)) {
      for (const route of routes) {
        addCandidate(rootDomainBaseUrl, route);
      }
    }
  }

  if (includeMcpSubdomainFallback) {
    for (const mcpBaseUrl of toDocsMcpSubdomainBaseUrls(base)) {
      addCandidate(mcpBaseUrl, DEFAULT_MCP_PUBLIC_ROUTE);
      addCandidate(mcpBaseUrl, "/");
    }
  }

  return candidates;
}

function resolveDocsMcpCandidateUrl(
  baseUrl: string,
  route: string,
): { baseUrl: string; route: string; url: string } {
  if (/^https?:\/\//i.test(route)) {
    const parsed = new URL(route);
    const path = `${parsed.pathname || "/"}${parsed.search}`;
    return {
      baseUrl: parsed.origin,
      route: path,
      url: parsed.toString(),
    };
  }

  const base = new URL(baseUrl);
  const basePath = base.pathname.replace(/\/+$/, "");
  const routePath = route.startsWith("/") ? route : `/${route}`;
  const parsed = new URL(`${basePath}${routePath}`, base.origin);

  return {
    baseUrl: parsed.origin,
    route: `${parsed.pathname}${parsed.search}`,
    url: parsed.toString(),
  };
}

function formatDocsMcpCandidateLabel(url: string, primaryOrigin: string): string {
  const parsed = new URL(url);
  const path = `${parsed.pathname}${parsed.search}`;
  return parsed.origin === primaryOrigin ? path : `${parsed.origin}${path}`;
}

function toDocsMcpSubdomainBaseUrls(base: URL): string[] {
  return getDocsMcpRootDomainCandidates(base.hostname).map(
    (rootDomain) => `${base.protocol}//mcp.${rootDomain}${base.port ? `:${base.port}` : ""}`,
  );
}

function toDocsRootDomainBaseUrls(base: URL): string[] {
  return getDocsMcpRootDomainCandidates(base.hostname).map(
    (rootDomain) => `${base.protocol}//${rootDomain}${base.port ? `:${base.port}` : ""}`,
  );
}

function getDocsMcpRootDomainCandidates(hostname: string): string[] {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (!normalized || !normalized.includes(".") || isDocsIpHostname(normalized)) return [];

  const labels = normalized.split(".").filter(Boolean);
  if (labels.length < 2) return [];

  const candidates: string[] = [];
  const addCandidate = (candidateLabels: string[]) => {
    if (candidateLabels.length < 2) return;
    const candidate = candidateLabels.join(".");
    if (!candidates.includes(candidate)) candidates.push(candidate);
  };

  if (labels.length >= 3 && DOCS_MCP_SERVICE_SUBDOMAIN_LABELS.has(labels[0] ?? "")) {
    addCandidate(labels.slice(1));
  }

  const tld = labels.at(-1) ?? "";
  const secondLevel = labels.at(-2) ?? "";
  const shouldPreserveSecondLevelSuffix =
    labels.length >= 3 &&
    tld.length === 2 &&
    COMMON_SECOND_LEVEL_PUBLIC_SUFFIX_LABELS.has(secondLevel);

  if (shouldPreserveSecondLevelSuffix) {
    addCandidate(labels.slice(-3));
  } else {
    addCandidate(labels.slice(-2));
  }
  return candidates;
}

function isDocsIpHostname(hostname: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.includes(":");
}

export function isDocsSkillRequest(url: URL): boolean {
  const pathname = normalizeDocsUrlPath(url.pathname);
  if (pathname === DEFAULT_SKILL_MD_ROUTE || pathname === DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE) {
    return true;
  }

  return pathname === DEFAULT_DOCS_API_ROUTE && resolveDocsSkillFormat(url) === "skill";
}

export function resolveDocsSkillFormat(url: URL): "skill" | null {
  return url.searchParams.get("format")?.trim() === "skill" ? "skill" : null;
}

function isDocsAgentsPath(pathname: string): boolean {
  return (
    pathname === DEFAULT_AGENTS_MD_ROUTE ||
    pathname === DEFAULT_AGENTS_MD_WELL_KNOWN_ROUTE ||
    pathname === DEFAULT_AGENT_MD_ROUTE ||
    pathname === DEFAULT_AGENT_MD_WELL_KNOWN_ROUTE
  );
}

export function isDocsAgentsRequest(url: URL): boolean {
  const pathname = normalizeDocsUrlPath(url.pathname);
  if (isDocsAgentsPath(pathname)) return true;

  return pathname === DEFAULT_DOCS_API_ROUTE && resolveDocsAgentsFormat(url) === "agents";
}

export function resolveDocsAgentsFormat(url: URL): "agents" | null {
  return url.searchParams.get("format")?.trim() === "agents" ? "agents" : null;
}

export function isDocsPublicGetRequest(
  entry: string,
  url: URL,
  request: Request,
  options: {
    sitemap?: boolean | DocsSitemapConfig;
    llms?: boolean | DocsLlmsDiscoveryConfig | LlmsTxtConfig;
    robots?: boolean | DocsRobotsConfig;
  } = {},
): boolean {
  const pathname = normalizeDocsUrlPath(url.pathname);
  if (pathname === DEFAULT_DOCS_API_ROUTE || pathname === DEFAULT_MCP_ROUTE) return false;

  return (
    isDocsAgentDiscoveryRequest(url) ||
    isDocsAgentsRequest(url) ||
    isDocsSkillRequest(url) ||
    (pathname === DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE &&
      isRobotsDiscoveryEnabled(options.robots)) ||
    resolveDocsLlmsTxtRequest(url, options.llms, entry) !== null ||
    resolveDocsSitemapRequest(url, options.sitemap) !== null ||
    resolveDocsMarkdownRequest(entry, url, request) !== null
  );
}

export function isDocsLlmsTxtPublicRequest(
  url: URL,
  llms?: boolean | DocsLlmsDiscoveryConfig | LlmsTxtConfig,
  basePath?: string,
): boolean {
  const pathname = normalizeDocsUrlPath(url.pathname);
  return (
    pathname !== DEFAULT_DOCS_API_ROUTE && resolveDocsLlmsTxtRequest(url, llms, basePath) !== null
  );
}

export function resolveDocsLlmsTxtFormat(url: URL, basePath?: string): "llms" | "llms-full" | null {
  return resolveDocsLlmsTxtRequest(url, undefined, basePath)?.format ?? null;
}

export function resolveDocsMarkdownRequest(
  entry: string,
  url: URL,
  request: Request,
): { requestedPath: string } | null {
  const pathname = normalizeDocsUrlPath(url.pathname);
  const format = url.searchParams.get("format")?.trim();
  if (pathname === DEFAULT_DOCS_API_ROUTE && format === "markdown") {
    return {
      requestedPath: url.searchParams.get("path")?.trim() ?? "",
    };
  }

  const normalizedEntry = `/${normalizeDocsPathSegment(entry) || "docs"}`;

  if (pathname === `${normalizedEntry}.md`) {
    return { requestedPath: "" };
  }

  const slugPrefix = `${normalizedEntry}/`;
  if (pathname.startsWith(slugPrefix) && pathname.endsWith(".md")) {
    return {
      requestedPath: pathname.slice(slugPrefix.length, -3),
    };
  }

  if (
    acceptsDocsMarkdown(request) ||
    hasDocsMarkdownSignatureAgent(request) ||
    detectDocsMarkdownAgentRequest(request).detected
  ) {
    if (pathname === normalizedEntry) {
      return { requestedPath: "" };
    }

    if (pathname.startsWith(slugPrefix)) {
      return {
        requestedPath: pathname.slice(slugPrefix.length),
      };
    }
  }

  return null;
}

export function hasDocsMarkdownSignatureAgent(request: Request): boolean {
  return Boolean(request.headers.get(DOCS_MARKDOWN_SIGNATURE_AGENT_HEADER)?.trim());
}

export type DocsMarkdownAgentDetection =
  | { detected: true; method: "signature_agent" | "user_agent" | "heuristic" }
  | { detected: false; method: null };

export function detectDocsMarkdownAgentRequest(request: Request): DocsMarkdownAgentDetection {
  if (hasDocsMarkdownSignatureAgent(request)) return { detected: true, method: "signature_agent" };

  const userAgent = request.headers.get("user-agent")?.trim().toLowerCase() ?? "";
  if (!userAgent) return { detected: false, method: null };

  if (DOCS_AI_AGENT_USER_AGENT_PATTERNS.some((pattern) => userAgent.includes(pattern))) {
    return { detected: true, method: "user_agent" };
  }

  const secFetchMode = request.headers.get("sec-fetch-mode");
  if (!secFetchMode && DOCS_BOT_LIKE_USER_AGENT_PATTERN.test(userAgent)) {
    const isTraditionalBot = DOCS_TRADITIONAL_BOT_USER_AGENT_PATTERNS.some((pattern) =>
      userAgent.includes(pattern),
    );
    if (!isTraditionalBot) return { detected: true, method: "heuristic" };
  }

  return { detected: false, method: null };
}

export function getDocsMarkdownVaryHeader(request: Request): string | null {
  const values = new Set<string>();

  if (acceptsDocsMarkdown(request)) values.add("Accept");

  if (hasDocsMarkdownSignatureAgent(request)) {
    values.add("Accept");
    values.add(DOCS_MARKDOWN_SIGNATURE_AGENT_HEADER);
  }

  const agentDetection = detectDocsMarkdownAgentRequest(request);
  if (agentDetection.detected && agentDetection.method !== "signature_agent") {
    values.add("User-Agent");
    if (agentDetection.method === "heuristic") values.add("Sec-Fetch-Mode");
  }

  return values.size > 0 ? Array.from(values).join(", ") : null;
}

const DOCS_MARKDOWN_RECOVERY_MATCH_LIMIT = 5;
const DOCS_MARKDOWN_RECOVERY_REDIRECT_CONFIDENCE = 0.99;
const DOCS_MARKDOWN_RECOVERY_SLUG_MAX_LENGTH = 256;

function normalizeDocsRecoveryText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.md$/i, "")
    .replace(/[#?].*$/g, "")
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeDocsRecoverySlug(entry: string, value: string): string {
  const withoutHash = value.split("#", 1)[0] ?? value;
  const withoutQuery = withoutHash.split("?", 1)[0] ?? withoutHash;
  const withoutMarkdown = withoutQuery.replace(/\.md$/i, "");
  const normalizedPath = normalizeDocsUrlPath(
    withoutMarkdown.startsWith("/") ? withoutMarkdown : `/${withoutMarkdown}`,
  );
  const normalizedEntry = `/${normalizeDocsPathSegment(entry) || "docs"}`;

  if (normalizedPath === normalizedEntry) return "";
  if (normalizedPath.startsWith(`${normalizedEntry}/`)) {
    return normalizeDocsPathSegment(normalizedPath.slice(normalizedEntry.length + 1));
  }

  return normalizeDocsPathSegment(normalizedPath);
}

function limitDocsRecoverySlug(value: string): string {
  return value.slice(0, DOCS_MARKDOWN_RECOVERY_SLUG_MAX_LENGTH);
}

function tokenizeDocsRecoveryText(value: string): string[] {
  return normalizeDocsRecoveryText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    [previous, current] = [current, previous];
  }

  return previous[b.length] ?? Math.max(a.length, b.length);
}

function normalizedEditSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return Math.max(0, 1 - levenshteinDistance(a, b) / maxLength);
}

function tokenOverlapScore(requestedTokens: string[], candidateTokens: string[]): number {
  if (requestedTokens.length === 0 || candidateTokens.length === 0) return 0;
  const candidates = new Set(candidateTokens);
  const matches = requestedTokens.filter((token) => candidates.has(token)).length;
  return matches / requestedTokens.length;
}

function sameDocsRecoveryParent(a: string, b: string): boolean {
  const aParts = a.split("/").filter(Boolean);
  const bParts = b.split("/").filter(Boolean);
  if (aParts.length !== bParts.length || aParts.length === 0) return false;
  return aParts.slice(0, -1).join("/") === bParts.slice(0, -1).join("/");
}

function scoreDocsMarkdownRecoveryMatch({
  entry,
  requestedPath,
  page,
}: {
  entry: string;
  requestedPath: string;
  page: DocsMarkdownPage;
}): number {
  const requestedSlug = limitDocsRecoverySlug(normalizeDocsRecoverySlug(entry, requestedPath));
  const pageSlug = limitDocsRecoverySlug(normalizeDocsRecoverySlug(entry, page.url));
  const requestedLast = requestedSlug.split("/").filter(Boolean).at(-1) ?? requestedSlug;
  const pageLast = pageSlug.split("/").filter(Boolean).at(-1) ?? pageSlug;
  const title = normalizeDocsRecoveryText(page.title);
  const requestedText = normalizeDocsRecoveryText(requestedSlug.replace(/\//g, " "));
  const requestedTokens = tokenizeDocsRecoveryText(requestedText);
  const candidateTokens = tokenizeDocsRecoveryText(
    [pageSlug.replace(/\//g, " "), page.title, page.description ?? ""].join(" "),
  );

  const pathDistance = levenshteinDistance(requestedSlug, pageSlug);
  const segmentDistance = levenshteinDistance(requestedLast, pageLast);
  if (
    requestedSlug &&
    pageSlug &&
    ((sameDocsRecoveryParent(requestedSlug, pageSlug) && segmentDistance <= 1) || pathDistance <= 1)
  ) {
    return 0.995;
  }

  const pathSimilarity = normalizedEditSimilarity(requestedSlug, pageSlug);
  const segmentSimilarity = normalizedEditSimilarity(requestedLast, pageLast);
  const titleSimilarity = normalizedEditSimilarity(requestedText, title);
  const overlap = tokenOverlapScore(requestedTokens, candidateTokens);
  const substringBoost =
    requestedText &&
    (pageSlug.includes(requestedSlug) ||
      title.includes(requestedText) ||
      requestedText.includes(title))
      ? 0.12
      : 0;

  return Math.min(
    0.98,
    Math.max(
      pathSimilarity * 0.86,
      segmentSimilarity * 0.8,
      titleSimilarity * 0.72,
      overlap * 0.75,
    ) + substringBoost,
  );
}

export function resolveDocsMarkdownRecovery({
  entry = "docs",
  requestedPath,
  pages = [],
}: DocsMarkdownNotFoundOptions): DocsMarkdownRecoveryResult {
  const normalizedEntry = normalizeDocsPathSegment(entry) || "docs";
  const matches = pages
    .map((page) => ({
      page,
      confidence: scoreDocsMarkdownRecoveryMatch({
        entry: normalizedEntry,
        requestedPath,
        page,
      }),
    }))
    .filter((item) => item.confidence >= 0.35)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.page.url.localeCompare(b.page.url);
    })
    .slice(0, DOCS_MARKDOWN_RECOVERY_MATCH_LIMIT)
    .map(({ page, confidence }) => ({
      title: page.title,
      url: normalizeDocsUrlPath(page.url),
      markdownUrl: toDocsMarkdownUrl(page.url),
      description: page.description,
      confidence,
    }));

  const redirect =
    matches[0] && matches[0].confidence >= DOCS_MARKDOWN_RECOVERY_REDIRECT_CONFIDENCE
      ? matches[0]
      : undefined;

  return { matches, redirect };
}

function renderDocsMarkdownSitemapFooter(sitemap?: boolean | DocsSitemapConfig): string {
  const sitemapConfig = resolveDocsSitemapConfig(sitemap);
  const lines = ["## Sitemap", ""];

  if (sitemapConfig.enabled && sitemapConfig.markdown.enabled) {
    lines.push(`See the full [sitemap](${sitemapConfig.markdown.route}) for all pages.`);
    if (sitemapConfig.markdown.docsRoute) {
      lines.push(
        `Docs-scoped sitemap: [${sitemapConfig.markdown.docsRoute}](${sitemapConfig.markdown.docsRoute}).`,
      );
    }
    lines.push(
      `Well-known sitemap: [${sitemapConfig.markdown.wellKnownRoute}](${sitemapConfig.markdown.wellKnownRoute}).`,
    );
  } else if (sitemapConfig.enabled && sitemapConfig.xml.enabled) {
    lines.push(`See the XML [sitemap](${sitemapConfig.xml.route}) for all pages.`);
  } else {
    lines.push("Sitemap discovery is not enabled for this deployment.");
  }

  return lines.join("\n");
}

function appendDocsMarkdownSitemapFooter(
  markdown: string,
  sitemap?: boolean | DocsSitemapConfig,
): string {
  if (/^##\s+Sitemap\s*$/im.test(markdown)) return markdown;
  return `${markdown.replace(/\s+$/g, "")}\n\n${renderDocsMarkdownSitemapFooter(sitemap)}\n`;
}

function normalizeDocsMarkdownLastUpdated(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const dateOnly = trimmed.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (dateOnly) return dateOnly;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function resolveDocsMarkdownMetadataUrl(value: string, origin?: string): string {
  if (!origin) return value;
  try {
    return new URL(value, origin).toString();
  } catch {
    return value;
  }
}

function renderDocsMarkdownFrontmatter({
  title,
  description,
  canonicalUrl,
  markdownUrl,
  lastUpdated,
}: {
  title: string;
  description?: string;
  canonicalUrl: string;
  markdownUrl: string;
  lastUpdated?: string;
}): string {
  const lines = [
    "---",
    `title: ${toYamlString(title)}`,
    ...(description ? [`description: ${toYamlString(description)}`] : []),
    `canonical_url: ${toYamlString(canonicalUrl)}`,
    `markdown_url: ${toYamlString(markdownUrl)}`,
    ...(lastUpdated ? [`last_updated: ${toYamlString(lastUpdated)}`] : []),
    "---",
  ];

  return lines.join("\n");
}

function hasDocsMarkdownFrontmatter(markdown: string): boolean {
  return /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(markdown);
}

function prependDocsMarkdownFrontmatter(
  markdown: string,
  metadata: Parameters<typeof renderDocsMarkdownFrontmatter>[0],
): string {
  if (hasDocsMarkdownFrontmatter(markdown)) return markdown;
  return `${renderDocsMarkdownFrontmatter(metadata)}\n\n${markdown.replace(/^\r?\n+/, "")}`;
}

function resolveDocsMarkdownPageMetadata(
  page: DocsMarkdownPage,
  options?: DocsMarkdownDocumentOptions,
): Parameters<typeof renderDocsMarkdownFrontmatter>[0] {
  return {
    title: page.title,
    description: page.description,
    canonicalUrl: resolveDocsMarkdownMetadataUrl(page.url, options?.origin),
    markdownUrl: resolveDocsMarkdownMetadataUrl(
      page.markdownUrl ?? toDocsMarkdownUrl(page.url),
      options?.origin,
    ),
    lastUpdated: normalizeDocsMarkdownLastUpdated(page.lastmod ?? page.lastModified),
  };
}

export function renderDocsMarkdownNotFound({
  entry = "docs",
  requestedPath,
  origin,
  pages,
  sitemap,
}: DocsMarkdownNotFoundOptions): string {
  const normalizedEntry = normalizeDocsPathSegment(entry) || "docs";
  const normalizedRequest = normalizeRequestedMarkdownPath(normalizedEntry, requestedPath);
  const slugPrefix = `/${normalizedEntry}/`;
  const requestedSlug =
    normalizedRequest === `/${normalizedEntry}` ? "" : normalizedRequest.slice(slugPrefix.length);
  const encodedRequestedSlug = requestedSlug.split("/").map(encodeURIComponent).join("/");
  const requestedMarkdownRoute = toDocsMarkdownUrl(normalizedRequest);
  const requestedApiRoute = requestedSlug
    ? `${DEFAULT_DOCS_API_ROUTE}?format=markdown&path=${encodedRequestedSlug}`
    : `${DEFAULT_DOCS_API_ROUTE}?format=markdown`;
  const sitemapConfig = resolveDocsSitemapConfig(sitemap);
  const recovery = resolveDocsMarkdownRecovery({
    entry: normalizedEntry,
    requestedPath,
    pages,
  });
  const lines = [
    "# Docs Page Not Found",
    "",
    `Could not find a markdown page for \`${requestedMarkdownRoute}\`.`,
  ];

  if (recovery.matches.length > 0) {
    lines.push("", "## Closest Matches", "");
    for (const match of recovery.matches) {
      const confidence = `${Math.round(match.confidence * 1000) / 10}%`;
      lines.push(
        `- [${match.title}](${match.markdownUrl}) (${confidence} confidence)${
          match.description ? ` - ${match.description}` : ""
        }`,
      );
    }
  }

  lines.push(
    "",
    "## Recovery",
    "",
    "- If a closest match looks right, fetch that markdown URL directly.",
    "- If the match is uncertain, search the docs first and then fetch the smallest page that answers the task.",
    "- Use the sitemap routes below to browse the full docs index before guessing another slug.",
    "",
    "## Discovery Routes",
    "",
    "Use these discovery routes to find the right page:",
    "",
    `- Agent discovery spec: \`${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE}\``,
    `- Agent discovery fallback: \`${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE}\``,
    `- Agent discovery API: \`${DEFAULT_AGENT_SPEC_ROUTE}\``,
    `- Agent instructions: \`${DEFAULT_AGENTS_MD_ROUTE}\``,
    `- Search endpoint: \`${DEFAULT_DOCS_API_ROUTE}?query={query}\``,
    `- Docs index markdown: \`/${normalizedEntry}.md\``,
    `- Requested markdown API route: \`${requestedApiRoute}\``,
  );

  if (sitemapConfig.enabled) {
    if (sitemapConfig.markdown.enabled) {
      lines.push(`- Semantic sitemap: \`${sitemapConfig.markdown.route}\``);
      if (sitemapConfig.markdown.docsRoute) {
        lines.push(`- Docs-scoped sitemap alias: \`${sitemapConfig.markdown.docsRoute}\``);
      }
      lines.push(
        `- Semantic sitemap well-known alias: \`${sitemapConfig.markdown.wellKnownRoute}\``,
      );
    }

    if (sitemapConfig.xml.enabled) {
      lines.push(`- XML sitemap: \`${sitemapConfig.xml.route}\``);
    }
  } else {
    lines.push(
      `- Sitemap discovery, if enabled: \`${DEFAULT_SITEMAP_MD_ROUTE}\`, \`${DEFAULT_SITEMAP_MD_DOCS_ROUTE}\`, \`${DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE}\`, or \`${DEFAULT_SITEMAP_XML_ROUTE}\``,
    );
  }

  lines.push(
    "",
    "The agent discovery spec is the safest first step because it lists the active markdown, sitemap, robots, search, MCP, and feedback routes for this deployment.",
  );

  const document = prependDocsMarkdownFrontmatter(lines.join("\n"), {
    title: "Docs Page Not Found",
    description: `Could not find a markdown page for ${requestedMarkdownRoute}.`,
    canonicalUrl: resolveDocsMarkdownMetadataUrl(normalizedRequest, origin),
    markdownUrl: resolveDocsMarkdownMetadataUrl(requestedMarkdownRoute, origin),
  });

  return appendDocsMarkdownSitemapFooter(document, sitemap);
}

function hashDocsMarkdownRepresentation(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function createDocsMarkdownEtag(document: string): string {
  return `W/"${document.length.toString(16)}-${hashDocsMarkdownRepresentation(document)}"`;
}

function normalizeDocsMarkdownEtag(value: string): string {
  return value.trim().replace(/^W\//i, "");
}

function requestMatchesDocsMarkdownEtag(request: Request, etag: string): boolean {
  const header = request.headers.get("if-none-match");
  if (!header) return false;
  if (header.trim() === "*") return true;
  const expected = normalizeDocsMarkdownEtag(etag);
  return header.split(",").some((candidate) => normalizeDocsMarkdownEtag(candidate) === expected);
}

function resolveDocsMarkdownHttpDate(value?: string | Date | null): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string" && !/(?:T|\s)\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?/.test(value.trim())) {
    return undefined;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toUTCString();
}

function extractDocsMarkdownLastModified(document: string): string | undefined {
  const frontmatter = document.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) return undefined;
  const raw = frontmatter.match(/^last_updated:\s*(.+?)\s*$/m)?.[1]?.trim();
  if (!raw) return undefined;
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return raw.slice(1, -1);
  }
  return raw;
}

function requestHasFreshDocsMarkdownDate(request: Request, lastModified?: string): boolean {
  if (!lastModified || request.headers.has("if-none-match")) return false;
  const ifModifiedSince = request.headers.get("if-modified-since");
  if (!ifModifiedSince) return false;
  const resourceTime = Date.parse(lastModified);
  const requestTime = Date.parse(ifModifiedSince);
  return (
    Number.isFinite(resourceTime) &&
    Number.isFinite(requestTime) &&
    Math.floor(resourceTime / 1000) <= Math.floor(requestTime / 1000)
  );
}

function resolveDocsMarkdownContentLocation(canonicalUrl: string): string {
  const url = new URL(canonicalUrl);
  url.pathname = toDocsMarkdownUrl(url.pathname);
  return url.toString();
}

/** Build one standards-aware Markdown response for every framework adapter. */
export function createDocsMarkdownResponse(options: DocsMarkdownResponseOptions): Response {
  const {
    request,
    document,
    entry = "docs",
    requestedPath,
    origin = new URL(request.url).origin,
    pages,
    sitemap,
    locale,
  } = options;
  const canonicalUrl =
    options.canonicalUrl ??
    resolveDocsMarkdownCanonicalUrl({ origin, entry, requestedPath, locale });
  const contentLocation =
    options.contentLocation ?? resolveDocsMarkdownContentLocation(canonicalUrl);
  const varyHeader = getDocsMarkdownVaryHeader(request);
  const sharedHeaders: Record<string, string> = {
    "Content-Location": contentLocation,
    Link: `<${canonicalUrl}>; rel="canonical"`,
    "X-Robots-Tag": "noindex",
    ...(locale ? { "Content-Language": locale } : {}),
    ...(varyHeader ? { Vary: varyHeader } : {}),
  };

  if (!document) {
    const recovery = resolveDocsMarkdownRecovery({ entry, requestedPath, pages, sitemap });
    if (recovery.redirect) {
      return new Response(null, {
        status: 307,
        headers: {
          ...sharedHeaders,
          "Cache-Control": "no-store",
          Location: new URL(recovery.redirect.markdownUrl, request.url).toString(),
        },
      });
    }

    return new Response(
      renderDocsMarkdownNotFound({ entry, requestedPath, origin, pages, sitemap }),
      {
        status: 404,
        headers: {
          ...sharedHeaders,
          "Cache-Control": "no-store",
          "Content-Type": "text/markdown; charset=utf-8",
        },
      },
    );
  }

  const etag = createDocsMarkdownEtag(document);
  const lastModified = resolveDocsMarkdownHttpDate(
    options.lastModified ?? extractDocsMarkdownLastModified(document),
  );
  const responseHeaders: Record<string, string> = {
    ...sharedHeaders,
    "Cache-Control": options.cacheControl ?? "public, max-age=0, s-maxage=3600",
    "Content-Type": "text/markdown; charset=utf-8",
    ETag: etag,
    ...(lastModified ? { "Last-Modified": lastModified } : {}),
  };

  if (
    requestMatchesDocsMarkdownEtag(request, etag) ||
    requestHasFreshDocsMarkdownDate(request, lastModified)
  ) {
    const { "Content-Type": _contentType, ...notModifiedHeaders } = responseHeaders;
    return new Response(null, { status: 304, headers: notModifiedHeaders });
  }

  return new Response(document, { headers: responseHeaders });
}

export function findDocsMarkdownPage<T extends DocsMarkdownPage>(
  entry: string,
  pages: T[],
  requestedPath: string,
): T | null {
  const normalizedRequest = normalizeRequestedMarkdownPath(entry, requestedPath);

  for (const page of pages) {
    if (normalizeDocsUrlPath(page.url) === normalizedRequest) return page;
  }

  const normalizedSlug = normalizeDocsPathSegment(
    requestedPath.replace(/^\//, "").replace(/\.md$/i, ""),
  );
  for (const page of pages) {
    if (page.slug !== undefined && normalizeDocsPathSegment(page.slug) === normalizedSlug) {
      return page;
    }
  }

  return null;
}

function shouldRenderLlmsDirective(options?: DocsMarkdownDocumentOptions): boolean {
  if (options?.llms === false) return false;
  if (options?.llms && typeof options.llms === "object" && options.llms.enabled === false) {
    return false;
  }
  return true;
}

interface DocsAgentDocumentContext {
  normalizedEntry: string;
  siteTitle: string;
  siteDescription?: string;
  llmsEnabled: boolean;
  searchEnabled: boolean;
  mcpEnabled: boolean;
  feedbackEnabled: boolean;
  sitemapConfig: ReturnType<typeof resolveDocsSitemapConfig>;
  robotsEnabled: boolean;
  openapiConfig: DocsOpenApiResolvedDiscoveryConfig;
  feedbackRoute: string;
  feedbackSchemaRoute: string;
  llmsSections: DocsLlmsTxtResolvedSection[];
  markdownAcceptHeader: string | null;
  markdownSignatureAgentHeader: string | null;
}

type DocsAgentDocumentVariant = "skill" | "agents";

function resolveDocsAgentDocumentContext({
  entry = "docs",
  search,
  mcp,
  feedback,
  llms,
  sitemap,
  robots,
  openapi,
  markdown,
}: DocsSkillDocumentOptions): DocsAgentDocumentContext {
  const feedbackRoute = feedback?.route ?? DEFAULT_AGENT_FEEDBACK_ROUTE;

  return {
    normalizedEntry: normalizeDocsPathSegment(entry) || "docs",
    siteTitle: compactSkillText(llms?.siteTitle ?? "Documentation"),
    siteDescription: llms?.siteDescription ? compactSkillText(llms.siteDescription) : undefined,
    llmsEnabled: llms?.enabled ?? true,
    searchEnabled: isSearchEnabled(search),
    mcpEnabled: mcp.enabled,
    feedbackEnabled: feedback?.enabled ?? false,
    sitemapConfig: resolveDocsSitemapConfig(sitemap),
    robotsEnabled: isRobotsDiscoveryEnabled(robots),
    openapiConfig: resolveDocsOpenApiDiscoveryConfig(openapi),
    feedbackRoute,
    feedbackSchemaRoute: feedback?.schemaRoute ?? `${feedbackRoute}/schema`,
    llmsSections: resolveDocsLlmsTxtSections(llms),
    markdownAcceptHeader: markdown?.acceptHeader === false ? null : "text/markdown",
    markdownSignatureAgentHeader:
      markdown?.signatureAgentHeader === false ? null : DOCS_MARKDOWN_SIGNATURE_AGENT_HEADER,
  };
}

function appendDocsMarkdownNegotiationStartLines(
  lines: string[],
  context: DocsAgentDocumentContext,
  variant: DocsAgentDocumentVariant,
): void {
  if (context.markdownAcceptHeader) {
    lines.push(
      variant === "skill"
        ? `- You can also request ${context.markdownAcceptHeader} from normal page URLs.`
        : `- Normal docs pages can return markdown with Accept: ${context.markdownAcceptHeader}.`,
    );
  }

  if (context.markdownSignatureAgentHeader) {
    lines.push(
      variant === "skill"
        ? `- Requests with ${context.markdownSignatureAgentHeader} on normal page URLs receive markdown automatically.`
        : `- Normal docs pages can also return markdown when ${context.markdownSignatureAgentHeader} is present.`,
    );
  }
}

function appendDocsSearchStartLine(
  lines: string[],
  context: DocsAgentDocumentContext,
  variant: DocsAgentDocumentVariant,
): void {
  if (!context.searchEnabled) return;
  lines.push(
    variant === "skill"
      ? `- Search with ${DEFAULT_DOCS_API_ROUTE}?query={query} when you do not know the page.`
      : `- Search with ${DEFAULT_DOCS_API_ROUTE}?query={query} when the route is unknown.`,
  );
}

function appendDocsOpenApiStartLine(
  lines: string[],
  context: DocsAgentDocumentContext,
  variant: DocsAgentDocumentVariant,
): void {
  if (!context.openapiConfig.enabled || !context.openapiConfig.url) return;
  lines.push(
    variant === "skill"
      ? `- Fetch ${context.openapiConfig.url} for the machine-readable OpenAPI schema before scraping API reference pages.`
      : `- Fetch ${context.openapiConfig.url} before scraping API reference pages; prefer schemas over prose.`,
  );
}

function appendDocsLlmsStartLines(
  lines: string[],
  context: DocsAgentDocumentContext,
  variant: DocsAgentDocumentVariant,
): void {
  if (!context.llmsEnabled) return;
  lines.push(
    variant === "skill"
      ? `- Use ${DEFAULT_LLMS_TXT_ROUTE} for a compact docs index.`
      : `- Use ${DEFAULT_LLMS_TXT_ROUTE} as the compact docs map.`,
    variant === "skill"
      ? `- Use ${DEFAULT_LLMS_FULL_TXT_ROUTE} for full markdown context.`
      : `- Use ${DEFAULT_LLMS_FULL_TXT_ROUTE} when you need the full markdown bundle.`,
  );

  for (const section of context.llmsSections) {
    lines.push(
      variant === "skill"
        ? `- Use ${section.route} for the ${section.title} llms.txt section.`
        : `- Use ${section.route} for the ${section.title} section map.`,
    );
  }
}

function appendDocsSitemapStartLines(
  lines: string[],
  context: DocsAgentDocumentContext,
  variant: DocsAgentDocumentVariant,
): void {
  if (!context.sitemapConfig.enabled) return;

  if (variant === "skill") {
    if (context.sitemapConfig.xml.enabled) {
      lines.push(`- Use ${context.sitemapConfig.xml.route} to check canonical page freshness.`);
    }
    if (context.sitemapConfig.markdown.enabled) {
      lines.push(`- Use ${context.sitemapConfig.markdown.route} for a semantic docs map.`);
    }
    return;
  }

  if (context.sitemapConfig.markdown.enabled) {
    lines.push(
      `- Use ${context.sitemapConfig.markdown.route} for a semantic sitemap with sections.`,
    );
  }
  if (context.sitemapConfig.xml.enabled) {
    lines.push(
      `- Use ${context.sitemapConfig.xml.route} for canonical URLs and freshness metadata.`,
    );
  }
}

function appendDocsRobotsStartLine(
  lines: string[],
  context: DocsAgentDocumentContext,
  variant: DocsAgentDocumentVariant,
): void {
  if (!context.robotsEnabled) return;
  lines.push(
    variant === "skill"
      ? `- Check ${DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE} for crawler and AI-agent access policy.`
      : `- Check ${DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE} before crawling broadly.`,
  );
}

function appendDocsMcpStartLine(
  lines: string[],
  context: DocsAgentDocumentContext,
  variant: DocsAgentDocumentVariant,
): void {
  if (!context.mcpEnabled) return;
  lines.push(
    variant === "skill"
      ? `- Use ${DEFAULT_MCP_WELL_KNOWN_ROUTE} or ${DEFAULT_MCP_PUBLIC_ROUTE} for MCP tools when your environment supports MCP.`
      : `- Use MCP at ${DEFAULT_MCP_PUBLIC_ROUTE} or ${DEFAULT_MCP_WELL_KNOWN_ROUTE} when your environment supports MCP tools.`,
  );
}

function appendDocsFeedbackStartLine(
  lines: string[],
  context: DocsAgentDocumentContext,
  variant: DocsAgentDocumentVariant,
): void {
  if (!context.feedbackEnabled) return;
  lines.push(
    variant === "skill"
      ? `- Read ${context.feedbackSchemaRoute} before posting agent feedback to ${context.feedbackRoute}.`
      : `- Read ${context.feedbackSchemaRoute} before posting feedback to ${context.feedbackRoute}.`,
  );
}

function appendDocsAgentStartHereLines(
  lines: string[],
  context: DocsAgentDocumentContext,
  variant: DocsAgentDocumentVariant,
): void {
  lines.push(
    variant === "skill"
      ? `- Fetch ${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE}; fall back to ${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE} or ${DEFAULT_AGENT_SPEC_ROUTE}.`
      : `- Read ${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE} first; fall back to ${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE} or ${DEFAULT_AGENT_SPEC_ROUTE}.`,
    variant === "skill"
      ? `- Fetch /${context.normalizedEntry}.md for the root docs page.`
      : `- Read /${context.normalizedEntry}.md for the root docs page.`,
    variant === "skill"
      ? `- Fetch /${context.normalizedEntry}/{slug}.md for page-specific context.`
      : `- Read /${context.normalizedEntry}/{slug}.md for page-specific context.`,
  );

  if (variant === "skill") {
    appendDocsMarkdownNegotiationStartLines(lines, context, variant);
    appendDocsSearchStartLine(lines, context, variant);
    appendDocsOpenApiStartLine(lines, context, variant);
    appendDocsLlmsStartLines(lines, context, variant);
    appendDocsSitemapStartLines(lines, context, variant);
    appendDocsRobotsStartLine(lines, context, variant);
    appendDocsMcpStartLine(lines, context, variant);
    appendDocsFeedbackStartLine(lines, context, variant);
    return;
  }

  appendDocsLlmsStartLines(lines, context, variant);
  appendDocsSitemapStartLines(lines, context, variant);
  appendDocsRobotsStartLine(lines, context, variant);
  appendDocsSearchStartLine(lines, context, variant);
  appendDocsOpenApiStartLine(lines, context, variant);
  appendDocsMcpStartLine(lines, context, variant);
  appendDocsFeedbackStartLine(lines, context, variant);
  appendDocsMarkdownNegotiationStartLines(lines, context, variant);
}

function appendDocsLlmsRouteLines(lines: string[], context: DocsAgentDocumentContext): void {
  if (!context.llmsEnabled) return;
  lines.push(
    `- llms.txt: ${DEFAULT_LLMS_TXT_ROUTE}`,
    `- llms-full.txt: ${DEFAULT_LLMS_FULL_TXT_ROUTE}`,
    `- llms well-known aliases: ${DEFAULT_LLMS_TXT_WELL_KNOWN_ROUTE}, ${DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE}`,
  );
  for (const section of context.llmsSections) {
    lines.push(`- ${section.title} llms.txt: ${section.route}`);
    lines.push(`- ${section.title} llms-full.txt: ${section.fullRoute}`);
  }
}

function appendDocsOpenApiRouteLines(lines: string[], context: DocsAgentDocumentContext): void {
  if (!context.openapiConfig.enabled || !context.openapiConfig.url) return;
  lines.push(`- OpenAPI schema: ${context.openapiConfig.url}`);
  if (context.openapiConfig.apiReferencePath) {
    lines.push(`- API reference: ${context.openapiConfig.apiReferencePath}`);
  }
}

function appendDocsSitemapRouteLines(lines: string[], context: DocsAgentDocumentContext): void {
  if (!context.sitemapConfig.enabled) return;
  if (context.sitemapConfig.xml.enabled)
    lines.push(`- Sitemap XML: ${context.sitemapConfig.xml.route}`);
  if (context.sitemapConfig.markdown.enabled) {
    lines.push(
      `- Sitemap Markdown: ${context.sitemapConfig.markdown.route}`,
      ...(context.sitemapConfig.markdown.docsRoute
        ? [`- Sitemap docs alias: ${context.sitemapConfig.markdown.docsRoute}`]
        : []),
      `- Sitemap well-known alias: ${context.sitemapConfig.markdown.wellKnownRoute}`,
    );
  }
}

function appendDocsMcpRouteLines(lines: string[], context: DocsAgentDocumentContext): void {
  if (!context.mcpEnabled) return;
  lines.push(`- MCP: ${DEFAULT_MCP_PUBLIC_ROUTE}, ${DEFAULT_MCP_WELL_KNOWN_ROUTE}`);
}

function appendDocsAgentPublicRouteLines(
  lines: string[],
  context: DocsAgentDocumentContext,
  variant: DocsAgentDocumentVariant,
): void {
  if (variant === "skill") {
    lines.push(
      `- Agent instructions: ${DEFAULT_AGENTS_MD_ROUTE}`,
      `- Agent instructions well-known alias: ${DEFAULT_AGENTS_MD_WELL_KNOWN_ROUTE}`,
      `- Agent instructions API format: ${DEFAULT_DOCS_API_ROUTE}?format=agents`,
      `- Skill document: ${DEFAULT_SKILL_MD_ROUTE}`,
      `- Skill well-known alias: ${DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE}`,
      `- Skill API format: ${DEFAULT_DOCS_API_ROUTE}?format=skill`,
      `- Agent discovery: ${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE}`,
      `- Agent discovery fallback: ${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE}`,
      `- Markdown root: /${context.normalizedEntry}.md`,
      `- Markdown pages: /${context.normalizedEntry}/{slug}.md`,
    );

    if (context.robotsEnabled) {
      lines.push(`- Robots policy: ${DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE}`);
    }
    appendDocsLlmsRouteLines(lines, context);
    appendDocsOpenApiRouteLines(lines, context);
    appendDocsSitemapRouteLines(lines, context);
    appendDocsMcpRouteLines(lines, context);
    return;
  }

  lines.push(
    `- Agent instructions: ${DEFAULT_AGENTS_MD_ROUTE}`,
    `- Agent instructions well-known alias: ${DEFAULT_AGENTS_MD_WELL_KNOWN_ROUTE}`,
    `- Agent instructions API format: ${DEFAULT_DOCS_API_ROUTE}?format=agents`,
    `- Agent instructions aliases: ${DEFAULT_AGENT_MD_ROUTE}, ${DEFAULT_AGENT_MD_WELL_KNOWN_ROUTE}`,
    `- Site skill: ${DEFAULT_SKILL_MD_ROUTE}`,
    `- Site skill well-known alias: ${DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE}`,
    `- Site skill API format: ${DEFAULT_DOCS_API_ROUTE}?format=skill`,
    `- Markdown root: /${context.normalizedEntry}.md`,
    `- Markdown pages: /${context.normalizedEntry}/{slug}.md`,
    `- Agent discovery: ${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE}`,
    `- Agent discovery fallback: ${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE}`,
  );

  appendDocsLlmsRouteLines(lines, context);
  if (context.robotsEnabled) {
    lines.push(`- Robots policy: ${DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE}`);
  }
  appendDocsSitemapRouteLines(lines, context);
  appendDocsOpenApiRouteLines(lines, context);
  appendDocsMcpRouteLines(lines, context);
}

export function renderDocsMarkdownDocument(
  page: DocsMcpPage | DocsSearchSourcePage,
  options?: DocsMarkdownDocumentOptions,
): string;
export function renderDocsMarkdownDocument(
  page: DocsMarkdownPage,
  options?: DocsMarkdownDocumentOptions,
): string;
export function renderDocsMarkdownDocument(
  page: DocsMarkdownPage,
  options?: DocsMarkdownDocumentOptions,
): string {
  if (page.agentRawContent !== undefined) {
    return appendDocsMarkdownSitemapFooter(
      prependDocsMarkdownFrontmatter(
        page.agentRawContent,
        resolveDocsMarkdownPageMetadata(page, options),
      ),
      options?.sitemap,
    );
  }

  const relatedLines = renderDocsRelatedMarkdownLines(page.related);
  const lines = [`# ${page.title}`, `URL: ${page.url}`];
  if (shouldRenderLlmsDirective(options)) lines.push(DOCS_LLMS_TXT_DIRECTIVE_LINE);
  if (page.description) lines.push(`Description: ${page.description}`);
  lines.push(...relatedLines);
  lines.push("", page.agentFallbackRawContent ?? page.rawContent ?? page.content);
  return appendDocsMarkdownSitemapFooter(
    prependDocsMarkdownFrontmatter(
      lines.join("\n"),
      resolveDocsMarkdownPageMetadata(page, options),
    ),
    options?.sitemap,
  );
}

export function renderDocsSkillDocument(options: DocsSkillDocumentOptions): string {
  const { origin } = options;
  const context = resolveDocsAgentDocumentContext(options);
  const description = truncateSkillDescription(
    `Use ${context.siteTitle} through markdown routes, llms.txt, robots.txt, agent discovery, search, and MCP when available.`,
  );
  const lines = [
    "---",
    "name: docs",
    `description: ${toYamlString(description)}`,
    "---",
    "",
    `# ${context.siteTitle} Skill`,
    "",
    `Base URL: ${origin}`,
  ];

  if (context.siteDescription) {
    lines.push(`Description: ${context.siteDescription}`);
  }

  lines.push(
    "",
    "## When To Use",
    "Use this skill when you need to read or implement against this documentation site.",
    "",
    "## Start Here",
  );
  appendDocsAgentStartHereLines(lines, context, "skill");

  lines.push("", "## Routes");
  appendDocsAgentPublicRouteLines(lines, context, "skill");

  lines.push(
    "",
    "## Reusable Framework Skills",
    "For framework setup, CLI, page actions, Ask AI, or configuration work, install the reusable Farming Labs skills:",
    "",
    "```sh",
    "npx skills add farming-labs/docs",
    "```",
  );

  return lines.join("\n");
}

export function renderDocsAgentsDocument(options: DocsAgentsDocumentOptions): string {
  const { origin } = options;
  const context = resolveDocsAgentDocumentContext(options);

  const lines = ["# Agent Instructions", "", `Site: ${context.siteTitle}`, `Base URL: ${origin}`];

  if (context.siteDescription) {
    lines.push(`Description: ${context.siteDescription}`);
  }

  lines.push("", "## Start Here");
  appendDocsAgentStartHereLines(lines, context, "agents");

  lines.push(
    "",
    "## Working Rules",
    "- Prefer markdown routes, llms.txt, sitemap.md, OpenAPI schemas, and MCP tools over scraping rendered HTML.",
    "- Treat generated context files as discovery aids, then fetch the smallest page or section that answers the task.",
    "- Preserve canonical docs URLs when citing pages back to humans.",
    "- If a markdown route returns a recovery page, use its closest matches, sitemap, and discovery spec before guessing another slug.",
    "",
    "## Public Routes",
  );
  appendDocsAgentPublicRouteLines(lines, context, "agents");

  lines.push(
    "",
    "## Framework Maintenance",
    "- For @farming-labs/docs projects, keep the framework package current before debugging missing agent surfaces.",
    "",
    "```sh",
    "npx @farming-labs/docs@latest upgrade --latest",
    "```",
    "",
    "- For framework setup, configuration, CLI, Ask AI, page actions, or theme work, install the reusable Skills pack:",
    "",
    "```sh",
    "npx skills add farming-labs/docs",
    "```",
  );

  return lines.join("\n");
}

export function resolveDocsAgentMdxContent(content: string, audience: "human" | "agent"): string {
  const lines = content.split("\n");
  const output: string[] = [];
  let fenceMarker: string | null = null;
  let agentDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      if (!fenceMarker) {
        fenceMarker = fenceMatch[1];
      } else if (trimmed.startsWith(fenceMarker)) {
        fenceMarker = null;
      }

      if (audience === "agent" || agentDepth === 0) {
        output.push(line);
      }
      continue;
    }

    if (!fenceMarker) {
      if (/^<Agent(?:\s[^>]*)?\/>$/.test(trimmed)) {
        continue;
      }

      const singleLineMatch = line.match(/^(\s*)<Agent(?:\s[^>]*)?>([\s\S]*?)<\/Agent>\s*$/);
      if (singleLineMatch) {
        if (audience === "agent" && singleLineMatch[2]) {
          output.push(`${singleLineMatch[1]}${singleLineMatch[2]}`);
        }
        continue;
      }

      const openMatch = line.match(/^(\s*)<Agent(?:\s[^>]*)?>\s*$/);
      if (openMatch) {
        agentDepth += 1;
        continue;
      }

      const openWithContentMatch = line.match(/^(\s*)<Agent(?:\s[^>]*)?>(.*)$/);
      if (openWithContentMatch) {
        agentDepth += 1;
        if (audience === "agent" && openWithContentMatch[2]) {
          output.push(`${openWithContentMatch[1]}${openWithContentMatch[2]}`);
        }
        continue;
      }

      const closeWithContentMatch = line.match(/^(.*)<\/Agent>\s*$/);
      if (closeWithContentMatch && agentDepth > 0) {
        if (audience === "agent" && closeWithContentMatch[1].trim()) {
          output.push(closeWithContentMatch[1]);
        }
        agentDepth = Math.max(0, agentDepth - 1);
        continue;
      }

      if (/^<\/Agent>\s*$/.test(trimmed) && agentDepth > 0) {
        agentDepth = Math.max(0, agentDepth - 1);
        continue;
      }
    }

    if (agentDepth > 0 && audience === "human") {
      continue;
    }

    output.push(line);
  }

  return output
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildDocsAgentDiscoverySpec({
  origin,
  entry = "docs",
  i18n = null,
  search,
  mcp,
  feedback,
  llms,
  sitemap,
  robots,
  openapi,
  markdown,
}: DocsAgentDiscoverySpecOptions) {
  const normalizedEntry = normalizeDocsPathSegment(entry) || "docs";
  const localesEnabled = i18n !== null;
  const searchEnabled = isSearchEnabled(search);
  const feedbackRoute = feedback?.route ?? DEFAULT_AGENT_FEEDBACK_ROUTE;
  const feedbackSchemaRoute = feedback?.schemaRoute ?? `${feedbackRoute}/schema`;
  const llmsEnabled = llms?.enabled ?? true;
  const llmsSections = resolveDocsLlmsTxtSections(llms);
  const sitemapConfig = resolveDocsSitemapConfig(sitemap, { baseUrl: llms?.baseUrl });
  const robotsEnabled = isRobotsDiscoveryEnabled(robots);
  const openapiConfig = resolveDocsOpenApiDiscoveryConfig(openapi);

  return {
    version: "1",
    name: "@farming-labs/docs",
    baseUrl: origin,
    site: {
      title: llms?.siteTitle ?? "Documentation",
      description: llms?.siteDescription,
      entry: normalizedEntry,
      baseUrl: llms?.baseUrl ?? origin,
    },
    locales: {
      enabled: localesEnabled,
      available: i18n?.locales ?? [],
      default: i18n?.defaultLocale ?? null,
      queryParam: "lang",
      fallbackQueryParam: "locale",
    },
    capabilities: {
      markdownRoutes: true,
      agentMdOverrides: true,
      agentBlocks: true,
      agents: true,
      llms: llmsEnabled,
      skills: true,
      mcp: mcp.enabled,
      search: searchEnabled,
      sitemap: sitemapConfig.enabled,
      robots: robotsEnabled,
      structuredData: true,
      apiReference: openapiConfig.enabled,
      openapi: openapiConfig.enabled,
      agentFeedback: feedback?.enabled ?? false,
      locales: localesEnabled,
    },
    api: {
      docs: DEFAULT_DOCS_API_ROUTE,
      config: DEFAULT_DOCS_CONFIG_ROUTE,
      diagnostics: DEFAULT_DOCS_DIAGNOSTICS_ROUTE,
      agentSpec: DEFAULT_AGENT_SPEC_ROUTE,
      agentSpecDefault: DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
      agentSpecFallback: DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE,
      agentSpecWellKnown: DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE,
      agentSpecWellKnownJson: DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
      agentSpecQuery: `${DEFAULT_DOCS_API_ROUTE}?agent=spec`,
      agents: `${DEFAULT_DOCS_API_ROUTE}?format=agents`,
      openapi: DEFAULT_OPENAPI_SCHEMA_ROUTE,
    },
    config: {
      format: DEFAULT_DOCS_CONFIG_FORMAT,
      endpoint: DEFAULT_DOCS_CONFIG_ROUTE,
    },
    markdown: {
      enabled: true,
      acceptHeader: markdown?.acceptHeader === false ? null : "text/markdown",
      signatureAgentHeader:
        markdown?.signatureAgentHeader === false ? null : DOCS_MARKDOWN_SIGNATURE_AGENT_HEADER,
      pagePattern: `/${normalizedEntry}/{slug}.md`,
      rootPage: `/${normalizedEntry}.md`,
      apiPattern: `${DEFAULT_DOCS_API_ROUTE}?format=markdown&path={slug}`,
      resolutionOrder: ["agent.md", "Agent blocks", "page markdown"],
    },
    llms: {
      enabled: llmsEnabled,
      defaultTxt: DEFAULT_LLMS_TXT_ROUTE,
      defaultFull: DEFAULT_LLMS_FULL_TXT_ROUTE,
      txt: `${DEFAULT_DOCS_API_ROUTE}?format=llms`,
      full: `${DEFAULT_DOCS_API_ROUTE}?format=llms-full`,
      publicTxt: DEFAULT_LLMS_TXT_ROUTE,
      publicFull: DEFAULT_LLMS_FULL_TXT_ROUTE,
      wellKnownTxt: DEFAULT_LLMS_TXT_WELL_KNOWN_ROUTE,
      wellKnownFull: DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE,
      ...(llmsSections.length > 0
        ? {
            sections: llmsSections.map((section) => ({
              title: section.title,
              description: section.description,
              match: section.match,
              txt: section.route,
              full: section.fullRoute,
            })),
          }
        : {}),
    },
    sitemap: {
      enabled: sitemapConfig.enabled,
      xml: {
        enabled: sitemapConfig.xml.enabled,
        route: sitemapConfig.xml.route,
        api: `${DEFAULT_DOCS_API_ROUTE}?format=sitemap-xml`,
        defaultRoute: DEFAULT_SITEMAP_XML_ROUTE,
      },
      markdown: {
        enabled: sitemapConfig.markdown.enabled,
        route: sitemapConfig.markdown.route,
        docsRoute: sitemapConfig.markdown.docsRoute,
        wellKnownRoute: sitemapConfig.markdown.wellKnownRoute,
        api: `${DEFAULT_DOCS_API_ROUTE}?format=sitemap-md`,
        defaultRoute: DEFAULT_SITEMAP_MD_ROUTE,
        defaultDocsRoute: DEFAULT_SITEMAP_MD_DOCS_ROUTE,
        defaultWellKnownRoute: DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE,
      },
    },
    robots: {
      enabled: robotsEnabled,
      route: DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE,
      defaultRoute: DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE,
    },
    structuredData: {
      enabled: true,
      format: "application/ld+json",
      schema: "https://schema.org/TechArticle",
      fields: ["headline", "description", "url", "dateModified", "breadcrumb"],
      canonicalUrlField: "url",
      breadcrumbType: "BreadcrumbList",
    },
    openapi: {
      enabled: openapiConfig.enabled,
      url: openapiConfig.url ?? null,
      source: openapiConfig.source ?? null,
      specUrl: openapiConfig.specUrl ?? null,
      apiReferencePath: openapiConfig.apiReferencePath ?? null,
      format: "OpenAPI 3.1",
    },
    search: {
      enabled: searchEnabled,
      endpoint: `${DEFAULT_DOCS_API_ROUTE}?query={query}`,
      method: "GET",
      queryParam: "query",
      localeParam: "lang",
    },
    agents: {
      enabled: true,
      file: "AGENTS.md",
      route: DEFAULT_AGENTS_MD_ROUTE,
      wellKnown: DEFAULT_AGENTS_MD_WELL_KNOWN_ROUTE,
      api: `${DEFAULT_DOCS_API_ROUTE}?format=agents`,
      generatedFallback: true,
      aliases: [DEFAULT_AGENT_MD_ROUTE, DEFAULT_AGENT_MD_WELL_KNOWN_ROUTE],
    },
    skills: {
      enabled: true,
      file: "skill.md",
      route: DEFAULT_SKILL_MD_ROUTE,
      wellKnown: DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE,
      api: `${DEFAULT_DOCS_API_ROUTE}?format=skill`,
      generatedFallback: true,
      registry: "skills.sh",
      install: "npx skills add farming-labs/docs",
      recommended: [
        {
          name: "getting-started",
          description:
            "Use for installation, init, framework setup, theme CSS, and first docs.config wiring.",
        },
      ],
    },
    mcp: {
      enabled: mcp.enabled,
      endpoint: mcp.route,
      defaultEndpoint: DEFAULT_MCP_PUBLIC_ROUTE,
      publicEndpoint: DEFAULT_MCP_PUBLIC_ROUTE,
      wellKnownEndpoint: DEFAULT_MCP_WELL_KNOWN_ROUTE,
      publicEndpoints: [DEFAULT_MCP_PUBLIC_ROUTE, DEFAULT_MCP_WELL_KNOWN_ROUTE],
      canonicalEndpoint: DEFAULT_MCP_ROUTE,
      name: mcp.name,
      version: mcp.version,
      tools: mcp.tools,
    },
    feedback: {
      enabled: feedback?.enabled ?? false,
      schema: feedbackSchemaRoute,
      submit: feedbackRoute,
      schemaQuery: `${DEFAULT_DOCS_API_ROUTE}?feedback=agent&schema=1`,
      submitQuery: `${DEFAULT_DOCS_API_ROUTE}?feedback=agent`,
    },
    instructions: {
      preferMarkdownRoutes: true,
      useMcpWhenAvailable: true,
      useOpenApiWhenAvailable: true,
      readFeedbackSchemaBeforeSubmitting: true,
      doNotAssumeFeedbackPayloadShape: true,
    },
  };
}

export function acceptsDocsMarkdown(request: Request): boolean {
  const accept = request.headers.get("accept");
  if (!accept) return false;
  const ranges = accept.split(",").map((value) => {
    const [rawMediaType = "", ...params] = value
      .split(";")
      .map((part) => part.trim().toLowerCase());
    const qualityParam = params.find((param) => param.split("=", 1)[0]?.trim() === "q");
    const parsedQuality = qualityParam
      ? Number.parseFloat(qualityParam.slice(qualityParam.indexOf("=") + 1).trim())
      : 1;
    return {
      mediaType: rawMediaType,
      quality: Number.isFinite(parsedQuality) ? Math.min(1, Math.max(0, parsedQuality)) : 0,
    };
  });
  const qualityFor = (mediaType: string): number | undefined => {
    const matches = ranges.filter((range) => range.mediaType === mediaType);
    return matches.length > 0 ? Math.max(...matches.map((range) => range.quality)) : undefined;
  };
  const markdownQuality = qualityFor("text/markdown");
  if (!markdownQuality || markdownQuality <= 0) return false;

  const htmlQuality = qualityFor("text/html") ?? qualityFor("text/*") ?? qualityFor("*/*");
  return htmlQuality === undefined || htmlQuality <= markdownQuality;
}

function buildDocsUserAgentHeaderPattern(patterns: readonly string[]): string {
  return `.*(?:${patterns.map(toCaseInsensitiveHeaderPattern).join("|")}).*`;
}

function toCaseInsensitiveHeaderPattern(value: string): string {
  return value
    .split("")
    .map((char) => {
      if (/^[a-z]$/i.test(char)) return `[${char.toLowerCase()}${char.toUpperCase()}]`;
      return escapeRegex(char);
    })
    .join("");
}

function escapeRegex(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function normalizeRequestedMarkdownPath(entry: string, requestedPath: string): string {
  const normalizedEntry = `/${normalizeDocsPathSegment(entry) || "docs"}`;
  const trimmed = requestedPath.trim().replace(/\.md$/i, "");
  if (!trimmed) return normalizedEntry;

  const normalized = normalizeDocsUrlPath(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
  if (normalized === normalizedEntry || normalized.startsWith(`${normalizedEntry}/`)) {
    return normalized;
  }

  const slug = normalizeDocsPathSegment(trimmed);
  return slug ? normalizeDocsUrlPath(`${normalizedEntry}/${slug}`) : normalizedEntry;
}

function isSearchEnabled(search?: boolean | DocsSearchConfig): boolean {
  if (search === false) return false;
  if (search && typeof search === "object" && search.enabled === false) return false;
  return true;
}

function isRobotsDiscoveryEnabled(robots?: boolean | DocsRobotsConfig): boolean {
  if (robots === false) return false;
  if (robots && typeof robots === "object" && robots.enabled === false) return false;
  return true;
}

export function resolveDocsOpenApiDiscoveryConfig(
  openapi?: boolean | DocsOpenApiDiscoveryConfig,
): DocsOpenApiResolvedDiscoveryConfig {
  if (openapi === false || openapi === undefined) return { enabled: false };
  if (openapi === true) {
    return {
      enabled: true,
      url: DEFAULT_OPENAPI_SCHEMA_ROUTE,
      source: "generated",
    };
  }

  if (openapi.enabled === false) return { enabled: false };

  return {
    enabled: true,
    url: openapi.url ?? DEFAULT_OPENAPI_SCHEMA_ROUTE,
    source: openapi.source ?? "generated",
    specUrl: openapi.specUrl,
    apiReferencePath: openapi.apiReferencePath,
  };
}

function compactSkillText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateSkillDescription(value: string): string {
  const normalized = compactSkillText(value);
  if (normalized.length <= 1024) return normalized;
  return `${normalized.slice(0, 1021).trimEnd()}...`;
}

function toYamlString(value: string): string {
  return JSON.stringify(value);
}
