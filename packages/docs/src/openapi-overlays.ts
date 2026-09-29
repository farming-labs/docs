import { paths as queryJsonPaths, query as queryJsonValues } from "jsonpath-rfc9535";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

export interface OpenApiOverlayDocumentSource {
  source: string;
  document: unknown;
}

interface OpenApiOverlayAction {
  target: string;
  description?: string;
  update?: JsonValue;
  copy?: string;
  remove?: boolean;
}

interface ValidatedOpenApiOverlay {
  version: "1.0" | "1.1";
  actions: OpenApiOverlayAction[];
}

export class OpenApiOverlayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenApiOverlayError";
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isJsonPrimitive(value: JsonValue): value is JsonPrimitive {
  return value === null || typeof value !== "object";
}

function assertAllowedFields(
  value: JsonObject,
  allowed: readonly string[],
  location: string,
): void {
  const allowedSet = new Set(allowed);
  const unexpected = Object.keys(value).find(
    (key) => !allowedSet.has(key) && !key.startsWith("x-"),
  );
  if (unexpected) {
    throw new OpenApiOverlayError(`${location} contains an unsupported \`${unexpected}\` field.`);
  }
}

function requireNonEmptyString(value: unknown, location: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new OpenApiOverlayError(`${location} must be a non-empty string.`);
  }
  return value.trim();
}

export function assertValidOpenApiOverlayDocument(
  value: unknown,
  source = "OpenAPI Overlay document",
): asserts value is JsonObject {
  if (!isJsonObject(value)) {
    throw new OpenApiOverlayError(`${source} must contain an object.`);
  }

  const overlayVersion = requireNonEmptyString(value.overlay, `${source} \`overlay\``);
  const match = /^1\.(0|1)\.\d+$/.exec(overlayVersion);
  if (!match) {
    throw new OpenApiOverlayError(
      `${source} uses unsupported Overlay version \`${overlayVersion}\`. Supported versions are 1.0.x and 1.1.x.`,
    );
  }
  const featureVersion = match[1] === "0" ? "1.0" : "1.1";

  assertAllowedFields(value, ["overlay", "info", "extends", "actions"], source);
  if (!isJsonObject(value.info)) {
    throw new OpenApiOverlayError(`${source} \`info\` must be an object.`);
  }
  assertAllowedFields(
    value.info,
    featureVersion === "1.1" ? ["title", "version", "description"] : ["title", "version"],
    `${source} \`info\``,
  );
  requireNonEmptyString(value.info.title, `${source} \`info.title\``);
  requireNonEmptyString(value.info.version, `${source} \`info.version\``);
  if (value.extends !== undefined && typeof value.extends !== "string") {
    throw new OpenApiOverlayError(`${source} \`extends\` must be a URI-reference string.`);
  }
  if (!Array.isArray(value.actions) || value.actions.length === 0) {
    throw new OpenApiOverlayError(`${source} \`actions\` must contain at least one action.`);
  }

  const serializedActions = new Set<string>();
  value.actions.forEach((action, index) => {
    const location = `${source} action ${index + 1}`;
    if (!isJsonObject(action)) {
      throw new OpenApiOverlayError(`${location} must be an object.`);
    }
    assertAllowedFields(
      action,
      featureVersion === "1.1"
        ? ["target", "description", "update", "copy", "remove"]
        : ["target", "description", "update", "remove"],
      location,
    );
    const target = requireNonEmptyString(action.target, `${location} \`target\``);
    if (!target.startsWith("$")) {
      throw new OpenApiOverlayError(`${location} \`target\` must start with \`$\`.`);
    }
    if (action.description !== undefined && typeof action.description !== "string") {
      throw new OpenApiOverlayError(`${location} \`description\` must be a string.`);
    }
    if (action.remove !== undefined && typeof action.remove !== "boolean") {
      throw new OpenApiOverlayError(`${location} \`remove\` must be a boolean.`);
    }
    if (action.copy !== undefined) {
      const copy = requireNonEmptyString(action.copy, `${location} \`copy\``);
      if (!copy.startsWith("$")) {
        throw new OpenApiOverlayError(`${location} \`copy\` must start with \`$\`.`);
      }
    }

    const serialized = JSON.stringify(action);
    if (serializedActions.has(serialized)) {
      throw new OpenApiOverlayError(`${location} duplicates an earlier action.`);
    }
    serializedActions.add(serialized);
  });
}

