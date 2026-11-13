import type { DocsMdxOptions, DocsMdxPlugin } from "./types.js";

export interface ResolvedDocsMdxOptions {
  remarkPlugins: DocsMdxPlugin[];
  rehypePlugins: DocsMdxPlugin[];
  codeHighlighter: DocsMdxPlugin | undefined;
}

const MDX_OPTION_KEYS = ["remarkPlugins", "rehypePlugins", "codeHighlighter"];

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isJsonValue = (value: unknown, seen = new Set<object>()): boolean => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  if (!Array.isArray(value) && !isPlainObject(value)) return false;
  seen.add(value);
  const valid = Object.values(value).every((item) => isJsonValue(item, seen));
  seen.delete(value);
  return valid;
};

/**
 * Validate `mdx` from docs.config and copy it. Throws every problem at once.
 */
export function resolveDocsMdxOptions(options: DocsMdxOptions | undefined): ResolvedDocsMdxOptions {
  if (options !== undefined && !isPlainObject(options)) {
    throw new TypeError(
      "`mdx` must be an object with `remarkPlugins`, `rehypePlugins` or `codeHighlighter`.",
    );
  }
  const issues = Object.keys(options ?? {})
    .filter((key) => !MDX_OPTION_KEYS.includes(key))
    .map(
      (key) =>
        `Unknown \`mdx.${key}\`. Use \`remarkPlugins\`, \`rehypePlugins\` or \`codeHighlighter\`.`,
    );

  const copy = (plugin: unknown, key: string): DocsMdxPlugin[] => {
    const module = Array.isArray(plugin) ? plugin[0] : plugin;
    if (
      typeof module !== "string" ||
      !module.trim() ||
      (Array.isArray(plugin) && plugin.length > 2)
    ) {
      issues.push(
        `\`${key}\` must be an MDX plugin module name or path, or a [module, JSON options] tuple.`,
      );
      return [];
    }
    if (!Array.isArray(plugin)) return [module];
    if (plugin[1] === undefined) return [[module]];
    if (!isJsonValue(plugin[1])) {
      issues.push(
        `The MDX plugin ${JSON.stringify(module)} at \`${key}\` needs JSON-serializable options. Put callbacks in the plugin module instead.`,
      );
      return [];
    }
    // MDX loaders replace a tuple's module with the imported function, so never hand them the caller's.
    return [[module, JSON.parse(JSON.stringify(plugin[1]))]];
  };
  const list = (key: "remarkPlugins" | "rehypePlugins") => {
    const plugins: unknown = options?.[key];
    if (plugins === undefined) return [];
    if (!Array.isArray(plugins)) {
      issues.push(`\`mdx.${key}\` must be an array of MDX plugins.`);
      return [];
    }
    return plugins.flatMap((plugin, index) => copy(plugin, `mdx.${key}[${index}]`));
  };

  const resolved: ResolvedDocsMdxOptions = {
    remarkPlugins: list("remarkPlugins"),
    rehypePlugins: list("rehypePlugins"),
    codeHighlighter:
      options?.codeHighlighter === undefined
        ? undefined
        : copy(options.codeHighlighter, "mdx.codeHighlighter")[0],
  };
  if (issues.length === 1) throw new TypeError(issues[0]);
  if (issues.length > 1) throw new TypeError(`Invalid \`mdx\` options:\n- ${issues.join("\n- ")}`);
  return resolved;
}
