export interface AgentSurfaceSchemaOption {
  path: string;
  children?: readonly AgentSurfaceSchemaOption[];
}

export interface AgentSurfaceExpectedValues {
  entry: string;
  search: {
    enabled: boolean;
    endpoint: string | null;
  };
  mcp: {
    enabled: boolean;
    endpoint: string | null;
    tools: Readonly<Record<string, boolean>>;
    protectedResource?: {
      metadataEndpoints: readonly string[];
      authorizationServers: readonly string[];
      scopesSupported: readonly string[];
      requiredScopes: readonly string[];
    } | null;
  };
  /**
   * Discovery dot paths whose values must match their resolved runtime values.
   * For example, `api.docs`, `api.config`, or `config.endpoint`.
   */
  routes: Readonly<Record<string, string | null>>;
}

export interface AnalyzeAgentSurfaceDriftOptions {
  /** Config paths present in the resolved config map, expressed as dot paths. */
  configOptionPaths: readonly string[];
  /** Published config schema options. Child options are traversed recursively. */
  schemaOptions: readonly AgentSurfaceSchemaOption[];
  /** Canonical top-level fields in the page agent contract. */
  agentContractFields: readonly string[];
  /** Agent discovery document to inspect. */
  discovery: unknown;
  /** Values resolved independently from docs.config and runtime defaults. */
  expected: AgentSurfaceExpectedValues;
}

export type AgentSurfaceDriftCode =
  | "config-schema-omission"
  | "agent-contract-field-missing"
  | "agent-contract-field-unexpected"
  | "entry-mismatch"
  | "search-enabled-mismatch"
  | "search-capability-mismatch"
  | "search-route-mismatch"
  | "mcp-enabled-mismatch"
  | "mcp-capability-mismatch"
  | "mcp-route-mismatch"
  | "mcp-protected-resource-mismatch"
  | "mcp-tool-mismatch"
  | "mcp-tool-unexpected"
  | "route-mismatch";

export interface AgentSurfaceDriftIssue {
  code: AgentSurfaceDriftCode;
  /** Config or discovery dot path associated with the issue. */
  path: string;
  /** Stable, display-ready representation of the expected value. */
  expected: string;
  /** Stable, display-ready representation of the discovered value. */
  actual: string;
  message: string;
}

interface PathValue {
  present: boolean;
  value: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDotPath(value: string): string {
  const segments = value
    .trim()
    .replace(/\[\d+\]/gu, "[]")
    .replace(/^\/+|\/+$/g, "")
    .replaceAll("/", ".")
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const normalized: string[] = [];

  for (const segment of segments) {
    if (/^\d+$/u.test(segment) && normalized.length > 0) {
      normalized[normalized.length - 1] = `${normalized.at(-1)}[]`;
      continue;
    }
    normalized.push(segment);
  }

  return normalized.join(".");
}

function collectSchemaPaths(options: readonly AgentSurfaceSchemaOption[]): Set<string> {
  const paths = new Set<string>();
  const visited = new Set<AgentSurfaceSchemaOption>();

  const visit = (option: AgentSurfaceSchemaOption) => {
    if (visited.has(option)) return;
    visited.add(option);

    const optionPath = normalizeDotPath(option.path);
    if (optionPath) paths.add(optionPath);
    for (const child of option.children ?? []) visit(child);
  };

  for (const option of options) visit(option);
  return paths;
}

function schemaCoversConfigPath(schemaPaths: ReadonlySet<string>, configPath: string): boolean {
  if (schemaPaths.has(configPath)) return true;
  if (configPath.endsWith("[]") && schemaPaths.has(configPath.slice(0, -2))) return true;
  for (const schemaPath of schemaPaths) {
    if (!schemaPath.endsWith(".*")) continue;
    const prefix = schemaPath.slice(0, -1);
    if (configPath.startsWith(prefix) && configPath.length > prefix.length) return true;
  }
  return false;
}

function readPath(root: unknown, dotPath: string): PathValue {
  const normalized = normalizeDotPath(dotPath);
  if (!normalized) return { present: true, value: root };

  let current = root;
  for (const segment of normalized.split(".")) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { present: false, value: undefined };
    }
    current = current[segment];
  }

  return { present: true, value: current };
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!isRecord(value)) return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableJsonValue(value[key])]),
  );
}

