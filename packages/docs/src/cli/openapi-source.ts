import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadApiReferenceOpenApiDocumentAsync } from "../api-reference.js";
import type { DocsConfig } from "../types.js";

export interface LoadOpenApiCliSourceOptions {
  rootDir?: string;
  baseUrl?: string;
}

export async function loadOpenApiCliSource(
  source: string,
  options: LoadOpenApiCliSourceOptions = {},
): Promise<Record<string, unknown>> {
  const rootDir = path.resolve(options.rootDir ?? process.cwd());
  const localPath = path.isAbsolute(source) ? source : path.resolve(rootDir, source);
  const specUrl =
    existsSync(localPath) && path.isAbsolute(source) ? pathToFileURL(localPath).href : source;
  const config: DocsConfig = {
    entry: "docs",
    apiReference: { enabled: true, specUrl },
  };
  return loadApiReferenceOpenApiDocumentAsync(config, {
    framework: "next",
    rootDir,
    baseUrl: options.baseUrl,
  });
}

export function displayOpenApiCliSource(source: string): string {
  if (!/^https?:/i.test(source)) return source;
  try {
    const url = new URL(source);
    url.username = url.username ? "redacted" : "";
    url.password = url.password ? "redacted" : "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "remote OpenAPI source";
  }
}
