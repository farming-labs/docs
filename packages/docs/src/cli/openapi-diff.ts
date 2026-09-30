import path from "node:path";
import pc from "picocolors";
import {
  buildNormalizedOpenApiModel,
  type NormalizedOpenApiMediaType,
  type NormalizedOpenApiOperation,
  type NormalizedOpenApiParameter,
  type NormalizedOpenApiResponse,
} from "../openapi-operations.js";
import { displayOpenApiCliSource, loadOpenApiCliSource } from "./openapi-source.js";

export type OpenApiDiffSeverity = "breaking" | "non-breaking";
export type OpenApiDiffFailOn = "breaking" | "any" | "never";

export interface OpenApiDiffChange {
  severity: OpenApiDiffSeverity;
  kind: string;
  detail: string;
  selector?: string;
  location?: string;
}

export interface OpenApiDiffSourceSummary {
  source: string;
  title: string;
  version: string;
  specificationVersion: string;
  operationCount: number;
}

export interface OpenApiDiffReport {
  format: "farming-labs-openapi-diff.v1";
  baseline: OpenApiDiffSourceSummary;
  current: OpenApiDiffSourceSummary;
  breaking: boolean;
  breakingCount: number;
  nonBreakingCount: number;
  changes: OpenApiDiffChange[];
}

export interface OpenApiDiffOptions {
  baseline?: string;
  current?: string;
  baseUrl?: string;
  failOn: OpenApiDiffFailOn;
  json: boolean;
  help: boolean;
  rootDir?: string;
}

const SCHEMA_ANNOTATION_KEYS = new Set([
  "$comment",
  "deprecated",
  "description",
  "example",
  "examples",
  "externalDocs",
  "title",
  "xml",
]);

export function parseOpenApiDiffArgs(argv: string[]): OpenApiDiffOptions {
  const positionals: string[] = [];
  let baseline: string | undefined;
  let current: string | undefined;
  let baseUrl: string | undefined;
  let failOn: OpenApiDiffFailOn = "breaking";
  let json = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index] ?? "";
    if (argument === "--help" || argument === "-h") {
      help = true;
      continue;
    }
    if (argument === "--json") {
      json = true;
      continue;
    }
    const flagSeparator = argument.startsWith("--") ? argument.indexOf("=") : -1;
    const rawFlag = argument.startsWith("--")
      ? argument.slice(2, flagSeparator === -1 ? undefined : flagSeparator)
      : undefined;
    const inlineValue = flagSeparator === -1 ? undefined : argument.slice(flagSeparator + 1);
    if (rawFlag) {
      const value = inlineValue ?? argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`Missing value for --${rawFlag}.`);
      }
      if (inlineValue === undefined) index += 1;
      if (rawFlag === "base" || rawFlag === "baseline") baseline = value;
      else if (rawFlag === "head" || rawFlag === "current") current = value;
      else if (rawFlag === "base-url") baseUrl = value;
      else if (rawFlag === "fail-on") {
        if (value !== "breaking" && value !== "any" && value !== "never") {
          throw new Error('`--fail-on` must be "breaking", "any", or "never".');
        }
        failOn = value;
      } else {
        throw new Error(`Unknown OpenAPI diff option: --${rawFlag}.`);
      }
      continue;
    }
    positionals.push(argument);
  }

  for (const source of positionals) {
    if (!baseline) baseline = source;
    else if (!current) current = source;
    else throw new Error("Pass exactly two OpenAPI sources: baseline and current.");
  }

  if (!help && (!baseline || !current)) {
    throw new Error(
      "Pass baseline and current OpenAPI sources as positional arguments or with --base and --head.",
    );
  }

  return { baseline, current, baseUrl, failOn, json, help };
}

export async function runOpenApiDiff(options: OpenApiDiffOptions): Promise<OpenApiDiffReport> {
  if (!options.baseline || !options.current) {
    throw new Error("Both baseline and current OpenAPI sources are required.");
  }
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const [baseline, current] = await Promise.all([
    loadOpenApiCliSource(options.baseline, { rootDir, baseUrl: options.baseUrl }),
    loadOpenApiCliSource(options.current, { rootDir, baseUrl: options.baseUrl }),
  ]);
  const report = compareOpenApiDocuments(baseline, current, {
    baselineSource: displayOpenApiCliSource(options.baseline),
    currentSource: displayOpenApiCliSource(options.current),
  });

  if (options.json) console.log(JSON.stringify(report, null, 2));
  else printOpenApiDiffReport(report);

  if (
    (options.failOn === "breaking" && report.breaking) ||
    (options.failOn === "any" && report.changes.length > 0)
  ) {
    process.exitCode = 1;
  }
  return report;
}

