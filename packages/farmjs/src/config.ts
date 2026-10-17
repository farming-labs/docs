import type { DocsConfig } from "@farming-labs/docs";
import { docsAgentSkillsBundle } from "./agent-skills.js";
import { farmDocsRuntimeAdapter, type FarmDocsRuntimeAdapter } from "./runtime.js";
import { docsShell } from "./shell-plugin.js";
import { docsMdx, type FarmDocsCodeBlockThemes } from "./vite.js";

interface FarmViteConfigLike {
  plugins?: unknown[];
  [key: string]: unknown;
}

type FarmViteConfigFactory = (config: FarmViteConfigLike) => FarmViteConfigLike;

export interface FarmDocsCoreConfig extends Partial<DocsConfig> {
  enabled?: boolean;
  configPath?: string;
  config?: Partial<DocsConfig>;
  /** Runtime entrypoints owned by the official Farm adapter. */
  adapter?: FarmDocsRuntimeAdapter;
}

export interface FarmDocsAdapterOptions {
  /** Reuse unchanged production MDX compilation. Defaults to true. */
  buildCache?: boolean;
  /** Enable the docs runtime. Defaults to true when withDocs is used. */
  enabled?: boolean;
  /** Path to docs.config.ts, relative to the Farm application root. */
  configPath?: string;
  /** Inline docs config merged after the config file. */
  config?: Partial<DocsConfig>;
  /** Shiki themes used to compile Markdown and MDX code blocks. */
  codeBlockThemes?: FarmDocsCodeBlockThemes;
  /** Additional documentation roots outside the Farm application directory. */
  contentRoots?: string[];
  /**
   * Module whose default export wraps every docs page, relative to the Farm application root.
   * Farm renders docs pages outside the app's root layout, so use it for what that layout adds
   * to other routes, such as analytics or site-wide widgets.
   */
  shell?: string;
}

export interface FarmConfigLike {
  docs?: boolean | FarmDocsCoreConfig;
  vite?: FarmViteConfigLike | FarmViteConfigFactory;
  [key: string]: unknown;
}

export type FarmConfigWithDocs<TConfig extends FarmConfigLike> = Omit<TConfig, "docs" | "vite"> & {
  docs: FarmDocsCoreConfig;
  vite: FarmViteConfigLike | FarmViteConfigFactory;
};

function normalizeExistingDocs(value: FarmConfigLike["docs"]): FarmDocsCoreConfig {
  if (!value || value === true) return {};
  return value;
}

function appendDocsVitePlugins(
  config: FarmViteConfigLike = {},
  options: FarmDocsAdapterOptions,
): FarmViteConfigLike {
  const { codeBlockThemes, contentRoots, buildCache, configPath, shell } = options;
  return {
    ...config,
    plugins: [
      docsMdx({ codeBlockThemes, contentRoots, buildCache }),
      docsAgentSkillsBundle({ configPath }),
      docsShell(shell),
      ...(config.plugins ?? []),
    ],
  };
}

function withDocsViteConfig(
  value: FarmConfigLike["vite"],
  options: FarmDocsAdapterOptions,
): FarmViteConfigLike | FarmViteConfigFactory {
  if (typeof value === "function") {
    return (config) => appendDocsVitePlugins(value(config), options);
  }

  return appendDocsVitePlugins(value, options);
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
    vite: withDocsViteConfig(farmConfig.vite, {
      ...options,
      configPath: options.configPath ?? existing.configPath,
    }),
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
