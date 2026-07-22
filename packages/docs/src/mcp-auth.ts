import type { DocsMcpConfig } from "./types.js";

export const DEFAULT_MCP_ROUTE = "/api/docs/mcp";
export const DEFAULT_MCP_PUBLIC_ROUTE = "/mcp";
export const DEFAULT_MCP_WELL_KNOWN_ROUTE = "/.well-known/mcp";
export const DEFAULT_MCP_PROTECTED_RESOURCE_METADATA_ROUTE =
  "/.well-known/oauth-protected-resource";

export interface DocsMcpResourceLocation {
  resourceUrl: URL;
  metadataUrl: URL;
}

export function normalizeDocsMcpEndpointPath(route?: string, fallback = DEFAULT_MCP_ROUTE): string {
  const candidate = route?.trim().split(/[?#]/, 1)[0] || fallback;
  const normalized = `/${candidate}`.replace(/\/+/g, "/");
  return normalized !== "/" ? normalized.replace(/\/+$/, "") : fallback;
}

export function getDocsMcpResourcePaths(route?: string): string[] {
  return Array.from(
    new Set([
      normalizeDocsMcpEndpointPath(route),
      DEFAULT_MCP_PUBLIC_ROUTE,
      DEFAULT_MCP_WELL_KNOWN_ROUTE,
    ]),
  );
}

export function buildDocsMcpProtectedResourceMetadataRoute(resourcePath: string): string {
  const candidate = resourcePath.trim().split(/[?#]/, 1)[0] || "/";
  const trailingSlash = candidate.length > 1 && candidate.endsWith("/");
  const normalized = candidate === "/" ? "/" : normalizeDocsMcpEndpointPath(candidate);
  return normalized === "/"
    ? DEFAULT_MCP_PROTECTED_RESOURCE_METADATA_ROUTE
    : `${DEFAULT_MCP_PROTECTED_RESOURCE_METADATA_ROUTE}${normalized}${trailingSlash ? "/" : ""}`;
}

export function getDocsMcpProtectedResourceMetadataRoutes(route?: string): string[] {
  return getDocsMcpResourcePaths(route).map(buildDocsMcpProtectedResourceMetadataRoute);
}

export function hasDocsMcpProtectedResourceConfig(mcp?: boolean | DocsMcpConfig): boolean {
  if (
    !mcp ||
    typeof mcp !== "object" ||
    mcp.enabled === false ||
    typeof mcp.security?.authenticate !== "function"
  ) {
    return false;
  }
  return (
    normalizeDocsMcpAuthorizationServerUrls(mcp.security?.protectedResource?.authorizationServers)
      .length > 0
  );
}

export function normalizeDocsMcpAuthorizationServerUrls(values?: readonly string[]): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(isAbsoluteHttpUrl),
    ),
  );
}

export function isDocsMcpOAuthScopeToken(value: unknown): value is string {
  return typeof value === "string" && /^[\x21\x23-\x5B\x5D-\x7E]+$/u.test(value);
}

export function isDocsMcpRequest(url: URL, mcp?: boolean | DocsMcpConfig): boolean {
  const route = typeof mcp === "object" ? mcp.route : undefined;
  if (isDocsMcpResourcePath(url.pathname, route)) return true;

  return (
    hasDocsMcpProtectedResourceConfig(mcp) &&
    isDocsMcpProtectedResourceMetadataRequestPath(url.pathname, route)
  );
}

export function isDocsMcpResourcePath(pathname: string, route?: string): boolean {
  return isCanonicalResourcePath(pathname, getDocsMcpResourcePaths(route));
}

export function resolveDocsMcpResourceLocation(
  request: Request,
  route?: string,
): DocsMcpResourceLocation {
  const requestUrl = new URL(request.url);
  const allowedPaths = getDocsMcpResourcePaths(route);
  const normalizedRequestPath = normalizeRequestPath(requestUrl.pathname);
  const resourcePath = isCanonicalResourcePath(requestUrl.pathname, allowedPaths)
    ? requestUrl.pathname
    : normalizedRequestPath;

  const resourceUrl = new URL(requestUrl);
  resourceUrl.pathname = resourcePath;
  const metadataUrl = new URL(resourceUrl);
  metadataUrl.pathname = buildDocsMcpProtectedResourceMetadataRoute(resourcePath);

  return { resourceUrl, metadataUrl };
}

export function resolveDocsMcpProtectedResourceMetadataLocation(
  request: Request,
  route?: string,
): DocsMcpResourceLocation | undefined {
  const rawUrl = new URL(request.url);
  const allowedPaths = getDocsMcpResourcePaths(route);
  if (!rawUrl.pathname.startsWith(`${DEFAULT_MCP_PROTECTED_RESOURCE_METADATA_ROUTE}/`)) {
    return undefined;
  }
  const requestedResourcePath = rawUrl.pathname.slice(
    DEFAULT_MCP_PROTECTED_RESOURCE_METADATA_ROUTE.length,
  );
  if (!isCanonicalResourcePath(requestedResourcePath, allowedPaths)) return undefined;

  const metadataUrl = new URL(rawUrl);
  const resourceUrl = new URL(metadataUrl);
  resourceUrl.pathname = requestedResourcePath;
  return { resourceUrl, metadataUrl };
}

export function isDocsMcpProtectedResourceMetadataPath(pathname: string): boolean {
  const normalized = normalizeRequestPath(pathname);
  return (
    normalized === DEFAULT_MCP_PROTECTED_RESOURCE_METADATA_ROUTE ||
    normalized.startsWith(`${DEFAULT_MCP_PROTECTED_RESOURCE_METADATA_ROUTE}/`)
  );
}

function normalizeRequestPath(pathname: string): string {
  const normalized = `/${pathname}`.replace(/\/+/g, "/");
  return normalized === "/" ? normalized : normalized.replace(/\/+$/, "");
}

function isCanonicalResourcePath(pathname: string, resourcePaths: readonly string[]): boolean {
  return resourcePaths.some(
    (resourcePath) =>
      pathname === resourcePath || (resourcePath !== "/" && pathname === `${resourcePath}/`),
  );
}

function isDocsMcpProtectedResourceMetadataRequestPath(
  pathname: string,
  route: string | undefined,
): boolean {
  if (!pathname.startsWith(`${DEFAULT_MCP_PROTECTED_RESOURCE_METADATA_ROUTE}/`)) return false;
  const resourcePath = pathname.slice(DEFAULT_MCP_PROTECTED_RESOURCE_METADATA_ROUTE.length);
  return isCanonicalResourcePath(resourcePath, getDocsMcpResourcePaths(route));
}

function isAbsoluteHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const loopbackHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
    return (
      (url.protocol === "https:" || loopbackHttp) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
