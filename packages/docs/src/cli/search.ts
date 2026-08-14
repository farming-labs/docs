import { readFileSync } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import {
  buildDocsSearchDocuments,
  createAlgoliaSearchAdapter,
  createFilesystemDocsMcpSource,
  createTypesenseSearchAdapter,
} from "../server.js";
import type {
  AlgoliaDocsSearchConfig,
  DocsSearchAdapterContext,
  TypesenseDocsSearchConfig,
} from "../types.js";
import { resolveDocsI18n } from "../i18n.js";
import { resolveDocsMetadataBaseUrl } from "../metadata.js";
import {
  loadDocsConfigModuleResultWithProjectEnv,
  loadProjectEnv,
  readTopLevelStringProperty,
  resolveDocsConfigPath,
  resolveDocsContentDir,
} from "./config.js";

type SearchSyncProvider = "typesense" | "algolia";

export interface SearchSyncOptions {
  configPath?: string;
  provider?: string;
  typesense?: boolean;
  algolia?: boolean;
  baseUrl?: string;
  siteUrl?: string;
  collection?: string;
  apiKey?: string;
  adminApiKey?: string;
  mode?: string;
  ollamaModel?: string;
  ollamaBaseUrl?: string;
  appId?: string;
  indexName?: string;
  searchApiKey?: string;
  syncNamespace?: string;
}

function getEnvValue(loadedEnv: Record<string, string>, key: string): string | undefined {
  return process.env[key] ?? loadedEnv[key];
}

export function resolveSearchSyncProvider(
  options: SearchSyncOptions,
  loadedEnv: Record<string, string>,
): SearchSyncProvider {
  if (options.typesense && options.algolia) {
    throw new Error("Use only one provider flag: --typesense or --algolia.");
  }

  if (options.typesense) return "typesense";
  if (options.algolia) return "algolia";

  if (options.provider === "typesense" || options.provider === "algolia") {
    return options.provider;
  }

  if (options.provider) {
    throw new Error(`Unsupported search provider: ${options.provider}.`);
  }

  if (options.baseUrl || getEnvValue(loadedEnv, "TYPESENSE_URL")) return "typesense";
  if (options.appId || getEnvValue(loadedEnv, "ALGOLIA_APP_ID")) return "algolia";

  throw new Error(
    "Could not determine a search provider. Use --typesense, --algolia, or --provider <name>.",
  );
}

export function resolveTypesenseSyncConfig(
  options: SearchSyncOptions,
  loadedEnv: Record<string, string>,
): TypesenseDocsSearchConfig {
  const baseUrl =
    options.baseUrl ??
    getEnvValue(loadedEnv, "TYPESENSE_URL") ??
    getEnvValue(loadedEnv, "TYPESENSE_BASE_URL");
  const collection = options.collection ?? getEnvValue(loadedEnv, "TYPESENSE_COLLECTION") ?? "docs";
  const apiKey =
    options.apiKey ??
    getEnvValue(loadedEnv, "TYPESENSE_SEARCH_API_KEY") ??
    getEnvValue(loadedEnv, "TYPESENSE_API_KEY");
  const adminApiKey =
    options.adminApiKey ??
    getEnvValue(loadedEnv, "TYPESENSE_ADMIN_API_KEY") ??
    getEnvValue(loadedEnv, "TYPESENSE_API_KEY");
  const mode = options.mode === "hybrid" ? "hybrid" : "keyword";
  const ollamaModel = options.ollamaModel ?? getEnvValue(loadedEnv, "TYPESENSE_OLLAMA_MODEL");
  const ollamaBaseUrl =
    options.ollamaBaseUrl ?? getEnvValue(loadedEnv, "TYPESENSE_OLLAMA_BASE_URL");
  const syncNamespace =
    options.syncNamespace ?? getEnvValue(loadedEnv, "DOCS_SEARCH_SYNC_NAMESPACE");

  if (!baseUrl) {
    throw new Error("Missing Typesense base URL. Set TYPESENSE_URL or pass --base-url.");
  }

  if (!apiKey) {
    throw new Error("Missing Typesense API key. Set TYPESENSE_API_KEY or pass --api-key.");
  }

  if (!adminApiKey) {
    throw new Error(
      "Missing Typesense admin-capable key for sync. Set TYPESENSE_ADMIN_API_KEY or pass --admin-api-key.",
    );
  }

  return {
    provider: "typesense",
    baseUrl,
    collection,
    apiKey,
    adminApiKey,
    mode,
    ...(syncNamespace ? { syncNamespace } : {}),
    ...(mode === "hybrid"
      ? ollamaModel
        ? {
            embeddings: {
              provider: "ollama" as const,
              model: ollamaModel,
              baseUrl: ollamaBaseUrl,
            },
          }
        : (() => {
            throw new Error(
              "Typesense hybrid sync needs an embeddings model. Set TYPESENSE_OLLAMA_MODEL or pass --ollama-model.",
            );
          })()
      : {}),
  };
}