export function compareOpenApiDocuments(
  baselineDocument: Record<string, unknown>,
  currentDocument: Record<string, unknown>,
  sources: { baselineSource?: string; currentSource?: string } = {},
): OpenApiDiffReport {
  const baselineModel = buildNormalizedOpenApiModel(baselineDocument);
  const currentModel = buildNormalizedOpenApiModel(currentDocument);
  const changes: OpenApiDiffChange[] = [];
  const baselineOperations = new Map(
    baselineModel.operations.map((operation) => [operation.selector, operation]),
  );
  const currentOperations = new Map(
    currentModel.operations.map((operation) => [operation.selector, operation]),
  );

  for (const selector of Array.from(baselineOperations.keys()).sort()) {
    const baseline = baselineOperations.get(selector)!;
    const current = currentOperations.get(selector);
    if (!current) {
      changes.push(change("breaking", "operation-removed", selector, "Operation was removed."));
      continue;
    }
    compareOperation(baseline, current, baselineDocument, currentDocument, changes);
  }
  for (const selector of Array.from(currentOperations.keys()).sort()) {
    if (baselineOperations.has(selector)) continue;
    changes.push(change("non-breaking", "operation-added", selector, "Operation was added."));
  }

  if (baselineModel.specificationVersion !== currentModel.specificationVersion) {
    changes.push({
      severity: "non-breaking",
      kind: "specification-version-changed",
      detail: `OpenAPI version changed from ${baselineModel.specificationVersion} to ${currentModel.specificationVersion}.`,
      location: "/openapi",
    });
  }

  changes.sort(compareChanges);
  const breakingCount = changes.filter((entry) => entry.severity === "breaking").length;
  return {
    format: "farming-labs-openapi-diff.v1",
    baseline: summarizeSource(sources.baselineSource ?? "baseline", baselineModel),
    current: summarizeSource(sources.currentSource ?? "current", currentModel),
    breaking: breakingCount > 0,
    breakingCount,
    nonBreakingCount: changes.length - breakingCount,
    changes,
  };
}

function compareOperation(
  baseline: NormalizedOpenApiOperation,
  current: NormalizedOpenApiOperation,
  baselineDocument: Record<string, unknown>,
  currentDocument: Record<string, unknown>,
  changes: OpenApiDiffChange[],
): void {
  const selector = baseline.selector;
  if (baseline.operationId !== current.operationId) {
    changes.push(
      change(
        "breaking",
        "operation-id-changed",
        selector,
        `operationId changed from ${baseline.operationId} to ${current.operationId}.`,
        `${selector} operationId`,
      ),
    );
  }
  compareParameters(
    baseline.parameters,
    current.parameters,
    baselineDocument,
    currentDocument,
    selector,
    changes,
  );
  compareRequestBody(baseline, current, baselineDocument, currentDocument, selector, changes);
  compareResponses(
    baseline.responses,
    current.responses,
    baselineDocument,
    currentDocument,
    selector,
    changes,
  );

  const baselineSecurity = normalizeSecurityForDiff(baseline.security);
  const currentSecurity = normalizeSecurityForDiff(current.security);
  if (baselineSecurity !== currentSecurity) {
    changes.push(
      change(
        baseline.security.length === 0 && current.security.length > 0
          ? "breaking"
          : baseline.security.length > 0 && current.security.length === 0
            ? "non-breaking"
            : "breaking",
        "security-changed",
        selector,
        "Security requirements changed.",
        `${selector} security`,
      ),
    );
  }
  if (stableJson(baseline.securitySchemes) !== stableJson(current.securitySchemes)) {
    changes.push(
      change(
        "breaking",
        "security-scheme-changed",
        selector,
        "A security scheme used by the operation changed.",
        `${selector} securitySchemes`,
      ),
    );
  }
  if (
    baseline.servers.length > 0 &&
    !baseline.servers.some((server) => current.servers.includes(server))
  ) {
    changes.push(
      change(
        "breaking",
        "server-changed",
        selector,
        "The operation no longer exposes any previously declared server URL.",
        `${selector} servers`,
      ),
    );
  }
  if (!baseline.deprecated && current.deprecated) {
    changes.push(
      change("non-breaking", "operation-deprecated", selector, "Operation is now deprecated."),
    );
  }
}

