const OPENAPI_HTTP_METHODS = [
  "get",
  "put",
  "post",
  "delete",
  "options",
  "head",
  "patch",
  "trace",
] as const;

export type OpenApiContractDiagnosticCode =
  | "conflicting-version-fields"
  | "missing-version"
  | "invalid-version"
  | "unsupported-version"
  | "invalid-paths"
  | "invalid-webhooks"
  | "invalid-path-item"
  | "invalid-operation"
  | "invalid-operation-id"
  | "invalid-callbacks"
  | "duplicate-operation-id";

export interface OpenApiContractDiagnostic {
  severity: "error";
  code: OpenApiContractDiagnosticCode;
  path: string;
  message: string;
  relatedPath?: string;
}

export interface OpenApiContractValidationResult {
  valid: boolean;
  dialect?: "openapi" | "swagger";
  version?: string;
  operationCount: number;
  diagnostics: OpenApiContractDiagnostic[];
}

interface ValidationState {
  diagnostics: OpenApiContractDiagnostic[];
  operationIds: Map<string, string>;
  operationCount: number;
  activePathItems: WeakSet<object>;
}

export class OpenApiContractValidationError extends Error {
  readonly diagnostics: readonly OpenApiContractDiagnostic[];

  constructor(result: OpenApiContractValidationResult) {
    const first = result.diagnostics[0];
    const remaining = result.diagnostics.length - 1;
    super(
      first
        ? `OpenAPI contract validation failed at ${first.path}: ${first.message}${
            remaining > 0 ? ` (${remaining} more ${remaining === 1 ? "error" : "errors"})` : ""
          }`
        : "OpenAPI contract validation failed.",
    );
    this.name = "OpenApiContractValidationError";
    this.diagnostics = result.diagnostics;
  }
}

export function validateOpenApiContract(
  document: Record<string, unknown>,
): OpenApiContractValidationResult {
  const state: ValidationState = {
    diagnostics: [],
    operationIds: new Map(),
    operationCount: 0,
    activePathItems: new WeakSet(),
  };
  const hasOpenApi = Object.hasOwn(document, "openapi");
  const hasSwagger = Object.hasOwn(document, "swagger");
  let dialect: OpenApiContractValidationResult["dialect"];
  let version: string | undefined;

  if (hasOpenApi && hasSwagger) {
    addDiagnostic(
      state,
      "conflicting-version-fields",
      "/",
      "Use either the `openapi` field or the `swagger` field, not both.",
    );
  } else if (hasOpenApi) {
    dialect = "openapi";
    version = validateOpenApiVersion(document.openapi, state);
  } else if (hasSwagger) {
    dialect = "swagger";
    version = validateSwaggerVersion(document.swagger, state);
  } else {
    addDiagnostic(
      state,
      "missing-version",
      "/",
      "The document must declare an `openapi` or `swagger` specification version.",
    );
  }

  inspectPathItemMap(document.paths, "/paths", "paths", state);
  if (document.webhooks !== undefined) {
    inspectPathItemMap(document.webhooks, "/webhooks", "webhooks", state);
  }

  return {
    valid: state.diagnostics.length === 0,
    dialect,
    version,
    operationCount: state.operationCount,
    diagnostics: state.diagnostics,
  };
}

export function assertValidOpenApiContract(document: Record<string, unknown>): void {
  const result = validateOpenApiContract(document);
  if (!result.valid) throw new OpenApiContractValidationError(result);
}

function validateOpenApiVersion(value: unknown, state: ValidationState): string | undefined {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value)) {
    addDiagnostic(
      state,
      "invalid-version",
      "/openapi",
      "`openapi` must be a stable major.minor.patch version string.",
    );
    return undefined;
  }

  if (!/^3\.(?:0|1|2)\.\d+$/.test(value)) {
    addDiagnostic(
      state,
      "unsupported-version",
      "/openapi",
      `OpenAPI ${value} is not supported. Supported families are 3.0.x, 3.1.x, and 3.2.x.`,
    );
  }

  return value;
}

