import type { DocsSearchConfig, DocsSearchSourcePage, ResolvedDocsRelatedLink } from "./types.js";
import type { ResolvedDocsI18n } from "./i18n.js";
import type { DocsMcpPage, DocsMcpResolvedConfig } from "./mcp.js";
import { renderDocsRelatedMarkdownLines } from "./related.js";

export const DEFAULT_DOCS_API_ROUTE = "/api/docs";
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
export const DEFAULT_SKILL_MD_ROUTE = "/skill.md";
export const DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE = "/.well-known/skill.md";
export const DEFAULT_AGENT_FEEDBACK_ROUTE = "/api/docs/agent/feedback";

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
}

export interface DocsAgentDiscoverySpecOptions {
  origin: string;
  entry?: string;
  i18n?: ResolvedDocsI18n | null;
  search?: boolean | DocsSearchConfig;
  mcp: DocsMcpResolvedConfig;
  feedback?: DocsAgentFeedbackDiscoveryConfig;
  llms?: DocsLlmsDiscoveryConfig;
  markdown?: {
    acceptHeader?: boolean;
  };
}

export interface DocsSkillDocumentOptions {
  origin: string;
  entry?: string;
  search?: boolean | DocsSearchConfig;
  mcp: DocsMcpResolvedConfig;
  feedback?: DocsAgentFeedbackDiscoveryConfig;
  llms?: DocsLlmsDiscoveryConfig;
  markdown?: {
    acceptHeader?: boolean;
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

export function normalizeDocsPathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function normalizeDocsUrlPath(value: string): string {
  const normalized = value.replace(/\/+/g, "/");
  if (normalized === "/") return normalized;
  return normalized.replace(/\/+$/, "");
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

export function isDocsSkillRequest(url: URL): boolean {
  const pathname = normalizeDocsUrlPath(url.pathname);
  if (pathname === DEFAULT_SKILL_MD_ROUTE || pathname === DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE) {
    return true;
  }

  return pathname === DEFAULT_DOCS_API_ROUTE && url.searchParams.get("format")?.trim() === "skill";
}

export function isDocsPublicGetRequest(entry: string, url: URL, request: Request): boolean {
  const pathname = normalizeDocsUrlPath(url.pathname);
  if (pathname === DEFAULT_DOCS_API_ROUTE || pathname === DEFAULT_MCP_ROUTE) return false;

  return (
    isDocsAgentDiscoveryRequest(url) ||
    isDocsSkillRequest(url) ||
    resolveDocsLlmsTxtFormat(url) !== null ||
    resolveDocsMarkdownRequest(entry, url, request) !== null
  );
}

export function resolveDocsLlmsTxtFormat(url: URL): "llms" | "llms-full" | null {
  const pathname = normalizeDocsUrlPath(url.pathname);

  if (pathname === DEFAULT_LLMS_TXT_ROUTE || pathname === DEFAULT_LLMS_TXT_WELL_KNOWN_ROUTE) {
    return "llms";
  }

  if (
    pathname === DEFAULT_LLMS_FULL_TXT_ROUTE ||
    pathname === DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE
  ) {
    return "llms-full";
  }

  const format = url.searchParams.get("format");
  return pathname === DEFAULT_DOCS_API_ROUTE && (format === "llms" || format === "llms-full")
    ? format
    : null;
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

  if (acceptsMarkdown(request)) {
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

export function renderDocsMarkdownDocument(page: DocsMcpPage | DocsSearchSourcePage): string;
export function renderDocsMarkdownDocument(page: DocsMarkdownPage): string;
export function renderDocsMarkdownDocument(page: DocsMarkdownPage): string {
  if (page.agentRawContent !== undefined) return page.agentRawContent;

  const relatedLines = renderDocsRelatedMarkdownLines(page.related);
  const lines = [`# ${page.title}`, `URL: ${page.url}`];
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
  const feedbackRoute = feedback?.route ?? DEFAULT_AGENT_FEEDBACK_ROUTE;
  const feedbackSchemaRoute = feedback?.schemaRoute ?? `${feedbackRoute}/schema`;
  const description = truncateSkillDescription(
    `Use ${siteTitle} through markdown routes, llms.txt, agent discovery, search, and MCP when available.`,
  );
  const markdownAcceptHeader = markdown?.acceptHeader === false ? null : "text/markdown";
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

  if (searchEnabled) {
    lines.push(
      `- Search with ${DEFAULT_DOCS_API_ROUTE}?query={query} when you do not know the page.`,
    );
  }

  if (llmsEnabled) {
    lines.push(
      `- Use ${DEFAULT_LLMS_TXT_ROUTE} for a compact docs index.`,
      `- Use ${DEFAULT_LLMS_FULL_TXT_ROUTE} for full markdown context.`,
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

  if (llmsEnabled) {
    lines.push(
      `- llms.txt: ${DEFAULT_LLMS_TXT_ROUTE}`,
      `- llms-full.txt: ${DEFAULT_LLMS_FULL_TXT_ROUTE}`,
      `- llms well-known aliases: ${DEFAULT_LLMS_TXT_WELL_KNOWN_ROUTE}, ${DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE}`,
    );
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
  markdown,
}: DocsAgentDiscoverySpecOptions) {
  const normalizedEntry = normalizeDocsPathSegment(entry) || "docs";
  const localesEnabled = i18n !== null;
  const searchEnabled = isSearchEnabled(search);
  const feedbackRoute = feedback?.route ?? DEFAULT_AGENT_FEEDBACK_ROUTE;
  const feedbackSchemaRoute = feedback?.schemaRoute ?? `${feedbackRoute}/schema`;
  const llmsEnabled = llms?.enabled ?? true;

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
    },
    markdown: {
      enabled: true,
      acceptHeader: markdown?.acceptHeader === false ? null : "text/markdown",
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