function compareParameters(
  baseline: NormalizedOpenApiParameter[],
  current: NormalizedOpenApiParameter[],
  baselineDocument: Record<string, unknown>,
  currentDocument: Record<string, unknown>,
  selector: string,
  changes: OpenApiDiffChange[],
): void {
  const baselineMap = new Map(baseline.map((parameter) => [parameterKey(parameter), parameter]));
  const currentMap = new Map(current.map((parameter) => [parameterKey(parameter), parameter]));
  for (const key of Array.from(baselineMap.keys()).sort()) {
    const before = baselineMap.get(key)!;
    const after = currentMap.get(key);
    const location = `${selector} parameter ${before.in}:${before.name}`;
    if (!after) {
      changes.push(
        change(
          "breaking",
          "parameter-removed",
          selector,
          `${before.in} parameter ${before.name} was removed.`,
          location,
        ),
      );
      continue;
    }
    if (!before.required && after.required) {
      changes.push(
        change(
          "breaking",
          "parameter-required",
          selector,
          `${after.in} parameter ${after.name} is now required.`,
          location,
        ),
      );
    } else if (before.required && !after.required) {
      changes.push(
        change(
          "non-breaking",
          "parameter-optional",
          selector,
          `${after.in} parameter ${after.name} is now optional.`,
          location,
        ),
      );
    }
    compareSchema(
      before.schema,
      after.schema,
      baselineDocument,
      currentDocument,
      "request",
      selector,
      location,
      "parameter-schema-changed",
      changes,
    );
  }
  for (const key of Array.from(currentMap.keys()).sort()) {
    if (baselineMap.has(key)) continue;
    const parameter = currentMap.get(key)!;
    changes.push(
      change(
        parameter.required ? "breaking" : "non-breaking",
        parameter.required ? "required-parameter-added" : "optional-parameter-added",
        selector,
        `${parameter.required ? "Required" : "Optional"} ${parameter.in} parameter ${parameter.name} was added.`,
        `${selector} parameter ${parameter.in}:${parameter.name}`,
      ),
    );
  }
}

function compareRequestBody(
  baseline: NormalizedOpenApiOperation,
  current: NormalizedOpenApiOperation,
  baselineDocument: Record<string, unknown>,
  currentDocument: Record<string, unknown>,
  selector: string,
  changes: OpenApiDiffChange[],
): void {
  const before = baseline.requestBody;
  const after = current.requestBody;
  const location = `${selector} requestBody`;
  if (before && !after) {
    changes.push(
      change("breaking", "request-body-removed", selector, "Request body was removed.", location),
    );
    return;
  }
  if (!before && after) {
    changes.push(
      change(
        after.required ? "breaking" : "non-breaking",
        after.required ? "required-request-body-added" : "optional-request-body-added",
        selector,
        `${after.required ? "Required" : "Optional"} request body was added.`,
        location,
      ),
    );
    return;
  }
  if (!before || !after) return;
  if (!before.required && after.required) {
    changes.push(
      change(
        "breaking",
        "request-body-required",
        selector,
        "Request body is now required.",
        location,
      ),
    );
  } else if (before.required && !after.required) {
    changes.push(
      change(
        "non-breaking",
        "request-body-optional",
        selector,
        "Request body is now optional.",
        location,
      ),
    );
  }
  compareMediaTypes(
    before.content,
    after.content,
    baselineDocument,
    currentDocument,
    "request",
    selector,
    location,
    changes,
  );
}

