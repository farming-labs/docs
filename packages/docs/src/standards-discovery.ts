import matter from "gray-matter";
import type {
  DocsAgentA2AApiKeySecurityScheme,
  DocsAgentA2ACapabilities,
  DocsAgentA2AConfig,
  DocsAgentA2AExtension,
  DocsAgentA2AHttpAuthSecurityScheme,
  DocsAgentA2AInterfaceConfig,
  DocsAgentA2AMutualTlsSecurityScheme,
  DocsAgentA2AOAuth2SecurityScheme,
  DocsAgentA2AOAuthFlows,
  DocsAgentA2AOpenIdConnectSecurityScheme,
  DocsAgentA2AProtocolBinding,
  DocsAgentA2ASecurityRequirement,
  DocsAgentA2ASecurityScheme,
  DocsAgentA2ASecurityScopeList,
  DocsAgentA2ASkill,
} from "./types.js";

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
export const DEFAULT_A2A_PROTOCOL_BINDING = "HTTP+JSON";
export const DEFAULT_A2A_PROTOCOL_VERSION = "1.0";
export const AGENT_SKILLS_DISCOVERY_SCHEMA_URI =
  "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
export const DOCS_AGENT_MANIFEST_FORMAT = "farming-labs-agent-manifest.v1";
export const DOCS_AGENT_MANIFEST_SCHEMA_URI =
  "https://docs.farming-labs.dev/schema/agent-manifest.v1.json";
export const DOCS_AGENT_MANIFEST_SCHEMA_MEDIA_TYPE = "application/schema+json";

const DEFAULT_DOCS_API_ROUTE = "/api/docs";
const DEFAULT_AGENT_MANIFEST_ROUTE = "/.well-known/agent.json";
const AGENT_SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AGENT_SKILL_NAME_MAX_LENGTH = 64;
const AGENT_SKILL_DESCRIPTION_MAX_LENGTH = 1024;
const DISCOVERY_CACHE_CONTROL = "public, max-age=0, s-maxage=3600";
const LEGACY_A2A_PROTOCOL_VERSION = "0.3";

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

export type DocsA2AAgentCardOptions = DocsAgentA2AConfig;

export interface DocsA2AAgentInterface {
  url: string;
  protocolBinding: DocsAgentA2AProtocolBinding;
  protocolVersion: string;
  tenant?: string;
}

export interface DocsA2AAgentCard {
  name: string;
  description: string;
  supportedInterfaces: DocsA2AAgentInterface[];
  provider?: { organization: string; url: string };
  version: string;
  documentationUrl?: string;
  capabilities: DocsAgentA2ACapabilities;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: DocsAgentA2ASkill[];
  securitySchemes?: Record<string, DocsAgentA2ASecurityScheme>;
  securityRequirements?: DocsAgentA2ASecurityRequirement[];
  iconUrl?: string;
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

function createDocsPublishedAgentSkill(
  content: string,
  metadata: { name: string; description: string },
  sha256: string,
): DocsPublishedAgentSkill {
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

/** Build a published skill from an exact SKILL.md document and its precomputed SHA-256. */
export function buildDocsPublishedAgentSkill(
  document: string,
  sha256: string,
): DocsPublishedAgentSkill {
  const metadata = readAgentSkillFrontmatter(document);
  if (!metadata) {
    throw new Error(
      "The generated Agent Skills fallback must contain valid name and description frontmatter.",
    );
  }
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error("Agent Skill SHA-256 must be a lowercase 64-character hexadecimal digest.");
  }
  return createDocsPublishedAgentSkill(document, metadata, sha256);
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
  return createDocsPublishedAgentSkill(content, metadata, sha256);
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

function requireA2AText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty.`);
  return normalized;
}

function isA2ALoopbackHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)
  );
}

function parseAbsoluteA2AUrl(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL.`);
  }
  if (url.username || url.password) {
    throw new Error(`${label} must not contain credentials.`);
  }
  return url;
}

