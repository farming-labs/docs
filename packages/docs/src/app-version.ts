import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The `version` field of the app's `package.json`, which adapters report as the
 * MCP server version when `mcp.version` is not set. Returns `undefined` when the
 * file is missing (a deployed function often ships without it), unreadable, or
 * has no usable version, so callers fall back instead of failing to start.
 */
export function readDocsAppVersion(rootDir: string): string | undefined {
  try {
    // Keep bundlers from tracing every package.json reachable from a dynamic root.
    const manifestPath = /*! turbopackIgnore: true */ path.join(
      /*! turbopackIgnore: true */ rootDir,
      "package.json",
    );
    const manifest = JSON.parse(
      readFileSync(/*! turbopackIgnore: true */ manifestPath, "utf8"),
    ) as {
      version?: unknown;
    } | null;
    const version = manifest?.version;
    return typeof version === "string" && version.trim() ? version.trim() : undefined;
  } catch {
    return undefined;
  }
}