function compareResponses(
  baseline: NormalizedOpenApiResponse[],
  current: NormalizedOpenApiResponse[],
  baselineDocument: Record<string, unknown>,
  currentDocument: Record<string, unknown>,
  selector: string,
  changes: OpenApiDiffChange[],
): void {
  const baselineMap = new Map(baseline.map((response) => [response.status, response]));
  const currentMap = new Map(current.map((response) => [response.status, response]));
  for (const status of Array.from(baselineMap.keys()).sort()) {
    const before = baselineMap.get(status)!;
    const after = currentMap.get(status);
    const location = `${selector} response ${status}`;
    if (!after) {
      changes.push(
        change(
          "breaking",
          "response-removed",
          selector,
          `Response ${status} was removed.`,
          location,
        ),
      );
      continue;
    }
    compareMediaTypes(
      before.content,
      after.content,
      baselineDocument,
      currentDocument,
      "response",
      selector,
      location,
      changes,
    );
  }
  for (const status of Array.from(currentMap.keys()).sort()) {
    if (baselineMap.has(status)) continue;
    changes.push(
      change(
        "non-breaking",
        "response-added",
        selector,
        `Response ${status} was added.`,
        `${selector} response ${status}`,
      ),
    );
  }
}

function compareMediaTypes(
  baseline: NormalizedOpenApiMediaType[],
  current: NormalizedOpenApiMediaType[],
  baselineDocument: Record<string, unknown>,
  currentDocument: Record<string, unknown>,
  mode: "request" | "response",
  selector: string,
  parentLocation: string,
  changes: OpenApiDiffChange[],
): void {
  const baselineMap = new Map(baseline.map((media) => [media.mediaType, media]));
  const currentMap = new Map(current.map((media) => [media.mediaType, media]));
  for (const mediaType of Array.from(baselineMap.keys()).sort()) {
    const before = baselineMap.get(mediaType)!;
    const after = currentMap.get(mediaType);
    const location = `${parentLocation} ${mediaType}`;
    if (!after) {
      changes.push(
        change("breaking", "media-type-removed", selector, `${mediaType} was removed.`, location),
      );
      continue;
    }
    compareSchema(
      before.schema,
      after.schema,
      baselineDocument,
      currentDocument,
      mode,
      selector,
      location,
      `${mode}-schema-changed`,
      changes,
    );
  }
  for (const mediaType of Array.from(currentMap.keys()).sort()) {
    if (baselineMap.has(mediaType)) continue;
    changes.push(
      change(
        "non-breaking",
        "media-type-added",
        selector,
        `${mediaType} was added.`,
        `${parentLocation} ${mediaType}`,
      ),
    );
  }
}

function compareSchema(
  baseline: unknown,
  current: unknown,
  baselineDocument: Record<string, unknown>,
  currentDocument: Record<string, unknown>,
  mode: "request" | "response",
  selector: string,
  location: string,
  kind: string,
  changes: OpenApiDiffChange[],
): void {
  const before = normalizeSchema(baselineDocument, baseline);
  const after = normalizeSchema(currentDocument, current);
  if (stableJson(before) === stableJson(after)) return;
  const breakingReason = findBreakingSchemaReason(before, after, mode);
  changes.push(
    change(
      breakingReason ? "breaking" : "non-breaking",
      kind,
      selector,
      breakingReason ??
        (mode === "request"
          ? "Request schema was expanded compatibly."
          : "Response schema was narrowed compatibly."),
      location,
    ),
  );
}

