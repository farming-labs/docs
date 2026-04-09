import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDocsAPI, createDocsMCPAPI } from "@farming-labs/theme/api";

export { createDocsAPI, createDocsMCPAPI } from "@farming-labs/theme/api";

/**
 * Resolve the Next.js project root for app route handlers in both dev/source
 * paths and deployed `.next/server/...` output.
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

      if (path.basename(parent) === "server" && path.basename(path.dirname(parent)) === ".next") {
        return path.dirname(path.dirname(parent));
      }

      return parent;
    }

    if (parent === current) {
      return process.cwd();
    }

    current = parent;
  }
}
