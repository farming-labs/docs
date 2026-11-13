import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { DocsConfig, DocsMdxOptions, DocsMdxPlugin } from "@farming-labs/docs";
import {
  loadDocsConfigModuleResult,
  resolveDocsConfigPath,
  resolveDocsMdxOptions,
} from "@farming-labs/docs/build";
import type { CompileOptions } from "@mdx-js/mdx";
import mdx from "@mdx-js/rollup";
import {
  applyDocsMarkdownHeadingAnchors,
  encodeDocsHeadingTocUrls,
  isolateDocsMarkdownPromptReferences,
  remarkCodeGroup,
  withDocsMarkdownRenderableHeadings,
} from "./mdx-core.js";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { remarkHeading as createFumadocsRemarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";
import { rehypeToc } from "fumadocs-core/mdx-plugins/rehype-toc";
import { rehypeCode } from "fumadocs-core/mdx-plugins/rehype-code";
import { normalizePath, type PluginOption, type Plugin, type ResolvedConfig } from "vite";
import { MdxBuildCache, mdxCacheDigest } from "./mdx-build-cache.js";
import { fingerprintMdxCompiler } from "./mdx-compiler-fingerprint.js";

export interface FarmDocsCodeBlockThemes {
  /** Shiki theme used in light mode. */
  light?: string;
  /** Shiki theme used in dark mode. */
  dark?: string;
}

export interface FarmDocsMdxOptions {
  /** Reuse unchanged production MDX compilation. Defaults to true; never used in dev/watch. */
  buildCache?: boolean;
  /** Shiki themes used while compiling Markdown and MDX code blocks. */
  codeBlockThemes?: FarmDocsCodeBlockThemes;
  /** Additional content roots that the development server may compile. */
  contentRoots?: string[];
  /** Path to docs.config, relative to the Farm application root. Its `mdx` plugins compile every page. */
  configPath?: string;
  /** Inline docs config merged after the config file; its `mdx` replaces the file's. */
  config?: Partial<DocsConfig>;
}

type MdxPluggable = NonNullable<CompileOptions["remarkPlugins"]>[number];

interface LoadedMdxExtensions {
  remarkPlugins: MdxPluggable[];
  rehypePlugins: MdxPluggable[];
  codeHighlighter?: MdxPluggable;
}

async function loadMdxPlugin(plugin: DocsMdxPlugin, root: string): Promise<MdxPluggable> {
  const module = Array.isArray(plugin) ? plugin[0] : plugin;
  let resolved: string;
  try {
    resolved = createRequire(path.join(root, "package.json")).resolve(module);
  } catch (cause) {
    throw new Error(
      `Could not resolve the MDX plugin ${JSON.stringify(module)} from ${root}. ` +
        "Name an installed package or a path relative to the Farm application root.",
      { cause },
    );
  }
  const { default: attacher } = await import(pathToFileURL(resolved).href);
  if (typeof attacher !== "function") {
    throw new TypeError(
      `The MDX plugin ${JSON.stringify(module)} must default-export a unified plugin function.`,
    );
  }
  return Array.isArray(plugin) && plugin[1] !== undefined ? [attacher, plugin[1]] : attacher;
}

async function loadMdxExtensions(
  options: DocsMdxOptions,
  root: string,
): Promise<LoadedMdxExtensions> {
  const { remarkPlugins, rehypePlugins, codeHighlighter } = resolveDocsMdxOptions(options);
  const load = (plugins: DocsMdxPlugin[]) =>
    Promise.all(plugins.map((plugin) => loadMdxPlugin(plugin, root)));
  const [remark, rehype, [highlighter]] = await Promise.all([
    load(remarkPlugins),
    load(rehypePlugins),
    load(codeHighlighter === undefined ? [] : [codeHighlighter]),
  ]);
  return { remarkPlugins: remark, rehypePlugins: rehype, codeHighlighter: highlighter };
}

/** The app's `mdx`, from the inline config or else from docs.config. */
async function readDocsMdxOptions(
  root: string,
  options: Pick<FarmDocsMdxOptions, "config" | "configPath">,
): Promise<DocsMdxOptions | undefined> {
  if (options.config && Object.hasOwn(options.config, "mdx")) return options.config.mdx;
  let configPath: string;
  try {
    configPath = resolveDocsConfigPath(root, options.configPath);
  } catch (error) {
    if (options.configPath) throw error;
    return undefined;
  }
  const result = await loadDocsConfigModuleResult(root, configPath, { silent: true });
  if (result.status === "evaluated") return result.config.mdx;
  if (/\bmdx\s*:/.test(fs.readFileSync(result.path, "utf8"))) {
    throw new Error(
      `Could not evaluate ${result.path} to read its \`mdx\` plugins: ${result.error} ` +
        "Fix the error so the config can be imported at build time.",
    );
  }
  return undefined;
}

const DEFAULT_CODE_BLOCK_THEMES = {
  light: "github-light",
  dark: "github-dark",
} as const;

export function resolveFarmDocsCodeBlockThemes(themes: FarmDocsCodeBlockThemes = {}): {
  light: string;
  dark: string;
} {
  return {
    light: themes.light ?? DEFAULT_CODE_BLOCK_THEMES.light,
    dark: themes.dark ?? DEFAULT_CODE_BLOCK_THEMES.dark,
  };
}

export function createCanonicalDocsRemarkHeading(): ReturnType<typeof createFumadocsRemarkHeading> {
  return (root, file) => {
    isolateDocsMarkdownPromptReferences(root, file.value);
    applyDocsMarkdownHeadingAnchors(root);
    withDocsMarkdownRenderableHeadings(root, () =>
      createFumadocsRemarkHeading({ customId: false })(root, file, () => undefined),
    );
    encodeDocsHeadingTocUrls(file.data.toc);
    return root;
  };
}

interface MarkdownNode {
  type: string;
  value?: string;
  meta?: string | null;
  children?: MarkdownNode[];
}

/**
 * Preserve Farm's conventional standalone bold code labels without requiring
 * framework-owned HTML. File labels become code-block titles; generic terminal
 * labels are omitted because the language and copy affordance already identify
 * those blocks.
 */
export function remarkStandaloneCodeLabels() {
  return (tree: MarkdownNode) => {
    const children = tree.children;
    if (!children) return tree;

    for (let index = 0; index < children.length - 1; index += 1) {
      const label = children[index];
      const code = children[index + 1];
      const strong = label?.type === "paragraph" ? label.children?.[0] : undefined;
      const text = strong?.type === "strong" ? strong.children?.[0] : undefined;

      if (
        label?.children?.length !== 1 ||
        strong?.children?.length !== 1 ||
        text?.type !== "text" ||
        code?.type !== "code" ||
        !text.value?.trim()
      ) {
        continue;
      }

      const value = text.value.trim();
      if (!/^(terminal|shell|console)$/i.test(value)) {
        const title = `title=${JSON.stringify(value)}`;
        code.meta = [code.meta?.trim(), title].filter(Boolean).join(" ");
      }

      children.splice(index, 1);
      index -= 1;
    }

    return tree;
  };
}

function findWorkspaceRoot(startDir: string): string | null {
  let current = startDir;

  while (true) {
    const workspace = path.join(current, "pnpm-workspace.yaml");
    const docsSrc = path.join(current, "packages", "docs", "src", "index.ts");
    const farmjsSrc = path.join(current, "packages", "farmjs", "src", "index.ts");

    if (fs.existsSync(workspace) && fs.existsSync(docsSrc) && fs.existsSync(farmjsSrc)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function findRepositoryRoot(startDir: string): string {
  let current = path.resolve(startDir);

  while (true) {
    if (
      fs.existsSync(path.join(current, ".git")) ||
      fs.existsSync(path.join(current, "pnpm-workspace.yaml"))
    ) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) return path.resolve(startDir);
    current = parent;
  }
}

/**
 * Keep external documentation sources importable when the Farm application is
 * nested inside a repository, while retaining explicit escape hatches for
 * content that intentionally lives elsewhere.
 */
export function resolveFarmDocsViteContentRoots(
  appRoot: string = process.cwd(),
  contentRoots: string[] = [],
): string[] {
  const normalizedAppRoot = path.resolve(appRoot);
  return Array.from(
    new Set(
      [
        normalizedAppRoot,
        findRepositoryRoot(normalizedAppRoot),
        ...contentRoots.map((root) => path.resolve(normalizedAppRoot, root)),
      ].map(normalizePath),
    ),
  );
}

/**
 * Point the docs packages at their TypeScript sources, for working on the adapter
 * against an app in this repository. Opt-in: apps in the repository (the docs
 * website) run the built packages like any other consumer.
 */
function resolveWorkspaceAliases() {
  if (process.env.FARMING_LABS_DOCS_SOURCE !== "1") return [];
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = findWorkspaceRoot(moduleDir);

  if (!workspaceRoot) return [];

  const docsSrc = normalizePath(path.join(workspaceRoot, "packages", "docs", "src"));
  const farmjsSrc = normalizePath(path.join(workspaceRoot, "packages", "farmjs", "src"));
  const themeSrc = normalizePath(path.join(workspaceRoot, "packages", "fumadocs", "src"));

  return [
    {
      find: /^@farming-labs\/docs$/,
      replacement: `${docsSrc}/index.ts`,
    },
    {
      find: /^@farming-labs\/docs\/(.+)$/,
      replacement: `${docsSrc}/$1`,
    },
    {
      find: /^@farming-labs\/farmjs$/,
      replacement: `${farmjsSrc}/index.ts`,
    },
    {
      find: /^@farming-labs\/farmjs\/(.+)$/,
      replacement: `${farmjsSrc}/$1`,
    },
    {
      find: /^@farming-labs\/theme$/,
      replacement: `${themeSrc}/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/mdx$/,
      replacement: `${themeSrc}/mdx.ts`,
    },
    {
      find: /^@farming-labs\/theme\/default$/,
      replacement: `${themeSrc}/default/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/darksharp$/,
      replacement: `${themeSrc}/darksharp/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/pixel-border$/,
      replacement: `${themeSrc}/pixel-border/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/colorful$/,
      replacement: `${themeSrc}/colorful/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/shiny$/,
      replacement: `${themeSrc}/shiny/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/darkbold$/,
      replacement: `${themeSrc}/darkbold/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/greentree$/,
      replacement: `${themeSrc}/greentree/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/concrete$/,
      replacement: `${themeSrc}/concrete/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/hardline$/,
      replacement: `${themeSrc}/hardline/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/shadcn$/,
      replacement: `${themeSrc}/shadcn/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/threadline$/,
      replacement: `${themeSrc}/threadline/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/command-grid$/,
      replacement: `${themeSrc}/command-grid/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/ledger$/,
      replacement: `${themeSrc}/ledger/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/search$/,
      replacement: `${themeSrc}/search.ts`,
    },
    {
      find: /^@farming-labs\/theme\/api$/,
      replacement: `${themeSrc}/docs-api.ts`,
    },
    {
      find: /^@farming-labs\/theme\/tanstack$/,
      replacement: `${themeSrc}/tanstack.ts`,
    },
    {
      find: /^@farming-labs\/theme\/ai$/,
      replacement: `${themeSrc}/ai-search-dialog.tsx`,
    },
  ];
}

export function docsMdx(options: FarmDocsMdxOptions = {}): PluginOption {
  const aliases = resolveWorkspaceAliases();
  const codeBlockThemes = resolveFarmDocsCodeBlockThemes(options.codeBlockThemes);
  const compiler = mdx({ include: /\.(md|mdx)$/, ...mdxCompileOptions(options) });
  const appCompilers = new Map<string, Promise<typeof compiler | undefined>>();
  const appCompiler = (root: string) => {
    let pending = appCompilers.get(root);
    if (!pending) {
      pending = readDocsMdxOptions(root, options).then(async (value) => {
        if (value === undefined) return undefined;
        if (options.buildCache === true) {
          throw new Error(
            "withDocs `buildCache: true` cannot be combined with `mdx` plugins in docs.config, " +
              "because the build cache cannot fingerprint them. Remove `buildCache` to compile every page.",
          );
        }
        const loaded = await loadMdxExtensions(value, root);
        return mdx({ include: /\.(md|mdx)$/, ...mdxCompileOptions(options, loaded) });
      });
      appCompilers.set(root, pending);
    }
    return pending;
  };
  let active = compiler;
  // Vite gives hooks an environment-specific config view, not the same object
  // passed to configResolved. Keep discovery/dev and production scopes separate.
  const buildKey = (config: ResolvedConfig) =>
    JSON.stringify([
      config.root,
      config.cacheDir,
      config.command,
      config.mode,
      Boolean(config.build.watch),
    ]);
  const builds = new Map<
    string,
    {
      cache: MdxBuildCache;
      fingerprint?: Promise<string | undefined>;
      context: string;
    }
  >();
  const cachedCompiler: Plugin = {
    ...compiler,
    async configResolved(config) {
      builds.delete(buildKey(config));
      const app = await appCompiler(config.root);
      active = app ?? compiler;
      if (
        options.buildCache !== false &&
        !app &&
        config.command === "build" &&
        !config.build.watch
      ) {
        builds.set(buildKey(config), {
          cache: new MdxBuildCache(path.join(config.cacheDir, "farming-docs", "mdx-v1.json")),
          context: JSON.stringify([
            config.root,
            config.mode,
            codeBlockThemes,
            process.versions.node,
          ]),
        });
      }
    },
    transform: {
      // Match the compiler's include rule before crossing the bundler's JS hook
      // boundary. Keep its own filtering below for hosts without hook filters.
      filter: { id: /\.(md|mdx)$/ },
      async handler(code, id) {
        const compile = () => active.transform.call(this, code, id);
        const build = this.environment && builds.get(buildKey(this.environment.config));
        if (!build || !/\.(md|mdx)$/.test(id.split("?", 1)[0])) return compile();
        const version = await (build.fingerprint ??= fingerprintMdxCompiler());
        if (!version) return compile();
        const key = mdxCacheDigest(JSON.stringify([build.context, version, id, code]));
        return build.cache.compile(id, key, compile);
      },
    },
    async buildEnd(error) {
      const build = this.environment && builds.get(buildKey(this.environment.config));
      if (!error) await build?.cache.flush();
    },
  };

  return [
    {
      name: "farming-labs-farmjs-workspace-alias",
      enforce: "pre",
      config() {
        return {
          ...(aliases.length > 0 ? { resolve: { alias: aliases } } : {}),
          server: {
            fs: {
              allow: resolveFarmDocsViteContentRoots(process.cwd(), options.contentRoots),
            },
          },
          ssr: {
            noExternal: ["@farming-labs/docs", "@farming-labs/theme"],
          },
        };
      },
    },
    cachedCompiler,
  ];
}

/**
 * Grammars other grammars embed in documentation: frontmatter, and code inside Markdown and
 * HTML. Shiki loads these lazily, so without preloading, whether a block highlights them
 * depends on which pages compiled first. Farm compiles pages separately for the browser and
 * the server, so the two could tokenize one block differently and fail hydration.
 */
export const FARM_DOCS_PRELOADED_CODE_LANGUAGES = [
  "yaml",
  "toml",
  "json",
  "jsonc",
  "html",
  "css",
  "javascript",
  "typescript",
  "jsx",
  "tsx",
  "shellscript",
  "markdown",
  "mdx",
] as const;

/** Shared MDX transforms used by Vite and the build-time edge compiler. */
export function createFarmDocsMdxCompileOptions(
  options: FarmDocsMdxOptions = {},
): Pick<CompileOptions, "remarkPlugins" | "rehypePlugins"> {
  return mdxCompileOptions(options);
}

/** The edge compiler's MDX transforms, with the app's own plugins from docs.config `mdx`. */
export async function loadFarmDocsMdxCompileOptions(
  root: string,
  options: DocsMdxOptions | undefined,
): Promise<Pick<CompileOptions, "remarkPlugins" | "rehypePlugins">> {
  return mdxCompileOptions(
    {},
    options === undefined ? undefined : await loadMdxExtensions(options, root),
  );
}

function mdxCompileOptions(
  options: FarmDocsMdxOptions,
  app?: LoadedMdxExtensions,
): Pick<CompileOptions, "remarkPlugins" | "rehypePlugins"> {
  const codeBlockThemes = resolveFarmDocsCodeBlockThemes(options.codeBlockThemes);
  const remarkPlugins: NonNullable<CompileOptions["remarkPlugins"]> = [
    remarkGfm,
    remarkFrontmatter,
    [remarkMdxFrontmatter, { name: "metadata" }],
    remarkStandaloneCodeLabels,
    remarkCodeGroup,
    createCanonicalDocsRemarkHeading,
    ...(app?.remarkPlugins ?? []),
  ];
  const rehypePlugins: NonNullable<CompileOptions["rehypePlugins"]> = [
    rehypeToc,
    app?.codeHighlighter ?? [
      rehypeCode,
      {
        engine: "oniguruma",
        themes: codeBlockThemes,
        langs: [...FARM_DOCS_PRELOADED_CODE_LANGUAGES],
      },
    ],
    ...(app?.rehypePlugins ?? []),
  ];
  return { remarkPlugins, rehypePlugins };
}
