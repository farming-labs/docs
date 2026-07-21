export const DEFAULT_API_CATALOG_ROUTE = "/.well-known/api-catalog";
export const DEFAULT_API_CATALOG_FORMAT = "api-catalog";
export const API_CATALOG_PROFILE_URI = "https://www.rfc-editor.org/info/rfc9727";
export const API_CATALOG_MEDIA_TYPE = "application/linkset+json";

export const DEFAULT_AGENT_SKILLS_INDEX_ROUTE = "/.well-known/agent-skills/index.json";
export const DEFAULT_AGENT_SKILLS_ROUTE_PREFIX = "/.well-known/agent-skills";
export const DEFAULT_AGENT_SKILLS_ROUTE_PATTERN = `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/{name}/SKILL.md`;
export const DEFAULT_AGENT_SKILLS_INDEX_FORMAT = "agent-skills";
export const DEFAULT_AGENT_SKILL_FORMAT = "agent-skill";
export const AGENT_SKILLS_DISCOVERY_SCHEMA_URI =
  "https://schemas.agentskills.io/discovery/0.2.0/schema.json";

const DEFAULT_DOCS_API_ROUTE = "/api/docs";
const DEFAULT_AGENT_MANIFEST_ROUTE = "/.well-known/agent.json";
const AGENT_SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AGENT_SKILL_NAME_MAX_LENGTH = 64;
const AGENT_SKILL_DESCRIPTION_MAX_LENGTH = 1024;
const DISCOVERY_CACHE_CONTROL = "public, max-age=0, s-maxage=3600";

export interface DocsAgentSkillIndexEntry {
  name: string;
  type: "skill-md";
  description: string;
  url: string;
  digest: `sha256:${string}`;
}

export interface DocsAgentSkillsIndex {
  $schema: typeof AGENT_SKILLS_DISCOVERY_SCHEMA_URI;
  skills: DocsAgentSkillIndexEntry[];
}

export interface DocsPublishedAgentSkill extends DocsAgentSkillIndexEntry {
  content: string;
  sha256: string;
}

export interface DocsPublishedAgentSkillOptions {
  preferredDocument?: string | null;
  fallbackDocument: string;
}

export interface DocsApiCatalogLinkTarget {
  href: string;
  type?: string;
  title?: string;
}

export interface DocsApiCatalogLinkContext {
  anchor: string;
  item?: DocsApiCatalogLinkTarget[];
  "api-catalog"?: DocsApiCatalogLinkTarget[];
  "service-desc"?: DocsApiCatalogLinkTarget[];
  "service-doc"?: DocsApiCatalogLinkTarget[];
  "service-meta"?: DocsApiCatalogLinkTarget[];
}

export interface DocsApiCatalog {
  linkset: DocsApiCatalogLinkContext[];
}

export interface DocsApiCatalogOptions {
  origin: string;
  docsRoute?: string;
  apiRoute?: string | null;
  /** Additional HTTP API endpoints to list as RFC 9727 `item` links. */
  apiRoutes?: readonly {
    route: string;
    type?: string;
    title?: string;
  }[];
  configRoute?: string | null;
  diagnosticsRoute?: string | null;
  agentManifestRoute?: string | null;
  agentSkillsIndexRoute?: string | null;
  agentsRoute?: string | null;
  skillRoute?: string | null;
  markdownRootRoute?: string | null;
  llmsRoutes?: readonly string[];
  sitemapRoutes?: readonly string[];
  robotsRoute?: string | null;
  mcpRoute?: string | null;
  feedbackRoutes?: readonly string[];
  openapiRoute?: string | null;
  apiReferenceRoute?: string | null;
}

export type DocsStandardsDiscoveryRequest =
  | { kind: "api-catalog" }
  | { kind: "agent-skills-index" }
  | { kind: "agent-skill"; name: string };

