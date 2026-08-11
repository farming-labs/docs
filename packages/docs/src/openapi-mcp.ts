import type { DocsOpenApiMcpConfig } from "./types.js";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;
const OPENAPI_RATE_WINDOW_MS = 60_000;
const openApiRateWindows = new Map<string, { startedAt: number; count: number; active: number }>();

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isDocsOpenApiMcpPrivateAddress(address: string): boolean {
  const normalized = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/gu, "");
  const family = isIP(normalized);
  if (family === 4) return isPrivateIpv4(normalized);
  if (family !== 6) return true;
  const mappedIpv4 = normalized.match(/^(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/u.test(normalized) ||
    normalized.startsWith("ff")
  );
}

async function defaultResolveHost(hostname: string): Promise<readonly string[]> {
  if (isIP(hostname)) return [hostname];
  return (await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);
}

export async function validateDocsOpenApiMcpUrl(
  url: URL,
  config: DocsOpenApiMcpConfig,
): Promise<void> {
  if (url.protocol !== "https:" && !(url.protocol === "http:" && config.allowInsecureHttp)) {
    throw new Error("OpenAPI MCP destinations must use HTTPS unless allowInsecureHttp is enabled.");
  }
  if (url.username || url.password) {
    throw new Error("OpenAPI MCP destinations cannot contain URL credentials.");
  }
  if (config.allowPrivateNetwork) return;
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    throw new Error(`OpenAPI MCP blocked private destination: ${hostname}`);
  }
  let addresses: readonly string[];
  try {
    addresses = await (config.resolveHost ?? defaultResolveHost)(hostname);
  } catch {
    throw new Error(`OpenAPI MCP could not safely resolve destination: ${hostname}`);
  }
  if (addresses.length === 0 || addresses.some(isDocsOpenApiMcpPrivateAddress)) {
    throw new Error(`OpenAPI MCP blocked private or unresolved destination: ${hostname}`);
  }
}

export function acquireDocsOpenApiMcpBudget(
  key: string,
  config: DocsOpenApiMcpConfig,
  now = Date.now(),
): () => void {
  const requestsPerMinute = Math.max(1, config.requestsPerMinute ?? 60);
  const maxConcurrentRequests = Math.max(1, config.maxConcurrentRequests ?? 4);
  let window = openApiRateWindows.get(key);
  if (!window || now - window.startedAt >= OPENAPI_RATE_WINDOW_MS) {
    window = { startedAt: now, count: 0, active: window?.active ?? 0 };
    openApiRateWindows.set(key, window);
  }
  if (window.count >= requestsPerMinute) {
    throw new Error("OpenAPI MCP rate limit exceeded for this principal and operation.");
  }
  if (window.active >= maxConcurrentRequests) {
    throw new Error("OpenAPI MCP concurrency limit exceeded for this principal and operation.");
  }
  window.count += 1;
  window.active += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    window.active = Math.max(0, window.active - 1);
  };
}

export async function readDocsOpenApiMcpResponse(
  response: Response,
  maxBytes = 1_000_000,
): Promise<{ text: string; truncated: boolean }> {
  const limit = Math.max(1, maxBytes);
  if (!response.body) return { text: "", truncated: false };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let used = 0;
  let truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (used + value.byteLength > limit) {
        const remaining = limit - used;
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        used = limit;
        truncated = true;
        await reader.cancel("OpenAPI MCP response byte limit reached");
        break;
      }
      chunks.push(value);
      used += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(used);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(bytes), truncated };
}

export interface DocsOpenApiMcpParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  required: boolean;
}