function validateOverlay(value: unknown, source: string): ValidatedOpenApiOverlay {
  assertValidOpenApiOverlayDocument(value, source);
  const version = String(value.overlay).startsWith("1.0.") ? "1.0" : "1.1";
  return {
    version,
    actions: value.actions as unknown as OpenApiOverlayAction[],
  };
}

function decodeNormalizedPathKey(value: string): string {
  return value.replace(/\\(?:['\\bfnrt]|u[\da-fA-F]{4})/g, (match) => {
    const escape = match.slice(1);
    if (escape.startsWith("u")) return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
    return (
      {
        "'": "'",
        "\\": "\\",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
      } as Record<string, string>
    )[escape];
  });
}

function parseNormalizedJsonPath(path: string): Array<string | number> {
  if (path === "$") return [];
  const segments: Array<string | number> = [];
  const segmentPattern = /\[(?:(\d+)|'((?:\\.|[^'])*)')\]/gy;
  segmentPattern.lastIndex = 1;
  while (segmentPattern.lastIndex < path.length) {
    const match = segmentPattern.exec(path);
    if (!match) {
      throw new OpenApiOverlayError(`JSONPath returned an unsupported normalized path: ${path}`);
    }
    segments.push(
      match[1] === undefined ? decodeNormalizedPathKey(match[2] ?? "") : Number(match[1]),
    );
  }
  return segments;
}

function getAtPath(root: JsonValue, path: readonly (string | number)[]): JsonValue {
  let value = root;
  for (const segment of path) {
    if (Array.isArray(value) && typeof segment === "number") {
      value = value[segment];
      continue;
    }
    if (isJsonObject(value) && typeof segment === "string") {
      value = value[segment];
      continue;
    }
    throw new OpenApiOverlayError("An Overlay action selected a node that no longer exists.");
  }
  return value;
}

function setAtPath(
  root: JsonValue,
  path: readonly (string | number)[],
  value: JsonValue,
): JsonValue {
  if (path.length === 0) return value;
  const parent = getAtPath(root, path.slice(0, -1));
  const key = path[path.length - 1];
  if (Array.isArray(parent) && typeof key === "number") parent[key] = value;
  else if (isJsonObject(parent) && typeof key === "string") parent[key] = value;
  else throw new OpenApiOverlayError("An Overlay action selected an invalid parent node.");
  return root;
}

function removeAtPath(root: JsonValue, path: readonly (string | number)[]): void {
  if (path.length === 0) {
    throw new OpenApiOverlayError("An Overlay action cannot remove the document root.");
  }
  const parent = getAtPath(root, path.slice(0, -1));
  const key = path[path.length - 1];
  if (Array.isArray(parent) && typeof key === "number") parent.splice(key, 1);
  else if (isJsonObject(parent) && typeof key === "string") delete parent[key];
  else throw new OpenApiOverlayError("An Overlay remove action selected an invalid parent node.");
}

function mergeObjectValues(target: JsonObject, update: JsonObject, location: string): JsonObject {
  const result = structuredClone(target);
  for (const [key, updateValue] of Object.entries(update)) {
    if (!(key in result)) {
      result[key] = structuredClone(updateValue);
      continue;
    }
    const targetValue = result[key];
    if (isJsonObject(targetValue) && isJsonObject(updateValue)) {
      result[key] = mergeObjectValues(targetValue, updateValue, `${location}.${key}`);
    } else if (Array.isArray(targetValue) && Array.isArray(updateValue)) {
      result[key] = [...targetValue, ...structuredClone(updateValue)];
    } else if (isJsonPrimitive(targetValue) && isJsonPrimitive(updateValue)) {
      result[key] = updateValue;
    } else {
      throw new OpenApiOverlayError(`${location} cannot merge incompatible values for \`${key}\`.`);
    }
  }
  return result;
}