export interface CreateDocsStandardsResponseOptions {
  request: Request;
  apiCatalog: DocsApiCatalog;
  preferredSkillDocument?: string | null;
  fallbackSkillDocument: string;
}

function normalizeDocsRoute(value: string): string {
  const normalized = `/${value}`.replace(/\/{2,}/g, "/");
  return normalized === "/" ? normalized : normalized.replace(/\/+$/, "");
}

function resolveHttpUrl(value: string | null | undefined, origin: string): string | null {
  if (!value) return null;

  try {
    const base = new URL(origin);
    const resolved = new URL(value, `${base.origin}/`);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

function compactUniqueTargets(targets: Array<DocsApiCatalogLinkTarget | null>) {
  const seen = new Set<string>();
  return targets.filter((target): target is DocsApiCatalogLinkTarget => {
    if (!target) return false;
    const key = `${target.href}\u0000${target.type ?? ""}\u0000${target.title ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toTarget(
  route: string | null | undefined,
  origin: string,
  type?: string,
  title?: string,
): DocsApiCatalogLinkTarget | null {
  const href = resolveHttpUrl(route, origin);
  return href ? { href, ...(type ? { type } : {}), ...(title ? { title } : {}) } : null;
}

/** Build an RFC 9727 API Catalog using the RFC 9264 JSON Linkset representation. */
export function buildDocsApiCatalog(options: DocsApiCatalogOptions): DocsApiCatalog {
  const catalogUrl = resolveHttpUrl(DEFAULT_API_CATALOG_ROUTE, options.origin);
  if (!catalogUrl) {
    throw new Error(`Invalid HTTP(S) docs origin for API catalog: ${options.origin}`);
  }

  const apiRoute = options.apiRoute === undefined ? DEFAULT_DOCS_API_ROUTE : options.apiRoute;
  const agentManifestRoute =
    options.agentManifestRoute === undefined
      ? DEFAULT_AGENT_MANIFEST_ROUTE
      : options.agentManifestRoute;
  const agentSkillsIndexRoute =
    options.agentSkillsIndexRoute === undefined
      ? DEFAULT_AGENT_SKILLS_INDEX_ROUTE
      : options.agentSkillsIndexRoute;

  const apiTargets = compactUniqueTargets([
    toTarget(apiRoute, options.origin, "application/json", "Documentation API"),
    ...(options.apiRoutes ?? []).map((target) =>
      toTarget(target.route, options.origin, target.type, target.title),
    ),
    toTarget(options.mcpRoute, options.origin, "application/json", "Documentation MCP endpoint"),
    ...(options.feedbackRoutes ?? []).map((route, index) =>
      toTarget(
        route,
        options.origin,
        index === 0 ? "application/json" : "application/schema+json",
        index === 0 ? "Agent feedback endpoint" : "Agent feedback schema",
      ),
    ),
  ]);

  const serviceDocs = compactUniqueTargets([
    toTarget(options.docsRoute ?? "/docs", options.origin, "text/html", "Documentation"),
    toTarget(options.markdownRootRoute, options.origin, "text/markdown", "Documentation Markdown"),
    toTarget(options.agentsRoute, options.origin, "text/markdown", "Agent instructions"),
    toTarget(options.skillRoute, options.origin, "text/markdown", "Site skill"),
    ...(options.llmsRoutes ?? []).map((route) =>
      toTarget(route, options.origin, "text/plain", "LLM documentation index"),
    ),
    ...(options.sitemapRoutes ?? []).map((route) =>
      toTarget(
        route,
        options.origin,
        route.endsWith(".xml") ? "application/xml" : "text/markdown",
        "Documentation sitemap",
      ),
    ),
    toTarget(options.apiReferenceRoute, options.origin, "text/html", "API reference"),
  ]);

  const serviceMetadata = compactUniqueTargets([
    toTarget(agentManifestRoute, options.origin, "application/json", "Agent discovery manifest"),
    toTarget(
      agentSkillsIndexRoute,
      options.origin,
      "application/json",
      "Agent Skills discovery index",
    ),
    toTarget(options.configRoute, options.origin, "application/json", "Docs configuration map"),
    toTarget(options.diagnosticsRoute, options.origin, "application/json", "Docs diagnostics"),
    toTarget(options.robotsRoute, options.origin, "text/plain", "Robots policy"),
  ]);

  const serviceDescriptions = compactUniqueTargets([
    toTarget(
      options.openapiRoute,
      options.origin,
      "application/vnd.oai.openapi+json;version=3.1",
      "OpenAPI schema",
    ),
  ]);

  const catalogContext: DocsApiCatalogLinkContext = {
    anchor: catalogUrl,
    "api-catalog": [
      {
        href: catalogUrl,
        type: API_CATALOG_MEDIA_TYPE,
        title: "API catalog",
      },
    ],
  };
  if (apiTargets.length > 0) catalogContext.item = apiTargets;
  if (serviceDocs.length > 0) catalogContext["service-doc"] = serviceDocs;
  if (serviceMetadata.length > 0) catalogContext["service-meta"] = serviceMetadata;
  if (serviceDescriptions.length > 0) catalogContext["service-desc"] = serviceDescriptions;

  const linkset = [catalogContext];
  for (const target of apiTargets) {
    const context: DocsApiCatalogLinkContext = { anchor: target.href };
    if (serviceDocs.length > 0) context["service-doc"] = serviceDocs;
    if (serviceMetadata.length > 0) context["service-meta"] = serviceMetadata;
    if (
      serviceDescriptions.length > 0 &&
      target.href === resolveHttpUrl(apiRoute, options.origin)
    ) {
      context["service-desc"] = serviceDescriptions;
    }
    linkset.push(context);
  }

  return { linkset };
}

function unquoteFrontmatterScalar(value: string): string | null {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed === ">" ||
    trimmed === "|" ||
    trimmed.startsWith("[") ||
    trimmed.startsWith("{")
  ) {
    return null;
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === "string" ? parsed.trim() : null;
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'").trim();
  }

  return trimmed.replace(/\s+#.*$/, "").trim();
}

function readAgentSkillFrontmatter(document: string): { name: string; description: string } | null {
  const normalized = document.startsWith("\uFEFF") ? document.slice(1) : document;
  const match = normalized.match(/^---[\t ]*\r?\n([\s\S]*?)\r?\n---(?:[\t ]*\r?\n|$)/);
  if (!match) return null;

  const values = new Map<string, string>();
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*?)\s*$/);
    if (!field) continue;
    const value = unquoteFrontmatterScalar(field[2]);
    if (value !== null) values.set(field[1], value);
  }

  const name = values.get("name") ?? "";
  const description = values.get("description") ?? "";
  if (
    !name ||
    name.length > AGENT_SKILL_NAME_MAX_LENGTH ||
    !AGENT_SKILL_NAME_PATTERN.test(name) ||
    !description ||
    description.length > AGENT_SKILL_DESCRIPTION_MAX_LENGTH
  ) {
    return null;
  }

  return { name, description };
}

export async function sha256DocsDiscoveryContent(content: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto SHA-256 support is required for Agent Skills discovery.");
  }
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/** Select a valid public skill and hash the exact bytes returned by its standards route. */
export async function resolveDocsPublishedAgentSkill({
  preferredDocument,
  fallbackDocument,
}: DocsPublishedAgentSkillOptions): Promise<DocsPublishedAgentSkill> {
  const preferredMetadata = preferredDocument ? readAgentSkillFrontmatter(preferredDocument) : null;
  const fallbackMetadata = readAgentSkillFrontmatter(fallbackDocument);
  const content = preferredMetadata ? preferredDocument! : fallbackDocument;
  const metadata = preferredMetadata ?? fallbackMetadata;

  if (!metadata) {
    throw new Error(
      "The generated Agent Skills fallback must contain valid name and description frontmatter.",
    );
  }

  const sha256 = await sha256DocsDiscoveryContent(content);
  return {
    name: metadata.name,
    type: "skill-md",
    description: metadata.description,
    url: `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/${metadata.name}/SKILL.md`,
    digest: `sha256:${sha256}`,
    content,
    sha256,
  };
}

export function buildDocsAgentSkillsIndex(
  skills: DocsPublishedAgentSkill | readonly DocsPublishedAgentSkill[],
): DocsAgentSkillsIndex {
  const entries = (Array.isArray(skills) ? skills : [skills])
    .map(({ name, type, description, url, digest }) => ({
      name,
      type,
      description,
      url,
      digest,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    $schema: AGENT_SKILLS_DISCOVERY_SCHEMA_URI,
    skills: entries,
  };
}

export function resolveDocsStandardsDiscoveryRequest(
  url: URL,
): DocsStandardsDiscoveryRequest | null {
  const pathname = normalizeDocsRoute(url.pathname);
  if (pathname === DEFAULT_API_CATALOG_ROUTE) return { kind: "api-catalog" };
  if (pathname === DEFAULT_AGENT_SKILLS_INDEX_ROUTE) return { kind: "agent-skills-index" };

  const artifactMatch = pathname.match(/^\/\.well-known\/agent-skills\/([^/]+)\/SKILL\.md$/);
  if (artifactMatch) {
    try {
      return { kind: "agent-skill", name: decodeURIComponent(artifactMatch[1]) };
    } catch {
      return { kind: "agent-skill", name: "" };
    }
  }

  if (pathname !== DEFAULT_DOCS_API_ROUTE) return null;
  const format = url.searchParams.get("format")?.trim();
  if (format === DEFAULT_API_CATALOG_FORMAT) return { kind: "api-catalog" };
  if (format === DEFAULT_AGENT_SKILLS_INDEX_FORMAT) return { kind: "agent-skills-index" };
  if (format === DEFAULT_AGENT_SKILL_FORMAT) {
    return { kind: "agent-skill", name: url.searchParams.get("name")?.trim() ?? "" };
  }
  return null;
}

export function isDocsStandardsDiscoveryRequest(url: URL): boolean {
  return resolveDocsStandardsDiscoveryRequest(url) !== null;
}

function formatLinkTarget(
  href: string,
  relation: string,
  options: { type?: string; profile?: string } = {},
): string {
  return [
    `<${href}>`,
    `rel="${relation}"`,
    ...(options.type ? [`type="${options.type}"`] : []),
    ...(options.profile ? [`profile="${options.profile}"`] : []),
  ].join("; ");
}

/** Cross-link the standards endpoints without replacing an existing canonical Link value. */
export function getDocsDiscoveryLinkHeader(
  options: { includeManifest?: boolean; includeSkills?: boolean } = {},
): string {
  return [
    formatLinkTarget(DEFAULT_API_CATALOG_ROUTE, "api-catalog", {
      type: API_CATALOG_MEDIA_TYPE,
      profile: API_CATALOG_PROFILE_URI,
    }),
    ...(options.includeManifest === false
      ? []
      : [
          formatLinkTarget(DEFAULT_AGENT_MANIFEST_ROUTE, "service-meta", {
            type: "application/json",
          }),
        ]),
    ...(options.includeSkills === false
      ? []
      : [
          formatLinkTarget(DEFAULT_AGENT_SKILLS_INDEX_ROUTE, "service-meta", {
            type: "application/json",
          }),
        ]),
  ].join(", ");
}

export function appendDocsDiscoveryLinkHeader(headers: Headers, value?: string): Headers {
  const next = new Headers(headers);
  const discoveryLinks = value ?? getDocsDiscoveryLinkHeader();
  const existing = next.get("Link");
  next.set("Link", existing ? `${existing}, ${discoveryLinks}` : discoveryLinks);
  return next;
}

function requestMatchesEtag(request: Request, etag: string): boolean {
  const value = request.headers.get("if-none-match");
  if (!value) return false;
  if (value.trim() === "*") return true;
  return value.split(",").some((candidate) => candidate.trim().replace(/^W\//i, "") === etag);
}

async function createHashedDiscoveryResponse(options: {
  request: Request;
  content: string;
  contentType: string;
  sha256?: string;
  linkHeader: string;
}): Promise<Response> {
  const sha256 = options.sha256 ?? (await sha256DocsDiscoveryContent(options.content));
  const etag = `"${sha256}"`;
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "ETag, Link",
    Allow: "GET, HEAD",
    "Cache-Control": DISCOVERY_CACHE_CONTROL,
    "Content-Type": options.contentType,
    ETag: etag,
    Link: options.linkHeader,
    "X-Robots-Tag": "noindex",
  };

  if (requestMatchesEtag(options.request, etag)) {
    const { "Content-Type": _contentType, ...notModifiedHeaders } = headers;
    return new Response(null, { status: 304, headers: notModifiedHeaders });
  }

  return new Response(options.request.method.toUpperCase() === "HEAD" ? null : options.content, {
    headers,
  });
}

function standardsNotFoundResponse(request: Request): Response {
  return new Response(request.method.toUpperCase() === "HEAD" ? null : "Not Found", {
    status: 404,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Link",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      Link: getDocsDiscoveryLinkHeader(),
      "X-Robots-Tag": "noindex",
    },
  });
}

function standardsMethodNotAllowedResponse(): Response {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Link",
      Allow: "GET, HEAD",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      Link: getDocsDiscoveryLinkHeader(),
      "X-Robots-Tag": "noindex",
    },
  });
}

/** Return one RFC 9727 or Agent Skills discovery response, or null for unrelated requests. */
export async function createDocsStandardsResponse({
  request,
  apiCatalog,
  preferredSkillDocument,
  fallbackSkillDocument,
}: CreateDocsStandardsResponseOptions): Promise<Response | null> {
  const resolved = resolveDocsStandardsDiscoveryRequest(new URL(request.url));
  if (!resolved) return null;

  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return standardsMethodNotAllowedResponse();
  }

  if (resolved.kind === "api-catalog") {
    const content = `${JSON.stringify(apiCatalog, null, 2)}\n`;
    return createHashedDiscoveryResponse({
      request,
      content,
      contentType: `${API_CATALOG_MEDIA_TYPE}; profile="${API_CATALOG_PROFILE_URI}"; charset=utf-8`,
      linkHeader: getDocsDiscoveryLinkHeader(),
    });
  }

  const skill = await resolveDocsPublishedAgentSkill({
    preferredDocument: preferredSkillDocument,
    fallbackDocument: fallbackSkillDocument,
  });

  if (resolved.kind === "agent-skill") {
    if (resolved.name !== skill.name) return standardsNotFoundResponse(request);
    return createHashedDiscoveryResponse({
      request,
      content: skill.content,
      contentType: "text/markdown; charset=utf-8",
      sha256: skill.sha256,
      linkHeader: [
        getDocsDiscoveryLinkHeader(),
        formatLinkTarget(DEFAULT_AGENT_SKILLS_INDEX_ROUTE, "collection", {
          type: "application/json",
        }),
      ].join(", "),
    });
  }

  const content = `${JSON.stringify(buildDocsAgentSkillsIndex(skill), null, 2)}\n`;
  return createHashedDiscoveryResponse({
    request,
    content,
    contentType: "application/json; charset=utf-8",
    linkHeader: [
      getDocsDiscoveryLinkHeader(),
      formatLinkTarget(skill.url, "item", { type: "text/markdown" }),
    ].join(", "),
  });
}
