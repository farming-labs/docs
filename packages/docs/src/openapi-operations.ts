export const OPENAPI_OPERATION_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

export type OpenApiOperationMethod = Uppercase<(typeof OPENAPI_OPERATION_METHODS)[number]>;

export interface NormalizedOpenApiExample {
  name: string;
  location: "parameter" | "request" | "response";
  summary?: string;
  description?: string;
  mediaType?: string;
  status?: string;
  value?: unknown;
  externalValue?: string;
}

export interface NormalizedOpenApiMediaType {
  mediaType: string;
  schema?: unknown;
  examples: NormalizedOpenApiExample[];
}

export interface NormalizedOpenApiParameter {
  name: string;
  in: string;
  required: boolean;
  description?: string;
  schema?: unknown;
  examples: NormalizedOpenApiExample[];
}

export interface NormalizedOpenApiRequestBody {
  required: boolean;
  description?: string;
  content: NormalizedOpenApiMediaType[];
}

export interface NormalizedOpenApiResponse {
  status: string;
  description?: string;
  content: NormalizedOpenApiMediaType[];
}

export interface NormalizedOpenApiOperation {
  id: string;
  operationId: string;
  operationIdSource: "explicit" | "generated";
  slug: string;
  selector: string;
  pointer: string;
  method: OpenApiOperationMethod;
  path: string;
  title: string;
  summary?: string;
  description?: string;
  tags: string[];
  deprecated: boolean;
  parameters: NormalizedOpenApiParameter[];
  requestBody?: NormalizedOpenApiRequestBody;
  responses: NormalizedOpenApiResponse[];
  examples: NormalizedOpenApiExample[];
  security: Array<Record<string, string[]>>;
  securitySchemes: Record<string, unknown>;
  servers: string[];
  extensions: Record<string, unknown>;
}

export interface NormalizedOpenApiModel {
  title: string;
  version: string;
  specificationVersion: string;
  servers: string[];
  tags: string[];
  operationCount: number;
  operations: NormalizedOpenApiOperation[];
}

export function buildNormalizedOpenApiModel(
  document: Record<string, unknown>,
): NormalizedOpenApiModel {
  const info = asRecord(document.info);
  const specificationVersion =
    stringValue(document.openapi) ?? stringValue(document.swagger) ?? "unknown";
  const servers = normalizeServers(document);
  const globalSecurity = normalizeSecurity(document.security);
  const securitySchemes = normalizeSecuritySchemes(document);
  const paths = asRecord(document.paths) ?? {};
  const operations: NormalizedOpenApiOperation[] = [];
  const operationIds = new Map<string, string>();

  for (const path of Object.keys(paths).sort()) {
    if (path.startsWith("x-")) continue;
    const pathItem = resolveRecord(document, paths[path]);
    if (!pathItem) continue;

    for (const method of OPENAPI_OPERATION_METHODS) {
      const operation = resolveRecord(document, pathItem[method]);
      if (!operation) continue;
      const selector = `${method.toUpperCase()} ${path}`;
      const explicitOperationId = stringValue(operation.operationId);
      const operationId = explicitOperationId ?? createGeneratedOperationId(method, path);
      const pointer = `/paths/${escapeJsonPointer(path)}/${method}`;
      const previousPointer = operationIds.get(operationId);
      if (previousPointer) {
        throw new Error(
          `OpenAPI operation ID collision: \`${operationId}\` is used at ${previousPointer} and ${pointer}.`,
        );
      }
      operationIds.set(operationId, pointer);

      const parameters = normalizeParameters(document, pathItem.parameters, operation.parameters);
      const requestBody = normalizeRequestBody(
        document,
        operation.requestBody,
        parameters,
        document,
        operation,
      );
      const responses = normalizeResponses(document, operation.responses, document, operation);
      const security =
        operation.security === undefined ? globalSecurity : normalizeSecurity(operation.security);
      const usedSchemeNames = new Set(security.flatMap((requirement) => Object.keys(requirement)));
      const usedSecuritySchemes = Object.fromEntries(
        Object.entries(securitySchemes).filter(([name]) => usedSchemeNames.has(name)),
      );
      const tags = normalizeTags(operation.tags, path);
      const summary = stringValue(operation.summary);
      const description = stringValue(operation.description);
      const operationServers = normalizeServerValues(operation.servers);
      const pathServers = normalizeServerValues(pathItem.servers);
      const examples = [
        ...parameters.flatMap((parameter) => parameter.examples),
        ...(requestBody?.content.flatMap((entry) => entry.examples) ?? []),
        ...responses.flatMap((response) => response.content.flatMap((entry) => entry.examples)),
      ];

      operations.push({
        id: operationId,
        operationId,
        operationIdSource: explicitOperationId ? "explicit" : "generated",
        slug: createOperationSlug(operationId),
        selector,
        pointer,
        method: method.toUpperCase() as OpenApiOperationMethod,
        path,
        title: summary ?? description ?? selector,
        ...(summary ? { summary } : {}),
        ...(description ? { description } : {}),
        tags,
        deprecated: operation.deprecated === true,
        parameters,
        ...(requestBody ? { requestBody } : {}),
        responses,
        examples,
        security,
        securitySchemes: usedSecuritySchemes,
        servers:
          operationServers.length > 0
            ? operationServers
            : pathServers.length > 0
              ? pathServers
              : servers,
        extensions: Object.fromEntries(
          Object.entries(operation).filter(([key]) => key.startsWith("x-")),
        ),
      });
    }
  }

  const declaredTags = Array.isArray(document.tags)
    ? document.tags.flatMap((tag) => {
        const name = stringValue(asRecord(tag)?.name);
        return name ? [name] : [];
      })
    : [];
  const tags = Array.from(
    new Set([...declaredTags, ...operations.flatMap((operation) => operation.tags)]),
  );

  return {
    title: stringValue(info?.title) ?? "API Reference",
    version: stringValue(info?.version) ?? "0.0.0",
    specificationVersion,
    servers,
    tags,
    operationCount: operations.length,
    operations,
  };
}

