import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { getHtmlDocument } from "@scalar/core/libs/html-rendering";
import { parse as parseYaml } from "yaml";
import {
  acceptsDocsMarkdown,
  createDocsMarkdownResponse,
  detectDocsMarkdownAgentRequest,
  hasDocsMarkdownSignatureAgent,
  renderDocsMarkdownDocument,
  toDocsMarkdownUrl,
} from "./agent.js";
import { assertValidOpenApiContract } from "./openapi-contract.js";
import { applyOpenApiOverlayDocuments } from "./openapi-overlays.js";
import type { OpenApiOverlayDocumentSource } from "./openapi-overlays.js";
import { buildNormalizedOpenApiModel } from "./openapi-operations.js";
import type {
  NormalizedOpenApiMediaType,
  NormalizedOpenApiOperation,
  NormalizedOpenApiParameter,
} from "./openapi-operations.js";
import { resolveOpenApiReferences, resolveOpenApiReferencesSync } from "./openapi-references.js";
import type { OpenApiReferenceDocument } from "./openapi-references.js";
import type {
  ApiReferenceRenderer,
  ApiReferenceConfig,
  ApiReferenceVersionConfig,
  DocsConfig,
  DocsOpenApiMcpConfig,
  DocsOkfConfig,
  DocsSearchSourcePage,
  DocsSitemapConfig,
  DocsTheme,
} from "./types.js";

export type { ApiReferenceRenderer };

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

export type ApiReferenceFramework =
  | "next"
  | "tanstack-start"
  | "farmjs"
  | "sveltekit"
  | "astro"
  | "nuxt";

export interface ApiReferenceRoute {
  title: string;
  summary: string;
  description?: string;
  routePath: string;
  sourceFile: string;
  methods: HttpMethod[];
  tag: string;
  parameters: Array<Record<string, unknown>>;
}

export interface ResolvedApiReferenceConfig {
  enabled: boolean;
  path: string;
  specUrl?: string;
  overlays: string[];
  versions: ResolvedApiReferenceVersion[];
  defaultVersion?: string;
  catalogTargets?: string[];
  renderer?: ApiReferenceRenderer;
  mcp?: DocsOpenApiMcpConfig;
  routeRoot: string;
  exclude: string[];
}

export interface ResolvedApiReferenceVersion {
  id: string;
  label: string;
  specUrl: string;
  overlays: string[];
  default: boolean;
}

export interface ApiReferenceOpenApiVersionDiscovery {
  id: string;
  label: string;
  default: boolean;
  url: string;
  apiReferencePath: string;
  specUrl?: string;
}

export interface ApiReferenceOpenApiDiscovery {
  enabled: boolean;
  url?: string;
  urlSource?: "default" | "configured";
  source?: "generated" | "configured";
  specUrl?: string;
  apiReferencePath?: string;
  catalogTargets?: string[];
  versions?: ApiReferenceOpenApiVersionDiscovery[];
}

export interface BuildApiReferenceOptions {
  framework: ApiReferenceFramework;
  rootDir?: string;
  baseUrl?: string;
  version?: string;
}

export interface BuildApiReferenceOperationPagesOptions extends Omit<
  BuildApiReferenceOptions,
  "version"
> {
  /** Locale attached to generated search records in localized documentation sites. */
  locale?: string;
}

export interface CreateApiReferenceOperationMarkdownResponseOptions extends BuildApiReferenceOperationPagesOptions {
  request: Request;
  /** Shared Docs API pathname used by query-form Markdown requests. @default "/api/docs" */
  apiRoute?: string;
  /** Public metadata origin. Defaults to `baseUrl`, then the request origin. */
  origin?: string;
  /** Authored pages included in Markdown recovery suggestions. */
  pages?: DocsSearchSourcePage[];
  /** Reuse a cached operation projection when the adapter already maintains one. */
  operationPages?:
    | DocsSearchSourcePage[]
    | (() => DocsSearchSourcePage[] | Promise<DocsSearchSourcePage[]>);
  sitemap?: boolean | DocsSitemapConfig;
  okf?: boolean | DocsOkfConfig;
}

interface BuildApiReferenceHtmlOptions extends BuildApiReferenceOptions {
  title?: string;
}

const NEXT_ROUTE_FILE_RE = /^route\.(ts|tsx|js|jsx)$/;
const SVELTE_ROUTE_FILE_RE = /^\+server\.(ts|js)$/;
const ASTRO_ROUTE_FILE_RE = /^[^.].*\.(ts|js|mts|mjs)$/;
const NUXT_ROUTE_FILE_RE = /^[^.].*\.(ts|js|mts|mjs)$/;
const TANSTACK_ROUTE_FILE_RE = /\.(ts|tsx|js|jsx)$/;
const METHOD_RE =
  /export\s+(?:async\s+function|function|const)\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|ALL)\b/g;
const METHOD_NAMES: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"];
export const DEFAULT_API_REFERENCE_OPENAPI_ROUTE = "/api/docs?format=openapi";
export const OPENAPI_SPEC_FETCH_TIMEOUT_MS = 10_000;
export const OPENAPI_SPEC_MAX_BYTES = 5 * 1024 * 1024;