function findBreakingSchemaReason(
  baseline: unknown,
  current: unknown,
  mode: "request" | "response",
  schemaPath = "schema",
): string | undefined {
  if (baseline === undefined || current === undefined) {
    if (baseline === current) return undefined;
    const constrained = baseline === undefined ? "current" : "baseline";
    const incompatible =
      mode === "request" ? constrained === "current" : constrained === "baseline";
    return incompatible ? `${schemaPath} changed incompatibly.` : undefined;
  }
  const before = asRecord(baseline);
  const after = asRecord(current);
  if (!before || !after) {
    return stableJson(baseline) === stableJson(current)
      ? undefined
      : `${schemaPath} changed incompatibly.`;
  }
  const beforeTypes = normalizeTypes(before.type);
  const afterTypes = normalizeTypes(after.type);
  const typeIncompatible = restrictionChangedIncompatibly(beforeTypes, afterTypes, mode);
  if (typeIncompatible) return `${schemaPath} type changed incompatibly.`;
  const beforeEnum = Array.isArray(before.enum) ? before.enum.map(stableJson) : [];
  const afterEnum = Array.isArray(after.enum) ? after.enum.map(stableJson) : [];
  const enumIncompatible = restrictionChangedIncompatibly(beforeEnum, afterEnum, mode);
  if (enumIncompatible) return `${schemaPath} enum changed incompatibly.`;
  const beforeConst = Object.hasOwn(before, "const") ? [stableJson(before.const)] : [];
  const afterConst = Object.hasOwn(after, "const") ? [stableJson(after.const)] : [];
  if (stableJson(beforeConst) !== stableJson(afterConst)) {
    if (beforeConst.length > 0 && afterConst.length > 0 && beforeConst[0] !== afterConst[0]) {
      return `${schemaPath} constant value changed.`;
    }
    if (restrictionChangedIncompatibly(beforeConst, afterConst, mode)) {
      return `${schemaPath} constant constraint changed incompatibly.`;
    }
  }

  const scalarRestrictionReason = compareScalarSchemaRestrictions(before, after, mode, schemaPath);
  if (scalarRestrictionReason) return scalarRestrictionReason;

  const limitReason = compareSchemaLimits(before, after, mode, schemaPath);
  if (limitReason) return limitReason;

  const beforeRequired = new Set(stringArray(before.required));
  const afterRequired = new Set(stringArray(after.required));
  if (mode === "request") {
    const addedRequired = Array.from(afterRequired).find((name) => !beforeRequired.has(name));
    if (addedRequired) return `${schemaPath}.${addedRequired} is newly required.`;
  } else {
    const relaxedRequired = Array.from(beforeRequired).find((name) => !afterRequired.has(name));
    if (relaxedRequired) return `${schemaPath}.${relaxedRequired} is no longer guaranteed.`;
  }

  const beforeProperties = asRecord(before.properties) ?? {};
  const afterProperties = asRecord(after.properties) ?? {};
  if (mode === "response") {
    const removed = Object.keys(beforeProperties).find(
      (name) => !Object.hasOwn(afterProperties, name),
    );
    if (removed) return `${schemaPath}.${removed} was removed from the response.`;
  } else if (after.additionalProperties === false) {
    const rejected = Object.keys(beforeProperties).find(
      (name) => !Object.hasOwn(afterProperties, name),
    );
    if (rejected) return `${schemaPath}.${rejected} is no longer accepted.`;
  }
  for (const name of Object.keys(beforeProperties).sort()) {
    if (!Object.hasOwn(afterProperties, name)) continue;
    const nested = findBreakingSchemaReason(
      beforeProperties[name],
      afterProperties[name],
      mode,
      `${schemaPath}.${name}`,
    );
    if (nested) return nested;
  }
  if (stableJson(before.items) !== stableJson(after.items)) {
    const nested = findBreakingSchemaReason(before.items, after.items, mode, `${schemaPath}[]`);
    if (nested) return nested;
  }
  const beforeAdditional = before.additionalProperties ?? true;
  const afterAdditional = after.additionalProperties ?? true;
  if (stableJson(beforeAdditional) !== stableJson(afterAdditional)) {
    const beforeAdditionalSchema = asRecord(beforeAdditional);
    const afterAdditionalSchema = asRecord(afterAdditional);
    if (beforeAdditionalSchema && afterAdditionalSchema) {
      const nested = findBreakingSchemaReason(
        beforeAdditionalSchema,
        afterAdditionalSchema,
        mode,
        `${schemaPath}.*`,
      );
      if (nested) return nested;
    } else {
      const becameRestricted = beforeAdditional !== false && afterAdditional === false;
      const becameUnrestricted = beforeAdditional === false && afterAdditional !== false;
      if (
        (mode === "request" && becameRestricted) ||
        (mode === "response" && becameUnrestricted) ||
        (!becameRestricted && !becameUnrestricted)
      ) {
        return `${schemaPath}.additionalProperties changed incompatibly.`;
      }
    }
  }
  for (const keyword of ["allOf", "anyOf", "oneOf", "not", "discriminator"] as const) {
    if (stableJson(before[keyword]) !== stableJson(after[keyword])) {
      return `${schemaPath}.${keyword} changed; compatibility cannot be preserved safely.`;
    }
  }
  return undefined;
}

