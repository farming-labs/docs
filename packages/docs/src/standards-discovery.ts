import matter from "gray-matter";

export const DEFAULT_API_CATALOG_ROUTE = "/.well-known/api-catalog";
export const DEFAULT_API_CATALOG_FORMAT = "api-catalog";
export const API_CATALOG_PROFILE_URI = "https://www.rfc-editor.org/info/rfc9727";
export const API_CATALOG_MEDIA_TYPE = "application/linkset+json";

export const DEFAULT_AGENT_SKILLS_INDEX_ROUTE = "/.well-known/agent-skills/index.json";
export const DEFAULT_AGENT_SKILLS_ROUTE_PREFIX = "/.well-known/agent-skills";
export const DEFAULT_AGENT_SKILLS_ROUTE_PATTERN = `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/{name}/SKILL.md`;
export const DEFAULT_AGENT_SKILLS_ARCHIVE_ROUTE_PATTERN = `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/{name}.tar.gz`;
export const DEFAULT_AGENT_SKILLS_INDEX_FORMAT = "agent-skills";
export const DEFAULT_AGENT_SKILL_FORMAT = "agent-skill";
export const DEFAULT_AGENT_SKILL_ARCHIVE_FORMAT = "agent-skill-archive";
export const DEFAULT_AGENT_SKILL_FILE_FORMAT = "agent-skill-file";
export const DEFAULT_AGENT_SKILL_RESOURCE_FORMAT = "agent-skill-resource";
export const DEFAULT_LEGACY_SKILLS_INDEX_ROUTE = "/.well-known/skills/index.json";
export const DEFAULT_LEGACY_SKILLS_INDEX_FORMAT = "legacy-skills";
export const DEFAULT_LEGACY_SKILLS_ROUTE_PREFIX = "/.well-known/skills";
export const DEFAULT_A2A_AGENT_CARD_ROUTE = "/.well-known/agent-card.json";
export const DEFAULT_A2A_AGENT_CARD_FORMAT = "agent-card";
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
  type: "skill-md" | "archive";
  description: string;
  url: string;
  digest: `sha256:${string}`;
}

export interface DocsAgentSkillsIndex {
  $schema: typeof AGENT_SKILLS_DISCOVERY_SCHEMA_URI;
  skills: DocsAgentSkillIndexEntry[];
}

export interface DocsPublishedAgentSkill extends DocsAgentSkillIndexEntry {
  /** Exact bytes served from the indexed artifact URL. */
  content: string | Uint8Array;
  sha256: string;
  /** Parsed SKILL.md text, including when `content` is an archive. */
  skillDocument: string;
  /** Safe files available for progressive disclosure and MCP resources. */
  files: DocsPublishedAgentSkillFile[];
}

export interface DocsPublishedAgentSkillFile {
  path: string;
  url: string;
  mediaType: string;
  content: string | Uint8Array;
  sha256: string;
  digest: `sha256:${string}`;
  /** Preserve source executability in portable archives without granting it to every script. */
  executable?: boolean;
}

export interface DocsLegacySkillsIndex {
  skills: Array<{
    name: string;
    description: string;
    files: string[];
  }>;
}

export interface DocsA2AAgentCardOptions {
  /** URL of a real A2A interface. Merely exposing docs or MCP is not sufficient. */
  interfaceUrl: string;
  name: string;
  description: string;
  documentationUrl: string;
  provider: { organization: string; url: string };
  version?: string;
  protocolVersion?: string;
  protocolBinding?: string;
}

export interface DocsA2AAgentCard {
  protocolVersion: string;
  preferredTransport: string;
  supportedInterfaces: Array<{
    url: string;
    protocolBinding: string;
    protocolVersion: string;
  }>;
  name: string;
  description: string;
  url: string;
  provider: { organization: string; url: string };
  version: string;
  documentationUrl: string;
  capabilities: { streaming: false; pushNotifications: false };
  defaultInputModes: ["text/plain"];
  defaultOutputModes: ["text/plain"];
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    examples: string[];
    url: string;
  }>;
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
  legacySkillsIndexRoute?: string | null;
  agentCardRoute?: string | null;
  agentsRoute?: string | null;
  skillRoute?: string | null;
  markdownRootRoute?: string | null;
  llmsRoutes?: readonly string[];
  sitemapRoutes?: readonly string[];
  robotsRoute?: string | null;
  mcpRoute?: string | null;
  protectedResourceMetadataRoutes?: readonly string[];
  feedbackRoutes?: readonly string[];
  openapiRoute?: string | null;
  apiReferenceRoute?: string | null;
}