function normalizePathSegment(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

export function resolveApiReferenceConfig(
  value: DocsConfig["apiReference"],
): ResolvedApiReferenceConfig {
  if (value === true) {
    return {
      enabled: true,
      path: "api-reference",
      specUrl: undefined,
      overlays: [],
      versions: [],
      defaultVersion: undefined,
      catalogTargets: undefined,
      renderer: undefined,
      mcp: undefined,
      routeRoot: "api",
      exclude: [],
    };
  }

  if (!value) {
    return {
      enabled: false,
      path: "api-reference",
      specUrl: undefined,
      overlays: [],
      versions: [],
      defaultVersion: undefined,
      catalogTargets: undefined,
      renderer: undefined,
      mcp: undefined,
      routeRoot: "api",
      exclude: [],
    };
  }

  const specUrl = normalizeRemoteSpecUrl(value.specUrl);
  const overlays = normalizeOpenApiOverlaySources(value.overlays, "apiReference.overlays");
  const { versions, defaultVersion } = resolveApiReferenceVersions(value);
  if (versions.length > 0 && specUrl) {
    throw new Error("`apiReference.versions` cannot be combined with `apiReference.specUrl`.");
  }
  if (versions.length > 0 && overlays.length > 0) {
    throw new Error(
      "`apiReference.versions` cannot be combined with top-level `apiReference.overlays`; configure overlays on each version instead.",
    );
  }

  return {
    enabled: value.enabled !== false,
    path: normalizePathSegment(value.path ?? "api-reference"),
    specUrl,
    overlays,
    versions,
    defaultVersion,
    catalogTargets: normalizeApiReferenceCatalogTargets(value.catalogTargets),
    renderer: normalizeApiReferenceRenderer(value.renderer),
    mcp: resolveOpenApiMcpConfig(value.mcp),
    routeRoot: normalizePathSegment(value.routeRoot ?? "api") || "api",
    exclude: normalizeApiReferenceExcludes(value.exclude),
  };
}

function normalizeOpenApiOverlaySources(
  value: readonly string[] | undefined,
  location: string,
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error(`\`${location}\` must be an array of sources.`);
  return value.map((source, index) => {
    if (typeof source !== "string" || !source.trim()) {
      throw new Error(`\`${location}[${index}]\` must be a non-empty string.`);
    }
    return source.trim();
  });
}

function resolveApiReferenceVersions(value: ApiReferenceConfig): {
  versions: ResolvedApiReferenceVersion[];
  defaultVersion?: string;
} {
  if (value.versions === undefined) {
    if (value.defaultVersion !== undefined) {
      throw new Error("`apiReference.defaultVersion` requires `apiReference.versions`.");
    }
    return { versions: [] };
  }
  if (!value.versions || typeof value.versions !== "object" || Array.isArray(value.versions)) {
    throw new Error("`apiReference.versions` must be an object keyed by version identifier.");
  }

  const entries = Object.entries(value.versions);
  if (entries.length === 0) throw new Error("`apiReference.versions` must not be empty.");
  const defaultVersion = value.defaultVersion?.trim();
  if (!defaultVersion) {
    throw new Error("`apiReference.defaultVersion` is required when versions are configured.");
  }
  if (!Object.prototype.hasOwnProperty.call(value.versions, defaultVersion)) {
    throw new Error(
      `\`apiReference.defaultVersion\` references unknown version \`${defaultVersion}\`.`,
    );
  }

  const versions = entries.map(([id, rawVersion]) =>
    resolveApiReferenceVersionConfig(id, rawVersion, defaultVersion),
  );
  return { versions, defaultVersion };
}

function resolveApiReferenceVersionConfig(
  rawId: string,
  value: ApiReferenceVersionConfig,
  defaultVersion: string,
): ResolvedApiReferenceVersion {
  const id = rawId.trim();
  if (!id || !/^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/.test(id)) {
    throw new Error(
      `OpenAPI version identifier \`${rawId}\` must be URL-safe and contain only letters, numbers, dots, underscores, or hyphens.`,
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`\`apiReference.versions.${id}\` must be an object.`);
  }
  const specUrl = normalizeRemoteSpecUrl(value.specUrl);
  if (!specUrl) throw new Error(`\`apiReference.versions.${id}.specUrl\` is required.`);
  const label = value.label?.trim() || id;
  return {
    id,
    label,
    specUrl,
    overlays: normalizeOpenApiOverlaySources(
      value.overlays,
      `apiReference.versions.${id}.overlays`,
    ),
    default: id === defaultVersion,
  };
}

function resolveOpenApiMcpConfig(
  value: ApiReferenceConfig["mcp"],
): DocsOpenApiMcpConfig | undefined {
  if (!value) return undefined;
  return value === true ? { enabled: true } : { ...value, enabled: value.enabled !== false };
}

function normalizeApiReferenceRenderer(value?: string): ApiReferenceRenderer | undefined {
  if (value === "fumadocs" || value === "scalar") return value;
  return undefined;
}

export function resolveApiReferenceRenderer(
  value: DocsConfig["apiReference"],
  framework: ApiReferenceFramework,
): ApiReferenceRenderer {
  const config = resolveApiReferenceConfig(value);
  if (config.renderer) return config.renderer;
  return framework === "next" ? "fumadocs" : "scalar";
}

export function resolveApiReferenceOpenApiDiscovery(
  value: DocsConfig["apiReference"],
  options: { route?: string } = {},
): ApiReferenceOpenApiDiscovery {
  const config = resolveApiReferenceConfig(value);
  if (!config.enabled) return { enabled: false };
  const defaultVersion = resolveApiReferenceVersion(config);
  const selectedSpecUrl = defaultVersion?.specUrl ?? config.specUrl;
  const catalogTargets =
    config.catalogTargets ??
    (!selectedSpecUrl || isRequestRelativeSpecUrl(selectedSpecUrl) ? ["/"] : undefined);
  const route = options.route ?? DEFAULT_API_REFERENCE_OPENAPI_ROUTE;
  const versions =
    config.versions.length > 0
      ? config.versions.map((version) => ({
          id: version.id,
          label: version.label,
          default: version.default,
          url: appendUrlSearchParam(route, "version", version.id),
          apiReferencePath: `/${config.path}/${encodeURIComponent(version.id)}`,
          specUrl: isLocalSpecSource(version.specUrl) ? undefined : version.specUrl,
        }))
      : undefined;

  return {
    enabled: true,
    url: route,
    urlSource: options.route === undefined ? "default" : "configured",
    source: selectedSpecUrl ? "configured" : "generated",
    specUrl: isLocalSpecSource(selectedSpecUrl) ? undefined : selectedSpecUrl,
    apiReferencePath: `/${config.path}`,
    catalogTargets,
    versions,
  };
}

function appendUrlSearchParam(url: string, name: string, value: string): string {
  const [withoutHash, hash] = url.split("#", 2);
  const separator = withoutHash.includes("?") ? "&" : "?";
  return `${withoutHash}${separator}${encodeURIComponent(name)}=${encodeURIComponent(value)}${
    hash === undefined ? "" : `#${hash}`
  }`;
}

export function resolveApiReferenceVersion(
  config: ResolvedApiReferenceConfig,
  requestedVersion?: string,
): ResolvedApiReferenceVersion | undefined {
  if (config.versions.length === 0) return undefined;
  const versionId = requestedVersion?.trim() || config.defaultVersion;
  return config.versions.find((version) => version.id === versionId);
}

export function resolveApiReferenceVersionFromPathname(
  value: DocsConfig["apiReference"],
  pathname: string,
): ResolvedApiReferenceVersion | undefined {
  const config = resolveApiReferenceConfig(value);
  if (config.versions.length === 0) return undefined;
  const pathSegments = normalizePathSegment(config.path).split("/").filter(Boolean);
  const pathnameSegments = pathname.split("/").filter(Boolean);
  if (!pathSegments.every((segment, index) => pathnameSegments[index] === segment)) {
    return undefined;
  }
  const rawVersion = pathnameSegments[pathSegments.length];
  if (!rawVersion) return undefined;
  try {
    return resolveApiReferenceVersion(config, decodeURIComponent(rawVersion));
  } catch {
    return undefined;
  }
}

export function isApiReferenceOpenApiRequest(url: URL): boolean {
  return url.searchParams.get("format")?.trim() === "openapi";
}

function normalizeRemoteSpecUrl(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed;
}

function normalizeApiReferenceCatalogTargets(value?: string[]): string[] | undefined {
  if (value === undefined) return undefined;

  return Array.from(
    new Set(
      value
        .filter((target): target is string => typeof target === "string")
        .map((target) => target.trim())
        .filter(Boolean),
    ),
  );
}

function isRequestRelativeSpecUrl(value?: string): boolean {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

function isRemoteSpecUrl(value: string): boolean {
  return /^(?:https?:)?\/\//i.test(value);
}

function isLocalSpecSource(value?: string): boolean {
  if (!value) return false;
  if (value.startsWith("file:")) return true;
  return (
    !isRemoteSpecUrl(value) &&
    !isRequestRelativeSpecUrl(value) &&
    !/^[a-z][a-z\d+.-]*:/i.test(value)
  );
}

export function buildApiReferencePageTitle(config: DocsConfig, title = "API Reference"): string {
  const template = config.metadata?.titleTemplate;
  if (!template) return title;
  return template.replace("%s", title);
}

export function buildApiReferenceScalarCss(config: DocsConfig): string {
  const theme = resolveTheme(config);
  const colors = theme?.ui?.colors;
  const typography = theme?.ui?.typography?.font?.style;
  const layout = theme?.ui?.layout;
  const radius = resolveApiReferenceRadius(theme);
  const primary = colors?.primary ?? "#6366f1";
  const border = colors?.border ?? "#2a2a2a";
  const muted = colors?.muted ?? "#64748b";
  const background = colors?.background ?? "#ffffff";
  const card = colors?.card ?? background;
  const foreground = colors?.foreground ?? inferApiReferenceForeground(theme, background);
  const primaryForeground =
    colors?.primaryForeground ?? inferContrastingForeground(primary, theme, background);
  const sidebarWidth = layout?.sidebarWidth ?? 280;
  const sans = typography?.sans ?? '"Geist", "Inter", "Segoe UI", sans-serif';
  const mono = typography?.mono ?? '"Geist Mono", "SFMono-Regular", "Menlo", monospace';
  const isPixelBorder = theme?.name?.includes("pixel-border");
  const darkBorderColor = isPixelBorder
    ? "color-mix(in srgb, var(--scalar-theme-foreground) 10%, transparent)"
    : "color-mix(in srgb, var(--scalar-theme-border) 14%, rgba(255, 255, 255, 0.02))";
  const lightBorderColor = isPixelBorder
    ? "color-mix(in srgb, var(--scalar-theme-foreground) 14%, transparent)"
    : "color-mix(in srgb, var(--scalar-theme-border) 30%, white 70%)";

  return `
:root {
  --scalar-font: ${sans};
  --scalar-font-code: ${mono};
  --scalar-radius: ${radius};
  --scalar-radius-sm: calc(${radius} + 2px);
  --scalar-theme-primary: ${primary};
  --scalar-theme-border: ${border};
  --scalar-theme-muted: ${muted};
  --scalar-theme-background: ${background};
  --scalar-theme-card: ${card};
  --scalar-theme-foreground: ${foreground};
}

.dark-mode {
  --scalar-background-1: color-mix(
    in srgb,
    var(--scalar-theme-background) 96%,
    var(--scalar-theme-primary) 4%
  );
  --scalar-background-2: color-mix(in srgb, var(--scalar-theme-card) 94%, var(--scalar-theme-primary) 6%);
  --scalar-background-3: color-mix(
    in srgb,
    var(--scalar-theme-card) 90%,
    var(--scalar-theme-foreground) 10%
  );
  --scalar-color-1: var(--scalar-theme-foreground);
  --scalar-color-2: color-mix(in srgb, var(--scalar-theme-foreground) 72%, transparent);
  --scalar-color-3: color-mix(in srgb, var(--scalar-theme-foreground) 52%, transparent);
  --scalar-color-accent: var(--scalar-theme-primary);
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-background-2: var(--scalar-background-2);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-search-background: var(--scalar-background-2);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
  --scalar-sidebar-search-color: var(--scalar-color-2);
  --scalar-sidebar-color-active: var(--scalar-theme-primary);
  --scalar-sidebar-item-active-background: color-mix(
    in srgb,
    var(--scalar-theme-primary) 7%,
    transparent
  );
  --scalar-border-color: ${darkBorderColor};
  --scalar-button-1: var(--scalar-theme-primary);
  --scalar-button-1-color: ${primaryForeground};
  --scalar-button-1-hover: color-mix(in srgb, var(--scalar-theme-primary) 88%, white 12%);
}

.light-mode {
  --scalar-background-1: var(--scalar-theme-background);
  --scalar-background-2: color-mix(in srgb, var(--scalar-theme-card) 92%, white 8%);
  --scalar-background-3: color-mix(in srgb, var(--scalar-theme-card) 84%, black 4%);
  --scalar-color-1: var(--scalar-theme-foreground);
  --scalar-color-2: var(--scalar-theme-muted);
  --scalar-color-3: color-mix(in srgb, var(--scalar-theme-muted) 78%, white 22%);
  --scalar-color-accent: var(--scalar-theme-primary);
  --scalar-sidebar-background-1: var(--scalar-background-1);
  --scalar-sidebar-background-2: var(--scalar-background-2);
  --scalar-sidebar-color-1: var(--scalar-color-1);
  --scalar-sidebar-color-2: var(--scalar-color-2);
  --scalar-sidebar-search-background: var(--scalar-background-2);
  --scalar-sidebar-search-border-color: var(--scalar-border-color);
  --scalar-sidebar-search-color: var(--scalar-color-2);
  --scalar-sidebar-color-active: var(--scalar-theme-primary);
  --scalar-sidebar-item-active-background: color-mix(
    in srgb,
    var(--scalar-theme-primary) 5%,
    transparent
  );
  --scalar-border-color: ${lightBorderColor};
  --scalar-button-1: var(--scalar-theme-primary);
  --scalar-button-1-color: ${primaryForeground};
  --scalar-button-1-hover: color-mix(in srgb, var(--scalar-theme-primary) 88%, black 12%);
}

body {
  background: var(--scalar-background-1);
  color: var(--scalar-color-1);
}

.t-doc__sidebar {
  width: min(${sidebarWidth}px, 100vw);
  border-right: 1px solid var(--scalar-border-color);
}

.scalar-card,
.t-doc__sidebar,
.references-layout .reference-layout__content .request-card,
.references-layout .reference-layout__content .response-card,
.references-layout .reference-layout__content .scalar-card-header,
.references-layout .reference-layout__content .scalar-card-footer,
.references-layout .reference-layout__content .section,
.references-layout .reference-layout__content .section-container {
  border-color: var(--scalar-border-color) !important;
}

.t-doc__sidebar,
.t-doc__sidebar * {
  font-family: var(--scalar-font);
}

.t-doc__sidebar .sidebar-search {
  margin: 0.5rem 0 1rem;
}

.t-doc__sidebar .sidebar-search input {
  border-radius: var(--scalar-radius-sm);
}

.t-doc__sidebar .sidebar-item,
.t-doc__sidebar .sidebar-heading {
  border-radius: var(--scalar-radius-sm);
}

.t-doc__sidebar .sidebar-group-label {
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--scalar-color-3);
}

