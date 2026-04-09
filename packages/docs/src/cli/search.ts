import { readFileSync } from "node:fs";
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
import {
  loadProjectEnv,
  readStringProperty,
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
  collection?: string;
  apiKey?: string;
  adminApiKey?: string;
  mode?: string;
  ollamaModel?: string;
  ollamaBaseUrl?: string;
  appId?: string;
  indexName?: string;
  searchApiKey?: string;
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
  };
}

export async function syncSearch(options: SearchSyncOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveDocsConfigPath(rootDir, options.configPath);
  const configContent = readFileSync(configPath, "utf-8");
  const loadedEnv = loadProjectEnv(rootDir);

  const provider = resolveSearchSyncProvider(options, loadedEnv);
  const entry = readStringProperty(configContent, "entry") ?? "docs";
  const contentDir = resolveDocsContentDir(rootDir, configContent, entry);

  const source = createFilesystemDocsMcpSource({
    rootDir,
    entry,
    contentDir,
    siteTitle: "Documentation",
  });

  const pages = await source.getPages();
  const documents = buildDocsSearchDocuments(pages);
  const context: DocsSearchAdapterContext = {
    pages,
    documents,
    siteTitle: source.siteTitle,
  };

  if (documents.length === 0) {
    throw new Error(`No docs content was found under ${contentDir}.`);
  }

  if (provider === "typesense") {
    const config = resolveTypesenseSyncConfig(options, loadedEnv);
    const adapter = createTypesenseSearchAdapter(config);
    await adapter.index?.(context);
    console.log(
      pc.green(
        `Synced ${documents.length} docs search documents to Typesense collection "${config.collection}".`,
      ),
    );
    return;
  }

  const config = resolveAlgoliaSyncConfig(options, loadedEnv);
  const adapter = createAlgoliaSearchAdapter(config);
  await adapter.index?.(context);
  console.log(
    pc.green(
      `Synced ${documents.length} docs search documents to Algolia index "${config.indexName}".`,
    ),
  );
}