export interface DocsOpenApiMcpOperation {
  toolName: string;
  operationId: string;
  method: string;
  path: string;
  title: string;
  description?: string;
  parameters: DocsOpenApiMcpParameter[];
  security: Array<Record<string, string[]>>;
  securitySchemes: Record<string, unknown>;
  readOnly: boolean;
  destructive: boolean;
  idempotent: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function selectorFor(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`;
}

function sanitizeToolName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56);
  return `api_${normalized || "operation"}`;
}

function operationExtensionEnabled(operation: Record<string, unknown>): boolean {
  const extension = operation["x-farming-labs-mcp"];
  return extension === true || asRecord(extension)?.enabled === true;
}

function normalizeSecurity(value: unknown): Array<Record<string, string[]>> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((requirement) => {
    const record = asRecord(requirement);
    if (!record) return [];
    const normalized: Record<string, string[]> = {};
    for (const [name, scopes] of Object.entries(record)) {
      normalized[name] = Array.isArray(scopes)
        ? scopes.filter((scope): scope is string => typeof scope === "string")
        : [];
    }
    return [normalized];
  });
}

function normalizeParameters(...values: unknown[]): DocsOpenApiMcpParameter[] {
  const parameters = values.flatMap((value) => (Array.isArray(value) ? value : []));
  const seen = new Set<string>();
  return parameters.flatMap((parameter) => {
    const record = asRecord(parameter);
    if (!record) return [];
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const location = record?.in;
    if (
      !name ||
      (location !== "path" &&
        location !== "query" &&
        location !== "header" &&
        location !== "cookie")
    ) {
      return [];
    }
    const key = `${location}:${name}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ name, in: location, required: record.required === true || location === "path" }];
  });
}

export function resolveDocsOpenApiMcpOperations(
  document: Record<string, unknown>,
  config?: DocsOpenApiMcpConfig,
): DocsOpenApiMcpOperation[] {
  if (!config || config.enabled === false) return [];
  const allow = new Set((config.operations ?? []).map((value) => value.trim()).filter(Boolean));
  const paths = asRecord(document.paths) ?? {};
  const components = asRecord(document.components);
  const securitySchemes = asRecord(components?.securitySchemes) ?? {};
  const globalSecurity = normalizeSecurity(document.security);
  const operations: DocsOpenApiMcpOperation[] = [];
  const names = new Set<string>();

  for (const [path, rawPathItem] of Object.entries(paths)) {
    const pathItem = asRecord(rawPathItem);
    if (!pathItem) continue;
    for (const method of HTTP_METHODS) {
      const operation = asRecord(pathItem[method]);
      if (!operation) continue;
      const operationId =
        typeof operation.operationId === "string" && operation.operationId.trim()
          ? operation.operationId.trim()
          : `${method}_${path.replace(/[^a-zA-Z0-9]+/g, "_")}`;
      const explicitlyAllowed =
        allow.has(operationId) ||
        allow.has(selectorFor(method, path)) ||
        operationExtensionEnabled(operation);
      if (!explicitlyAllowed) continue;
      const mutation = !["get", "head", "options"].includes(method);
      if (mutation && config.allowMutations !== true) continue;
      const toolName = sanitizeToolName(operationId);
      if (names.has(toolName)) {
        throw new Error(`OpenAPI MCP tool name collision: ${toolName}`);
      }
      names.add(toolName);
      const security =
        operation.security === undefined ? globalSecurity : normalizeSecurity(operation.security);
      const usedSchemeNames = new Set(security.flatMap((requirement) => Object.keys(requirement)));
      const usedSecuritySchemes = Object.fromEntries(
        Object.entries(securitySchemes).filter(([name]) => usedSchemeNames.has(name)),
      );
      operations.push({
        toolName,
        operationId,
        method: method.toUpperCase(),
        path,
        title:
          (typeof operation.summary === "string" && operation.summary.trim()) ||
          (typeof operation.description === "string" && operation.description.trim()) ||
          selectorFor(method, path),
        ...(typeof operation.description === "string" && operation.description.trim()
          ? { description: operation.description.trim() }
          : {}),
        parameters: normalizeParameters(pathItem.parameters, operation.parameters),
        security,
        securitySchemes: usedSecuritySchemes,
        readOnly: method === "get" || method === "head",
        destructive: method === "delete",
        idempotent: ["GET", "HEAD", "PUT", "DELETE", "OPTIONS"].includes(method.toUpperCase()),
      });
    }
  }

  return operations.sort((left, right) => left.toolName.localeCompare(right.toolName));
}

export function resolveDocsOpenApiMcpBaseUrl(
  document: Record<string, unknown>,
  config: DocsOpenApiMcpConfig,
): string | undefined {
  const configured = config.baseUrl?.trim();
  if (configured) return configured;
  const servers = Array.isArray(document.servers) ? document.servers : [];
  for (const server of servers) {
    const url = asRecord(server)?.url;
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  return undefined;
}