function displayValue(value: unknown, present = true): string {
  if (!present || value === undefined) return "<missing>";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return String(value);
  }

  try {
    return JSON.stringify(stableJsonValue(value));
  } catch {
    return "<unserializable>";
  }
}

function valuesMatch(actual: PathValue, expected: unknown): boolean {
  if (!actual.present) return false;
  if (Object.is(actual.value, expected)) return true;
  if (
    (Array.isArray(actual.value) || isRecord(actual.value)) &&
    (Array.isArray(expected) || isRecord(expected))
  ) {
    return displayValue(actual.value) === displayValue(expected);
  }
  return false;
}

function mismatchIssue(
  code: AgentSurfaceDriftCode,
  path: string,
  expected: unknown,
  actual: PathValue,
  label: string,
): AgentSurfaceDriftIssue {
  const expectedDisplay = displayValue(expected);
  const actualDisplay = displayValue(actual.value, actual.present);
  return {
    code,
    path,
    expected: expectedDisplay,
    actual: actualDisplay,
    message: `${label} is ${actualDisplay}; expected ${expectedDisplay}.`,
  };
}

function compareExpectedValue(
  issues: AgentSurfaceDriftIssue[],
  discovery: unknown,
  code: AgentSurfaceDriftCode,
  path: string,
  expected: unknown,
  label: string,
) {
  const actual = readPath(discovery, path);
  if (!valuesMatch(actual, expected)) {
    issues.push(mismatchIssue(code, path, expected, actual, label));
  }
}

/**
 * Compare independently resolved docs values with the public agent discovery and
 * config-schema surfaces. The helper is intentionally pure so doctor, review,
 * and golden evaluations can use the same deterministic drift rules.
 */