.t-doc__sidebar .sidebar-item--active {
  font-weight: 600;
}

.scalar-card,
.references-layout .reference-layout__content .request-card,
.references-layout .reference-layout__content .response-card {
  border-radius: var(--scalar-radius);
}

.references-layout .reference-layout__content {
  padding-top: 1.5rem;
}

.references-layout .section-content,
.references-layout .section-flare {
  background: transparent;
}

.references-layout .reference-layout__content,
.references-layout .reference-layout__content * {
  font-family: var(--scalar-font);
}

.references-layout code,
.references-layout pre,
.references-layout .scalar-codeblock {
  font-family: var(--scalar-font-code);
}

.references-layout,
.references-layout * {
  color: inherit;
}

.references-layout .reference-layout__content .introduction,
.references-layout .reference-layout__content .section,
.references-layout .reference-layout__content .section-container,
.references-layout .reference-layout__content .operation-details,
.references-layout .reference-layout__content .markdown,
.references-layout .reference-layout__content .markdown *,
.references-layout .reference-layout__content .property,
.references-layout .reference-layout__content .property *,
.references-layout .reference-layout__content .parameter-item,
.references-layout .reference-layout__content .parameter-item *,
.references-layout .reference-layout__content .response-card,
.references-layout .reference-layout__content .response-card *,
.references-layout .reference-layout__content .request-card,
.references-layout .reference-layout__content .request-card * {
  color: var(--scalar-color-1);
}

.references-layout a,
.references-layout button {
  color: var(--scalar-color-1);
}

${isPixelBorder ? buildPixelBorderScalarCss() : ""}
`;
}

function buildPixelBorderScalarCss(): string {
  return `
.t-doc__sidebar,
.references-layout .reference-layout__content {
  background-image:
    repeating-linear-gradient(
      -45deg,
      color-mix(in srgb, var(--scalar-theme-border) 12%, transparent),
      color-mix(in srgb, var(--scalar-theme-border) 12%, transparent) 1px,
      transparent 1px,
      transparent 8px
    );
}

.t-doc__sidebar .sidebar-group-label,
.t-doc__sidebar .sidebar-item,
.references-layout .reference-layout__content .section-header {
  font-family: var(--scalar-font-code);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
`;
}

function inferApiReferenceForeground(theme: DocsTheme | undefined, background: string): string {
  if (looksDarkTheme(theme, background)) return "#f5f5f4";
  return "#1b1b1b";
}

function resolveApiReferenceRadius(theme: DocsTheme | undefined): string {
  if (theme?.ui?.radius) return theme.ui.radius;

  const name = theme?.name?.toLowerCase() ?? "";
  if (name.includes("pixel-border") || name.includes("darksharp")) {
    return "0px";
  }

  return "var(--radius, 0.75rem)";
}

function inferContrastingForeground(
  value: string,
  theme: DocsTheme | undefined,
  background: string,
): string {
  const rgb = parseCssColor(value);
  if (rgb) {
    return relativeLuminance(rgb) > 0.58 ? "#0b0b0b" : "#ffffff";
  }

  if (theme?.name?.includes("pixel-border")) {
    return "#0b0b0b";
  }

  if (looksDarkTheme(theme, background)) {
    return "#0b0b0b";
  }

  return "#ffffff";
}

function looksDarkTheme(theme: DocsTheme | undefined, background: string): boolean {
  const name = theme?.name?.toLowerCase() ?? "";
  if (name.includes("pixel-border") || name.includes("darksharp")) return true;

  const rgb = parseCssColor(background);
  if (!rgb) return false;
  return relativeLuminance(rgb) < 0.45;
}

function parseCssColor(value: string): [number, number, number] | undefined {
  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith("#")) {
    return parseHexColor(normalized);
  }

  const rgbMatch = normalized.match(/^rgba?\((.+)\)$/);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch[1]
      .split(",")
      .slice(0, 3)
      .map((part) => Number.parseFloat(part.trim()));
    if ([r, g, b].every((channel) => Number.isFinite(channel))) {
      return [r, g, b] as [number, number, number];
    }
  }

  const hslMatch = normalized.match(/^hsla?\((.+)\)$/);
  if (hslMatch) {
    const [h, s, l] = hslMatch[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .slice(0, 3);
    const hue = Number.parseFloat(h);
    const saturation = Number.parseFloat(s.replace("%", ""));
    const lightness = Number.parseFloat(l.replace("%", ""));
    if ([hue, saturation, lightness].every((channel) => Number.isFinite(channel))) {
      return hslToRgb(hue, saturation / 100, lightness / 100);
    }
  }

  const oklchMatch = normalized.match(/^oklch\((.+)\)$/);
  if (oklchMatch) {
    const [l, c, h] = oklchMatch[1].split(/[\s/]+/).filter(Boolean);
    const lightness = Number.parseFloat(l);
    const chroma = Number.parseFloat(c);
    const hue = Number.parseFloat(h);
    if ([lightness, chroma, hue].every((channel) => Number.isFinite(channel))) {
      return oklchToRgb(lightness, chroma, hue);
    }
  }

  return undefined;
}

function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const hue = (h * Math.PI) / 180;
  const a = Math.cos(hue) * c;
  const b = Math.sin(hue) * c;

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  const linearR = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const linearG = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const linearB = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  return [srgbFromLinear(linearR), srgbFromLinear(linearG), srgbFromLinear(linearB)];
}

function srgbFromLinear(value: number): number {
  const normalized = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(normalized * 255)));
}

function parseHexColor(value: string): [number, number, number] | undefined {
  const raw = value.slice(1);
  if (raw.length === 3) {
    return [
      Number.parseInt(raw[0] + raw[0], 16),
      Number.parseInt(raw[1] + raw[1], 16),
      Number.parseInt(raw[2] + raw[2], 16),
    ];
  }

  if (raw.length === 6 || raw.length === 8) {
    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
    ];
  }

  return undefined;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = (((h % 360) + 360) % 360) / 360;

  if (s === 0) {
    const gray = Math.round(l * 255);
    return [gray, gray, gray];
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const convert = (channel: number) => {
    let t = channel;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  return [
    Math.round(convert(hue + 1 / 3) * 255),
    Math.round(convert(hue) * 255),
    Math.round(convert(hue - 1 / 3) * 255),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const normalize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
}

export function buildApiReferenceOpenApiDocument(
  config: DocsConfig,
  options: BuildApiReferenceOptions,
): Record<string, unknown> {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  const selectedVersion = resolveApiReferenceVersion(apiReference, options.version);
  if (apiReference.versions.length > 0 && !selectedVersion) {
    return buildUnavailableOpenApiDocument(
      config,
      `Unknown OpenAPI version \`${options.version}\`. Available versions: ${apiReference.versions
        .map((version) => version.id)
        .join(", ")}.`,
    );
  }
  const specUrl = selectedVersion?.specUrl ?? apiReference.specUrl;
  const overlays = selectedVersion?.overlays ?? apiReference.overlays;
  if (specUrl) {
    if (isLocalSpecSource(specUrl)) {
      try {
        if (overlays.some((overlay) => !isLocalSpecSource(overlay))) {
          throw new Error("Remote OpenAPI overlays require the async API reference builder.");
        }
        const document = readLocalOpenApiDocument(specUrl, options.rootDir, overlays);
        return normalizeConfiguredOpenApiDocument(
          document,
          config,
          options.baseUrl,
          specUrl,
          selectedVersion,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return buildUnavailableOpenApiDocument(
          config,
          `Unable to load the configured OpenAPI document. ${message}`,
        );
      }
    }

    return buildUnavailableOpenApiDocument(
      config,
      `Remote OpenAPI specs require the async API reference builder. Use the framework route helper or buildApiReferenceOpenApiDocumentAsync().`,
    );
  }

  const routes = buildApiReferenceRoutes(config, options);
  return buildOpenApiDocumentFromRoutes(config, options.framework, routes, options.baseUrl);
}

