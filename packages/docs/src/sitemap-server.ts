import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { resolveDocsSitemapConfig, type DocsSitemapManifest } from "./sitemap.js";
import type { DocsSitemapConfig } from "./types.js";

export function readDocsSitemapManifest(
  rootDir: string,
  sitemap?: boolean | DocsSitemapConfig,
): DocsSitemapManifest | null {
  const resolved = resolveDocsSitemapConfig(sitemap);
  const manifestPath = path.resolve(rootDir, resolved.manifestPath);
  if (!existsSync(manifestPath)) return null;

  try {
    return JSON.parse(readFileSync(manifestPath, "utf-8")) as DocsSitemapManifest;
  } catch {
    return null;
  }
}
