import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createDocsAPI as createThemeDocsAPI,
  createDocsMCPAPI as createThemeDocsMCPAPI,
} from "@farming-labs/theme/api";
import {
  bundledAgentSkills,
  bundledAppVersion,
  bundledRootDocuments,
} from "@farming-labs/docs/agent-skills-bundle";
import type { DocsConfig } from "@farming-labs/docs";
import { createDocsRootRouter, resolveDocsRoots, withVaryReferer } from "@farming-labs/docs/server";
import type {
  DocsCloudRouteHandlerOptions,
  DocsCloudServer,
} from "@farming-labs/docs/cloud/server";
export {
  createDocsCloudRouteHandler,
  type DocsCloudRouteHandlerOptions,
  type DocsCloudRouteHandlers,
  type DocsCloudServer,
} from "@farming-labs/docs/cloud/server";

type DocsAPIOptions = NonNullable<Parameters<typeof createThemeDocsAPI>[0]>;
type DocsMCPAPIOptions = NonNullable<Parameters<typeof createThemeDocsMCPAPI>[0]>;

export interface DocsAPICloudOptions extends DocsCloudRouteHandlerOptions {
  docsCloud?: DocsCloudServer;
}

export type DocsAPICloudIntegration = DocsCloudServer | DocsAPICloudOptions;

/**
 * Resolve the app project root for a Next route module.
 *
 * This handles source routes (`app/...` or `src/app/...`) and built production
 * output (`.next/server/app/...` or custom-dist-dir `/server/app/...`).
 */