function compareScalarSchemaRestrictions(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  mode: "request" | "response",
  schemaPath: string,
): string | undefined {
  for (const keyword of ["pattern", "format", "multipleOf"] as const) {
    if (stableJson(baseline[keyword]) === stableJson(current[keyword])) continue;
    const before = baseline[keyword] === undefined ? [] : [stableJson(baseline[keyword])];
    const after = current[keyword] === undefined ? [] : [stableJson(current[keyword])];
    if (before.length > 0 && after.length > 0) {
      return `${schemaPath}.${keyword} changed; compatibility cannot be proven.`;
    }
    if (restrictionChangedIncompatibly(before, after, mode)) {
      return `${schemaPath}.${keyword} changed incompatibly.`;
    }
  }

  const beforeNullable = baseline.nullable === true;
  const afterNullable = current.nullable === true;
  if (
    (mode === "request" && beforeNullable && !afterNullable) ||
    (mode === "response" && !beforeNullable && afterNullable)
  ) {
    return `${schemaPath}.nullable changed incompatibly.`;
  }
  if (mode === "request" && baseline.readOnly !== true && current.readOnly === true) {
    return `${schemaPath}.readOnly now rejects request input.`;
  }
  if (mode === "response" && baseline.writeOnly !== true && current.writeOnly === true) {
    return `${schemaPath}.writeOnly removes response output.`;
  }
  return undefined;
}

function compareSchemaLimits(
  baseline: Record<string, unknown>,
  current: Record<string, unknown>,
  mode: "request" | "response",
  schemaPath: string,
): string | undefined {
  const checks: Array<[string, "min" | "max"]> = [
    ["minimum", "min"],
    ["exclusiveMinimum", "min"],
    ["minLength", "min"],
    ["minItems", "min"],
    ["minProperties", "min"],
    ["maximum", "max"],
    ["exclusiveMaximum", "max"],
    ["maxLength", "max"],
    ["maxItems", "max"],
    ["maxProperties", "max"],
  ];
  for (const [keyword, direction] of checks) {
    const before = numberValue(baseline[keyword]);
    const after = numberValue(current[keyword]);
    if (before === after) continue;
    const narrowed =
      before === undefined
        ? after !== undefined
        : after === undefined
          ? false
          : direction === "min"
            ? after > before
            : after < before;
    const incompatible = mode === "request" ? narrowed : !narrowed;
    if (incompatible) return `${schemaPath}.${keyword} changed incompatibly.`;
  }
  if (
    typeof baseline.pattern === "string" &&
    typeof current.pattern === "string" &&
    baseline.pattern !== current.pattern
  ) {
    return `${schemaPath}.pattern changed; compatibility cannot be proven.`;
  }
  return undefined;
}

function normalizeSchema(document: Record<string, unknown>, value: unknown): unknown {
  return normalizeSchemaValue(document, value, new Set());
}

function normalizeSchemaValue(
  document: Record<string, unknown>,
  value: unknown,
  references: Set<string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeSchemaValue(document, entry, references));
  }
  const record = asRecord(value);
  if (!record) return value;
  const reference = typeof record.$ref === "string" ? record.$ref : undefined;
  if (reference?.startsWith("#/")) {
    if (references.has(reference)) return { $ref: reference };
    const target = resolvePointer(document, reference.slice(1));
    if (target !== undefined) {
      const nextReferences = new Set(references).add(reference);
      const siblings = Object.fromEntries(Object.entries(record).filter(([key]) => key !== "$ref"));
      const resolved = normalizeSchemaValue(document, target, nextReferences);
      const resolvedRecord = asRecord(resolved);
      return resolvedRecord
        ? normalizeSchemaValue(document, { ...resolvedRecord, ...siblings }, nextReferences)
        : resolved;
    }
  }
  return Object.fromEntries(
    Object.keys(record)
      .filter((key) => !SCHEMA_ANNOTATION_KEYS.has(key))
      .sort()
      .map((key) => [key, normalizeSchemaValue(document, record[key], references)]),
  );
}

function summarizeSource(
  source: string,
  model: ReturnType<typeof buildNormalizedOpenApiModel>,
): OpenApiDiffSourceSummary {
  return {
    source,
    title: model.title,
    version: model.version,
    specificationVersion: model.specificationVersion,
    operationCount: model.operationCount,
  };
}