function resolveA2ASecureHttpUrl(value: string, label: string): string {
  const url = parseAbsoluteA2AUrl(value, label);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && isA2ALoopbackHostname(url.hostname))
  ) {
    throw new Error(`${label} must use HTTPS (HTTP is allowed only for loopback development).`);
  }
  return url.toString();
}

function resolveA2AInterfaceUrl(
  value: string,
  protocolBinding: DocsAgentA2AProtocolBinding,
  label: string,
): string {
  const url = parseAbsoluteA2AUrl(value, label);
  if (["JSONRPC", "GRPC", "HTTP+JSON"].includes(protocolBinding)) {
    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" && isA2ALoopbackHostname(url.hostname))
    ) {
      throw new Error(
        `${label} must use HTTPS for core A2A bindings (HTTP is allowed only for loopback development).`,
      );
    }
  } else {
    const unsafeProtocols = new Set([
      "file:",
      "data:",
      "javascript:",
      "blob:",
      "ftp:",
      "mqtt:",
      "amqp:",
    ]);
    if (
      unsafeProtocols.has(url.protocol) ||
      ((url.protocol === "http:" || url.protocol === "ws:") && !isA2ALoopbackHostname(url.hostname))
    ) {
      throw new Error(
        `${label} must use a secure binding-appropriate URL outside loopback development.`,
      );
    }
  }
  return url.toString();
}

function normalizeA2AStringList(
  values: readonly string[],
  label: string,
  options: { allowEmpty?: boolean } = {},
): string[] {
  if (!Array.isArray(values) || (!options.allowEmpty && values.length === 0)) {
    throw new Error(`${label} must contain at least one value.`);
  }
  return values.map((value, index) => requireA2AText(value, `${label}[${index}]`));
}

function normalizeA2AStringMap(
  values: Readonly<Record<string, string>>,
  label: string,
): Record<string, string> {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new Error(`${label} must be an object.`);
  }
  const normalized: [string, string][] = [];
  const normalizedKeys = new Set<string>();
  for (const [key, value] of Object.entries(values)) {
    const normalizedKey = requireA2AText(key, `${label} key`);
    if (normalizedKeys.has(normalizedKey)) {
      throw new Error(`${label} must not contain duplicate keys after trimming.`);
    }
    normalizedKeys.add(normalizedKey);
    normalized.push([normalizedKey, requireA2AText(value, `${label}.${normalizedKey}`)]);
  }
  return Object.fromEntries(normalized);
}

function normalizeA2AInterface(
  value: DocsAgentA2AInterfaceConfig,
  index: number,
): DocsA2AAgentInterface {
  const label = `agent.a2a.supportedInterfaces[${index}]`;
  const protocolBinding = requireA2AText(
    value.protocolBinding ?? DEFAULT_A2A_PROTOCOL_BINDING,
    `${label}.protocolBinding`,
  ) as DocsAgentA2AProtocolBinding;
  if (!["JSONRPC", "GRPC", "HTTP+JSON"].includes(protocolBinding)) {
    try {
      new URL(protocolBinding);
    } catch {
      throw new Error(`${label}.protocolBinding must be a core A2A binding or an absolute URI.`);
    }
  }
  const url = resolveA2AInterfaceUrl(value.url, protocolBinding, `${label}.url`);
  const protocolVersion = requireA2AText(
    value.protocolVersion ?? DEFAULT_A2A_PROTOCOL_VERSION,
    `${label}.protocolVersion`,
  );
  if (!/^\d+\.\d+$/.test(protocolVersion)) {
    throw new Error(`${label}.protocolVersion must use A2A major.minor form (for example, "1.0").`);
  }
  const tenant =
    value.tenant === undefined ? undefined : requireA2AText(value.tenant, `${label}.tenant`);
  return { url, protocolBinding, protocolVersion, ...(tenant ? { tenant } : {}) };
}