export type DocsStandardsDiscoveryRequest =
  | { kind: "api-catalog" }
  | { kind: "agent-skills-index" }
  | { kind: "legacy-skills-index" }
  | { kind: "agent-card" }
  | { kind: "agent-skill"; name: string }
  | { kind: "agent-skill-archive"; name: string }
  | { kind: "agent-skill-file"; name: string; path: string };

export interface DocsDiscoveryApiRouteOptions {
  /** Same-origin Docs API pathname used by query-form discovery. @default "/api/docs" */
  apiRoute?: string;
}

export interface DocsStandardsDiscoveryRouteOptions extends DocsDiscoveryApiRouteOptions {}

export interface CreateDocsStandardsResponseOptions {
  request: Request;
  apiCatalog?: DocsApiCatalog;
  /** Whether the RFC 9727 catalog is exposed. Defaults to true. */
  apiCatalogEnabled?: boolean;
  /** Internal docs API route used for query-form forwarding. */
  apiRoute?: string;
  preferredSkillDocument?: string | null;
  fallbackSkillDocument: string;
  /** Additional validated project skills. The legacy root/fallback skill remains first. */
  publishedSkills?: readonly DocsPublishedAgentSkill[];
  /** Identity used to publish the optional A2A Agent Card. */
  agentCard?: DocsA2AAgentCardOptions;
}

function normalizeDocsRoute(value: string): string {
  const normalized = `/${value.trim()}`.replace(/\/{2,}/g, "/");
  return normalized === "/" ? normalized : normalized.replace(/\/+$/, "");
}

