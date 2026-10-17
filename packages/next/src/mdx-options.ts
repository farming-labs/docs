export type DocsMdxValue =
  | string
  | number
  | boolean
  | null
  | DocsMdxValue[]
  | { [key: string]: DocsMdxValue };

/** Module names/paths and JSON options work with both Webpack and Turbopack. */
export type DocsMdxPlugin = string | [module: string, options?: DocsMdxValue];

export interface WithDocsOptions {
  mdx?: {
    /** Additional remark plugins, run after the built-in remark plugins. */
    remarkPlugins?: DocsMdxPlugin[];
    /** Additional rehype plugins, run after the built-in rehype plugins. */
    rehypePlugins?: DocsMdxPlugin[];
    /** Replace only the syntax-highlighting plugin; metadata and TOC stay enabled. */
    codeHighlighter?: DocsMdxPlugin;
  };
}

function isJsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    return false;
  seen.add(value);
  const valid = Object.values(value).every((item) => isJsonValue(item, seen));
  seen.delete(value);
  return valid;
}

function copyPlugin(plugin: DocsMdxPlugin): DocsMdxPlugin {
  const module = Array.isArray(plugin) ? plugin[0] : plugin;
  if (
    typeof module !== "string" ||
    !module.trim() ||
    (Array.isArray(plugin) && plugin.length > 2)
  ) {
    throw new TypeError(
      "withDocs MDX plugins must be module names/paths or [module, JSON options] tuples.",
    );
  }
  if (!Array.isArray(plugin)) return plugin;
  if (plugin[1] === undefined) return [module];
  if (!isJsonValue(plugin[1])) {
    throw new TypeError(
      `withDocs MDX plugin ${module} requires JSON-serializable options for Turbopack. Put callbacks in the plugin module instead.`,
    );
  }
  // Next's MDX loader replaces module strings in tuples with imported functions.
  // Never give it a caller-owned tuple or mutable options object.
  return [module, JSON.parse(JSON.stringify(plugin[1]))];
}

export function resolveMdxExtensions(options: WithDocsOptions["mdx"]) {
  return {
    remarkPlugins: (options?.remarkPlugins ?? []).map(copyPlugin),
    rehypePlugins: (options?.rehypePlugins ?? []).map(copyPlugin),
    codeHighlighter:
      options?.codeHighlighter === undefined ? undefined : copyPlugin(options.codeHighlighter),
  };
}