export async function buildApiReferenceOpenApiDocumentAsync(
  config: DocsConfig,
  options: BuildApiReferenceOptions,
): Promise<Record<string, unknown>> {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  const selectedVersion = resolveApiReferenceVersion(apiReference, options.version);
  if (apiReference.versions.length > 0 && !selectedVersion) {
    return buildUnavailableOpenApiDocument(
      config,
      `Unknown OpenAPI version \`${options.version}\`. Available versions: ${apiReference.versions
        .map((version) => version.id)
        .join(", ")}.`,
    );
  }
  const specUrl = selectedVersion?.specUrl ?? apiReference.specUrl;
  const overlays = selectedVersion?.overlays ?? apiReference.overlays;
  if (!specUrl) {
    return buildApiReferenceOpenApiDocument(config, options);
  }

  try {
    const document = isLocalSpecSource(specUrl)
      ? await readLocalOpenApiDocumentAsync(specUrl, options.rootDir, overlays, options.baseUrl)
      : await fetchRemoteOpenApiDocument(specUrl, options.baseUrl, overlays, options.rootDir);
    return normalizeConfiguredOpenApiDocument(
      document,
      config,
      options.baseUrl,
      specUrl,
      selectedVersion,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return buildUnavailableOpenApiDocument(
      config,
      `Unable to load the configured OpenAPI document. ${message}`,
    );
  }
}

/**
 * Build deterministic, operation-level source pages from every configured OpenAPI version.
 *
 * These pages are framework-neutral projections used by documentation search and other
 * read-only knowledge surfaces. They never inherit MCP execution headers or credentials.
 */
export async function buildApiReferenceOperationPagesAsync(
  config: DocsConfig,
  options: BuildApiReferenceOperationPagesOptions,
): Promise<DocsSearchSourcePage[]> {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  if (!apiReference.enabled) return [];

  const versions =
    apiReference.versions.length > 0
      ? apiReference.versions
      : ([undefined] as Array<ResolvedApiReferenceVersion | undefined>);
  const pagesByVersion = await Promise.all(
    versions.map(async (version) => {
      const document = await buildApiReferenceOpenApiDocumentAsync(config, {
        ...options,
        version: version?.id,
      });
      const model = buildNormalizedOpenApiModel(document);
      const basePath = `/${apiReference.path}${
        version ? `/${encodeURIComponent(version.id)}` : ""
      }`;

      return model.operations.map((operation) => {
        const url = `${basePath}/operations/${encodeURIComponent(operation.slug)}`;
        const content = renderApiReferenceOperationMarkdown(operation, {
          apiTitle: model.title,
          apiVersion: version?.label ?? model.version,
          specificationVersion: model.specificationVersion,
        });
        const description = operation.summary ?? operation.description ?? operation.selector;

        return {
          title: operation.title,
          url,
          canonicalUrl: url,
          content,
          description,
          rawContent: content,
          agentContent: content,
          agentRawContent: content,
          type: "api" as const,
          ...(options.locale ? { locale: options.locale } : {}),
          ...(version?.id || model.version ? { version: version?.id ?? model.version } : {}),
          tags: Array.from(new Set(["openapi", operation.method.toLowerCase(), ...operation.tags])),
        } satisfies DocsSearchSourcePage;
      });
    }),
  );

  return pagesByVersion.flat();
}

function normalizeApiReferenceMarkdownPath(value: string): string {
  const trimmed = value.trim().replace(/\.md$/i, "");
  if (!trimmed) return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`.replace(/\/{2,}/g, "/");
}

function isApiReferenceOperationPath(pathname: string, apiReferencePath: string): boolean {
  const basePath = `/${normalizePathSegment(apiReferencePath)}`;
  if (!pathname.startsWith(`${basePath}/`)) return false;
  const segments = pathname.slice(basePath.length + 1).split("/");
  return (
    (segments.length === 2 && segments[0] === "operations" && Boolean(segments[1])) ||
    (segments.length === 3 && segments[1] === "operations" && Boolean(segments[0] && segments[2]))
  );
}

function resolveApiReferenceOperationMarkdownPath(
  request: Request,
  apiReferencePath: string,
  apiRoute = "/api/docs",
): string | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const url = new URL(request.url);
  const pathname = normalizeApiReferenceMarkdownPath(url.pathname);
  const normalizedApiRoute = normalizeApiReferenceMarkdownPath(apiRoute);
  if (pathname === normalizedApiRoute && url.searchParams.get("format")?.trim() === "markdown") {
    const requestedPath = normalizeApiReferenceMarkdownPath(
      url.searchParams.get("path")?.trim() ?? "",
    );
    return isApiReferenceOperationPath(requestedPath, apiReferencePath) ? requestedPath : null;
  }

  if (url.pathname.toLowerCase().endsWith(".md")) {
    return isApiReferenceOperationPath(pathname, apiReferencePath) ? pathname : null;
  }

  const requestsMarkdown =
    acceptsDocsMarkdown(request) ||
    hasDocsMarkdownSignatureAgent(request) ||
    detectDocsMarkdownAgentRequest(request).detected;
  return requestsMarkdown && isApiReferenceOperationPath(pathname, apiReferencePath)
    ? pathname
    : null;
}

/**
 * Resolve a public per-operation Markdown request using the same generated projection as search,
 * Ask AI, and MCP. Returns `null` when the request is not an API operation Markdown route.
 */
export async function createApiReferenceOperationMarkdownResponse(
  config: DocsConfig,
  options: CreateApiReferenceOperationMarkdownResponseOptions,
): Promise<Response | null> {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  if (!apiReference.enabled) return null;

  const requestedPath = resolveApiReferenceOperationMarkdownPath(
    options.request,
    apiReference.path,
    options.apiRoute,
  );
  if (!requestedPath) return null;

  const requestUrl = new URL(options.request.url);
  const origin = options.origin ?? options.baseUrl ?? requestUrl.origin;
  const operationPages = options.operationPages
    ? await (typeof options.operationPages === "function"
        ? options.operationPages()
        : options.operationPages)
    : await buildApiReferenceOperationPagesAsync(config, {
        framework: options.framework,
        rootDir: options.rootDir,
        baseUrl: options.baseUrl ?? requestUrl.origin,
        locale: options.locale,
      });
  const page = operationPages.find(
    (candidate) => normalizeApiReferenceMarkdownPath(candidate.url) === requestedPath,
  );
  const canonicalPath = page?.canonicalUrl ?? page?.url ?? requestedPath;
  const canonicalUrl = new URL(canonicalPath, origin).toString();
  const contentLocation = new URL(toDocsMarkdownUrl(page?.url ?? requestedPath), origin).toString();
  const relativeRequestedPath = requestedPath
    .slice(`/${apiReference.path}`.length)
    .replace(/^\/+/, "");

  return createDocsMarkdownResponse({
    request: options.request,
    apiRoute: options.apiRoute,
    document: page
      ? renderDocsMarkdownDocument(page, {
          origin,
          sitemap: options.sitemap,
          okf: options.okf,
        })
      : null,
    entry: apiReference.path,
    requestedPath: relativeRequestedPath,
    origin,
    locale: options.locale,
    canonicalUrl,
    contentLocation,
    pages: [...(options.pages ?? []), ...operationPages],
    sitemap: options.sitemap,
  });
}

function renderApiReferenceOperationMarkdown(
  operation: NormalizedOpenApiOperation,
  metadata: { apiTitle: string; apiVersion: string; specificationVersion: string },
): string {
  const lines = [
    `# ${operation.title}`,
    "",
    `\`${operation.method} ${operation.path}\``,
    "",
    `- Operation ID: \`${operation.operationId}\``,
    `- API: ${metadata.apiTitle}`,
    `- API version: ${metadata.apiVersion}`,
    `- OpenAPI: ${metadata.specificationVersion}`,
  ];

  if (operation.tags.length > 0) lines.push(`- Tags: ${operation.tags.join(", ")}`);
  if (operation.deprecated) lines.push("- Deprecated: yes");
  if (operation.description && operation.description !== operation.title) {
    lines.push("", operation.description);
  }
  if (operation.servers.length > 0) {
    lines.push("", "## Servers", "", ...operation.servers.map((server) => `- ${server}`));
  }
  if (operation.parameters.length > 0) {
    lines.push("", "## Parameters", "");
    for (const parameter of operation.parameters) {
      lines.push(renderApiReferenceParameter(parameter));
    }
  }
  if (operation.requestBody) {
    lines.push("", "## Request body", "");
    if (operation.requestBody.description) lines.push(operation.requestBody.description, "");
    lines.push(`Required: ${operation.requestBody.required ? "yes" : "no"}`);
    appendApiReferenceMediaTypes(lines, operation.requestBody.content);
  }
  if (operation.responses.length > 0) {
    lines.push("", "## Responses", "");
    for (const response of operation.responses) {
      lines.push(`### ${response.status}`, "", response.description ?? "No response description.");
      appendApiReferenceMediaTypes(lines, response.content);
      lines.push("");
    }
  }
  if (operation.security.length > 0) {
    lines.push("", "## Security", "");
    for (const requirement of operation.security) {
      const schemes = Object.entries(requirement).map(([name, scopes]) =>
        scopes.length > 0 ? `${name} (${scopes.join(", ")})` : name,
      );
      lines.push(`- ${schemes.join(" and ")}`);
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

function renderApiReferenceParameter(parameter: NormalizedOpenApiParameter): string {
  const details = [parameter.in, parameter.required ? "required" : "optional"];
  const schema = renderApiReferenceSchema(parameter.schema);
  if (schema) details.push(schema);
  return `- \`${parameter.name}\` (${details.join(", ")})${
    parameter.description ? ` — ${parameter.description}` : ""
  }`;
}

function appendApiReferenceMediaTypes(lines: string[], content: NormalizedOpenApiMediaType[]) {
  for (const media of content) {
    lines.push("", `- Content type: \`${media.mediaType}\``);
    const schema = renderApiReferenceSchema(media.schema);
    if (schema) lines.push(`  Schema: \`${schema}\``);
    for (const example of media.examples) {
      const value = renderApiReferenceSchema(example.value);
      lines.push(`  Example ${example.name}: ${value ? `\`${value}\`` : "available"}`);
    }
  }
}

function renderApiReferenceSchema(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }
  try {
    const serialized = JSON.stringify(value);
    return serialized.length > 500 ? `${serialized.slice(0, 497)}...` : serialized;
  } catch {
    return undefined;
  }
}

function buildOpenApiDocumentFromRoutes(
  config: DocsConfig,
  framework: ApiReferenceFramework,
  routes: ApiReferenceRoute[],
  baseUrl?: string,
): Record<string, unknown> {
  const tags = Array.from(new Set(routes.map((route) => route.tag))).map((name) => ({
    name,
    description: `${name} endpoints`,
  }));

  return {
    openapi: "3.1.0",
    info: {
      title: "API Reference",
      description: config.metadata?.description ?? `Generated API reference for ${framework}.`,
      version: "0.0.0",
    },
    servers: [{ url: baseUrl ?? "/" }],
    tags,
    paths: buildOpenApiPaths(routes),
  };
}

export function buildApiReferenceHtmlDocument(
  config: DocsConfig,
  options: BuildApiReferenceHtmlOptions,
): string {
  return buildApiReferenceHtmlDocumentFromDocument(
    config,
    options,
    buildApiReferenceOpenApiDocument(config, options),
  );
}

export async function buildApiReferenceHtmlDocumentAsync(
  config: DocsConfig,
  options: BuildApiReferenceHtmlOptions,
): Promise<string> {
  const document = await buildApiReferenceOpenApiDocumentAsync(config, options);
  return buildApiReferenceHtmlDocumentFromDocument(config, options, document);
}

function buildApiReferenceHtmlDocumentFromDocument(
  config: DocsConfig,
  options: BuildApiReferenceHtmlOptions,
  document: Record<string, unknown>,
): string {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  const title = options.title ?? "API Reference";
  const version = resolveApiReferenceVersion(apiReference, options.version);
  const basePath = `/${apiReference.path}${version ? `/${encodeURIComponent(version.id)}` : ""}`;

  return getHtmlDocument({
    pageTitle: buildApiReferencePageTitle(config, title),
    title,
    content: () => document,
    theme: "deepSpace",
    layout: "modern",
    customCss: buildApiReferenceScalarCss(config),
    pathRouting: {
      basePath,
    },
    showSidebar: true,
    defaultOpenFirstTag: true,
    tagsSorter: "alpha",
    operationsSorter: "alpha",
    operationTitleSource: "summary",
    defaultHttpClient: {
      targetKey: "shell",
      clientKey: "curl",
    },
    documentDownloadType: "json",
  });
}

async function fetchRemoteOpenApiDocument(
  specUrl: string,
  baseUrl?: string,
  overlays: readonly string[] = [],
  rootDir = process.cwd(),
): Promise<Record<string, unknown>> {
  let url: URL;
  try {
    url = baseUrl ? new URL(specUrl, baseUrl) : new URL(specUrl);
  } catch {
    throw new Error(
      baseUrl
        ? "`apiReference.specUrl` must be an absolute URL or a request-relative path."
        : "`apiReference.specUrl` must be an absolute URL.",
    );
  }

  const entry = await fetchOpenApiReferenceDocument(url, true);
  const overlaidDocument = await applyConfiguredOpenApiOverlaysAsync(
    entry.document as Record<string, unknown>,
    overlays,
    rootDir,
    baseUrl,
  );
  return resolveOpenApiReferences(overlaidDocument, {
    sourceUri: entry.uri,
    loadDocument: async (referenceUrl) => {
      if (referenceUrl.protocol !== "http:" && referenceUrl.protocol !== "https:") {
        throw new Error(
          `Remote OpenAPI documents cannot load non-HTTP references: ${referenceUrl.href}`,
        );
      }
      return fetchOpenApiReferenceDocument(referenceUrl, false);
    },
  });
}

async function fetchOpenApiReferenceDocument(
  url: URL,
  validateContract: boolean,
): Promise<OpenApiReferenceDocument> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("`apiReference.specUrl` must use HTTP or HTTPS for remote documents.");
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), OPENAPI_SPEC_FETCH_TIMEOUT_MS);
  let response: Response;
  let body: string;

  try {
    response = await fetch(url, {
      headers: {
        accept: "application/json, application/yaml, application/x-yaml, text/yaml, text/x-yaml",
      },
      redirect: "follow",
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Received ${response.status} ${response.statusText}`.trim());
    }

    if (response.url) {
      const responseUrl = new URL(response.url);
      if (responseUrl.protocol !== "http:" && responseUrl.protocol !== "https:") {
        throw new Error("The remote OpenAPI endpoint redirected to a non-HTTP URL.");
      }
    }

    body = await readOpenApiResponseBody(response);
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error(
        `The remote OpenAPI endpoint did not respond within ${OPENAPI_SPEC_FETCH_TIMEOUT_MS / 1_000} seconds.`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!body.trim()) {
    throw new Error("The remote endpoint returned an empty response.");
  }

  const sourceUri = response.url || url.href;
  return {
    uri: sourceUri,
    document: parseOpenApiDocument(
      body,
      sourceUri,
      response.headers.get("content-type"),
      "remote",
      validateContract,
    ),
  };
}

async function readOpenApiResponseBody(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > OPENAPI_SPEC_MAX_BYTES) {
      throw new Error(
        `The remote OpenAPI document exceeds the ${formatByteLimit(OPENAPI_SPEC_MAX_BYTES)} size limit.`,
      );
    }
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let body = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > OPENAPI_SPEC_MAX_BYTES) {
        await reader.cancel();
        throw new Error(
          `The remote OpenAPI document exceeds the ${formatByteLimit(OPENAPI_SPEC_MAX_BYTES)} size limit.`,
        );
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return body;
  } finally {
    reader.releaseLock();
  }
}

function formatByteLimit(bytes: number): string {
  return `${bytes / (1024 * 1024)} MiB`;
}

function readLocalOpenApiDocument(
  specUrl: string,
  rootDir = process.cwd(),
  overlays: readonly string[] = [],
): Record<string, unknown> {
  const filePath = resolveLocalOpenApiFilePath(specUrl, rootDir);
  const document = readOpenApiFileDocument(filePath, true);
  const trustedRoot = specUrl.startsWith("file:") ? undefined : realpathSync(resolve(rootDir));
  const overlaidDocument = applyConfiguredOpenApiOverlaysSync(
    document as Record<string, unknown>,
    overlays,
    rootDir,
  );
  return resolveOpenApiReferencesSync(overlaidDocument, {
    sourceUri: pathToFileURL(filePath).href,
    loadDocument: (referenceUrl) => {
      if (referenceUrl.protocol === "http:" || referenceUrl.protocol === "https:") {
        throw new Error("Remote OpenAPI references require the async API reference builder.");
      }
      return readOpenApiFileReference(referenceUrl, trustedRoot);
    },
  });
}

async function readLocalOpenApiDocumentAsync(
  specUrl: string,
  rootDir = process.cwd(),
  overlays: readonly string[] = [],
  baseUrl?: string,
): Promise<Record<string, unknown>> {
  const filePath = resolveLocalOpenApiFilePath(specUrl, rootDir);
  const document = await readOpenApiFileDocumentAsync(filePath, true);
  const trustedRoot = specUrl.startsWith("file:") ? undefined : realpathSync(resolve(rootDir));
  const overlaidDocument = await applyConfiguredOpenApiOverlaysAsync(
    document as Record<string, unknown>,
    overlays,
    rootDir,
    baseUrl,
  );
  return resolveOpenApiReferences(overlaidDocument, {
    sourceUri: pathToFileURL(filePath).href,
    loadDocument: async (referenceUrl, fromUrl) => {
      if (referenceUrl.protocol === "http:" || referenceUrl.protocol === "https:") {
        return fetchOpenApiReferenceDocument(referenceUrl, false);
      }
      if (fromUrl.protocol === "http:" || fromUrl.protocol === "https:") {
        throw new Error(
          `Remote OpenAPI documents cannot load local file references: ${referenceUrl.href}`,
        );
      }
      return readOpenApiFileReferenceAsync(referenceUrl, trustedRoot);
    },
  });
}

function applyConfiguredOpenApiOverlaysSync(
  document: Record<string, unknown>,
  overlays: readonly string[],
  rootDir: string,
): Record<string, unknown> {
  if (overlays.length === 0) return document;
  const loaded = overlays.map((source): OpenApiOverlayDocumentSource => {
    if (!isLocalSpecSource(source)) {
      throw new Error("Remote OpenAPI overlays require the async API reference builder.");
    }
    const filePath = resolveLocalOpenApiFilePath(source, rootDir);
    return {
      source,
      document: readOpenApiFileDocument(filePath, false),
    };
  });
  const result = applyOpenApiOverlayDocuments(document, loaded);
  assertValidOpenApiContract(result);
  return result;
}

async function applyConfiguredOpenApiOverlaysAsync(
  document: Record<string, unknown>,
  overlays: readonly string[],
  rootDir: string,
  baseUrl?: string,
): Promise<Record<string, unknown>> {
  if (overlays.length === 0) return document;
  const loaded = await Promise.all(
    overlays.map(async (source): Promise<OpenApiOverlayDocumentSource> => {
      if (isLocalSpecSource(source)) {
        const filePath = resolveLocalOpenApiFilePath(source, rootDir);
        return {
          source,
          document: await readOpenApiFileDocumentAsync(filePath, false),
        };
      }

      let url: URL;
      try {
        url = baseUrl ? new URL(source, baseUrl) : new URL(source);
      } catch {
        throw new Error(
          baseUrl
            ? `OpenAPI overlay \`${source}\` must be an absolute URL or a request-relative path.`
            : `OpenAPI overlay \`${source}\` must be an absolute URL.`,
        );
      }
      const entry = await fetchOpenApiReferenceDocument(url, false);
      return { source, document: entry.document };
    }),
  );
  const result = applyOpenApiOverlayDocuments(document, loaded);
  assertValidOpenApiContract(result);
  return result;
}

function readOpenApiFileReference(url: URL, trustedRoot?: string): OpenApiReferenceDocument {
  if (url.protocol !== "file:") {
    throw new Error(`Local OpenAPI documents cannot load this reference: ${url.href}`);
  }
  const filePath = resolveReferencedOpenApiFilePath(url, trustedRoot);
  return { uri: pathToFileURL(filePath).href, document: readOpenApiFileDocument(filePath, false) };
}

async function readOpenApiFileReferenceAsync(
  url: URL,
  trustedRoot?: string,
): Promise<OpenApiReferenceDocument> {
  if (url.protocol !== "file:") {
    throw new Error(`Local OpenAPI documents cannot load this reference: ${url.href}`);
  }
  const filePath = resolveReferencedOpenApiFilePath(url, trustedRoot);
  return {
    uri: pathToFileURL(filePath).href,
    document: await readOpenApiFileDocumentAsync(filePath, false),
  };
}

function readOpenApiFileDocument(filePath: string, validateContract: boolean): unknown {
  assertOpenApiFileSize(filePath);
  const body = readFileSync(filePath, "utf-8");
  if (!body.trim()) throw new Error(`The local OpenAPI file is empty: ${filePath}`);
  return parseOpenApiDocument(body, filePath, undefined, "local", validateContract);
}

async function readOpenApiFileDocumentAsync(
  filePath: string,
  validateContract: boolean,
): Promise<unknown> {
  assertOpenApiFileSize(filePath);
  const body = await readFile(filePath, "utf-8");
  if (!body.trim()) throw new Error(`The local OpenAPI file is empty: ${filePath}`);
  return parseOpenApiDocument(body, filePath, undefined, "local", validateContract);
}

function assertOpenApiFileSize(filePath: string): void {
  if (statSync(filePath).size > OPENAPI_SPEC_MAX_BYTES) {
    throw new Error(
      `The local OpenAPI document exceeds the ${formatByteLimit(OPENAPI_SPEC_MAX_BYTES)} size limit: ${filePath}`,
    );
  }
}

function resolveLocalOpenApiFilePath(specUrl: string, rootDir: string): string {
  if (specUrl.startsWith("file:")) return fileURLToPath(new URL(specUrl));

  const resolvedRoot = resolve(rootDir);
  const filePath = resolve(resolvedRoot, specUrl);
  return resolveContainedOpenApiFilePath(filePath, realpathSync(resolvedRoot));
}

function resolveReferencedOpenApiFilePath(url: URL, trustedRoot?: string): string {
  const filePath = fileURLToPath(url);
  return trustedRoot
    ? resolveContainedOpenApiFilePath(filePath, trustedRoot)
    : realpathSync(filePath);
}

function resolveContainedOpenApiFilePath(filePath: string, realRoot: string): string {
  const realFilePath = realpathSync(filePath);
  const relativePath = relative(realRoot, realFilePath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(
      "Project-relative OpenAPI files must stay inside the project root. Use an explicit `file:` URL for an external local file.",
    );
  }
  return realFilePath;
}

function parseOpenApiDocument(
  body: string,
  source: string,
  contentType: string | null | undefined,
  sourceKind: "local" | "remote",
  validateContract = true,
): unknown {
  const extension = getOpenApiSourceExtension(source);
  const normalizedContentType = contentType?.split(";", 1)[0]?.trim().toLowerCase();
  const format =
    normalizedContentType?.includes("yaml") || extension === ".yaml" || extension === ".yml"
      ? "yaml"
      : normalizedContentType?.includes("json") || extension === ".json"
        ? "json"
        : "auto";
  let parsed: unknown;

  try {
    if (format === "yaml") {
      parsed = parseYaml(body);
    } else if (format === "json") {
      parsed = JSON.parse(body);
    } else {
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = parseYaml(body);
      }
    }
  } catch {
    const location = sourceKind === "remote" ? "remote endpoint" : "local file";
    const verb = sourceKind === "remote" ? "return" : "contain";
    const expectedFormat = format === "auto" ? "JSON or YAML" : format.toUpperCase();
    throw new Error(`The ${location} did not ${verb} valid ${expectedFormat}.`);
  }

  if (validateContract && (!parsed || typeof parsed !== "object" || Array.isArray(parsed))) {
    throw new Error("The configured source contains a value instead of an OpenAPI object.");
  }

  if (validateContract) assertValidOpenApiContract(parsed as Record<string, unknown>);
  return parsed;
}

