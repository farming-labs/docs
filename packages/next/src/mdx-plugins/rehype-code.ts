import { createHash, randomUUID } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  rehypeCode,
  rehypeCodeDefaultOptions,
  type RehypeCodeOptions,
} from "fumadocs-core/mdx-plugins/rehype-code";
import { createRehypeCode } from "fumadocs-core/mdx-plugins/rehype-code.core";

export type DocsRehypeCodeOptions = Partial<RehypeCodeOptions> & {
  /**
   * Directory that keeps highlighted code blocks for build workers and later builds. It is used
   * only when every other option is plain JSON, as `withDocs()` passes them.
   */
  cacheDir?: string;
};

type CodeCache = NonNullable<RehypeCodeOptions["cache"]>;
type Fragment = Parameters<CodeCache["set"]>[1];
interface HastNode {
  type: string;
  tagName?: string;
  value?: unknown;
  children?: HastNode[];
  properties?: Record<string, unknown>;
  data?: { meta?: unknown };
}
interface CodeBlock {
  node: HastNode;
  parent: HastNode & { children: HastNode[] };
  index: number;
  lang: string;
  key: string;
}
interface LanguageRegistration {
  injectTo?: string[];
  embeddedLangsLazy?: string[];
}
type HighlighterFactory = Extract<
  Parameters<typeof createRehypeCode>[0],
  (...args: never[]) => unknown
>;
type Highlighter = Awaited<ReturnType<HighlighterFactory>>["highlighter"];
interface ShikiModule {
  bundledLanguages: Record<string, () => Promise<{ default: LanguageRegistration[] }>>;
  bundledLanguagesInfo: { id: string; aliases?: string[] }[];
  createHighlighter(options: Record<string, unknown>): Promise<Highlighter>;
  createOnigurumaEngine(wasm: Promise<unknown>): unknown;
  createJavaScriptRegexEngine(): unknown;
}
interface ShikiCore {
  isSpecialLang: (lang: string) => boolean;
}

// Bump when a cached fragment or its key changes meaning.
const CACHE_FORMAT = 2;
// Fenced code inside Markdown, and the scripts and styles of single-file components, is
// highlighted for these languages, the ones Farm.js preloads. Any other embedded language stays
// plain, so the output never depends on which languages a worker loaded for earlier pages.
const EMBEDDED_LANGUAGES = [
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
];
const MEMORY_ENTRIES = 2_000;
// Entries spread over 256 directories, so this bounds a scope at 16,384 blocks.
const SHARD_ENTRIES = 64;
const STALE_SCOPE_MS = 60 * 60 * 1000;

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

function isPlainJson(value: unknown): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isPlainJson);
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every(isPlainJson);
}

// Some packages export only their package.json, others only an entry point to walk up from.
function findPackage(require: NodeJS.Require, name: string) {
  let directory: string;
  try {
    directory = dirname(require.resolve(`${name}/package.json`));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ERR_PACKAGE_PATH_NOT_EXPORTED") throw error;
    directory = dirname(require.resolve(name));
  }
  for (;;) {
    const file = join(directory, "package.json");
    try {
      const json = JSON.parse(readFileSync(file, "utf8")) as {
        name?: string;
        version?: string;
        dependencies?: Record<string, string>;
      };
      if (json.name === name && json.version) return { file, json, require: createRequire(file) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`Could not find the package.json of \`${name}\` to key the code cache.`);
    }
    directory = parent;
  }
}

// Highlighted output depends on Fumadocs' transformers and Shiki's grammars, themes and engines.
function resolveHighlighter() {
  const fumadocs = findPackage(createRequire(import.meta.url), "fumadocs-core");
  const shiki = findPackage(fumadocs.require, "shiki");
  const shikijs = Object.keys(shiki.json.dependencies ?? {})
    .filter((name) => name.startsWith("@shikijs/"))
    .sort()
    .map((name) => [name, findPackage(shiki.require, name).json.version]);
  return {
    versions: { fumadocs: fumadocs.json.version, shiki: shiki.json.version, shikijs },
    shiki: pathToFileURL(fumadocs.require.resolve("shiki")).href,
    shikiCore: pathToFileURL(fumadocs.require.resolve("shiki/core")).href,
    shikiWasm: pathToFileURL(fumadocs.require.resolve("shiki/wasm")).href,
  };
}
type ResolvedHighlighter = ReturnType<typeof resolveHighlighter>;