function applyUpdate(
  target: JsonValue,
  update: JsonValue,
  version: "1.0" | "1.1",
  location: string,
): JsonValue {
  if (isJsonObject(target)) {
    if (!isJsonObject(update)) {
      throw new OpenApiOverlayError(`${location} must use an object update for an object target.`);
    }
    return mergeObjectValues(target, update, location);
  }
  if (Array.isArray(target)) {
    return Array.isArray(update)
      ? [...target, ...structuredClone(update)]
      : [...target, structuredClone(update)];
  }
  if (version === "1.0") {
    throw new OpenApiOverlayError(
      `${location} selects a primitive, which Overlay 1.0 cannot update.`,
    );
  }
  if (!isJsonPrimitive(update)) {
    throw new OpenApiOverlayError(
      `${location} must use a primitive update for a primitive target.`,
    );
  }
  return update;
}

function queryPaths(document: JsonValue, expression: string, location: string): string[] {
  try {
    return queryJsonPaths(document as never, expression);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new OpenApiOverlayError(`${location} contains invalid RFC 9535 JSONPath: ${message}`);
  }
}

function queryCopyValue(document: JsonValue, expression: string, location: string): JsonValue {
  let values: JsonValue[];
  try {
    values = queryJsonValues(document as never, expression) as JsonValue[];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new OpenApiOverlayError(`${location} contains invalid RFC 9535 JSONPath: ${message}`);
  }
  if (values.length !== 1) {
    throw new OpenApiOverlayError(
      `${location} must select exactly one node, but selected ${values.length}.`,
    );
  }
  return structuredClone(values[0]);
}

function compareRemovalPaths(a: readonly (string | number)[], b: readonly (string | number)[]) {
  if (a.length !== b.length) return b.length - a.length;
  const aLast = a[a.length - 1];
  const bLast = b[b.length - 1];
  return typeof aLast === "number" && typeof bLast === "number" ? bLast - aLast : 0;
}

function getJsonValueKind(value: JsonValue): "array" | "object" | "primitive" {
  if (Array.isArray(value)) return "array";
  return isJsonObject(value) ? "object" : "primitive";
}

export function applyOpenApiOverlayDocuments(
  document: Record<string, unknown>,
  overlays: readonly OpenApiOverlayDocumentSource[],
): Record<string, unknown> {
  let result = structuredClone(document) as JsonValue;

  for (const overlaySource of overlays) {
    const overlay = validateOverlay(overlaySource.document, overlaySource.source);
    for (const [actionIndex, action] of overlay.actions.entries()) {
      const location = `${overlaySource.source} action ${actionIndex + 1}`;
      const normalizedPaths = queryPaths(result, action.target, `${location} \`target\``);
      if (normalizedPaths.length === 0) {
        throw new OpenApiOverlayError(
          `${location} target \`${action.target}\` did not match any nodes.`,
        );
      }
      const selectedPaths = normalizedPaths.map(parseNormalizedJsonPath);

      if (action.remove === true) {
        for (const path of selectedPaths.sort(compareRemovalPaths)) removeAtPath(result, path);
        continue;
      }

      const hasUpdate = Object.prototype.hasOwnProperty.call(action, "update");
      const hasCopy = typeof action.copy === "string";
      if (!hasUpdate && !hasCopy) continue;
      const selectedKinds = new Set(
        selectedPaths.map((path) => getJsonValueKind(getAtPath(result, path))),
      );
      if (selectedKinds.size > 1) {
        throw new OpenApiOverlayError(
          `${location} must select only objects, only arrays, or only primitives for an update or copy action.`,
        );
      }
      const updateValue = hasUpdate
        ? (action.update as JsonValue)
        : queryCopyValue(result, action.copy as string, `${location} \`copy\``);

      for (const path of selectedPaths) {
        const target = getAtPath(result, path);
        const updated = applyUpdate(target, updateValue, overlay.version, location);
        result = setAtPath(result, path, updated);
      }
    }
  }

  if (!isJsonObject(result)) {
    throw new OpenApiOverlayError("OpenAPI Overlay actions must leave an object document root.");
  }
  return result as Record<string, unknown>;
}