function normalizeParameters(
  document: Record<string, unknown>,
  pathParameters: unknown,
  operationParameters: unknown,
): NormalizedOpenApiParameter[] {
  const parameters = new Map<string, NormalizedOpenApiParameter>();
  for (const value of [pathParameters, operationParameters]) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      const parameter = resolveRecord(document, item);
      if (!parameter) continue;
      const name = stringValue(parameter.name);
      const location = stringValue(parameter.in);
      if (!name || !location) continue;
      const examples = normalizeParameterExamples(document, parameter);
      const description = stringValue(parameter.description);
      parameters.set(`${location}:${name}`, {
        name,
        in: location,
        required: parameter.required === true || location === "path",
        ...(description ? { description } : {}),
        ...(parameter.schema !== undefined ? { schema: parameter.schema } : {}),
        examples,
      });
    }
  }
  return Array.from(parameters.values());
}

function normalizeParameterExamples(
  document: Record<string, unknown>,
  parameter: Record<string, unknown>,
): NormalizedOpenApiExample[] {
  const examples: NormalizedOpenApiExample[] = [];
  if (parameter.example !== undefined) {
    examples.push({ name: "default", location: "parameter", value: parameter.example });
  }
  const exampleMap = asRecord(parameter.examples);
  if (exampleMap) {
    for (const name of Object.keys(exampleMap).sort()) {
      examples.push(normalizeExample(document, name, exampleMap[name], "parameter"));
    }
  }
  return examples;
}

function normalizeRequestBody(
  document: Record<string, unknown>,
  value: unknown,
  parameters: NormalizedOpenApiParameter[],
  root: Record<string, unknown>,
  operation: Record<string, unknown>,
): NormalizedOpenApiRequestBody | undefined {
  const requestBody = resolveRecord(document, value);
  if (requestBody) {
    const description = stringValue(requestBody.description);
    return {
      required: requestBody.required === true,
      ...(description ? { description } : {}),
      content: normalizeContent(document, requestBody.content, "request"),
    };
  }

  const bodyParameter = parameters.find((parameter) => parameter.in === "body");
  if (!bodyParameter) return undefined;
  const consumes = normalizeStringArray(operation.consumes);
  const mediaTypes = consumes.length > 0 ? consumes : normalizeStringArray(root.consumes);
  return {
    required: bodyParameter.required,
    ...(bodyParameter.description ? { description: bodyParameter.description } : {}),
    content: (mediaTypes.length > 0 ? mediaTypes : ["application/json"]).map((mediaType) => ({
      mediaType,
      ...(bodyParameter.schema !== undefined ? { schema: bodyParameter.schema } : {}),
      examples: bodyParameter.examples,
    })),
  };
}

function normalizeResponses(
  document: Record<string, unknown>,
  value: unknown,
  root: Record<string, unknown>,
  operation: Record<string, unknown>,
): NormalizedOpenApiResponse[] {
  const responses = asRecord(value);
  if (!responses) return [];
  const produces = normalizeStringArray(operation.produces);
  const fallbackMediaTypes = produces.length > 0 ? produces : normalizeStringArray(root.produces);

  return Object.keys(responses)
    .sort(compareResponseStatus)
    .flatMap((status) => {
      const response = resolveRecord(document, responses[status]);
      if (!response) return [];
      const description = stringValue(response.description);
      let content = normalizeContent(document, response.content, "response", status);
      if (content.length === 0 && response.schema !== undefined) {
        const legacyExamples = asRecord(response.examples);
        content = (fallbackMediaTypes.length > 0 ? fallbackMediaTypes : ["application/json"]).map(
          (mediaType) => ({
            mediaType,
            schema: response.schema,
            examples:
              legacyExamples && Object.hasOwn(legacyExamples, mediaType)
                ? [
                    {
                      name: "default",
                      location: "response" as const,
                      status,
                      mediaType,
                      value: legacyExamples[mediaType],
                    },
                  ]
                : [],
          }),
        );
      }
      return [
        {
          status,
          ...(description ? { description } : {}),
          content,
        },
      ];
    });
}

