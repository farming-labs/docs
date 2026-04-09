import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createDocsAPI as createThemeDocsAPI,
  createDocsMCPAPI as createThemeDocsMCPAPI,
} from "@farming-labs/theme/api";

type DocsAPIOptions = NonNullable<Parameters<typeof createThemeDocsAPI>[0]>;
type DocsMCPAPIOptions = NonNullable<Parameters<typeof createThemeDocsMCPAPI>[0]>;

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

export function createDocsAPI(options: DocsAPIOptions = {}) {
  const rootDir = options.rootDir ?? inferNextProjectRootFromCaller();
  return createThemeDocsAPI(rootDir ? { ...options, rootDir } : options);
}

export function createDocsMCPAPI(options: DocsMCPAPIOptions = {}) {
  const rootDir = options.rootDir ?? inferNextProjectRootFromCaller();
  return createThemeDocsMCPAPI(rootDir ? { ...options, rootDir } : options);
}
