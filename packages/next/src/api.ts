import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createDocsAPI as createThemeDocsAPI,
  createDocsMCPAPI as createThemeDocsMCPAPI,
} from "@farming-labs/theme/api";
import type { DocsCloudRouteHandlerOptions, DocsCloudServer } from "@farming-labs/docs/cloud/server";
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

function resolveDocsCloudIntegration(
  integration?: DocsAPICloudIntegration,
):
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
      [
        "analytics",
        "track",
        "track-event",
        "event",
        "ask-ai",
        "ai",
        "chat",
        "docs-cloud",
      ].includes(action),
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

export function createDocsAPI(
  options: DocsAPIOptions = {},
  cloudIntegration?: DocsAPICloudIntegration,
) {
  const rootDir = options.rootDir ?? inferNextProjectRootFromCaller();
  const handlers = createThemeDocsAPI(rootDir ? { ...options, rootDir } : options);
  const integration = resolveDocsCloudIntegration(cloudIntegration);

  if (!integration) return handlers;

  return {
    GET(request: Request) {
      if (isDocsCloudGetRequest(request)) {
        return integration.docsCloud.handleRequest(request, integration.routeOptions);
      }

      return handlers.GET(request);
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
  return createThemeDocsMCPAPI(rootDir ? { ...options, rootDir } : options);
}