function printOpenApiDiffReport(report: OpenApiDiffReport): void {
  console.log(`${pc.bold("@farming-labs/docs")} ${pc.dim("—")} ${pc.bold("openapi diff")}`);
  console.log();
  console.log(
    `${pc.bold("Baseline:")} ${report.baseline.source} ${pc.dim(`(${report.baseline.version}, ${report.baseline.operationCount} operations)`)}`,
  );
  console.log(
    `${pc.bold("Current:")}  ${report.current.source} ${pc.dim(`(${report.current.version}, ${report.current.operationCount} operations)`)}`,
  );
  console.log(
    `${pc.bold("Changes:")} ${report.breakingCount} breaking ${pc.dim("•")} ${report.nonBreakingCount} non-breaking`,
  );
  if (report.changes.length === 0) {
    console.log();
    console.log(pc.green("No contract changes found."));
    return;
  }
  for (const severity of ["breaking", "non-breaking"] as const) {
    const entries = report.changes.filter((entry) => entry.severity === severity);
    if (entries.length === 0) continue;
    console.log();
    console.log(
      severity === "breaking" ? pc.red(pc.bold("BREAKING")) : pc.cyan(pc.bold("NON-BREAKING")),
    );
    for (const entry of entries) {
      const target = entry.selector ? `${entry.selector}: ` : "";
      console.log(`- ${pc.dim(`[${entry.kind}]`)} ${target}${entry.detail}`);
    }
  }
}

export function printOpenApiDiffHelp(): void {
  console.log(`${pc.bold("docs openapi diff")} — Compare two OpenAPI contracts.

Usage:
  docs openapi diff <baseline> <current> [options]
  docs api diff --base <baseline> --head <current> [options]

Sources:
  Project-relative or absolute JSON/YAML files, file: URLs, and HTTP(S) URLs.

Options:
  ${pc.cyan("--base, --baseline <source>")}  Baseline contract
  ${pc.cyan("--head, --current <source>")}  Current contract
  ${pc.cyan("--base-url <url>")}            Resolve request-relative remote sources
  ${pc.cyan("--fail-on <policy>")}          breaking (default), any, or never
  ${pc.cyan("--json")}                      Print ${pc.dim("farming-labs-openapi-diff.v1")} JSON
  ${pc.cyan("--help")}                      Show this help
`);
}

function change(
  severity: OpenApiDiffSeverity,
  kind: string,
  selector: string,
  detail: string,
  location?: string,
): OpenApiDiffChange {
  return { severity, kind, selector, detail, ...(location ? { location } : {}) };
}

function compareChanges(left: OpenApiDiffChange, right: OpenApiDiffChange): number {
  if (left.severity !== right.severity) return left.severity === "breaking" ? -1 : 1;
  return `${left.selector ?? ""}\0${left.kind}\0${left.location ?? ""}`.localeCompare(
    `${right.selector ?? ""}\0${right.kind}\0${right.location ?? ""}`,
  );
}

function parameterKey(parameter: NormalizedOpenApiParameter): string {
  return `${parameter.in}:${parameter.name}`;
}

function normalizeTypes(value: unknown): string[] {
  if (typeof value === "string") return [value];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").sort()
    : [];
}

function restrictionChangedIncompatibly(
  baseline: string[],
  current: string[],
  mode: "request" | "response",
): boolean {
  if (baseline.length === 0 && current.length === 0) return false;
  if (mode === "request") {
    if (baseline.length === 0) return current.length > 0;
    if (current.length === 0) return false;
    return baseline.some((value) => !current.includes(value));
  }
  if (current.length === 0) return baseline.length > 0;
  if (baseline.length === 0) return false;
  return current.some((value) => !baseline.includes(value));
}

function normalizeSecurityForDiff(security: Array<Record<string, string[]>>): string {
  return security
    .map((requirement) =>
      stableJson(
        Object.fromEntries(
          Object.keys(requirement)
            .sort()
            .map((name) => [name, [...(requirement[name] ?? [])].sort()]),
        ),
      ),
    )
    .sort()
    .join("|");
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = asRecord(value);
  if (record) {
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function resolvePointer(document: Record<string, unknown>, pointer: string): unknown {
  let current: unknown = document;
  for (const token of pointer.slice(1).split("/")) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[token.replaceAll("~1", "/").replaceAll("~0", "~")];
  }
  return current;
}