function getOpenApiSourceExtension(source: string): string {
  try {
    return extname(new URL(source, "https://farming-labs.invalid").pathname).toLowerCase();
  } catch {
    return extname(source).toLowerCase();
  }
}

function normalizeConfiguredOpenApiDocument(
  document: Record<string, unknown>,
  config: DocsConfig,
  baseUrl?: string,
  specUrl?: string,
  version?: ResolvedApiReferenceVersion,
): Record<string, unknown> {
  const info =
    document.info && typeof document.info === "object" && !Array.isArray(document.info)
      ? (document.info as Record<string, unknown>)
      : {};
  const model = buildNormalizedOpenApiModel(document);
  const normalizedPaths = normalizeRemoteOpenApiPaths(document.paths);
  const normalizedTags = normalizeRemoteOpenApiTags(document.tags, normalizedPaths, model.tags);
  const normalizedServers = isRequestRelativeSpecUrl(specUrl)
    ? [{ url: baseUrl ?? "/" }]
    : document.servers;

  return {
    ...document,
    info: {
      title: "API Reference",
      version: "0.0.0",
      ...info,
      description:
        typeof info.description === "string" && info.description.trim()
          ? info.description
          : config.metadata?.description,
    },
    servers: normalizedServers,
    paths: normalizedPaths,
    tags: normalizedTags,
    ...(version
      ? {
          "x-farming-labs-api-version": {
            id: version.id,
            label: version.label,
            default: version.default,
          },
        }
      : {}),
  };
}