function validateSwaggerVersion(value: unknown, state: ValidationState): string | undefined {
  if (typeof value !== "string") {
    addDiagnostic(state, "invalid-version", "/swagger", "`swagger` must be the string `2.0`.");
    return undefined;
  }

  if (value !== "2.0") {
    addDiagnostic(
      state,
      "unsupported-version",
      "/swagger",
      `Swagger ${value} is not supported. The supported Swagger version is 2.0.`,
    );
  }

  return value;
}

function inspectPathItemMap(
  value: unknown,
  pointer: string,
  kind: "paths" | "webhooks" | "callbacks",
  state: ValidationState,
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    addDiagnostic(
      state,
      kind === "paths"
        ? "invalid-paths"
        : kind === "webhooks"
          ? "invalid-webhooks"
          : "invalid-callbacks",
      pointer,
      `\`${kind}\` must be an object.`,
    );
    return;
  }

  for (const [key, pathItem] of Object.entries(value)) {
    if (key.startsWith("x-")) continue;
    const pathPointer = `${pointer}/${escapeJsonPointer(key)}`;
    if (!isRecord(pathItem)) {
      addDiagnostic(
        state,
        "invalid-path-item",
        pathPointer,
        "Path items must be objects or Reference Objects.",
      );
      continue;
    }

    inspectPathItem(pathItem, pathPointer, state);
  }
}

function inspectPathItem(
  pathItem: Record<string, unknown>,
  pointer: string,
  state: ValidationState,
): void {
  if (state.activePathItems.has(pathItem)) return;
  state.activePathItems.add(pathItem);

  try {
    for (const method of OPENAPI_HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation === undefined) continue;
      const operationPointer = `${pointer}/${method}`;
      if (!isRecord(operation)) {
        addDiagnostic(
          state,
          "invalid-operation",
          operationPointer,
          `The ${method.toUpperCase()} operation must be an object.`,
        );
        continue;
      }

      state.operationCount += 1;
      inspectOperationId(operation.operationId, `${operationPointer}/operationId`, state);
      inspectCallbacks(operation.callbacks, `${operationPointer}/callbacks`, state);
    }
  } finally {
    state.activePathItems.delete(pathItem);
  }
}

function inspectOperationId(value: unknown, pointer: string, state: ValidationState): void {
  if (value === undefined) return;
  if (typeof value !== "string" || value.trim().length === 0) {
    addDiagnostic(
      state,
      "invalid-operation-id",
      pointer,
      "`operationId` must be a non-empty string when provided.",
    );
    return;
  }

  const firstPath = state.operationIds.get(value);
  if (firstPath) {
    addDiagnostic(
      state,
      "duplicate-operation-id",
      pointer,
      `The operationId \`${value}\` is already used at ${firstPath}.`,
      firstPath,
    );
    return;
  }

  state.operationIds.set(value, pointer);
}

function inspectCallbacks(value: unknown, pointer: string, state: ValidationState): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    addDiagnostic(state, "invalid-callbacks", pointer, "`callbacks` must be an object.");
    return;
  }

  for (const [callbackName, callback] of Object.entries(value)) {
    if (callbackName.startsWith("x-")) continue;
    const callbackPointer = `${pointer}/${escapeJsonPointer(callbackName)}`;
    if (!isRecord(callback)) {
      addDiagnostic(
        state,
        "invalid-callbacks",
        callbackPointer,
        "Callback entries must be Callback Objects or Reference Objects.",
      );
      continue;
    }
    if (typeof callback.$ref === "string") continue;
    inspectPathItemMap(callback, callbackPointer, "callbacks", state);
  }
}

function addDiagnostic(
  state: ValidationState,
  code: OpenApiContractDiagnosticCode,
  path: string,
  message: string,
  relatedPath?: string,
): void {
  state.diagnostics.push({ severity: "error", code, path, message, relatedPath });
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