function normalizeA2AExtension(
  extension: DocsAgentA2AExtension,
  index: number,
): DocsAgentA2AExtension {
  const label = `agent.a2a.capabilities.extensions[${index}]`;
  const uri = requireA2AText(extension.uri, `${label}.uri`);
  try {
    new URL(uri);
  } catch {
    throw new Error(`${label}.uri must be an absolute URI.`);
  }

  let params: Readonly<Record<string, unknown>> | undefined;
  if (extension.params !== undefined) {
    if (
      !extension.params ||
      typeof extension.params !== "object" ||
      Array.isArray(extension.params)
    ) {
      throw new Error(`${label}.params must be a JSON object.`);
    }
    try {
      params = JSON.parse(JSON.stringify(extension.params)) as Record<string, unknown>;
    } catch {
      throw new Error(`${label}.params must be JSON serializable.`);
    }
  }

  return {
    uri,
    ...(extension.description !== undefined
      ? { description: requireA2AText(extension.description, `${label}.description`) }
      : {}),
    ...(extension.required !== undefined ? { required: extension.required } : {}),
    ...(params ? { params } : {}),
  };
}

function normalizeA2ACapabilities(
  capabilities: DocsAgentA2ACapabilities | undefined,
): DocsAgentA2ACapabilities {
  return {
    streaming: capabilities?.streaming ?? false,
    pushNotifications: capabilities?.pushNotifications ?? false,
    ...(capabilities?.extensions
      ? {
          extensions: capabilities.extensions.map((extension, index) =>
            normalizeA2AExtension(extension, index),
          ),
        }
      : {}),
    ...(capabilities?.extendedAgentCard !== undefined
      ? { extendedAgentCard: capabilities.extendedAgentCard }
      : {}),
  };
}

function normalizeA2ASecurityRequirements(
  requirements: readonly DocsAgentA2ASecurityRequirement[] | undefined,
  label: string,
): DocsAgentA2ASecurityRequirement[] | undefined {
  if (requirements === undefined) return undefined;
  return requirements.map((requirement, requirementIndex) => {
    if (
      !requirement.schemes ||
      typeof requirement.schemes !== "object" ||
      Array.isArray(requirement.schemes)
    ) {
      throw new Error(`${label}[${requirementIndex}].schemes must be an object.`);
    }
    const schemes: [string, DocsAgentA2ASecurityScopeList][] = [];
    const schemeNames = new Set<string>();
    for (const [name, scopes] of Object.entries(requirement.schemes)) {
      const schemeName = requireA2AText(name, `${label}[${requirementIndex}].schemes key`);
      if (schemeNames.has(schemeName)) {
        throw new Error(
          `${label}[${requirementIndex}].schemes must not contain duplicate keys after trimming.`,
        );
      }
      schemeNames.add(schemeName);
      schemes.push([
        schemeName,
        {
          list: normalizeA2AStringList(
            scopes.list,
            `${label}[${requirementIndex}].schemes.${schemeName}.list`,
            { allowEmpty: true },
          ),
        },
      ]);
    }
    return {
      schemes: Object.fromEntries(schemes),
    };
  });
}