/** Resolve the same-origin Docs API pathname used by query-form discovery routes. */
export function resolveDocsDiscoveryApiRoute(apiRoute?: string): string {
  const candidate = apiRoute?.trim().split(/[?#]/, 1)[0];
  return normalizeDocsRoute(candidate || DEFAULT_DOCS_API_ROUTE);
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

  const apiRoute =
    options.apiRoute === null ? null : resolveDocsDiscoveryApiRoute(options.apiRoute);
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
    toTarget(
      options.legacySkillsIndexRoute === undefined
        ? DEFAULT_LEGACY_SKILLS_INDEX_ROUTE
        : options.legacySkillsIndexRoute,
      options.origin,
      "application/json",
      "Legacy Agent Skills discovery index",
    ),
    toTarget(options.agentCardRoute, options.origin, "application/json", "A2A Agent Card"),
    toTarget(options.configRoute, options.origin, "application/json", "Docs configuration map"),
    toTarget(options.diagnosticsRoute, options.origin, "application/json", "Docs diagnostics"),
    toTarget(options.robotsRoute, options.origin, "text/plain", "Robots policy"),
    ...(options.protectedResourceMetadataRoutes ?? []).map((route) =>
      toTarget(route, options.origin, "application/json", "OAuth protected-resource metadata"),
    ),
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

function readAgentSkillFrontmatter(document: string): { name: string; description: string } | null {
  const normalized = document.startsWith("\uFEFF") ? document.slice(1) : document;
  let data: Record<string, unknown>;
  try {
    data = matter(normalized).data;
  } catch {
    return null;
  }
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
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

function toDiscoveryBytes(content: string | Uint8Array): Uint8Array<ArrayBuffer> {
  if (typeof content === "string") return new TextEncoder().encode(content);
  const bytes = new Uint8Array(new ArrayBuffer(content.byteLength));
  bytes.set(content);
  return bytes;
}

function toPublishedSkillArray(
  skills: DocsPublishedAgentSkill | readonly DocsPublishedAgentSkill[],
): readonly DocsPublishedAgentSkill[] {
  return Array.isArray(skills)
    ? (skills as readonly DocsPublishedAgentSkill[])
    : [skills as DocsPublishedAgentSkill];
}

export async function sha256DocsDiscoveryContent(content: string | Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto SHA-256 support is required for Agent Skills discovery.");
  }
  const digest = await subtle.digest("SHA-256", toDiscoveryBytes(content));
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
    skillDocument: content,
    files: [
      {
        path: "SKILL.md",
        url: `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/${metadata.name}/SKILL.md`,
        mediaType: "text/markdown",
        content,
        sha256,
        digest: `sha256:${sha256}`,
      },
    ],
  };
}

export function buildDocsAgentSkillsIndex(
  skills: DocsPublishedAgentSkill | readonly DocsPublishedAgentSkill[],
): DocsAgentSkillsIndex {
  const entries = toPublishedSkillArray(skills)
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

/** Build the compatibility index used by older Agent Skills clients. */
export function buildDocsLegacySkillsIndex(
  skills: DocsPublishedAgentSkill | readonly DocsPublishedAgentSkill[],
): DocsLegacySkillsIndex {
  return {
    skills: toPublishedSkillArray(skills)
      .map((skill) => ({
        name: skill.name,
        description: skill.description,
        files: [...skill.files]
          .sort((left, right) => {
            if (left.path === "SKILL.md") return -1;
            if (right.path === "SKILL.md") return 1;
            return left.path.localeCompare(right.path);
          })
          .map((file) => file.path),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

/** Build an A2A Agent Card only when a real A2A interface is explicitly configured. */
export function buildDocsA2AAgentCard(
  options: DocsA2AAgentCardOptions,
  skills: DocsPublishedAgentSkill | readonly DocsPublishedAgentSkill[],
): DocsA2AAgentCard {
  const interfaceUrl = resolveHttpUrl(options.interfaceUrl, options.interfaceUrl);
  const documentationUrl = resolveHttpUrl(options.documentationUrl, options.interfaceUrl);
  const providerUrl = resolveHttpUrl(options.provider.url, options.interfaceUrl);
  if (!interfaceUrl || !documentationUrl || !providerUrl) {
    throw new Error("A2A Agent Card URLs must use HTTP(S).");
  }

  const protocolVersion = options.protocolVersion ?? "0.3";
  const protocolBinding = options.protocolBinding ?? "HTTP+JSON";
  return {
    protocolVersion,
    preferredTransport: protocolBinding,
    supportedInterfaces: [
      {
        url: interfaceUrl,
        protocolBinding,
        protocolVersion,
      },
    ],
    name: options.name,
    description: options.description,
    url: interfaceUrl,
    provider: { organization: options.provider.organization, url: providerUrl },
    version: options.version ?? "1.0.0",
    documentationUrl,
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: toPublishedSkillArray(skills)
      .map((skill) => ({
        id: skill.name,
        name: skill.name,
        description: skill.description,
        tags: ["documentation"],
        examples: [],
        url: skill.url,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

export function resolveDocsStandardsDiscoveryRequest(
  url: URL,
  options: DocsStandardsDiscoveryRouteOptions = {},
): DocsStandardsDiscoveryRequest | null {
  const pathname = normalizeDocsRoute(url.pathname);
  if (pathname === DEFAULT_API_CATALOG_ROUTE) return { kind: "api-catalog" };
  if (pathname === DEFAULT_AGENT_SKILLS_INDEX_ROUTE) return { kind: "agent-skills-index" };
  if (pathname === DEFAULT_LEGACY_SKILLS_INDEX_ROUTE) return { kind: "legacy-skills-index" };
  if (pathname === DEFAULT_A2A_AGENT_CARD_ROUTE) return { kind: "agent-card" };

  const archiveMatch = pathname.match(/^\/\.well-known\/agent-skills\/([^/]+)\.tar\.gz$/);
  if (archiveMatch) {
    try {
      return { kind: "agent-skill-archive", name: decodeURIComponent(archiveMatch[1]) };
    } catch {
      return { kind: "agent-skill-archive", name: "" };
    }
  }

  const artifactMatch = pathname.match(/^\/\.well-known\/agent-skills\/([^/]+)\/skill\.md$/i);
  if (artifactMatch) {
    try {
      return { kind: "agent-skill", name: decodeURIComponent(artifactMatch[1]) };
    } catch {
      return { kind: "agent-skill", name: "" };
    }
  }

  const fileMatch = pathname.match(
    /^\/\.well-known\/agent-skills\/([^/]+)\/(references|scripts|assets)\/(.+)$/,
  );
  if (fileMatch) {
    try {
      return {
        kind: "agent-skill-file",
        name: decodeURIComponent(fileMatch[1]),
        path: `${fileMatch[2]}/${decodeURIComponent(fileMatch[3])}`,
      };
    } catch {
      return { kind: "agent-skill-file", name: "", path: "" };
    }
  }

  const legacySkillMatch = pathname.match(/^\/\.well-known\/skills\/([^/]+)\/skill\.md$/i);
  if (legacySkillMatch) {
    try {
      return {
        kind: "agent-skill-file",
        name: decodeURIComponent(legacySkillMatch[1]),
        path: "SKILL.md",
      };
    } catch {
      return { kind: "agent-skill-file", name: "", path: "" };
    }
  }

  const legacyFileMatch = pathname.match(
    /^\/\.well-known\/skills\/([^/]+)\/(references|scripts|assets)\/(.+)$/,
  );
  if (legacyFileMatch) {
    try {
      return {
        kind: "agent-skill-file",
        name: decodeURIComponent(legacyFileMatch[1]),
        path: `${legacyFileMatch[2]}/${decodeURIComponent(legacyFileMatch[3])}`,
      };
    } catch {
      return { kind: "agent-skill-file", name: "", path: "" };
    }
  }

  const apiRoute = resolveDocsDiscoveryApiRoute(options.apiRoute);
  if (pathname !== apiRoute) return null;
  const format = url.searchParams.get("format")?.trim();
  if (format === DEFAULT_API_CATALOG_FORMAT) return { kind: "api-catalog" };
  if (format === DEFAULT_AGENT_SKILLS_INDEX_FORMAT) return { kind: "agent-skills-index" };
  if (format === DEFAULT_LEGACY_SKILLS_INDEX_FORMAT) return { kind: "legacy-skills-index" };
  if (format === DEFAULT_A2A_AGENT_CARD_FORMAT) return { kind: "agent-card" };
  if (format === DEFAULT_AGENT_SKILL_FORMAT) {
    return { kind: "agent-skill", name: url.searchParams.get("name")?.trim() ?? "" };
  }
  if (format === DEFAULT_AGENT_SKILL_ARCHIVE_FORMAT) {
    return { kind: "agent-skill-archive", name: url.searchParams.get("name")?.trim() ?? "" };
  }
  if (
    format === DEFAULT_AGENT_SKILL_FILE_FORMAT ||
    format === DEFAULT_AGENT_SKILL_RESOURCE_FORMAT
  ) {
    return {
      kind: "agent-skill-file",
      name: url.searchParams.get("name")?.trim() ?? "",
      path: url.searchParams.get("path")?.trim() ?? "SKILL.md",
    };
  }
  return null;
}

export function isDocsStandardsDiscoveryRequest(
  url: URL,
  options: DocsStandardsDiscoveryRouteOptions = {},
): boolean {
  return resolveDocsStandardsDiscoveryRequest(url, options) !== null;
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
  options: {
    includeApiCatalog?: boolean;
    includeManifest?: boolean;
    includeSkills?: boolean;
    includeAgentCard?: boolean;
  } = {},
): string {
  return [
    ...(options.includeApiCatalog === false
      ? []
      : [
          formatLinkTarget(DEFAULT_API_CATALOG_ROUTE, "api-catalog", {
            type: API_CATALOG_MEDIA_TYPE,
            profile: API_CATALOG_PROFILE_URI,
          }),
        ]),
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
          formatLinkTarget(DEFAULT_LEGACY_SKILLS_INDEX_ROUTE, "service-meta", {
            type: "application/json",
          }),
        ]),
    ...(options.includeAgentCard
      ? [
          formatLinkTarget(DEFAULT_A2A_AGENT_CARD_ROUTE, "service-meta", {
            type: "application/json",
          }),
        ]
      : []),
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
  content: string | Uint8Array;
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

  const body =
    options.request.method.toUpperCase() === "HEAD"
      ? null
      : typeof options.content === "string"
        ? options.content
        : toDiscoveryBytes(options.content).buffer;
  return new Response(body, { headers });
}

function standardsNotFoundResponse(request: Request, linkHeader: string): Response {
  return new Response(request.method.toUpperCase() === "HEAD" ? null : "Not Found", {
    status: 404,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Link",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      Link: linkHeader,
      "X-Robots-Tag": "noindex",
    },
  });
}

function standardsMethodNotAllowedResponse(linkHeader: string): Response {
  return new Response("Method Not Allowed", {
    status: 405,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "Link",
      Allow: "GET, HEAD",
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
      Link: linkHeader,
      "X-Robots-Tag": "noindex",
    },
  });
}

/** Return one RFC 9727 or Agent Skills discovery response, or null for unrelated requests. */
export async function createDocsStandardsResponse({
  request,
  apiCatalog,
  apiCatalogEnabled = true,
  apiRoute,
  preferredSkillDocument,
  fallbackSkillDocument,
  publishedSkills = [],
  agentCard,
}: CreateDocsStandardsResponseOptions): Promise<Response | null> {
  const resolved = resolveDocsStandardsDiscoveryRequest(new URL(request.url), { apiRoute });
  if (!resolved) return null;

  const linkHeader = getDocsDiscoveryLinkHeader({
    includeApiCatalog: apiCatalogEnabled,
    includeAgentCard: Boolean(agentCard),
  });
  if (resolved.kind === "api-catalog" && (!apiCatalogEnabled || !apiCatalog)) {
    return standardsNotFoundResponse(request, linkHeader);
  }

  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    return standardsMethodNotAllowedResponse(linkHeader);
  }

  if (resolved.kind === "api-catalog") {
    const content = `${JSON.stringify(apiCatalog, null, 2)}\n`;
    return createHashedDiscoveryResponse({
      request,
      content,
      contentType: `${API_CATALOG_MEDIA_TYPE}; profile="${API_CATALOG_PROFILE_URI}"; charset=utf-8`,
      linkHeader,
    });
  }

  const rootSkill = await resolveDocsPublishedAgentSkill({
    preferredDocument: preferredSkillDocument,
    fallbackDocument: fallbackSkillDocument,
  });
  const skills = [rootSkill, ...publishedSkills];
  const skillsByName = new Map<string, DocsPublishedAgentSkill>();
  for (const skill of skills) {
    if (skillsByName.has(skill.name)) {
      throw new Error(`Duplicate published Agent Skill name: ${skill.name}`);
    }
    skillsByName.set(skill.name, skill);
  }

  if (resolved.kind === "agent-skill") {
    const skill = skillsByName.get(resolved.name);
    if (!skill) return standardsNotFoundResponse(request, linkHeader);
    const directRequest = new URL(request.url).pathname
      .toLowerCase()
      .endsWith(
        `${DEFAULT_AGENT_SKILLS_ROUTE_PREFIX}/${encodeURIComponent(skill.name)}/skill.md`.toLowerCase(),
      );
    const file = directRequest
      ? skill.files.find((candidate) => candidate.path === "SKILL.md")
      : undefined;
    return createHashedDiscoveryResponse({
      request,
      content: file?.content ?? skill.content,
      contentType: file
        ? "text/markdown; charset=utf-8"
        : skill.type === "archive"
          ? "application/gzip"
          : "text/markdown; charset=utf-8",
      sha256: file?.sha256 ?? skill.sha256,
      linkHeader: [
        linkHeader,
        formatLinkTarget(DEFAULT_AGENT_SKILLS_INDEX_ROUTE, "collection", {
          type: "application/json",
        }),
      ].join(", "),
    });
  }

  if (resolved.kind === "agent-skill-archive") {
    const skill = skillsByName.get(resolved.name);
    if (!skill || skill.type !== "archive") {
      return standardsNotFoundResponse(request, linkHeader);
    }
    return createHashedDiscoveryResponse({
      request,
      content: skill.content,
      contentType: "application/gzip",
      sha256: skill.sha256,
      linkHeader: [
        linkHeader,
        formatLinkTarget(DEFAULT_AGENT_SKILLS_INDEX_ROUTE, "collection", {
          type: "application/json",
        }),
      ].join(", "),
    });
  }

  if (resolved.kind === "agent-skill-file") {
    const skill = skillsByName.get(resolved.name);
    const normalizedPath = resolved.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (
      !skill ||
      normalizedPath.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
      return standardsNotFoundResponse(request, linkHeader);
    }
    const file = skill.files.find((candidate) => candidate.path === normalizedPath);
    if (!file) return standardsNotFoundResponse(request, linkHeader);
    return createHashedDiscoveryResponse({
      request,
      content: file.content,
      contentType: `${file.mediaType}${file.mediaType.startsWith("text/") ? "; charset=utf-8" : ""}`,
      sha256: file.sha256,
      linkHeader: [
        linkHeader,
        formatLinkTarget(DEFAULT_AGENT_SKILLS_INDEX_ROUTE, "collection", {
          type: "application/json",
        }),
      ].join(", "),
    });
  }

  if (resolved.kind === "agent-card") {
    if (!agentCard) return standardsNotFoundResponse(request, linkHeader);
    const content = `${JSON.stringify(buildDocsA2AAgentCard(agentCard, skills), null, 2)}\n`;
    return createHashedDiscoveryResponse({
      request,
      content,
      contentType: "application/json; charset=utf-8",
      linkHeader,
    });
  }

  if (resolved.kind === "legacy-skills-index") {
    const content = `${JSON.stringify(buildDocsLegacySkillsIndex(skills), null, 2)}\n`;
    return createHashedDiscoveryResponse({
      request,
      content,
      contentType: "application/json; charset=utf-8",
      linkHeader,
    });
  }

  const content = `${JSON.stringify(buildDocsAgentSkillsIndex(skills), null, 2)}\n`;
  return createHashedDiscoveryResponse({
    request,
    content,
    contentType: "application/json; charset=utf-8",
    linkHeader: [
      linkHeader,
      ...skills.map((skill) =>
        formatLinkTarget(skill.url, "item", {
          type: skill.type === "archive" ? "application/gzip" : "text/markdown",
        }),
      ),
    ].join(", "),
  });
}
