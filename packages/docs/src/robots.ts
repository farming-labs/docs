import {
  DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
  DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE,
  DEFAULT_LLMS_FULL_TXT_ROUTE,
  DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE,
  DEFAULT_LLMS_TXT_ROUTE,
  DEFAULT_LLMS_TXT_WELL_KNOWN_ROUTE,
  DEFAULT_MCP_PUBLIC_ROUTE,
  DEFAULT_MCP_WELL_KNOWN_ROUTE,
  DEFAULT_SKILL_MD_ROUTE,
  DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE,
  normalizeDocsPathSegment,
} from "./agent.js";
import { resolveDocsSitemapConfig } from "./sitemap.js";
import type { DocsRobotsConfig, DocsRobotsRule, DocsSitemapConfig } from "./types.js";

export const DEFAULT_ROBOTS_TXT_ROUTE = "/robots.txt";
export const DOCS_ROBOTS_GENERATED_BLOCK_START = "# BEGIN @farming-labs/docs robots";
export const DOCS_ROBOTS_GENERATED_BLOCK_END = "# END @farming-labs/docs robots";

export const DEFAULT_DOCS_AI_ROBOTS_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
] as const;

export interface DocsRobotsResolvedConfig {
  enabled: boolean;
  path?: string;
  baseUrl?: string;
  ai: "allow" | "disallow";
  userAgents: string[];
  extraRules: DocsRobotsRule[];
}

export interface DocsRobotsRenderOptions {
  entry?: string;
  sitemap?: boolean | DocsSitemapConfig;
  baseUrl?: string;
  robots?: boolean | DocsRobotsConfig;
}

export interface DocsRobotsAnalysis {
  blocksAgentRoutes: boolean;
  blocksAiAgents: boolean;
  hasAgentRoutes: boolean;
  hasAiPolicy: boolean;
  missingRoutes: string[];
}

export interface CreateDocsRobotsResponseOptions extends DocsRobotsRenderOptions {
  request: Request;
}

