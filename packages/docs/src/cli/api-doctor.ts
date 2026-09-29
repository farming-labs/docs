import path from "node:path";
import {
  buildApiReferenceOperationPagesAsync,
  loadApiReferenceOpenApiDocumentAsync,
  resolveApiReferenceConfig,
  resolveApiReferenceRenderer,
  type ApiReferenceFramework,
} from "../api-reference.js";
import { validateOpenApiContract } from "../openapi-contract.js";
import { buildNormalizedOpenApiModel } from "../openapi-operations.js";
import type { DocsConfig } from "../types.js";
import {
  loadDocsConfigModuleResultWithProjectEnv,
  resolveDocsConfigPath,
  resolveDocsProjectRoot,
} from "./config.js";
import { detectFramework, type Framework } from "./utils.js";

export type ApiDoctorStatus = "pass" | "warn" | "fail";

export interface ApiDoctorCheck {
  id: string;
  title: string;
  detail: string;
  status: ApiDoctorStatus;
  recommendation?: string;
}

export interface ApiDoctorSourceReport {
  id: string;
  label: string;
  default: boolean;
  source: string;
  sourceType: "generated" | "local" | "remote";
  overlays: number;
  status: "pass" | "fail";
  specificationVersion?: string;
  operationCount: number;
  diagnostic?: string;
}

export interface ApiDoctorReport {
  mode: "api";
  framework: Framework | "unknown";
  configPath?: string;
  enabled: boolean;
  renderer?: string;
  defaultVersion?: string;
  sourceCount: number;
  operationCount: number;
  checks: ApiDoctorCheck[];
  sources: ApiDoctorSourceReport[];
  recommendations: string[];
}

export interface ApiDoctorOptions {
  configPath?: string;
  baseUrl?: string;
}

interface LoadedApiSource {
  report: ApiDoctorSourceReport;
  operationIds: string[];
  operationSlugs: string[];
}

function makeCheck(
  id: string,
  title: string,
  status: ApiDoctorStatus,
  detail: string,
  recommendation?: string,
): ApiDoctorCheck {
  return { id, title, status, detail, recommendation };
}

function toApiReferenceFramework(framework: Framework): ApiReferenceFramework {
  return framework === "nextjs" ? "next" : framework;
}

function sourceType(source: string | undefined): ApiDoctorSourceReport["sourceType"] {
  if (!source) return "generated";
  if (/^https?:/i.test(source) || source.startsWith("/")) return "remote";
  return "local";
}