function normalizeRemoteOpenApiPaths(
  value: unknown,
): Record<string, Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const paths = value as Record<string, unknown>;
  const normalized: Record<string, Record<string, unknown>> = {};

  for (const [routePath, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object" || Array.isArray(pathItem)) {
      continue;
    }

    const normalizedPathItem: Record<string, unknown> = {
      ...(pathItem as Record<string, unknown>),
    };

    for (const method of [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "options",
      "head",
      "trace",
    ] as const) {
      const operation = normalizedPathItem[method];
      if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
        continue;
      }

      const operationRecord = operation as Record<string, unknown>;
      const tags = Array.isArray(operationRecord.tags)
        ? operationRecord.tags.filter(
            (tag): tag is string => typeof tag === "string" && tag.trim().length > 0,
          )
        : [];

      normalizedPathItem[method] = {
        ...operationRecord,
        tags: tags.length > 0 ? tags : [inferRemoteOpenApiTag(routePath)],
      };
    }

    normalized[routePath] = normalizedPathItem;
  }

  return normalized;
}

function inferRemoteOpenApiTag(routePath: string): string {
  const segment =
    routePath
      .split("/")
      .filter(Boolean)
      .find((value) => !value.startsWith("{")) ?? "general";

  return humanizeSegment(segment);
}