function normalizeRoute(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed.replace(/\/{2,}/g, "/") : `/${trimmed}`;
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function normalizeStringArray(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function normalizeAiPolicy(value: DocsRobotsConfig["ai"]): "allow" | "disallow" {
  return value === false || value === "disallow" ? "disallow" : "allow";
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function resolveDocsRobotsConfig(
  input: boolean | DocsRobotsConfig | undefined,
  options: { baseUrl?: string } = {},
): DocsRobotsResolvedConfig {
  if (input === false) {
    return {
      enabled: false,
      ai: "allow",
      userAgents: [...DEFAULT_DOCS_AI_ROBOTS_USER_AGENTS],
      extraRules: [],
    };
  }

  const config = typeof input === "object" ? input : {};
  return {
    enabled: config.enabled ?? true,
    path: config.path,
    baseUrl: normalizeBaseUrl(config.baseUrl) ?? normalizeBaseUrl(options.baseUrl),
    ai: normalizeAiPolicy(config.ai),
    userAgents: unique([
      ...DEFAULT_DOCS_AI_ROBOTS_USER_AGENTS,
      ...normalizeStringArray(config.aiUserAgents),
    ]),
    extraRules: config.extraRules ?? [],
  };
}

export function getDocsRobotsAllowRoutes(options: DocsRobotsRenderOptions = {}): string[] {
  const normalizedEntry = normalizeDocsPathSegment(options.entry ?? "docs") || "docs";
  const sitemapConfig = resolveDocsSitemapConfig(options.sitemap);
  const routes = [
    "/",
    `/${normalizedEntry}`,
    `/${normalizedEntry}/`,
    `/${normalizedEntry}.md`,
    `/${normalizedEntry}/*.md`,
    DEFAULT_LLMS_TXT_ROUTE,
    DEFAULT_LLMS_FULL_TXT_ROUTE,
    DEFAULT_LLMS_TXT_WELL_KNOWN_ROUTE,
    DEFAULT_LLMS_FULL_TXT_WELL_KNOWN_ROUTE,
    DEFAULT_SKILL_MD_ROUTE,
    DEFAULT_SKILL_MD_WELL_KNOWN_ROUTE,
    DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
    DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE,
    DEFAULT_MCP_PUBLIC_ROUTE,
    DEFAULT_MCP_WELL_KNOWN_ROUTE,
  ];

  if (sitemapConfig.enabled) {
    if (sitemapConfig.xml.enabled) routes.push(sitemapConfig.xml.route);
    if (sitemapConfig.markdown.enabled) {
      routes.push(sitemapConfig.markdown.route, sitemapConfig.markdown.wellKnownRoute);
    }
  }

  return unique(routes.map(normalizeRoute));
}

function sitemapUrls(
  robots: DocsRobotsResolvedConfig,
  sitemap: boolean | DocsSitemapConfig | undefined,
): string[] {
  const sitemapConfig = resolveDocsSitemapConfig(sitemap, { baseUrl: robots.baseUrl });
  if (!robots.baseUrl || !sitemapConfig.enabled || !sitemapConfig.xml.enabled) return [];

  try {
    return [new URL(sitemapConfig.xml.route, `${robots.baseUrl}/`).toString()];
  } catch {
    return [];
  }
}

function appendRule(lines: string[], rule: DocsRobotsRule) {
  const userAgents = normalizeStringArray(rule.userAgent);
  if (userAgents.length === 0) return;

  lines.push("");
  for (const userAgent of userAgents) {
    lines.push(`User-agent: ${userAgent}`);
  }
  for (const route of normalizeStringArray(rule.allow)) {
    lines.push(`Allow: ${normalizeRoute(route)}`);
  }
  for (const route of normalizeStringArray(rule.disallow)) {
    lines.push(`Disallow: ${normalizeRoute(route)}`);
  }
  if (typeof rule.crawlDelay === "number" && Number.isFinite(rule.crawlDelay)) {
    lines.push(`Crawl-delay: ${rule.crawlDelay}`);
  }
}

export function renderDocsRobotsTxt(options: DocsRobotsRenderOptions = {}): string {
  const robots = resolveDocsRobotsConfig(options.robots, { baseUrl: options.baseUrl });
  if (!robots.enabled) return "";

  const lines = [
    "# Generated by @farming-labs/docs.",
    "# Edit docs.config or rerun `docs robots generate --append` / `--force`.",
    "",
    "User-agent: *",
  ];

  for (const route of getDocsRobotsAllowRoutes(options)) {
    lines.push(`Allow: ${route}`);
  }

  for (const userAgent of robots.userAgents) {
    lines.push("", `User-agent: ${userAgent}`);
    lines.push(robots.ai === "allow" ? "Allow: /" : "Disallow: /");
  }

  for (const rule of robots.extraRules) {
    appendRule(lines, rule);
  }

  const sitemap = sitemapUrls(robots, options.sitemap);
  if (sitemap.length > 0) {
    lines.push("");
    for (const url of sitemap) {
      lines.push(`Sitemap: ${url}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function resolveDocsRobotsRequest(
  url: URL,
  robots?: boolean | DocsRobotsConfig,
): "robots" | null {
  const pathname = normalizeRoute(url.pathname);
  const format = url.searchParams.get("format")?.trim();
  if (pathname === "/api/docs" && format === "robots") return "robots";

  const resolved = resolveDocsRobotsConfig(robots);
  if (!resolved.enabled) return null;

  return pathname === DEFAULT_ROBOTS_TXT_ROUTE ? "robots" : null;
}

export function createDocsRobotsResponse({
  request,
  ...options
}: CreateDocsRobotsResponseOptions): Response | null {
  const url = new URL(request.url);
  if (!resolveDocsRobotsRequest(url, options.robots)) return null;

  const content = renderDocsRobotsTxt({
    ...options,
    baseUrl: options.baseUrl ?? url.origin,
  });
  if (!content) return null;

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}

export function renderDocsRobotsGeneratedBlock(options: DocsRobotsRenderOptions = {}): string {
  return `${DOCS_ROBOTS_GENERATED_BLOCK_START}\n${renderDocsRobotsTxt(options).trimEnd()}\n${DOCS_ROBOTS_GENERATED_BLOCK_END}\n`;
}

export function upsertDocsRobotsGeneratedBlock(existing: string, block: string): string {
  const escapedStart = DOCS_ROBOTS_GENERATED_BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnd = DOCS_ROBOTS_GENERATED_BLOCK_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}\\n?`);

  if (pattern.test(existing)) {
    return existing.replace(pattern, block);
  }

  const prefix = existing.trimEnd();
  return `${prefix}${prefix ? "\n\n" : ""}${block}`;
}

function blockForUserAgent(content: string, userAgent: string): string {
  const escaped = userAgent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = content.match(
    new RegExp(`(?:^|\\n)\\s*User-agent:\\s*${escaped}\\s*(?:\\n[ \\t]*(?!User-agent:).*)*`, "i"),
  );
  return match?.[0] ?? "";
}

function disallowsRoute(content: string, route: string): boolean {
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^\\s*Disallow:\\s*${escapedRoute}(?:\\s|$)`, "im").test(content);
}

export function analyzeDocsRobotsTxt(
  content: string,
  options: DocsRobotsRenderOptions = {},
): DocsRobotsAnalysis {
  const expectedRoutes = getDocsRobotsAllowRoutes(options).filter(
    (route) =>
      [
        DEFAULT_LLMS_TXT_ROUTE,
        DEFAULT_LLMS_FULL_TXT_ROUTE,
        DEFAULT_AGENT_SPEC_WELL_KNOWN_JSON_ROUTE,
        DEFAULT_AGENT_SPEC_WELL_KNOWN_ROUTE,
        DEFAULT_SKILL_MD_ROUTE,
        DEFAULT_MCP_PUBLIC_ROUTE,
      ].includes(route) || route.includes("sitemap"),
  );
  const missingRoutes = expectedRoutes.filter((route) => !content.includes(route));
  const blocksWildcard = /Disallow:\s*\/(?:\s|$)/i.test(blockForUserAgent(content, "*"));
  const blocksAgentRoutes =
    blocksWildcard || expectedRoutes.some((route) => disallowsRoute(content, route));
  const blocksAiAgents = DEFAULT_DOCS_AI_ROBOTS_USER_AGENTS.some((userAgent) =>
    /Disallow:\s*\/(?:\s|$)/i.test(blockForUserAgent(content, userAgent)),
  );

  return {
    blocksAgentRoutes,
    blocksAiAgents,
    hasAgentRoutes: missingRoutes.length === 0,
    hasAiPolicy: DEFAULT_DOCS_AI_ROBOTS_USER_AGENTS.some((userAgent) =>
      content.includes(userAgent),
    ),
    missingRoutes,
  };
}