function displaySource(source: string | undefined, routeRoot: string): string {
  if (!source) return `generated:${routeRoot}`;
  if (source.startsWith("/")) return source.split(/[?#]/, 1)[0] || "/";
  if (!/^https?:/i.test(source)) return source;

  try {
    const url = new URL(source);
    url.username = url.username ? "redacted" : "";
    url.password = url.password ? "redacted" : "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "configured remote source";
  }
}

function unique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function failedReport(
  framework: Framework | "unknown",
  detail: string,
  recommendation: string,
): ApiDoctorReport {
  const checks = [makeCheck("config", "API reference config", "fail", detail, recommendation)];
  return {
    mode: "api",
    framework,
    enabled: false,
    sourceCount: 0,
    operationCount: 0,
    checks,
    sources: [],
    recommendations: [recommendation],
  };
}

export async function inspectApiReferenceHealth(
  options: ApiDoctorOptions = {},
): Promise<ApiDoctorReport> {
  const invocationRoot = process.cwd();
  let configPath: string;
  let rootDir: string;
  let framework: Framework | "unknown" = "unknown";

  try {
    configPath = resolveDocsConfigPath(invocationRoot, options.configPath);
    rootDir = resolveDocsProjectRoot(invocationRoot, configPath);
    framework = detectFramework(rootDir) ?? "unknown";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    framework = detectFramework(invocationRoot) ?? "unknown";
    return failedReport(
      framework,
      message,
      "Add docs.config.ts[x] or pass --config so the API doctor can inspect the contract.",
    );
  }

  const configLoad = await loadDocsConfigModuleResultWithProjectEnv(rootDir, configPath);
  if (configLoad.status !== "evaluated") {
    return {
      ...failedReport(
        framework,
        `Could not evaluate ${path.relative(rootDir, configPath).replace(/\\/g, "/")}. ${configLoad.error}`,
        "Fix docs.config module evaluation so API sources, versions, overlays, and renderer settings can be validated.",
      ),
      configPath: path.relative(rootDir, configPath).replace(/\\/g, "/"),
    };
  }

  const config = configLoad.config as DocsConfig;
  let apiReference: ReturnType<typeof resolveApiReferenceConfig>;
  try {
    apiReference = resolveApiReferenceConfig(config.apiReference);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...failedReport(
        framework,
        message,
        "Correct the apiReference configuration, then rerun docs doctor --api.",
      ),
      configPath: path.relative(rootDir, configPath).replace(/\\/g, "/"),
    };
  }

  const relativeConfigPath = path.relative(rootDir, configPath).replace(/\\/g, "/");
  if (!apiReference.enabled) {
    const recommendation =
      "Enable apiReference when this project should publish an OpenAPI contract and generated operation documentation.";
    return {
      mode: "api",
      framework,
      configPath: relativeConfigPath,
      enabled: false,
      sourceCount: 0,
      operationCount: 0,
      checks: [
        makeCheck(
          "config",
          "API reference config",
          "warn",
          "apiReference is disabled; there is no API contract to inspect.",
          recommendation,
        ),
      ],
      sources: [],
      recommendations: [recommendation],
    };
  }

  if (framework === "unknown") {
    return {
      ...failedReport(
        framework,
        "Could not detect a supported framework from package.json.",
        "Install or declare Next.js, TanStack Start, Farm.js, SvelteKit, Astro, or Nuxt in the docs app package.",
      ),
      configPath: relativeConfigPath,
      enabled: true,
    };
  }

  const apiFramework = toApiReferenceFramework(framework);
  const renderer = resolveApiReferenceRenderer(config.apiReference, apiFramework);
  const configuredSources =
    apiReference.versions.length > 0
      ? apiReference.versions.map((version) => ({
          id: version.id,
          label: version.label,
          default: version.default,
          specUrl: version.specUrl,
          overlays: version.overlays,
        }))
      : [
          {
            id: "default",
            label: "Default",
            default: true,
            specUrl: apiReference.specUrl,
            overlays: apiReference.overlays,
          },
        ];

  const loadedSources: LoadedApiSource[] = await Promise.all(
    configuredSources.map(async (source) => {
      const baseReport: ApiDoctorSourceReport = {
        id: source.id,
        label: source.label,
        default: source.default,
        source: displaySource(source.specUrl, apiReference.routeRoot),
        sourceType: sourceType(source.specUrl),
        overlays: source.overlays.length,
        status: "fail",
        operationCount: 0,
      };

      try {
        const document = await loadApiReferenceOpenApiDocumentAsync(config, {
          framework: apiFramework,
          rootDir,
          baseUrl: options.baseUrl,
          version: apiReference.versions.length > 0 ? source.id : undefined,
        });
        const validation = validateOpenApiContract(document);
        if (!validation.valid) {
          const first = validation.diagnostics[0];
          throw new Error(
            first ? `${first.path}: ${first.message}` : "The resolved OpenAPI document is invalid.",
          );
        }
        const model = buildNormalizedOpenApiModel(document);
        return {
          report: {
            ...baseReport,
            status: "pass" as const,
            specificationVersion: model.specificationVersion,
            operationCount: model.operationCount,
          },
          operationIds: model.operations.map((operation) => operation.operationId),
          operationSlugs: model.operations.map((operation) => operation.slug),
        };
      } catch (error) {
        return {
          report: {
            ...baseReport,
            diagnostic: error instanceof Error ? error.message : String(error),
          },
          operationIds: [],
          operationSlugs: [],
        };
      }
    }),
  );

  const sources = loadedSources.map((source) => source.report);
  const failedSources = sources.filter((source) => source.status === "fail");
  const operationCount = sources.reduce((total, source) => total + source.operationCount, 0);
  const checks: ApiDoctorCheck[] = [
    makeCheck(
      "config",
      "API reference config",
      "pass",
      `Evaluated ${relativeConfigPath}; API reference is enabled at /${apiReference.path}.`,
    ),
    makeCheck(
      "versions",
      "Versions and default",
      "pass",
      apiReference.versions.length > 0
        ? `Resolved ${apiReference.versions.length} named versions with ${apiReference.defaultVersion} as the explicit default.`
        : "Resolved one unversioned API contract.",
    ),
  ];

  checks.push(
    failedSources.length === 0
      ? makeCheck(
          "sources",
          "Sources, references, and overlays",
          "pass",
          `Loaded ${sources.length} ${sources.length === 1 ? "contract" : "contracts"}, resolved references, and applied ${sources.reduce((total, source) => total + source.overlays, 0)} configured overlays.`,
        )
      : makeCheck(
          "sources",
          "Sources, references, and overlays",
          "fail",
          failedSources
            .map((source) => `${source.label}: ${source.diagnostic ?? "unknown error"}`)
            .join(" "),
          "Fix the reported source, parsing, reference, validation, or overlay error and rerun docs doctor --api.",
        ),
  );

  const identityFailure = loadedSources.find(
    (source) => !unique(source.operationIds) || !unique(source.operationSlugs),
  );
  checks.push(
    identityFailure
      ? makeCheck(
          "operation-identities",
          "Operation IDs and slugs",
          "fail",
          `${identityFailure.report.label} produced duplicate normalized operation IDs or slugs.`,
          "Give every operation a stable, unique operationId and remove normalized slug collisions.",
        )
      : makeCheck(
          "operation-identities",
          "Operation IDs and slugs",
          failedSources.length > 0 ? "warn" : "pass",
          failedSources.length > 0
            ? "Operation identities could only be checked for contracts that loaded successfully."
            : `Validated ${operationCount} unique normalized operation identities across ${sources.length} ${sources.length === 1 ? "contract" : "contracts"}.`,
        ),
  );

  const rendererCompatible = renderer !== "fumadocs" || framework === "nextjs";
  checks.push(
    rendererCompatible
      ? makeCheck(
          "renderer",
          "Renderer compatibility",
          "pass",
          `${renderer} is supported by ${framework}.`,
        )
      : makeCheck(
          "renderer",
          "Renderer compatibility",
          "fail",
          `The fumadocs renderer is only available for Next.js; ${framework} supports the Farming Labs and Scalar renderers.`,
          'Set apiReference.renderer to "farming-labs" or "scalar" for this framework.',
        ),
  );

  if (failedSources.length === 0 && !identityFailure) {
    try {
      const pages = await buildApiReferenceOperationPagesAsync(config, {
        framework: apiFramework,
        rootDir,
        baseUrl: options.baseUrl,
      });
      const pageUrls = pages.map((page) => page.url);
      const completePages = pages.every(
        (page) => page.type === "api" && page.canonicalUrl === page.url && Boolean(page.content),
      );
      const parity = pages.length === operationCount && unique(pageUrls) && completePages;
      checks.push(
        parity
          ? makeCheck(
              "surface-parity",
              "Generated surface parity",
              "pass",
              `${pages.length} normalized operations produce ${pages.length} unique search, Ask AI, Markdown, and read-only MCP documents.`,
            )
          : makeCheck(
              "surface-parity",
              "Generated surface parity",
              "fail",
              `Normalized contracts contain ${operationCount} operations, but generated projections contain ${pages.length} complete unique documents.`,
              "Regenerate operation projections from the normalized model and make their URLs and canonical metadata unique.",
            ),
      );
    } catch (error) {
      checks.push(
        makeCheck(
          "surface-parity",
          "Generated surface parity",
          "fail",
          error instanceof Error ? error.message : String(error),
          "Fix operation projection generation and rerun docs doctor --api.",
        ),
      );
    }
  } else {
    checks.push(
      makeCheck(
        "surface-parity",
        "Generated surface parity",
        "warn",
        "Generated projections were not checked because one or more contracts failed validation.",
      ),
    );
  }

  const recommendations = checks
    .map((check) => check.recommendation)
    .filter((recommendation): recommendation is string => Boolean(recommendation));

  return {
    mode: "api",
    framework,
    configPath: relativeConfigPath,
    enabled: true,
    renderer,
    defaultVersion: apiReference.defaultVersion,
    sourceCount: sources.length,
    operationCount,
    checks,
    sources,
    recommendations,
  };
}