function normalizeRemoteOpenApiTags(
  value: unknown,
  paths: Record<string, Record<string, unknown>> | undefined,
  modelTags: readonly string[] = [],
): Array<Record<string, unknown>> {
  const existingTags = Array.isArray(value)
    ? value.filter((tag): tag is Record<string, unknown> => !!tag && typeof tag === "object")
    : [];
  const tagsByName = new Map<string, Record<string, unknown>>();

  for (const tag of existingTags) {
    const name = typeof tag.name === "string" && tag.name.trim() ? tag.name.trim() : undefined;
    if (!name) continue;
    tagsByName.set(name, tag);
  }

  for (const name of modelTags) {
    if (!tagsByName.has(name)) {
      tagsByName.set(name, {
        name,
        description: `${name} endpoints`,
      });
    }
  }

  if (paths) {
    for (const pathItem of Object.values(paths)) {
      for (const method of [
        "get",
        "post",
        "put",
        "patch",
        "delete",
        "options",
        "head",
        "trace",
      ] as const) {
        const operation = pathItem[method];
        if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
          continue;
        }

        const tags = Array.isArray((operation as Record<string, unknown>).tags)
          ? ((operation as Record<string, unknown>).tags as unknown[])
          : [];

        for (const tag of tags) {
          if (typeof tag !== "string" || !tag.trim()) continue;
          if (!tagsByName.has(tag)) {
            tagsByName.set(tag, {
              name: tag,
              description: `${tag} endpoints`,
            });
          }
        }
      }
    }
  }

  if (tagsByName.size === 0) {
    return [
      {
        name: "General",
        description: "General endpoints",
      },
    ];
  }

  return Array.from(tagsByName.values());
}

function buildUnavailableOpenApiDocument(
  config: DocsConfig,
  description: string,
): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "API Reference",
      description,
      version: "0.0.0",
    },
    servers: [{ url: "/" }],
    tags: [
      {
        name: "Unavailable",
        description: config.metadata?.description ?? "OpenAPI spec could not be loaded.",
      },
    ],
    paths: {},
  };
}

function buildApiReferenceRoutes(
  config: DocsConfig,
  options: BuildApiReferenceOptions,
): ApiReferenceRoute[] {
  const apiReference = resolveApiReferenceConfig(config.apiReference);
  if (!apiReference.enabled) return [];

  const rootDir = options.rootDir ?? process.cwd();

  switch (options.framework) {
    case "next":
      return buildFileConventionRoutes({
        rootDir,
        sourceDir: resolveRootedDir(rootDir, apiReference.routeRoot, getNextAppDir(rootDir)),
        routePathBase: toRouteBase(apiReference.routeRoot, getNextAppDir(rootDir)),
        isRouteFile: (name) => NEXT_ROUTE_FILE_RE.test(name),
        toRouteSegments: (relativeFile) => relativeFile.split("/").slice(0, -1).filter(Boolean),
        exclude: apiReference.exclude,
      });
    case "farmjs":
      return buildFileConventionRoutes({
        rootDir,
        sourceDir: resolveRootedDir(rootDir, apiReference.routeRoot, getFarmAppDir(rootDir)),
        routePathBase: toRouteBase(apiReference.routeRoot, getFarmAppDir(rootDir)),
        isRouteFile: (name) => NEXT_ROUTE_FILE_RE.test(name),
        toRouteSegments: (relativeFile) => relativeFile.split("/").slice(0, -1).filter(Boolean),
        exclude: apiReference.exclude,
      });
    case "sveltekit":
      return buildFileConventionRoutes({
        rootDir,
        sourceDir: resolveRootedDir(rootDir, apiReference.routeRoot, "src/routes"),
        routePathBase: toRouteBase(apiReference.routeRoot, "src/routes"),
        isRouteFile: (name) => SVELTE_ROUTE_FILE_RE.test(name),
        toRouteSegments: (relativeFile) => relativeFile.split("/").slice(0, -1).filter(Boolean),
        exclude: apiReference.exclude,
      });
    case "astro":
      return buildFileConventionRoutes({
        rootDir,
        sourceDir: resolveRootedDir(rootDir, apiReference.routeRoot, "src/pages"),
        routePathBase: toRouteBase(apiReference.routeRoot, "src/pages"),
        isRouteFile: (name) => ASTRO_ROUTE_FILE_RE.test(name),
        toRouteSegments: (relativeFile) => routeSegmentsFromEndpointFile(relativeFile),
        exclude: apiReference.exclude,
      });
    case "nuxt":
      return buildFileConventionRoutes({
        rootDir,
        sourceDir: resolveRootedDir(rootDir, apiReference.routeRoot, "server"),
        routePathBase: toRouteBase(apiReference.routeRoot, "server"),
        isRouteFile: (name) => NUXT_ROUTE_FILE_RE.test(name),
        toRouteSegments: (relativeFile) =>
          routeSegmentsFromEndpointFile(stripNuxtMethodSuffix(relativeFile)),
        exclude: apiReference.exclude,
        getMethods: (source, file) => extractNuxtMethods(source, file),
      });
    case "tanstack-start":
      return buildTanstackRoutes(rootDir, apiReference);
  }
}

function getFarmAppDir(rootDir: string): string {
  return existsSync(join(rootDir, "src", "app")) ? "src/app" : "app";
}

function buildFileConventionRoutes({
  rootDir,
  sourceDir,
  routePathBase,
  isRouteFile,
  toRouteSegments,
  exclude,
  getMethods = extractMethods,
}: {
  rootDir: string;
  sourceDir: string;
  routePathBase: string;
  isRouteFile: (name: string) => boolean;
  toRouteSegments: (relativeFile: string) => string[];
  exclude: string[];
  getMethods?: (source: string, file: string) => HttpMethod[];
}): ApiReferenceRoute[] {
  const files = scanRouteFiles(sourceDir, isRouteFile);
  const routes: ApiReferenceRoute[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    const methods = getMethods(source, file);
    if (methods.length === 0) continue;

    const relativeFile = relative(sourceDir, file).replace(/\\/g, "/");
    const routeSegments = toRouteSegments(relativeFile);
    const routePath = buildRoutePath(routePathBase, routeSegments);
    if (shouldExcludeRoute(exclude, routePath, relativeFile, routeSegments.join("/"))) continue;

    routes.push(
      createApiReferenceRoute({
        rootDir,
        file,
        source,
        methods,
        routePath,
      }),
    );
  }

  return routes.sort((a, b) => a.routePath.localeCompare(b.routePath));
}