function normalizeContent(
  document: Record<string, unknown>,
  value: unknown,
  location: "request" | "response",
  status?: string,
): NormalizedOpenApiMediaType[] {
  const content = asRecord(value);
  if (!content) return [];
  return Object.keys(content)
    .sort()
    .flatMap((mediaType) => {
      const media = resolveRecord(document, content[mediaType]);
      if (!media) return [];
      const examples: NormalizedOpenApiExample[] = [];
      if (media.example !== undefined) {
        examples.push({
          name: "default",
          location,
          mediaType,
          ...(status ? { status } : {}),
          value: media.example,
        });
      }
      const exampleMap = asRecord(media.examples);
      if (exampleMap) {
        for (const name of Object.keys(exampleMap).sort()) {
          examples.push(
            normalizeExample(document, name, exampleMap[name], location, mediaType, status),
          );
        }
      }
      return [
        {
          mediaType,
          ...(media.schema !== undefined ? { schema: media.schema } : {}),
          examples,
        },
      ];
    });
}

function normalizeExample(
  document: Record<string, unknown>,
  name: string,
  value: unknown,
  location: NormalizedOpenApiExample["location"],
  mediaType?: string,
  status?: string,
): NormalizedOpenApiExample {
  const example = resolveRecord(document, value);
  if (!example) {
    return {
      name,
      location,
      ...(mediaType ? { mediaType } : {}),
      ...(status ? { status } : {}),
      value,
    };
  }
  const summary = stringValue(example.summary);
  const description = stringValue(example.description);
  const externalValue = stringValue(example.externalValue);
  return {
    name,
    location,
    ...(summary ? { summary } : {}),
    ...(description ? { description } : {}),
    ...(mediaType ? { mediaType } : {}),
    ...(status ? { status } : {}),
    ...(Object.hasOwn(example, "value") ? { value: example.value } : {}),
    ...(externalValue ? { externalValue } : {}),
  };
}

function normalizeSecuritySchemes(document: Record<string, unknown>): Record<string, unknown> {
  const components = asRecord(document.components);
  const schemes = asRecord(components?.securitySchemes) ?? asRecord(document.securityDefinitions);
  if (!schemes) return {};
  return Object.fromEntries(
    Object.entries(schemes).map(([name, value]) => [name, resolveRecord(document, value) ?? value]),
  );
}

function normalizeSecurity(value: unknown): Array<Record<string, string[]>> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((requirement) => {
    const record = asRecord(requirement);
    if (!record) return [];
    return [
      Object.fromEntries(
        Object.entries(record).map(([name, scopes]) => [name, normalizeStringArray(scopes)]),
      ),
    ];
  });
}

function normalizeServers(document: Record<string, unknown>): string[] {
  const servers = normalizeServerValues(document.servers);
  if (servers.length > 0) return servers;
  const host = stringValue(document.host);
  if (!host) return [];
  const schemes = normalizeStringArray(document.schemes);
  const basePath = stringValue(document.basePath) ?? "";
  return (schemes.length > 0 ? schemes : ["https"]).map(
    (scheme) => `${scheme}://${host}${basePath}`,
  );
}

function normalizeServerValues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((server) => {
    const url = stringValue(asRecord(server)?.url);
    return url ? [url] : [];
  });
}

function normalizeTags(value: unknown, path: string): string[] {
  const tags = normalizeStringArray(value);
  return tags.length > 0 ? tags : [inferTag(path)];
}

function inferTag(path: string): string {
  const segment = path
    .split("/")
    .filter(Boolean)
    .find((part) => !part.startsWith("{"));
  if (!segment) return "General";
  return segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function resolveRecord(
  document: Record<string, unknown>,
  value: unknown,
  activeReferences = new Set<string>(),
): Record<string, unknown> | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const reference = stringValue(record.$ref);
  if (!reference || !reference.startsWith("#/")) return record;
  if (activeReferences.has(reference)) {
    return Object.fromEntries(Object.entries(record).filter(([key]) => key !== "$ref"));
  }
  const target = resolveJsonPointer(document, reference.slice(1));
  const nextReferences = new Set(activeReferences).add(reference);
  const resolved = resolveRecord(document, target, nextReferences);
  const siblings = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "$ref"));
  return resolved
    ? { ...resolved, ...siblings }
    : Object.keys(siblings).length > 0
      ? siblings
      : record;
}

function resolveJsonPointer(document: Record<string, unknown>, pointer: string): unknown {
  let current: unknown = document;
  for (const token of pointer.slice(1).split("/")) {
    if (!current || typeof current !== "object") return undefined;
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function createGeneratedOperationId(method: string, path: string): string {
  return `${method}_${path.replace(/[^a-zA-Z0-9]+/g, "_")}`;
}

function createOperationSlug(operationId: string): string {
  const base =
    operationId
      .trim()
      .replace(/([a-z\d])([A-Z])/g, "$1-$2")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "operation";
  return `${base}-${fnv1a32(operationId).toString(36)}`;
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function compareResponseStatus(left: string, right: string): number {
  if (left === "default") return 1;
  if (right === "default") return -1;
  return left.localeCompare(right, undefined, { numeric: true });
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const normalized = stringValue(item);
    return normalized ? [normalized] : [];
  });
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}