export function resolveAlgoliaSyncConfig(
  options: SearchSyncOptions,
  loadedEnv: Record<string, string>,
): AlgoliaDocsSearchConfig {
  const appId = options.appId ?? getEnvValue(loadedEnv, "ALGOLIA_APP_ID");
  const indexName = options.indexName ?? getEnvValue(loadedEnv, "ALGOLIA_INDEX_NAME") ?? "docs";
  const adminApiKey = options.adminApiKey ?? getEnvValue(loadedEnv, "ALGOLIA_ADMIN_API_KEY");
  const searchApiKey =
    options.searchApiKey ?? getEnvValue(loadedEnv, "ALGOLIA_SEARCH_API_KEY") ?? adminApiKey;
  const syncNamespace =
    options.syncNamespace ?? getEnvValue(loadedEnv, "DOCS_SEARCH_SYNC_NAMESPACE");

  if (!appId) {
    throw new Error("Missing Algolia app id. Set ALGOLIA_APP_ID or pass --app-id.");
  }

  if (!adminApiKey) {
    throw new Error(
      "Missing Algolia admin API key for sync. Set ALGOLIA_ADMIN_API_KEY or pass --admin-api-key.",
    );
  }

  if (!searchApiKey) {
    throw new Error(
      "Missing Algolia search API key. Set ALGOLIA_SEARCH_API_KEY or pass --search-api-key.",
    );
  }

  return {
    provider: "algolia",
    appId,
    indexName,
    searchApiKey,
    adminApiKey,
    ...(syncNamespace ? { syncNamespace } : {}),
  };
}

export async function syncSearch(options: SearchSyncOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveDocsConfigPath(rootDir, options.configPath);
  const configContent = readFileSync(configPath, "utf-8");
  const configLoad = await loadDocsConfigModuleResultWithProjectEnv(rootDir, options.configPath);
  const canonicalBaseUrl =
    options.siteUrl ??
    (configLoad.status === "evaluated" ? resolveDocsMetadataBaseUrl(configLoad.config) : undefined);
  if (canonicalBaseUrl) {
    try {
      const parsed = new URL(canonicalBaseUrl);
      if (
        (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
        parsed.username ||
        parsed.password
      ) {
        throw new Error();
      }
    } catch {
      throw new Error(
        "The canonical docs URL must be an absolute HTTP(S) URL without credentials.",
      );
    }
  }
  const loadedEnv = loadProjectEnv(rootDir);

  const provider = resolveSearchSyncProvider(options, loadedEnv);
  const entry = readTopLevelStringProperty(configContent, "entry") ?? "docs";
  const contentDir = resolveDocsContentDir(rootDir, configContent, entry);
  const i18n = configLoad.status === "evaluated" ? resolveDocsI18n(configLoad.config.i18n) : null;
  const localizedSources = i18n
    ? i18n.locales.map((locale) => ({
        locale,
        contentDir: path.join(contentDir, locale),
      }))
    : [{ locale: undefined, contentDir }];
  const contexts: DocsSearchAdapterContext[] = [];

  for (const localized of localizedSources) {
    const source = createFilesystemDocsMcpSource({
      rootDir,
      entry,
      contentDir: localized.contentDir,
      siteTitle: "Documentation",
      baseUrl: canonicalBaseUrl,
    });
    const scannedPages = await source.getPages();
    if (scannedPages.length === 0) continue;
    const pages = localized.locale
      ? scannedPages.map((page) => ({ ...page, locale: localized.locale }))
      : scannedPages;
    contexts.push({
      pages,
      documents: buildDocsSearchDocuments(pages),
      audience: "human",
      locale: localized.locale,
      siteTitle: source.siteTitle,
      baseUrl: canonicalBaseUrl,
      indexBaseUrl: canonicalBaseUrl,
    });
  }

  const documentCount = contexts.reduce((count, context) => count + context.documents.length, 0);
  if (documentCount === 0) {
    throw new Error(`No docs content was found under ${contentDir}.`);
  }

  if (provider === "typesense") {
    const config = resolveTypesenseSyncConfig(options, loadedEnv);
    const adapter = createTypesenseSearchAdapter(config);
    for (const context of contexts) await adapter.index?.(context);
    console.log(
      pc.green(
        `Synced ${documentCount} docs search documents to Typesense collection "${config.collection}".`,
      ),
    );
    return;
  }

  const config = resolveAlgoliaSyncConfig(options, loadedEnv);
  const adapter = createAlgoliaSearchAdapter(config);
  for (const context of contexts) await adapter.index?.(context);
  console.log(
    pc.green(
      `Synced ${documentCount} docs search documents to Algolia index "${config.indexName}".`,
    ),
  );
}