function normalizeA2AOAuthFlows(
  flows: DocsAgentA2AOAuthFlows,
  label: string,
): DocsAgentA2AOAuthFlows {
  const configured = [
    flows.authorizationCode ? "authorizationCode" : null,
    flows.clientCredentials ? "clientCredentials" : null,
    flows.deviceCode ? "deviceCode" : null,
    flows.implicit ? "implicit" : null,
    flows.password ? "password" : null,
  ].filter((name): name is string => Boolean(name));
  if (configured.length !== 1) {
    throw new Error(`${label} must configure exactly one OAuth flow.`);
  }

  if (flows.authorizationCode) {
    const flow = flows.authorizationCode;
    return {
      authorizationCode: {
        authorizationUrl: resolveA2ASecureHttpUrl(
          flow.authorizationUrl,
          `${label}.authorizationCode.authorizationUrl`,
        ),
        tokenUrl: resolveA2ASecureHttpUrl(flow.tokenUrl, `${label}.authorizationCode.tokenUrl`),
        ...(flow.refreshUrl !== undefined
          ? {
              refreshUrl: resolveA2ASecureHttpUrl(
                flow.refreshUrl,
                `${label}.authorizationCode.refreshUrl`,
              ),
            }
          : {}),
        scopes: normalizeA2AStringMap(flow.scopes, `${label}.authorizationCode.scopes`),
        ...(flow.pkceRequired !== undefined ? { pkceRequired: flow.pkceRequired } : {}),
      },
    };
  }
  if (flows.clientCredentials) {
    const flow = flows.clientCredentials;
    return {
      clientCredentials: {
        tokenUrl: resolveA2ASecureHttpUrl(flow.tokenUrl, `${label}.clientCredentials.tokenUrl`),
        ...(flow.refreshUrl !== undefined
          ? {
              refreshUrl: resolveA2ASecureHttpUrl(
                flow.refreshUrl,
                `${label}.clientCredentials.refreshUrl`,
              ),
            }
          : {}),
        scopes: normalizeA2AStringMap(flow.scopes, `${label}.clientCredentials.scopes`),
      },
    };
  }
  if (flows.deviceCode) {
    const flow = flows.deviceCode;
    return {
      deviceCode: {
        deviceAuthorizationUrl: resolveA2ASecureHttpUrl(
          flow.deviceAuthorizationUrl,
          `${label}.deviceCode.deviceAuthorizationUrl`,
        ),
        tokenUrl: resolveA2ASecureHttpUrl(flow.tokenUrl, `${label}.deviceCode.tokenUrl`),
        ...(flow.refreshUrl !== undefined
          ? {
              refreshUrl: resolveA2ASecureHttpUrl(
                flow.refreshUrl,
                `${label}.deviceCode.refreshUrl`,
              ),
            }
          : {}),
        scopes: normalizeA2AStringMap(flow.scopes, `${label}.deviceCode.scopes`),
      },
    };
  }
  if (flows.implicit) {
    const flow = flows.implicit;
    return {
      implicit: {
        authorizationUrl: resolveA2ASecureHttpUrl(
          flow.authorizationUrl,
          `${label}.implicit.authorizationUrl`,
        ),
        ...(flow.refreshUrl !== undefined
          ? {
              refreshUrl: resolveA2ASecureHttpUrl(flow.refreshUrl, `${label}.implicit.refreshUrl`),
            }
          : {}),
        scopes: normalizeA2AStringMap(flow.scopes, `${label}.implicit.scopes`),
      },
    };
  }

  const flow = flows.password;
  return {
    password: {
      tokenUrl: resolveA2ASecureHttpUrl(flow.tokenUrl, `${label}.password.tokenUrl`),
      ...(flow.refreshUrl !== undefined
        ? {
            refreshUrl: resolveA2ASecureHttpUrl(flow.refreshUrl, `${label}.password.refreshUrl`),
          }
        : {}),
      scopes: normalizeA2AStringMap(flow.scopes, `${label}.password.scopes`),
    },
  };
}