/** The highlighter a language's blocks need instead of the shared one, and what it loads. */
interface SeparateHighlighter {
  key: string;
  langs: string[];
}
interface LanguageInfo {
  /** A bundled or special language. Unknown ones fail or fall back, and are never stored. */
  known: boolean;
  separate?: SeparateHighlighter;
}

// Fumadocs highlights every file a worker compiles with one highlighter, which loads each
// language on first use. Grammars that inject into other languages (`ts-tags`, `lit`, `vue`,
// `nix`, Angular) would change how later TypeScript, JavaScript, HTML or Markdown is highlighted,
// and grammars that embed languages lazily (Markdown, MDX, Vue, Svelte, Astro, LaTeX, …) highlight
// nested code only in languages that happen to be loaded. Blocks in those languages get a
// highlighter whose languages never change, so every block's output depends only on the block.
function createLanguageInspector(
  urls: ResolvedHighlighter,
  langAlias: Record<string, string> | undefined,
) {
  const known = new Map<string, LanguageInfo>();
  const pending = new Map<string, Promise<LanguageInfo>>();
  const inspect = async (lang: string): Promise<LanguageInfo> => {
    const [shiki, { isSpecialLang }] = await Promise.all([
      import(urls.shiki) as Promise<ShikiModule>,
      import(urls.shikiCore) as Promise<ShikiCore>,
    ]);
    const target = langAlias?.[lang] ?? lang;
    if (isSpecialLang(target)) return { known: true };
    const load = Object.hasOwn(shiki.bundledLanguages, target)
      ? shiki.bundledLanguages[target]
      : undefined;
    if (!load) return { known: false };
    const id =
      shiki.bundledLanguagesInfo.find(
        (info) => info.id === target || info.aliases?.includes(target),
      )?.id ?? target;
    const grammars = (await load()).default;
    const injects = grammars.some((grammar) => grammar.injectTo?.length);
    const embeds = grammars.some((grammar) => grammar.embeddedLangsLazy?.length);
    if (!injects && !embeds) return { known: true };
    const langs = embeds ? [...new Set([...EMBEDDED_LANGUAGES, id])] : [id];
    // Markdown and MDX need exactly the embedded languages, so they share one highlighter.
    const key = embeds && !injects && EMBEDDED_LANGUAGES.includes(id) ? "embedded" : id;
    return { known: true, separate: { key, langs } };
  };
  return {
    known: (lang: string) => known.get(lang),
    async inspect(lang: string) {
      let info = pending.get(lang);
      if (!info) {
        pending.set(lang, (info = inspect(lang)));
        known.set(lang, await info);
      }
      return info;
    },
  };
}

// Like Fumadocs' own highlighters, these live as long as the process and are shared by every
// processor. There is at most one per language that needs its own.
const separateHighlighters = new Map<string, Promise<Highlighter>>();

function getSeparateHighlighter(
  urls: ResolvedHighlighter,
  engine: RehypeCodeOptions["engine"],
  langAlias: Record<string, string> | undefined,
  { key, langs }: SeparateHighlighter,
) {
  const id = JSON.stringify([engine, langAlias ?? null, key]);
  let highlighter = separateHighlighters.get(id);
  if (!highlighter) {
    highlighter = (async () => {
      const shiki = (await import(urls.shiki)) as ShikiModule;
      // The same engines as Fumadocs' `wasmShikiFactory` and `defaultShikiFactory`.
      const regexEngine =
        engine === "oniguruma"
          ? shiki.createOnigurumaEngine(import(urls.shikiWasm))
          : shiki.createJavaScriptRegexEngine();
      return shiki.createHighlighter({
        langs,
        themes: [],
        langAlias,
        engine: regexEngine,
        // Shiki warns from ten instances. These are bounded by the languages that need one.
        warnings: false,
      });
    })();
    highlighter.catch(() => separateHighlighters.delete(id));
    separateHighlighters.set(id, highlighter);
  }
  return highlighter;
}

const ignoreMissing = (error: unknown) => {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
};

// Other option sets and package versions write sibling scopes that this build never reads.
function removeStaleScopes(cacheDir: string, current: string) {
  let scopes: string[];
  try {
    scopes = readdirSync(cacheDir);
  } catch (error) {
    return ignoreMissing(error);
  }
  for (const name of scopes) {
    if (name === current || !/^[0-9a-f]{16}$/.test(name)) continue;
    const directory = join(cacheDir, name);
    try {
      if (Date.now() - statSync(directory).mtimeMs > STALE_SCOPE_MS) {
        rmSync(directory, { recursive: true, force: true });
      }
    } catch (error) {
      ignoreMissing(error);
    }
  }
}

