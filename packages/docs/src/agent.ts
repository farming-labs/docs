import type {
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
  DEFAULT_SITEMAP_MD_ROUTE,
  DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE,
  DEFAULT_SITEMAP_XML_ROUTE,
  resolveDocsSitemapConfig,
  resolveDocsSitemapRequest,
} from "./sitemap.js";
import type { DocsSitemapConfig } from "./types.js";

export const DEFAULT_DOCS_API_ROUTE = "/api/docs";
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
export const DOCS_MARKDOWN_SIGNATURE_AGENT_HEADER = "Signature-Agent";
const DOCS_LLMS_TXT_DIRECTIVE_LINE = "LLM index: /llms.txt";

const COMMON_MULTI_PART_PUBLIC_SUFFIXES = new Set([
  "ac.uk",
  "co.in",
  "co.jp",
  "co.nz",
  "co.uk",
  "com.au",
  "com.br",
  "com.cn",
  "com.mx",
  "com.sg",
  "com.tr",
  "com.tw",
  "gov.uk",
  "net.au",
  "net.br",
  "net.cn",
  "net.nz",
  "org.au",
  "org.br",
  "org.cn",
  "org.nz",
  "org.uk",
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

export interface DocsMarkdownPage {
  slug?: string;
  url: string;
  title: string;
  description?: string;
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
}

export interface DocsMarkdownNotFoundOptions {
  entry?: string;
  requestedPath: string;
  sitemap?: boolean | DocsSitemapConfig;
}

export interface DocsMarkdownCanonicalUrlOptions {
  origin: string;
  entry?: string;
  requestedPath: string;
  locale?: string | null;
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

  if (
    pathname === DEFAULT_LLMS_FULL_TXT_ROUTE ||
    pathname === DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE
  ) {
    return { format: "llms-full" };
  }

  return null;
}

function renderLlmsTxtPageList(pages: DocsLlmsTxtPageInput[], baseUrl: string): string {
  let content = "";
  for (const page of pages) {
    content += `- [${page.title}](${baseUrl}${toDocsMarkdownUrl(page.url)})`;
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

  const rootDomainBaseUrl = toDocsRootDomainBaseUrl(base);
  if (includeRootDomainFallback && rootDomainBaseUrl) {
    for (const route of routes) {
      addCandidate(rootDomainBaseUrl, route);
    }
  }

  if (includeMcpSubdomainFallback) {
    const mcpBaseUrl = toDocsMcpSubdomainBaseUrl(base);
    if (mcpBaseUrl) {
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

function toDocsMcpSubdomainBaseUrl(base: URL): string | undefined {
  const rootDomain = getDocsMcpRegistrableDomain(base.hostname);
  if (!rootDomain) return undefined;
  return `${base.protocol}//mcp.${rootDomain}${base.port ? `:${base.port}` : ""}`;
}

function toDocsRootDomainBaseUrl(base: URL): string | undefined {
  const rootDomain = getDocsMcpRegistrableDomain(base.hostname);
  if (!rootDomain) return undefined;
  return `${base.protocol}//${rootDomain}${base.port ? `:${base.port}` : ""}`;
}

function getDocsMcpRegistrableDomain(hostname: string): string | undefined {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!normalized || !normalized.includes(".") || isDocsIpHostname(normalized)) return undefined;

  const labels = normalized.split(".").filter(Boolean);
  if (labels.length < 2) return undefined;

  const publicSuffix = labels.slice(-2).join(".");
  if (COMMON_MULTI_PART_PUBLIC_SUFFIXES.has(publicSuffix) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }

  return labels.slice(-2).join(".");
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
    isDocsSkillRequest(url) ||
    (pathname === DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE &&
      isRobotsDiscoveryEnabled(options.robots)) ||
    resolveDocsLlmsTxtRequest(url, options.llms) !== null ||
    resolveDocsSitemapRequest(url, options.sitemap) !== null ||
    resolveDocsMarkdownRequest(entry, url, request) !== null
  );
}

export function isDocsLlmsTxtPublicRequest(
  url: URL,
  llms?: boolean | DocsLlmsDiscoveryConfig | LlmsTxtConfig,
): boolean {
  const pathname = normalizeDocsUrlPath(url.pathname);
  return pathname !== DEFAULT_DOCS_API_ROUTE && resolveDocsLlmsTxtRequest(url, llms) !== null;
}

export function resolveDocsLlmsTxtFormat(url: URL): "llms" | "llms-full" | null {
  return resolveDocsLlmsTxtRequest(url)?.format ?? null;
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

  if (acceptsMarkdown(request) || hasDocsMarkdownSignatureAgent(request)) {
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

export function getDocsMarkdownVaryHeader(request: Request): string | null {
  if (hasDocsMarkdownSignatureAgent(request)) {
    return `Accept, ${DOCS_MARKDOWN_SIGNATURE_AGENT_HEADER}`;
  }

  return acceptsMarkdown(request) ? "Accept" : null;
}

export function renderDocsMarkdownNotFound({
  entry = "docs",
  requestedPath,
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
  const lines = [
    "# Docs Page Not Found",
    "",
    `Could not find a markdown page for \`${requestedMarkdownRoute}\`.`,
    "",
    "Use these discovery routes to find the right page:",
    "",
    `- Agent discovery spec: \`${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE}\``,
    `- Agent discovery fallback: \`${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE}\``,
    `- Agent discovery API: \`${DEFAULT_AGENT_SPEC_ROUTE}\``,
    `- Search endpoint: \`${DEFAULT_DOCS_API_ROUTE}?query={query}\``,
    `- Docs index markdown: \`/${normalizedEntry}.md\``,
    `- Requested markdown API route: \`${requestedApiRoute}\``,
  ];

  if (sitemapConfig.enabled) {
    if (sitemapConfig.markdown.enabled) {
      lines.push(`- Semantic sitemap: \`${sitemapConfig.markdown.route}\``);
      lines.push(
        `- Semantic sitemap well-known alias: \`${sitemapConfig.markdown.wellKnownRoute}\``,
      );
    }

    if (sitemapConfig.xml.enabled) {
      lines.push(`- XML sitemap: \`${sitemapConfig.xml.route}\``);
    }
  } else {
    lines.push(
      `- Sitemap discovery, if enabled: \`${DEFAULT_SITEMAP_MD_ROUTE}\`, \`${DEFAULT_SITEMAP_MD_WELL_KNOWN_ROUTE}\`, or \`${DEFAULT_SITEMAP_XML_ROUTE}\``,
    );
  }

  lines.push(
    "",
    "The agent discovery spec is the safest first step because it lists the active markdown, sitemap, robots, search, MCP, and feedback routes for this deployment.",
  );

  return lines.join("\n");
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
  if (page.agentRawContent !== undefined) return page.agentRawContent;

  const relatedLines = renderDocsRelatedMarkdownLines(page.related);
  const lines = [`# ${page.title}`, `URL: ${page.url}`];
  if (shouldRenderLlmsDirective(options)) lines.push(DOCS_LLMS_TXT_DIRECTIVE_LINE);
  if (page.description) lines.push(`Description: ${page.description}`);
  lines.push(...relatedLines);
  lines.push("", page.agentFallbackRawContent ?? page.rawContent ?? page.content);
  return lines.join("\n");
}

export function renderDocsSkillDocument({
  origin,
  entry = "docs",
  search,
  mcp,
  feedback,
  llms,
  sitemap,
  robots,
  openapi,
  markdown,
}: DocsSkillDocumentOptions): string {
  const normalizedEntry = normalizeDocsPathSegment(entry) || "docs";
  const siteTitle = compactSkillText(llms?.siteTitle ?? "Documentation");
  const siteDescription = llms?.siteDescription
    ? compactSkillText(llms.siteDescription)
    : undefined;
  const llmsEnabled = llms?.enabled ?? true;
  const searchEnabled = isSearchEnabled(search);
  const feedbackEnabled = feedback?.enabled ?? false;
  const sitemapConfig = resolveDocsSitemapConfig(sitemap);
  const robotsEnabled = isRobotsDiscoveryEnabled(robots);
  const openapiConfig = resolveDocsOpenApiDiscoveryConfig(openapi);
  const feedbackRoute = feedback?.route ?? DEFAULT_AGENT_FEEDBACK_ROUTE;
  const feedbackSchemaRoute = feedback?.schemaRoute ?? `${feedbackRoute}/schema`;
  const llmsSections = resolveDocsLlmsTxtSections(llms);
  const description = truncateSkillDescription(
    `Use ${siteTitle} through markdown routes, llms.txt, robots.txt, agent discovery, search, and MCP when available.`,
  );
  const markdownAcceptHeader = markdown?.acceptHeader === false ? null : "text/markdown";
  const markdownSignatureAgentHeader =
    markdown?.signatureAgentHeader === false ? null : DOCS_MARKDOWN_SIGNATURE_AGENT_HEADER;
  const lines = [
    "---",
    "name: docs",
    `description: ${toYamlString(description)}`,
    "---",
    "",
    `# ${siteTitle} Skill`,
    "",
    `Base URL: ${origin}`,
  ];

  if (siteDescription) {
    lines.push(`Description: ${siteDescription}`);
  }

  lines.push(
    "",
    "## When To Use",
    "Use this skill when you need to read or implement against this documentation site.",
    "",
    "## Start Here",
    `- Fetch ${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE}; fall back to ${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE} or ${DEFAULT_AGENT_SPEC_ROUTE}.`,
    `- Fetch /${normalizedEntry}.md for the root docs page.`,
    `- Fetch /${normalizedEntry}/{slug}.md for page-specific context.`,
  );

  if (markdownAcceptHeader) {
    lines.push(`- You can also request ${markdownAcceptHeader} from normal page URLs.`);
  }

  if (markdownSignatureAgentHeader) {
    lines.push(
      `- Requests with ${markdownSignatureAgentHeader} on normal page URLs receive markdown automatically.`,
    );
  }

  if (searchEnabled) {
    lines.push(
      `- Search with ${DEFAULT_DOCS_API_ROUTE}?query={query} when you do not know the page.`,
    );
  }

  if (openapiConfig.enabled && openapiConfig.url) {
    lines.push(
      `- Fetch ${openapiConfig.url} for the machine-readable OpenAPI schema before scraping API reference pages.`,
    );
  }

  if (llmsEnabled) {
    lines.push(
      `- Use ${DEFAULT_LLMS_TXT_ROUTE} for a compact docs index.`,
      `- Use ${DEFAULT_LLMS_FULL_TXT_ROUTE} for full markdown context.`,
    );
    for (const section of llmsSections) {
      lines.push(`- Use ${section.route} for the ${section.title} llms.txt section.`);
    }
  }

  if (sitemapConfig.enabled) {
    if (sitemapConfig.xml.enabled) {
      lines.push(`- Use ${sitemapConfig.xml.route} to check canonical page freshness.`);
    }
    if (sitemapConfig.markdown.enabled) {
      lines.push(`- Use ${sitemapConfig.markdown.route} for a semantic docs map.`);
    }
  }

  if (robotsEnabled) {
    lines.push(
      `- Check ${DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE} for crawler and AI-agent access policy.`,
    );
  }

  if (mcp.enabled) {
    lines.push(
      `- Use ${DEFAULT_MCP_WELL_KNOWN_ROUTE} or ${DEFAULT_MCP_PUBLIC_ROUTE} for MCP tools when your environment supports MCP.`,
    );
  }

  if (feedbackEnabled) {
    lines.push(`- Read ${feedbackSchemaRoute} before posting agent feedback to ${feedbackRoute}.`);
  }

  lines.push(
    "",
    "## Routes",
    `- Skill document: ${DEFAULT_SKILL_MD_ROUTE}`,
    `- Skill well-known alias: ${DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE}`,
    `- Skill API format: ${DEFAULT_DOCS_API_ROUTE}?format=skill`,
    `- Agent discovery: ${DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE}`,
    `- Agent discovery fallback: ${DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE}`,
    `- Markdown root: /${normalizedEntry}.md`,
    `- Markdown pages: /${normalizedEntry}/{slug}.md`,
  );

  if (robotsEnabled) {
    lines.push(`- Robots policy: ${DEFAULT_AGENT_DISCOVERY_ROBOTS_TXT_ROUTE}`);
  }

  if (llmsEnabled) {
    lines.push(
      `- llms.txt: ${DEFAULT_LLMS_TXT_ROUTE}`,
      `- llms-full.txt: ${DEFAULT_LLMS_FULL_TXT_ROUTE}`,
      `- llms well-known aliases: ${DEFAULT_LLMS_TXT_WELL_KNOWN_ROUTE}, ${DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE}`,
    );
    for (const section of llmsSections) {
      lines.push(`- ${section.title} llms.txt: ${section.route}`);
      lines.push(`- ${section.title} llms-full.txt: ${section.fullRoute}`);
    }
  }

  if (openapiConfig.enabled && openapiConfig.url) {
    lines.push(`- OpenAPI schema: ${openapiConfig.url}`);
    if (openapiConfig.apiReferencePath) {
      lines.push(`- API reference: ${openapiConfig.apiReferencePath}`);
    }
  }

  if (sitemapConfig.enabled) {
    if (sitemapConfig.xml.enabled) lines.push(`- Sitemap XML: ${sitemapConfig.xml.route}`);
    if (sitemapConfig.markdown.enabled) {
      lines.push(
        `- Sitemap Markdown: ${sitemapConfig.markdown.route}`,
        `- Sitemap well-known alias: ${sitemapConfig.markdown.wellKnownRoute}`,
      );
    }
  }

  if (mcp.enabled) {
    lines.push(`- MCP: ${DEFAULT_MCP_PUBLIC_ROUTE}, ${DEFAULT_MCP_WELL_KNOWN_ROUTE}`);
  }

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
      agentSpec: DEFAULT_AGENT_SPEC_ROUTE,
      agentSpecDefault: DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
      agentSpecFallback: DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE,
      agentSpecWellKnown: DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE,
      agentSpecWellKnownJson: DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
      agentSpecQuery: `${DEFAULT_DOCS_API_ROUTE}?agent=spec`,
      openapi: DEFAULT_OPENAPI_SCHEMA_ROUTE,
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
        wellKnownRoute: sitemapConfig.markdown.wellKnownRoute,
        api: `${DEFAULT_DOCS_API_ROUTE}?format=sitemap-md`,
        defaultRoute: DEFAULT_SITEMAP_MD_ROUTE,
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

function acceptsMarkdown(request: Request): boolean {
  const accept = request.headers.get("accept");
  if (!accept) return false;
  return accept
    .split(",")
    .map((value) => value.trim())
    .some((value) => {
      const [mediaType, ...params] = value.split(";").map((part) => part.trim().toLowerCase());
      if (mediaType !== "text/markdown") return false;

      const qualityParam = params.find((param) => param.split("=", 1)[0]?.trim() === "q");
      if (!qualityParam) return true;

      const qualityValue = qualityParam.slice(qualityParam.indexOf("=") + 1).trim();
      const quality = Number.parseFloat(qualityValue);
      return Number.isFinite(quality) ? quality > 0 : true;
    });
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
