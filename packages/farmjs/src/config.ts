import type { DocsConfig } from "@farming-labs/docs";
import { farmDocsRuntimeAdapter, type FarmDocsRuntimeAdapter } from "./runtime.js";

export interface FarmDocsCoreConfig extends Partial<DocsConfig> {
  enabled?: boolean;
  configPath?: string;
  config?: Partial<DocsConfig>;
  /** Runtime entrypoints owned by the official Farm adapter. */
  adapter?: FarmDocsRuntimeAdapter;
}

export interface FarmDocsAdapterOptions {
  /** Enable the docs runtime. Defaults to true when withDocs is used. */
  enabled?: boolean;
  /** Path to docs.config.ts, relative to the Farm application root. */
  configPath?: string;
  /** Inline docs config merged after the config file. */
  config?: Partial<DocsConfig>;
}

export interface FarmConfigLike {
  docs?: boolean | FarmDocsCoreConfig;
  [key: string]: unknown;
}

export type FarmConfigWithDocs<TConfig extends FarmConfigLike> = Omit<TConfig, "docs"> & {
  docs: FarmDocsCoreConfig;
};

function normalizeExistingDocs(value: FarmConfigLike["docs"]): FarmDocsCoreConfig {
  if (!value || value === true) return {};
  return value;
}

/**
 * Enable Farming Labs docs in a Farm.js application.
 *
 * The wrapper is deliberately structural, so it preserves the exact config
 * type returned by Farm's defineConfig without coupling this package to a
 * particular release of @farm.js/core.
 */
export function withDocs<TConfig extends FarmConfigLike>(
  farmConfig: TConfig,
  options: FarmDocsAdapterOptions = {},
): FarmConfigWithDocs<TConfig> {
  const existing = normalizeExistingDocs(farmConfig.docs);
  const enabled = options.enabled ?? true;

  return {
    ...farmConfig,
    docs: {
      ...existing,
      enabled,
      adapter: farmDocsRuntimeAdapter,
      ...(options.configPath ? { configPath: options.configPath } : {}),
      ...(options.config
        ? {
            config: {
              ...existing.config,
              ...options.config,
            },
          }
        : {}),
    },
  };
}
