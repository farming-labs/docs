import type { DocsOpenApiMcpConfig } from "./types.js";
import { buildNormalizedOpenApiModel } from "./openapi-operations.js";
import type { NormalizedOpenApiOperation } from "./openapi-operations.js";

const OPENAPI_RATE_WINDOW_MS = 60_000;
const openApiRateWindows = new Map<string, { startedAt: number; count: number; active: number }>();

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

function sanitizeToolName(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56);
  return `api_${normalized || "operation"}`;
}

function operationExtensionEnabled(operation: NormalizedOpenApiOperation): boolean {
  const extension = operation.extensions["x-farming-labs-mcp"];
  return extension === true || asRecord(extension)?.enabled === true;
}

export function resolveDocsOpenApiMcpOperations(
  document: Record<string, unknown>,
  config?: DocsOpenApiMcpConfig,
): DocsOpenApiMcpOperation[] {
  if (!config || config.enabled === false) return [];
  const allow = new Set((config.operations ?? []).map((value) => value.trim()).filter(Boolean));
  const model = buildNormalizedOpenApiModel(document);
  const operations: DocsOpenApiMcpOperation[] = [];
  const names = new Set<string>();

  for (const operation of model.operations) {
    if (operation.method === "TRACE") continue;
    const explicitlyAllowed =
      allow.has(operation.operationId) ||
      allow.has(operation.selector) ||
      operationExtensionEnabled(operation);
    if (!explicitlyAllowed) continue;
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(operation.method);
    if (mutation && config.allowMutations !== true) continue;
    const toolName = sanitizeToolName(operation.operationId);
    if (names.has(toolName)) {
      throw new Error(`OpenAPI MCP tool name collision: ${toolName}`);
    }
    names.add(toolName);
    operations.push({
      toolName,
      operationId: operation.operationId,
      method: operation.method,
      path: operation.path,
      title: operation.title,
      ...(operation.description ? { description: operation.description } : {}),
      parameters: operation.parameters.flatMap((parameter) => {
        if (
          parameter.in !== "path" &&
          parameter.in !== "query" &&
          parameter.in !== "header" &&
          parameter.in !== "cookie"
        ) {
          return [];
        }
        return [
          {
            name: parameter.name,
            in: parameter.in,
            required: parameter.required,
          } satisfies DocsOpenApiMcpParameter,
        ];
      }),
      security: operation.security,
      securitySchemes: operation.securitySchemes,
      readOnly: operation.method === "GET" || operation.method === "HEAD",
      destructive: operation.method === "DELETE",
      idempotent: ["GET", "HEAD", "PUT", "DELETE", "OPTIONS"].includes(operation.method),
    });
  }

  return operations.sort((left, right) => left.toolName.localeCompare(right.toolName));
}

export function resolveDocsOpenApiMcpBaseUrl(
  document: Record<string, unknown>,
  config: DocsOpenApiMcpConfig,
): string | undefined {
  const configured = config.baseUrl?.trim();
  if (configured) return configured;
  return buildNormalizedOpenApiModel(document).servers[0];
}