export function analyzeAgentSurfaceDrift(
  options: AnalyzeAgentSurfaceDriftOptions,
): AgentSurfaceDriftIssue[] {
  const issues: AgentSurfaceDriftIssue[] = [];
  const schemaPaths = collectSchemaPaths(options.schemaOptions);
  const configPaths = Array.from(
    new Set(options.configOptionPaths.map(normalizeDotPath).filter(Boolean)),
  ).sort();

  for (const configPath of configPaths) {
    if (schemaCoversConfigPath(schemaPaths, configPath)) continue;
    issues.push({
      code: "config-schema-omission",
      path: configPath,
      expected: "documented schema option",
      actual: "<missing>",
      message: `Config option ${JSON.stringify(configPath)} is present but missing from the published config schema.`,
    });
  }

  const canonicalFields = Array.from(
    new Set(options.agentContractFields.map((field) => field.trim()).filter(Boolean)),
  ).sort();
  const discoveredFieldsValue = readPath(options.discovery, "agentContract.fields");
  const discoveredFields = isRecord(discoveredFieldsValue.value)
    ? Object.keys(discoveredFieldsValue.value).sort()
    : [];
  const canonicalFieldSet = new Set(canonicalFields);
  const discoveredFieldSet = new Set(discoveredFields);

  for (const field of canonicalFields) {
    if (discoveredFieldSet.has(field)) continue;
    const issuePath = `agentContract.fields.${field}`;
    issues.push({
      code: "agent-contract-field-missing",
      path: issuePath,
      expected: "canonical field",
      actual: "<missing>",
      message: `Discovery agent contract is missing canonical field ${JSON.stringify(field)}.`,
    });
  }

  for (const field of discoveredFields) {
    if (canonicalFieldSet.has(field)) continue;
    const issuePath = `agentContract.fields.${field}`;
    issues.push({
      code: "agent-contract-field-unexpected",
      path: issuePath,
      expected: "<absent>",
      actual: "declared field",
      message: `Discovery agent contract advertises non-canonical field ${JSON.stringify(field)}.`,
    });
  }

  compareExpectedValue(
    issues,
    options.discovery,
    "entry-mismatch",
    "site.entry",
    options.expected.entry,
    "Discovery site.entry",
  );

  compareExpectedValue(
    issues,
    options.discovery,
    "search-enabled-mismatch",
    "search.enabled",
    options.expected.search.enabled,
    "Discovery search.enabled",
  );
  compareExpectedValue(
    issues,
    options.discovery,
    "search-capability-mismatch",
    "capabilities.search",
    options.expected.search.enabled,
    "Discovery capabilities.search",
  );
  compareExpectedValue(
    issues,
    options.discovery,
    "search-route-mismatch",
    "search.endpoint",
    options.expected.search.endpoint,
    "Discovery search.endpoint",
  );

  compareExpectedValue(
    issues,
    options.discovery,
    "mcp-enabled-mismatch",
    "mcp.enabled",
    options.expected.mcp.enabled,
    "Discovery mcp.enabled",
  );
  compareExpectedValue(
    issues,
    options.discovery,
    "mcp-capability-mismatch",
    "capabilities.mcp",
    options.expected.mcp.enabled,
    "Discovery capabilities.mcp",
  );
  compareExpectedValue(
    issues,
    options.discovery,
    "mcp-route-mismatch",
    "mcp.endpoint",
    options.expected.mcp.endpoint,
    "Discovery mcp.endpoint",
  );

  if (options.expected.mcp.protectedResource !== undefined) {
    const expectedProtectedResource = options.expected.mcp.protectedResource;
    const discoveredProtectedResource = readPath(options.discovery, "mcp.protectedResource");
    if (expectedProtectedResource === null) {
      if (discoveredProtectedResource.present) {
        issues.push(
          mismatchIssue(
            "mcp-protected-resource-mismatch",
            "mcp.protectedResource",
            undefined,
            discoveredProtectedResource,
            "Discovery mcp.protectedResource",
          ),
        );
      }
    } else {
      for (const field of [
        "metadataEndpoints",
        "authorizationServers",
        "scopesSupported",
        "requiredScopes",
      ] as const) {
        compareExpectedValue(
          issues,
          options.discovery,
          "mcp-protected-resource-mismatch",
          `mcp.protectedResource.${field}`,
          expectedProtectedResource[field],
          `Discovery mcp.protectedResource.${field}`,
        );
      }
    }
  }

  const expectedToolNames = Object.keys(options.expected.mcp.tools).sort();
  const expectedToolSet = new Set(expectedToolNames);
  const discoveredToolsValue = readPath(options.discovery, "mcp.tools");
  const discoveredTools = isRecord(discoveredToolsValue.value) ? discoveredToolsValue.value : {};

  for (const toolName of expectedToolNames) {
    const expected = options.expected.mcp.tools[toolName];
    const path = `mcp.tools.${toolName}`;
    const actual = Object.prototype.hasOwnProperty.call(discoveredTools, toolName)
      ? { present: true, value: discoveredTools[toolName] }
      : { present: false, value: undefined };
    if (!valuesMatch(actual, expected)) {
      issues.push(mismatchIssue("mcp-tool-mismatch", path, expected, actual, `Discovery ${path}`));
    }
  }

  for (const toolName of Object.keys(discoveredTools).sort()) {
    if (expectedToolSet.has(toolName)) continue;
    const path = `mcp.tools.${toolName}`;
    issues.push({
      code: "mcp-tool-unexpected",
      path,
      expected: "<absent>",
      actual: displayValue(discoveredTools[toolName]),
      message: `Discovery MCP tools advertise unexpected tool flag ${JSON.stringify(toolName)}.`,
    });
  }

  for (const routePath of Object.keys(options.expected.routes).sort()) {
    const expected = options.expected.routes[routePath];
    compareExpectedValue(
      issues,
      options.discovery,
      "route-mismatch",
      routePath,
      expected,
      `Discovery ${routePath}`,
    );
  }

  return issues.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  );
}