function normalizeA2ASecurityScheme(
  scheme: DocsAgentA2ASecurityScheme,
  name: string,
): DocsAgentA2ASecurityScheme {
  const label = `agent.a2a.securitySchemes.${name}`;
  const configured = [
    scheme.apiKeySecurityScheme ? "apiKeySecurityScheme" : null,
    scheme.httpAuthSecurityScheme ? "httpAuthSecurityScheme" : null,
    scheme.oauth2SecurityScheme ? "oauth2SecurityScheme" : null,
    scheme.openIdConnectSecurityScheme ? "openIdConnectSecurityScheme" : null,
    scheme.mtlsSecurityScheme ? "mtlsSecurityScheme" : null,
  ].filter((key): key is string => Boolean(key));
  if (configured.length !== 1) {
    throw new Error(`${label} must configure exactly one A2A security scheme.`);
  }

  if (scheme.apiKeySecurityScheme) {
    const value: DocsAgentA2AApiKeySecurityScheme = scheme.apiKeySecurityScheme;
    if (!["query", "header", "cookie"].includes(value.location)) {
      throw new Error(`${label}.apiKeySecurityScheme.location is invalid.`);
    }
    return {
      apiKeySecurityScheme: {
        ...(value.description !== undefined
          ? {
              description: requireA2AText(
                value.description,
                `${label}.apiKeySecurityScheme.description`,
              ),
            }
          : {}),
        location: value.location,
        name: requireA2AText(value.name, `${label}.apiKeySecurityScheme.name`),
      },
    };
  }
  if (scheme.httpAuthSecurityScheme) {
    const value: DocsAgentA2AHttpAuthSecurityScheme = scheme.httpAuthSecurityScheme;
    return {
      httpAuthSecurityScheme: {
        ...(value.description !== undefined
          ? {
              description: requireA2AText(
                value.description,
                `${label}.httpAuthSecurityScheme.description`,
              ),
            }
          : {}),
        scheme: requireA2AText(value.scheme, `${label}.httpAuthSecurityScheme.scheme`),
        ...(value.bearerFormat !== undefined
          ? {
              bearerFormat: requireA2AText(
                value.bearerFormat,
                `${label}.httpAuthSecurityScheme.bearerFormat`,
              ),
            }
          : {}),
      },
    };
  }
  if (scheme.oauth2SecurityScheme) {
    const value: DocsAgentA2AOAuth2SecurityScheme = scheme.oauth2SecurityScheme;
    return {
      oauth2SecurityScheme: {
        ...(value.description !== undefined
          ? {
              description: requireA2AText(
                value.description,
                `${label}.oauth2SecurityScheme.description`,
              ),
            }
          : {}),
        flows: normalizeA2AOAuthFlows(value.flows, `${label}.oauth2SecurityScheme.flows`),
        ...(value.oauth2MetadataUrl !== undefined
          ? {
              oauth2MetadataUrl: resolveA2ASecureHttpUrl(
                value.oauth2MetadataUrl,
                `${label}.oauth2SecurityScheme.oauth2MetadataUrl`,
              ),
            }
          : {}),
      },
    };
  }
  if (scheme.openIdConnectSecurityScheme) {
    const value: DocsAgentA2AOpenIdConnectSecurityScheme = scheme.openIdConnectSecurityScheme;
    return {
      openIdConnectSecurityScheme: {
        ...(value.description !== undefined
          ? {
              description: requireA2AText(
                value.description,
                `${label}.openIdConnectSecurityScheme.description`,
              ),
            }
          : {}),
        openIdConnectUrl: resolveA2ASecureHttpUrl(
          value.openIdConnectUrl,
          `${label}.openIdConnectSecurityScheme.openIdConnectUrl`,
        ),
      },
    };
  }

  const value: DocsAgentA2AMutualTlsSecurityScheme = scheme.mtlsSecurityScheme;
  return {
    mtlsSecurityScheme:
      value.description !== undefined
        ? {
            description: requireA2AText(
              value.description,
              `${label}.mtlsSecurityScheme.description`,
            ),
          }
        : {},
  };
}

function validateA2ARequirementReferences(
  requirements: readonly DocsAgentA2ASecurityRequirement[] | undefined,
  schemeNames: ReadonlySet<string>,
  label: string,
): void {
  for (const [requirementIndex, requirement] of (requirements ?? []).entries()) {
    for (const schemeName of Object.keys(requirement.schemes)) {
      if (!schemeNames.has(schemeName)) {
        throw new Error(
          `${label}[${requirementIndex}] references undefined security scheme "${schemeName}".`,
        );
      }
    }
  }
}