// Keep the newest entries of a full shard. Edited code blocks leave their old versions behind.
function trimShard(shard: string) {
  const names = readdirSync(shard).filter((name) => name.endsWith(".json"));
  if (names.length <= SHARD_ENTRIES) return;
  const aged = names.flatMap((name) => {
    try {
      return [{ name, mtimeMs: statSync(join(shard, name)).mtimeMs }];
    } catch (error) {
      ignoreMissing(error);
      return [];
    }
  });
  aged.sort((left, right) => left.mtimeMs - right.mtimeMs);
  for (const { name } of aged.slice(0, aged.length - (SHARD_ENTRIES * 3) / 4)) {
    rmSync(join(shard, name), { force: true });
  }
}

function createCodeStore(directory: string) {
  const memory = new Map<string, string>();
  const fileFor = (key: string) => {
    const name = digest(key);
    return join(directory, name.slice(0, 2), `${name}.json`);
  };
  const remember = (key: string, value: string) => {
    if (memory.size >= MEMORY_ENTRIES) memory.delete(memory.keys().next().value!);
    memory.set(key, value);
  };
  return {
    read(key: string): Fragment | undefined {
      let value = memory.get(key);
      if (value === undefined) {
        try {
          value = readFileSync(fileFor(key), "utf8");
        } catch {
          return undefined;
        }
      }
      let entry: { key?: unknown; fragment?: { type?: unknown } };
      try {
        entry = JSON.parse(value);
      } catch {
        // A damaged entry is a miss. The next highlight replaces it.
        return undefined;
      }
      if (entry.key !== key || entry.fragment?.type !== "root") return undefined;
      remember(key, value);
      // Later rehype plugins may mutate the tree, so every hit returns its own copy.
      return entry.fragment as Fragment;
    },
    write(key: string, fragment: Fragment) {
      const value = JSON.stringify({ key, fragment });
      remember(key, value);
      const file = fileFor(key);
      const temporary = `${file}.${randomUUID()}.tmp`;
      try {
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(temporary, value);
        renameSync(temporary, file);
        trimShard(dirname(file));
      } catch {
        // The block is already highlighted. A later build can store it again.
        rmSync(temporary, { force: true });
      }
    },
  };
}

const flatten = (node: HastNode): string =>
  node.children
    ? node.children.map(flatten).join("")
    : typeof node.value === "string"
      ? node.value
      : "";

// Mirrors the block discovery and cache key of Fumadocs' `rehypeCode` for `pre` elements.
function findCodeBlocks(tree: HastNode, defaultLanguage: unknown): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const visit = (node: HastNode, parent?: CodeBlock["parent"], index?: number) => {
    if (node.type === "element" && node.tagName === "pre" && parent && index !== undefined) {
      const head = node.children?.[0];
      if (!head || head.type !== "element" || head.tagName !== "code" || !head.properties) return;
      const classes = head.properties.className;
      const language = Array.isArray(classes)
        ? classes.find((name) => typeof name === "string" && name.startsWith("language-"))
        : undefined;
      const lang = typeof language === "string" ? language.slice("language-".length) : undefined;
      const resolved = lang ?? defaultLanguage;
      if (typeof resolved !== "string" || !resolved) return;
      const meta = head.data?.meta ?? head.properties.metastring?.toString() ?? "";
      const key = `${resolved}:${meta}:${flatten(head)}`;
      blocks.push({ node, parent, index, lang: resolved, key });
      return;
    }
    node.children?.forEach((child, i) => visit(child, node as CodeBlock["parent"], i));
  };
  visit(tree);
  return blocks;
}

type Attacher = typeof rehypeCode;
type Transform = ReturnType<Attacher>;

