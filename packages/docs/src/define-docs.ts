import type { DocsConfig } from "./types.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function definedEntries(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

/**
 * Merge the theme's `configDefaults` under `config`. An option the config sets wins; when both
 * are objects, the config's keys are merged over the theme's, one level deep.
 */
export function applyThemeConfigDefaults<Config extends DocsConfig>(config: Config): Config {
  const defaults = config.theme?.configDefaults;
  if (!isPlainObject(defaults)) return config;
  const resolved = { ...config } as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(defaults)) {
    if (fallback === undefined) continue;
    const own = resolved[key];
    if (own === undefined) resolved[key] = fallback;
    else if (isPlainObject(own) && isPlainObject(fallback)) {
      resolved[key] = { ...fallback, ...definedEntries(own) };
    }
  }
  return resolved as Config;
}

/**
 * Define docs configuration. Validates and returns the config, with the theme's
 * `configDefaults` merged under it.
 */
export function defineDocs(input: DocsConfig): DocsConfig {
  const config = applyThemeConfigDefaults(input);
  return {
    entry: config.entry ?? "docs",
    docsPath: config.docsPath,
    contentDir: config.contentDir,
    roots: config.roots,
    footer: config.footer,
    i18n: config.i18n,
    theme: config.theme,
    nav: config.nav,
    github: config.github,
    themeToggle: config.themeToggle,
    breadcrumb: config.breadcrumb,
    sidebar: config.sidebar,
    components: config.components,
    analytics: config.analytics,
    telemetry: config.telemetry,
    cloud: config.cloud,
    observability: config.observability,
    onCopyClick: config.onCopyClick,
    codeBlocks: config.codeBlocks,
    feedback: config.feedback,
    search: config.search,
    mcp: config.mcp,
    icons: config.icons,
    pageActions: config.pageActions,
    lastUpdated: config.lastUpdated,
    readingTime: config.readingTime,
    llmsTxt: config.llmsTxt,
    sitemap: config.sitemap,
    robots: config.robots,
    ai: config.ai,
    ordering: config.ordering,
    metadata: config.metadata,
    og: config.og,
    changelog: config.changelog,
    apiReference: config.apiReference,
    agent: config.agent,
    review: config.review,
  };
}