function normalizeA2ASkill(skill: DocsAgentA2ASkill, index: number): DocsAgentA2ASkill {
  const label = `agent.a2a.skills[${index}]`;
  return {
    id: requireA2AText(skill.id, `${label}.id`),
    name: requireA2AText(skill.name, `${label}.name`),
    description: requireA2AText(skill.description, `${label}.description`),
    tags: normalizeA2AStringList(skill.tags, `${label}.tags`),
    ...(skill.examples !== undefined
      ? {
          examples: normalizeA2AStringList(skill.examples, `${label}.examples`, {
            allowEmpty: true,
          }),
        }
      : {}),
    ...(skill.inputModes !== undefined
      ? { inputModes: normalizeA2AStringList(skill.inputModes, `${label}.inputModes`) }
      : {}),
    ...(skill.outputModes !== undefined
      ? { outputModes: normalizeA2AStringList(skill.outputModes, `${label}.outputModes`) }
      : {}),
    ...(skill.securityRequirements !== undefined
      ? {
          securityRequirements: normalizeA2ASecurityRequirements(
            skill.securityRequirements,
            `${label}.securityRequirements`,
          ),
        }
      : {}),
  };
}

/** Build an A2A Agent Card only when a real A2A interface is explicitly configured. */
export function buildDocsA2AAgentCard(
  options: DocsA2AAgentCardOptions,
  skills: DocsPublishedAgentSkill | readonly DocsPublishedAgentSkill[],
): DocsA2AAgentCard {
  const usesSupportedInterfaces = options.supportedInterfaces !== undefined;
  if (
    usesSupportedInterfaces &&
    ("interfaceUrl" in options || "protocolBinding" in options || "protocolVersion" in options)
  ) {
    throw new Error(
      "agent.a2a.supportedInterfaces cannot be combined with the deprecated interfaceUrl shorthand.",
    );
  }
  const interfaceConfigs: readonly DocsAgentA2AInterfaceConfig[] =
    options.supportedInterfaces ??
    ("interfaceUrl" in options
      ? [
          {
            url: options.interfaceUrl,
            protocolBinding: options.protocolBinding,
            protocolVersion: options.protocolVersion ?? LEGACY_A2A_PROTOCOL_VERSION,
          },
        ]
      : []);
  if (interfaceConfigs.length === 0) {
    throw new Error("agent.a2a.supportedInterfaces must contain at least one interface.");
  }
  const supportedInterfaces = interfaceConfigs.map(normalizeA2AInterface);
  const interfaceKeys = new Set<string>();
  for (const value of supportedInterfaces) {
    const key = `${value.url}\u0000${value.protocolBinding}\u0000${value.protocolVersion}\u0000${
      value.tenant ?? ""
    }`;
    if (interfaceKeys.has(key)) {
      throw new Error("agent.a2a.supportedInterfaces must not contain duplicate interfaces.");
    }
    interfaceKeys.add(key);
  }
  const provider = options.provider
    ? {
        organization: requireA2AText(
          options.provider.organization,
          "agent.a2a.provider.organization",
        ),
        url: resolveA2ASecureHttpUrl(options.provider.url, "agent.a2a.provider.url"),
      }
    : undefined;
  const documentationUrl =
    options.documentationUrl !== undefined
      ? resolveA2ASecureHttpUrl(options.documentationUrl, "agent.a2a.documentationUrl")
      : undefined;
  const iconUrl =
    options.iconUrl !== undefined
      ? resolveA2ASecureHttpUrl(options.iconUrl, "agent.a2a.iconUrl")
      : undefined;
  const capabilities = normalizeA2ACapabilities(options.capabilities);

  let securitySchemes: Record<string, DocsAgentA2ASecurityScheme> | undefined;
  if (options.securitySchemes !== undefined) {
    const entries = Object.entries(options.securitySchemes);
    if (entries.length === 0) {
      throw new Error(
        "agent.a2a.securitySchemes must contain at least one scheme when configured.",
      );
    }
    const normalizedSchemes: [string, DocsAgentA2ASecurityScheme][] = [];
    const normalizedNames = new Set<string>();
    for (const [name, scheme] of entries) {
      const normalizedName = requireA2AText(name, "agent.a2a.securitySchemes key");
      if (normalizedNames.has(normalizedName)) {
        throw new Error(
          "agent.a2a.securitySchemes must not contain duplicate keys after trimming.",
        );
      }
      normalizedNames.add(normalizedName);
      normalizedSchemes.push([normalizedName, normalizeA2ASecurityScheme(scheme, normalizedName)]);
    }
    securitySchemes = Object.fromEntries(normalizedSchemes);
  }
  const securityRequirements = normalizeA2ASecurityRequirements(
    options.securityRequirements,
    "agent.a2a.securityRequirements",
  );
  const securitySchemeNames = new Set(Object.keys(securitySchemes ?? {}));
  validateA2ARequirementReferences(
    securityRequirements,
    securitySchemeNames,
    "agent.a2a.securityRequirements",
  );
  if (
    capabilities.extendedAgentCard &&
    (!securitySchemes ||
      !securityRequirements?.some((requirement) => Object.keys(requirement.schemes).length > 0))
  ) {
    throw new Error(
      "agent.a2a.capabilities.extendedAgentCard requires a configured security scheme and a non-empty security requirement.",
    );
  }

  if (usesSupportedInterfaces && options.skills === undefined) {
    throw new Error(
      "agent.a2a.skills is required with supportedInterfaces so the card advertises only implemented A2A capabilities.",
    );
  }
  const configuredSkills: DocsAgentA2ASkill[] =
    options.skills === undefined
      ? toPublishedSkillArray(skills)
          .map((skill) => ({
            id: skill.name,
            name: skill.name,
            description: skill.description,
            tags: ["documentation"],
            examples: [],
          }))
          .sort((left, right) => left.name.localeCompare(right.name))
      : options.skills.map(normalizeA2ASkill);
  if (configuredSkills.length === 0) {
    throw new Error("agent.a2a.skills must contain at least one skill.");
  }
  const skillIds = new Set<string>();
  for (const [index, skill] of configuredSkills.entries()) {
    if (skillIds.has(skill.id)) {
      throw new Error(`agent.a2a.skills[${index}].id must be unique.`);
    }
    skillIds.add(skill.id);
    validateA2ARequirementReferences(
      skill.securityRequirements,
      securitySchemeNames,
      `agent.a2a.skills[${index}].securityRequirements`,
    );
  }

  return {
    name: requireA2AText(options.name, "agent.a2a.name"),
    description: requireA2AText(options.description, "agent.a2a.description"),
    supportedInterfaces,
    ...(provider ? { provider } : {}),
    version: requireA2AText(options.version ?? "1.0.0", "agent.a2a.version"),
    ...(documentationUrl ? { documentationUrl } : {}),
    capabilities,
    defaultInputModes: normalizeA2AStringList(
      options.defaultInputModes ?? ["text/plain"],
      "agent.a2a.defaultInputModes",
    ),
    defaultOutputModes: normalizeA2AStringList(
      options.defaultOutputModes ?? ["text/plain"],
      "agent.a2a.defaultOutputModes",
    ),
    skills: configuredSkills,
    ...(securitySchemes ? { securitySchemes } : {}),
    ...(securityRequirements ? { securityRequirements } : {}),
    ...(iconUrl ? { iconUrl } : {}),
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

/**
 * Add the registered `describedby` relation for the Farming Labs manifest schema.
 *
 * Keep this scoped to agent-manifest responses: the shared discovery Link header is
 * also used by unrelated resources that the manifest schema does not describe.
 */
export function getDocsAgentManifestLinkHeader(
  discoveryLinkHeader = getDocsDiscoveryLinkHeader(),
): string {
  const schemaLink = formatLinkTarget(DOCS_AGENT_MANIFEST_SCHEMA_URI, "describedby", {
    type: DOCS_AGENT_MANIFEST_SCHEMA_MEDIA_TYPE,
  });
  if (!discoveryLinkHeader.trim()) return schemaLink;
  if (discoveryLinkHeader.includes(schemaLink)) return discoveryLinkHeader;
  return `${discoveryLinkHeader}, ${schemaLink}`;
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