export default function rehypeDocsCode(
  this: ThisParameterType<Attacher>,
  options: DocsRehypeCodeOptions = {},
): ReturnType<Attacher> {
  const { cacheDir, ...rest } = options;
  // Shiki stops styling a line once tokenizing it takes `tokenizeTimeLimit`, 500 ms by default,
  // which a cold worker on a busy machine reaches. Builds tokenize every line completely.
  const resolved: Partial<RehypeCodeOptions> = {
    engine: "oniguruma",
    tokenizeTimeLimit: 0,
    ...rest,
  };
  // Eager loading puts every language in the highlighter before the first block, so the output
  // already depends only on the block.
  if (resolved.lazy === false) return rehypeCode.call(this, resolved);

  const highlighter = resolveHighlighter();
  const languages = createLanguageInspector(highlighter, resolved.langAlias);
  // Custom grammars, aliases and inline code change what a block's key means.
  const cacheable =
    cacheDir &&
    resolved.cache === undefined &&
    resolved.langs === undefined &&
    resolved.langAlias === undefined &&
    !resolved.inline &&
    isPlainJson(resolved);
  let store: ReturnType<typeof createCodeStore> | undefined;
  if (cacheable) {
    const scope = digest(JSON.stringify([CACHE_FORMAT, highlighter.versions, resolved]));
    removeStaleScopes(cacheDir, scope.slice(0, 16));
    store = createCodeStore(join(cacheDir, scope.slice(0, 16)));
  }
  const usable = (lang: string) => !!store && !!languages.known(lang)?.known;
  // A configured time limit can still cut a line short, and that output depends on load.
  const timeLimitMs = resolved.tokenizeTimeLimit ?? 500;
  // Blocks that Fumadocs is highlighting now, by cache key, and when each last missed the cache.
  const highlighting = new Map<string, { lang: string; missedAt?: number }>();
  const cache: CodeCache = {
    get(key) {
      const block = highlighting.get(key);
      if (!block || !usable(block.lang)) return undefined;
      const fragment = store!.read(key);
      if (!fragment) block.missedAt = performance.now();
      return fragment;
    },
    set(key, fragment) {
      const block = highlighting.get(key);
      if (block?.missedAt === undefined || !usable(block.lang)) return cache;
      // Fumadocs tokenizes the block between the miss and this call, so a shorter interval
      // cannot contain a line that stopped early.
      if (timeLimitMs === 0 || performance.now() - block.missedAt < timeLimitMs) {
        store!.write(key, fragment);
      }
      return cache;
    },
  };
  const codeOptions = store ? { ...resolved, cache } : resolved;
  const defaultLanguage = "defaultLanguage" in resolved ? resolved.defaultLanguage : "plaintext";
  let shared: ReturnType<Attacher> | undefined;
  const separate = new Map<string, ReturnType<Attacher>>();
  const highlightSeparately = (target: SeparateHighlighter) => {
    let transform = separate.get(target.key);
    if (!transform) {
      // Fumadocs' own `rehypeCode` is this call with its shared highlighter.
      const factory: HighlighterFactory = async (options) => ({
        highlighter: await getSeparateHighlighter(
          highlighter,
          resolved.engine,
          resolved.langAlias,
          target,
        ),
        options: { ...rehypeCodeDefaultOptions, ...options },
      });
      transform = createRehypeCode(factory).call(this, codeOptions);
      separate.set(target.key, transform);
    }
    return transform;
  };
  return async (tree, file) => {
    const blocks = findCodeBlocks(tree as HastNode, defaultLanguage);
    if (blocks.length === 0) return;
    if (store) {
      const fragments = blocks.map((block) => store.read(block.key));
      if (fragments.every((fragment) => fragment !== undefined)) {
        // Every block is cached, so this file never starts Shiki.
        blocks.forEach(
          (block, i) => (block.parent.children[block.index] = fragments[i] as HastNode),
        );
        return;
      }
    }
    const infos = await Promise.all(blocks.map((block) => languages.inspect(block.lang)));
    // Take these blocks out of the tree, so the shared highlighter never loads their languages.
    const moved = blocks.flatMap((block, i) => {
      const target = infos[i]!.separate;
      if (!target) return [];
      const placeholder: HastNode = { type: "text", value: "" };
      block.parent.children[block.index] = placeholder;
      return [{ block, target, placeholder }];
    });
    for (const block of blocks) highlighting.set(block.key, { lang: block.lang });
    try {
      if (moved.length < blocks.length) {
        shared ??= rehypeCode.call(this, codeOptions);
        await shared(tree, file, () => undefined);
      }
      for (const { block, target, placeholder } of moved) {
        const root = { type: "root", children: [block.node] };
        await highlightSeparately(target)(root as Parameters<Transform>[0], file, () => undefined);
        const siblings = block.parent.children;
        siblings.splice(siblings.indexOf(placeholder), 1, ...root.children);
      }
    } finally {
      for (const block of blocks) highlighting.delete(block.key);
    }
  };
}
