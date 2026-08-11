import type { DocsOpenApiMcpConfig } from "./types.js";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"] as const;

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