function buildTanstackRoutes(
  rootDir: string,
  apiReference: ResolvedApiReferenceConfig,
): ApiReferenceRoute[] {
  const routesDir = join(rootDir, "src", "routes");
  const files = scanRouteFiles(routesDir, (name) => TANSTACK_ROUTE_FILE_RE.test(name));
  const routeBase = `/${normalizePathSegment(apiReference.routeRoot)}`;
  const routes: ApiReferenceRoute[] = [];

  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    if (!source.includes("createFileRoute(") || !source.includes("handlers")) continue;

    const pathMatch = source.match(/createFileRoute\(\s*["'`]([^"'`]+)["'`]\s*\)/);
    if (!pathMatch) continue;

    const routePath = normalizeTanstackRoutePath(pathMatch[1]);
    if (!routePath.startsWith(routeBase)) continue;

    const methods = extractTanstackMethods(source);
    if (methods.length === 0) continue;

    const relativeFile = relative(routesDir, file).replace(/\\/g, "/");
    if (shouldExcludeRoute(apiReference.exclude, routePath, relativeFile, relativeFile)) continue;

    routes.push(
      createApiReferenceRoute({
        rootDir,
        file,
        source,
        methods,
        routePath,
      }),
    );
  }

  return routes.sort((a, b) => a.routePath.localeCompare(b.routePath));
}

function createApiReferenceRoute({
  rootDir,
  file,
  source,
  methods,
  routePath,
}: {
  rootDir: string;
  file: string;
  source: string;
  methods: HttpMethod[];
  routePath: string;
}): ApiReferenceRoute {
  const docBlock = extractDocBlock(source);
  const pathSegments = routePath.split("/").filter(Boolean);
  const titleSegment = pathSegments[pathSegments.length - 1] ?? "overview";
  const tagSegment = pathSegments[0] ?? "general";
  const title = humanizeSegment(titleSegment);

  return {
    title,
    summary: docBlock.summary ?? `${title} endpoint`,
    description: docBlock.description,
    routePath,
    sourceFile: relative(rootDir, file).replace(/\\/g, "/"),
    methods,
    tag: humanizeSegment(tagSegment),
    parameters: buildPathParameters(routePath),
  };
}

function buildPathParameters(routePath: string): Array<Record<string, unknown>> {
  const parameters: Array<Record<string, unknown>> = [];

  for (const segment of routePath.split("/")) {
    const match = segment.match(/^\{(.+)\}$/);
    if (!match) continue;

    parameters.push({
      name: match[1],
      in: "path",
      required: true,
      description: `${humanizeSegment(match[1])} path parameter.`,
      schema: {
        type: "string",
      },
    });
  }

  return parameters;
}

function buildOpenApiPaths(routes: ApiReferenceRoute[]): Record<string, Record<string, unknown>> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const pathItem: Record<string, unknown> = {};

    for (const method of route.methods) {
      pathItem[method.toLowerCase()] = {
        tags: [route.tag],
        summary: route.summary,
        description: route.description ?? route.summary,
        operationId: createOperationId(route, method),
        ...(route.parameters.length > 0 ? { parameters: route.parameters } : {}),
        ...(buildRequestBody(method) ? { requestBody: buildRequestBody(method) } : {}),
        responses: buildResponses(method),
        "x-farming-labs-source": route.sourceFile,
      };
    }

    paths[route.routePath] = pathItem;
  }

  return paths;
}

function buildRequestBody(method: HttpMethod): Record<string, unknown> | undefined {
  if (!["POST", "PUT", "PATCH"].includes(method)) return undefined;

  return {
    required: method === "POST",
    content: {
      "application/json": {
        schema: {
          type: "object",
          additionalProperties: true,
        },
        example: {
          example: true,
        },
      },
    },
  };
}

function buildResponses(method: HttpMethod): Record<string, unknown> {
  return {
    "200": {
      description:
        method === "DELETE" ? "Resource removed successfully." : "Request completed successfully.",
      content: {
        "application/json": {
          schema: {
            type: "object",
            additionalProperties: true,
          },
          example: {
            ok: true,
          },
        },
      },
    },
  };
}

function createOperationId(route: ApiReferenceRoute, method: HttpMethod): string {
  return `${method.toLowerCase()}_${route.routePath.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

function resolveTheme(config: DocsConfig): DocsTheme | undefined {
  return config.theme;
}

function normalizeApiReferenceExcludes(values?: string[]): string[] {
  return (values ?? []).map(normalizeExcludeMatcher).filter(Boolean);
}

function normalizeExcludeMatcher(value: string): string {
  return value
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.(ts|tsx|js|jsx|mjs|mts)$/i, "")
    .replace(/\/route$/i, "")
    .replace(/\/\+server$/i, "")
    .replace(/\/index$/i, "")
    .replace(/\.(get|post|put|patch|delete|options|head)$/i, "");
}

function shouldExcludeRoute(
  excludes: string[],
  routePath: string,
  relativeFile: string,
  relativeDir: string,
): boolean {
  if (excludes.length === 0) return false;

  const candidates = new Set([
    normalizeExcludeMatcher(routePath),
    normalizeExcludeMatcher(routePath.replace(/^\/+/, "")),
    normalizeExcludeMatcher(relativeFile),
    normalizeExcludeMatcher(relativeDir),
  ]);

  return excludes.some((entry) => candidates.has(entry));
}

function scanRouteFiles(dir: string, isRouteFile: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];

  const results: string[] = [];

  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      results.push(...scanRouteFiles(full, isRouteFile));
      continue;
    }

    if (isRouteFile(name)) results.push(full);
  }

  return results;
}

function resolveRootedDir(rootDir: string, routeRoot: string, defaultRoot: string): string {
  const normalized = normalizePathSegment(routeRoot) || "api";
  if (normalized === defaultRoot || normalized.startsWith(`${defaultRoot}/`)) {
    return join(rootDir, ...normalized.split("/"));
  }

  return join(rootDir, ...defaultRoot.split("/"), ...normalized.split("/"));
}

function toRouteBase(routeRoot: string, defaultRoot: string): string {
  const normalized = normalizePathSegment(routeRoot) || "api";
  const base =
    normalized === defaultRoot || normalized.startsWith(`${defaultRoot}/`)
      ? normalized.slice(defaultRoot.length).replace(/^\/+/, "")
      : normalized;

  return `/${normalizePathSegment(base)}`;
}

function getNextAppDir(rootDir: string): string {
  if (existsSync(join(rootDir, "src", "app"))) return "src/app";
  return "app";
}

function routeSegmentsFromEndpointFile(relativeFile: string): string[] {
  const segments = relativeFile.split("/");
  const last = segments.pop() ?? "";
  const name = last.replace(/\.(ts|js|mts|mjs)$/i, "");

  if (name !== "index") segments.push(name);
  return segments.filter(Boolean);
}

function stripNuxtMethodSuffix(relativeFile: string): string {
  return relativeFile.replace(
    /\.(get|post|put|patch|delete|options|head)(?=\.(ts|js|mts|mjs)$)/i,
    "",
  );
}

function buildRoutePath(basePath: string, rawSegments: string[]): string {
  const segments = rawSegments
    .filter(Boolean)
    .map((segment) => endpointSegmentFromConvention(segment))
    .join("/");

  const normalizedBase = normalizePathSegment(basePath);
  const path = [normalizedBase, segments].filter(Boolean).join("/");
  return path ? `/${path}` : "/";
}

function endpointSegmentFromConvention(value: string): string {
  if (value.startsWith("[[...") && value.endsWith("]]")) return `{${value.slice(5, -2)}}`;
  if (value.startsWith("[...") && value.endsWith("]")) return `{${value.slice(4, -1)}}`;
  if (value.startsWith("[") && value.endsWith("]")) return `{${value.slice(1, -1)}}`;
  return value;
}

function normalizeTanstackRoutePath(value: string): string {
  return `/${value
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((segment) => (segment.startsWith("$") ? `{${segment.slice(1)}}` : segment))
    .filter(Boolean)
    .join("/")}`;
}

function extractDocBlock(source: string): { summary?: string; description?: string } {
  const match = source.match(/\/\*\*([\s\S]*?)\*\//);
  if (!match) return {};

  const lines = match[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("@"));

  if (lines.length === 0) return {};

  return {
    summary: lines[0],
    description: lines.slice(1).join(" "),
  };
}

function extractMethods(source: string): HttpMethod[] {
  const methods = new Set<HttpMethod>();

  for (const match of source.matchAll(METHOD_RE)) {
    if (match[1] === "ALL") {
      METHOD_NAMES.forEach((method) => methods.add(method));
      continue;
    }

    methods.add(match[1] as HttpMethod);
  }

  return Array.from(methods);
}

function extractNuxtMethods(source: string, file: string): HttpMethod[] {
  const methods = extractMethods(source);
  if (methods.length > 0) return methods;

  const suffix = basename(file).match(
    /\.(get|post|put|patch|delete|options|head)\.(ts|js|mts|mjs)$/i,
  );
  if (suffix) return [suffix[1].toUpperCase() as HttpMethod];

  if (/defineEventHandler|eventHandler/.test(source)) return ["GET"];
  return [];
}

function extractTanstackMethods(source: string): HttpMethod[] {
  const methods = new Set<HttpMethod>();
  const handlersMatch = source.match(/handlers\s*:\s*\{([\s\S]*?)\}/m);
  if (!handlersMatch) return [];

  for (const match of handlersMatch[1].matchAll(
    /\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*:/g,
  )) {
    methods.add(match[1] as HttpMethod);
  }

  return Array.from(methods);
}

function humanizeSegment(value: string): string {
  const normalized = value
    .replace(/^\{/, "")
    .replace(/\}$/, "")
    .replace(/^\[\[?\.{3}/, "")
    .replace(/^\[/, "")
    .replace(/\]\]?$/, "")
    .replace(/^\$/, "")
    .replace(/-/g, " ");

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}
