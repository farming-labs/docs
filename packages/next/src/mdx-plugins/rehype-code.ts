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
import { rehypeCode, type RehypeCodeOptions } from "fumadocs-core/mdx-plugins/rehype-code";

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
  parent: HastNode & { children: HastNode[] };
  index: number;
  lang: string;
  key: string;
}
interface LanguageRegistration {
  scopeName: string;
  injectTo?: string[];
  embeddedLangsLazy?: string[];
}
interface ShikiModule {
  bundledLanguages: Record<string, () => Promise<{ default: LanguageRegistration[] }>>;
}
interface ShikiCore {
  isSpecialLang: (lang: string) => boolean;
}

// Bump when a cached fragment or its key changes meaning.
const CACHE_FORMAT = 1;
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
  };
}

interface LanguageInfo {
  /** Its output depends only on its own grammars, which inject into nothing. */
  cacheable: boolean;
  /** Scopes of its grammars and of the languages they embed. */
  scopes: string[];
  /** Scopes it changes for every later highlight in the same process. */
  injectTo: string[];
}

// A highlighter is shared by every file a worker compiles. Grammars that inject into other
// scopes, or embed languages only when already loaded, make output depend on the files compiled
// before. Store only output that a fresh highlighter would produce.
function createLanguageInspector(shikiUrl: string, shikiCoreUrl: string) {
  const known = new Map<string, LanguageInfo>();
  const pending = new Map<string, Promise<LanguageInfo>>();
  const inspect = async (lang: string): Promise<LanguageInfo> => {
    const [{ bundledLanguages }, { isSpecialLang }] = await Promise.all([
      import(shikiUrl) as Promise<ShikiModule>,
      import(shikiCoreUrl) as Promise<ShikiCore>,
    ]);
    if (isSpecialLang(lang)) return { cacheable: true, scopes: [], injectTo: [] };
    const load = Object.hasOwn(bundledLanguages, lang) ? bundledLanguages[lang] : undefined;
    if (!load) return { cacheable: false, scopes: [], injectTo: [] };
    const grammars = (await load()).default;
    const injectTo = grammars.flatMap((grammar) => grammar.injectTo ?? []);
    return {
      cacheable: injectTo.length === 0 && !grammars.some((g) => g.embeddedLangsLazy?.length),
      scopes: grammars.map((grammar) => grammar.scopeName),
      injectTo,
    };
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

// Scopes that grammars loaded by this process inject into. Fumadocs keeps one highlighter per
// engine for the whole process, shared by every processor, such as the ones for `.md` and `.mdx`.
const injected = new Set<string>();

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
      blocks.push({ parent, index, lang: resolved, key: `${resolved}:${meta}:${flatten(head)}` });
      return;
    }
    node.children?.forEach((child, i) => visit(child, node as CodeBlock["parent"], i));
  };
  visit(tree);
  return blocks;
}

type Attacher = typeof rehypeCode;

export default function rehypeDocsCode(
  this: ThisParameterType<Attacher>,
  options: DocsRehypeCodeOptions = {},
): ReturnType<Attacher> {
  const { cacheDir, ...rest } = options;
  const resolved: Partial<RehypeCodeOptions> = { engine: "oniguruma", ...rest };
  // Custom grammars, aliases, eager loading and inline code change what a block's key means.
  const cacheable =
    cacheDir &&
    resolved.cache === undefined &&
    resolved.langs === undefined &&
    resolved.langAlias === undefined &&
    resolved.lazy !== false &&
    !resolved.inline &&
    isPlainJson(resolved);
  if (!cacheable) return rehypeCode.call(this, resolved);

  const highlighter = resolveHighlighter();
  const scope = digest(JSON.stringify([CACHE_FORMAT, highlighter.versions, resolved]));
  removeStaleScopes(cacheDir, scope.slice(0, 16));
  const store = createCodeStore(join(cacheDir, scope.slice(0, 16)));
  const languages = createLanguageInspector(highlighter.shiki, highlighter.shikiCore);
  const usable = (lang: string) => {
    const info = languages.known(lang);
    return !!info?.cacheable && !info.scopes.some((scope) => injected.has(scope));
  };
  // Shiki leaves the rest of a line unstyled once tokenizing it takes this long, which a cold
  // worker on a busy machine can reach. That output depends on load, so it is never stored.
  const timeLimitMs =
    typeof resolved.tokenizeTimeLimit === "number" ? resolved.tokenizeTimeLimit : 500;
  // Blocks that Fumadocs is highlighting now, by cache key, and when each last missed the cache.
  const highlighting = new Map<string, { lang: string; missedAt?: number }>();
  const cache: CodeCache = {
    get(key) {
      const block = highlighting.get(key);
      if (!block || !usable(block.lang)) return undefined;
      const fragment = store.read(key);
      if (!fragment) block.missedAt = performance.now();
      return fragment;
    },
    set(key, fragment) {
      const block = highlighting.get(key);
      if (block?.missedAt === undefined || !usable(block.lang)) return cache;
      // Fumadocs tokenizes the block between the miss and this call, so a shorter interval
      // cannot contain a line that stopped early.
      if (timeLimitMs === 0 || performance.now() - block.missedAt < timeLimitMs) {
        store.write(key, fragment);
      }
      return cache;
    },
  };
  const defaultLanguage = "defaultLanguage" in resolved ? resolved.defaultLanguage : "plaintext";
  let highlight: ReturnType<Attacher> | undefined;
  return async (tree, file) => {
    const blocks = findCodeBlocks(tree as HastNode, defaultLanguage);
    if (blocks.length === 0) return;
    if (injected.size > 0) await Promise.all(blocks.map((block) => languages.inspect(block.lang)));
    if (injected.size === 0 || blocks.every((block) => usable(block.lang))) {
      const fragments = blocks.map((block) => store.read(block.key));
      if (fragments.every((fragment) => fragment !== undefined)) {
        // Every block is cached, so this file never starts Shiki.
        blocks.forEach(
          (block, i) => (block.parent.children[block.index] = fragments[i] as HastNode),
        );
        return;
      }
    }
    // Fumadocs loads every language of the file before it highlights any block.
    for (const block of blocks) {
      for (const scope of (await languages.inspect(block.lang)).injectTo) injected.add(scope);
    }
    for (const block of blocks) highlighting.set(block.key, { lang: block.lang });
    try {
      highlight ??= rehypeCode.call(this, { ...resolved, cache });
      await highlight(tree, file, () => undefined);
    } finally {
      for (const block of blocks) highlighting.delete(block.key);
    }
  };
}