export function resolveNextProjectRoot(metaUrl: string): string {
  const filePath = fileURLToPath(metaUrl);
  let current = path.dirname(filePath);

  while (true) {
    const parent = path.dirname(current);

    if (path.basename(current) === "app") {
      if (path.basename(parent) === "src") {
        return path.dirname(parent);
      }

      if (path.basename(parent) === "server") {
        const serverParent = path.dirname(parent);
        if (path.basename(serverParent) === "dev") {
          return path.dirname(path.dirname(serverParent));
        }

        return path.dirname(serverParent);
      }

      return parent;
    }

    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}

function isNextRouteFile(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  return /\/(?:src\/)?app\/api\/.+\/route\.[cm]?[jt]sx?$/.test(normalized);
}

function inferNextProjectRootFromCaller(): string | undefined {
  const previousPrepareStackTrace = Error.prepareStackTrace;

  try {
    Error.prepareStackTrace = (_error, stack) => stack;
    const error = new Error();

    Error.captureStackTrace?.(error, inferNextProjectRootFromCaller);

    const stack = error.stack as unknown as NodeJS.CallSite[] | undefined;

    for (const frame of stack ?? []) {
      const fileName = frame.getFileName?.();
      if (!fileName || !isNextRouteFile(fileName)) continue;

      return resolveNextProjectRoot(pathToFileURL(fileName).href);
    }
  } catch {
    // fall through to default handler behavior
  } finally {
    Error.prepareStackTrace = previousPrepareStackTrace;
  }

  return undefined;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeAction(value: string | null | undefined): string | undefined {
  return value?.trim().toLowerCase().replace(/_/g, "-") || undefined;
}

function isDocsCloudServer(value: unknown): value is DocsCloudServer {
  return isRecord(value) && typeof value.handleRequest === "function";
}

function resolveDocsCloudIntegration(integration?: DocsAPICloudIntegration):
  | {
      docsCloud: DocsCloudServer;
      routeOptions: DocsCloudRouteHandlerOptions;
    }
  | undefined {
  if (!integration) return undefined;

  if (isDocsCloudServer(integration)) {
    return { docsCloud: integration, routeOptions: {} };
  }

  if (!integration.docsCloud) return undefined;

  return {
    docsCloud: integration.docsCloud,
    routeOptions: {
      locale: integration.locale,
      publicBaseUrl: integration.publicBaseUrl,
    },
  };
}

function isDocsCloudGetRequest(request: Request): boolean {
  const url = new URL(request.url);
  const cloud = normalizeAction(url.searchParams.get("cloud"));
  const action = normalizeAction(url.searchParams.get("action"));
  const format = normalizeAction(url.searchParams.get("format"));

  return (
    cloud === "config" ||
    cloud === "public-config" ||
    action === "cloud-config" ||
    action === "docs-cloud-config" ||
    format === "cloud-config" ||
    format === "docs-cloud-config"
  );
}

function isDocsCloudAction(action: string | undefined): boolean {
  return Boolean(
    action &&
    ["analytics", "track", "track-event", "event", "ask-ai", "ai", "chat", "docs-cloud"].includes(
      action,
    ),
  );
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.clone().json();
  } catch {
    return undefined;
  }
}

async function isDocsCloudPostRequest(request: Request): Promise<boolean> {
  const url = new URL(request.url);
  const cloud = normalizeAction(url.searchParams.get("cloud"));
  const action = normalizeAction(url.searchParams.get("action"));

  if (isDocsCloudAction(cloud) || isDocsCloudAction(action)) return true;

  const body = await readJson(request);
  if (!isRecord(body)) return false;

  const bodyAction = normalizeAction(typeof body.action === "string" ? body.action : undefined);
  if (isDocsCloudAction(bodyAction)) return true;

  if (typeof body.type === "string") return true;
  if (isRecord(body.event) && typeof body.event.type === "string") return true;
  if (isRecord(body.payload) && typeof body.payload.type === "string") return true;

  return false;
}

/**
 * Route handlers for `/api/docs`. When the config lists `roots`, each root gets its own handlers:
 * a request goes to the root named by `?root=`, then by `?pathname=`, then by the Referer's page
 * (answered with `Vary: Referer`), and otherwise to the first root.
 */
export function createDocsAPI(
  options: DocsAPIOptions & Pick<DocsConfig, "roots"> = {},
  cloudIntegration?: DocsAPICloudIntegration,
) {
  const rootDir = options.rootDir ?? inferNextProjectRootFromCaller();
  if (!options.roots?.length) return createDocsRootAPI(options, rootDir, cloudIntegration);

  const configs = resolveDocsRoots(options as DocsConfig).map((config, index) => {
    const entry = config.entry ?? "docs";
    const docsPath = index === 0 ? config.docsPath : (config.docsPath ?? `/${entry}`);
    const path = docsPath?.replace(/^\/+|\/+$/g, "") || entry;
    // The theme API reads docs.config for any field left out, so a root's own docsPath must be set.
    return { path, config: { ...config, docsPath } as DocsAPIOptions };
  });
  const router = createDocsRootRouter(
    configs.map(({ path }, index) => ({ entry: path, index })),
    { apiRoute: options.apiRoute ?? options.cloud?.apiRoute },
  );
  const apis = configs.map(({ config }) => createDocsRootAPI(config, rootDir, cloudIntegration));
  const dispatch =
    (method: "GET" | "HEAD" | "POST") =>
    async (request: Request): Promise<Response> => {
      const { root, varyReferer } = router.select(request);
      const response = await apis[root.index]![method](request);
      return varyReferer ? withVaryReferer(response) : response;
    };

  return { GET: dispatch("GET"), HEAD: dispatch("HEAD"), POST: dispatch("POST") };
}

function createDocsRootAPI(
  options: DocsAPIOptions,
  rootDir: string | undefined,
  cloudIntegration?: DocsAPICloudIntegration,
) {
  const resolvedOptions = {
    ...options,
    ...(rootDir ? { rootDir } : {}),
    _preloadedAgentSkills: options._preloadedAgentSkills ?? bundledAgentSkills,
    _preloadedRootDocuments: options._preloadedRootDocuments ?? bundledRootDocuments,
    _preloadedAppVersion: options._preloadedAppVersion ?? bundledAppVersion,
  };
  const handlers = createThemeDocsAPI(resolvedOptions);
  const integration = resolveDocsCloudIntegration(cloudIntegration);

  if (!integration) return handlers;

  return {
    GET(request: Request) {
      if (isDocsCloudGetRequest(request)) {
        return integration.docsCloud.handleRequest(request, integration.routeOptions);
      }

      return handlers.GET(request);
    },
    async HEAD(request: Request) {
      if (!isDocsCloudGetRequest(request)) return handlers.HEAD(request);
      const response = await integration.docsCloud.handleRequest(request, integration.routeOptions);
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    },
    async POST(request: Request) {
      if (await isDocsCloudPostRequest(request)) {
        return integration.docsCloud.handleRequest(request, integration.routeOptions);
      }

      return handlers.POST(request);
    },
  };
}

export function createDocsMCPAPI(options: DocsMCPAPIOptions = {}) {
  const rootDir = options.rootDir ?? inferNextProjectRootFromCaller();
  return createThemeDocsMCPAPI({
    ...options,
    ...(rootDir ? { rootDir } : {}),
    _preloadedAgentSkills: options._preloadedAgentSkills ?? bundledAgentSkills,
    _preloadedRootDocuments: options._preloadedRootDocuments ?? bundledRootDocuments,
    _preloadedAppVersion: options._preloadedAppVersion ?? bundledAppVersion,
  });
}
