import "@sveltejs/kit/internal";
import "./exports.js";
import "./utils.js";
import "@sveltejs/kit/internal/server";
import "./root.js";
import "./state.svelte.js";
function defineDocs(config2) {
  return {
    entry: config2.entry ?? "docs",
    contentDir: config2.contentDir,
    theme: config2.theme,
    nav: config2.nav,
    github: config2.github,
    themeToggle: config2.themeToggle,
    breadcrumb: config2.breadcrumb,
    sidebar: config2.sidebar,
    components: config2.components,
    icons: config2.icons,
    pageActions: config2.pageActions,
    lastUpdated: config2.lastUpdated,
    llmsTxt: config2.llmsTxt,
    ai: config2.ai,
    ordering: config2.ordering,
    metadata: config2.metadata,
    og: config2.og
  };
}
function deepMerge(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();
  if (!source) return target;
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (sourceVal && typeof sourceVal === "object" && !Array.isArray(sourceVal) && targetVal && typeof targetVal === "object" && !Array.isArray(targetVal)) result[key] = deepMerge(targetVal, sourceVal);
    else if (sourceVal !== void 0) result[key] = sourceVal;
  }
  if (sources.length) return deepMerge(result, ...sources);
  return result;
}
function createTheme(baseTheme) {
  return function themeFactory(overrides = {}) {
    const merged = deepMerge(baseTheme, overrides);
    if (overrides.ui?.colors) merged._userColorOverrides = { ...overrides.ui.colors };
    return merged;
  };
}
const JSXBrackets = /* @__PURE__ */ new Set(["<", ">", "{", "}", "[", "]"]);
/* @__PURE__ */ new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "=",
  "!",
  "&",
  "|",
  "^",
  "~",
  "!",
  "?",
  ":",
  ".",
  ",",
  ";",
  `'`,
  '"',
  ".",
  "(",
  ")",
  "[",
  "]",
  "#",
  "@",
  "\\",
  ...JSXBrackets
]);
const TokenTypes = (
  /** @type {const} */
  [
    "identifier",
    "keyword",
    "string",
    "class",
    "property",
    "entity",
    "jsxliterals",
    "sign",
    "comment",
    "break",
    "space"
  ]
);
({
  TokenMap: new Map(TokenTypes.map((type, i) => [type, i]))
});
const GreenTreeUIDefaults = {
  colors: {
    primary: "#0D9373",
    background: "#fff",
    muted: "#505351",
    border: "#DFE1E0"
  },
  typography: {
    font: {
      style: {
        sans: "Inter, -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif",
        mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
      },
      h1: { size: "2.25rem", weight: 500, lineHeight: "1.2", letterSpacing: "-0.025em" },
      h2: { size: "1.875rem", weight: 600, lineHeight: "1.25", letterSpacing: "-0.02em" },
      h3: { size: "1.5rem", weight: 600, lineHeight: "1.3", letterSpacing: "-0.01em" },
      h4: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.7" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 240,
    toc: { enabled: true, depth: 3, style: "default" },
    header: { height: 56, sticky: true }
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" }
  }
};
const greentree = createTheme({
  name: "greentree",
  ui: GreenTreeUIDefaults
});
const config = defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: greentree({
    ui: {
      colors: {
        primary: "oklch(0.985 0.001 106.423)",
        background: "hsl(0 0% 2%)"
      },
      typography: {
        font: {
          style: {
            sans: "system-ui, -apple-system, sans-serif",
            mono: "ui-monospace, monospace"
          },
          h1: { size: "2.25rem", weight: 700, letterSpacing: "-0.02em" },
          h2: { size: "1.5rem", weight: 600, letterSpacing: "-0.01em" },
          h3: { size: "1.25rem", weight: 600 },
          body: { size: "1rem", lineHeight: "1.75" }
        }
      }
    }
  }),
  github: {
    url: "https://github.com/farming-labs/docs",
    branch: "main",
    directory: "examples/sveltekit/docs"
  },
  ai: {
    enabled: true,
    model: {
      models: [
        { id: "gpt-4o-mini", label: "GPT-4o mini (fast)" },
        { id: "gpt-4o", label: "GPT-4o (quality)" }
      ],
      defaultModel: "gpt-4o-mini"
    },
    maxResults: 5,
    aiLabel: "DocsBot",
    floatingStyle: "full-modal",
    mode: "floating",
    position: "bottom-right",
    packageName: "@farming-labs/docs",
    docsUrl: "https://docs.farming-labs.dev",
    suggestedQuestions: [
      "How do I get started?",
      "What databases are supported?",
      "How do I configure authentication?",
      "How do I set up social sign-on?"
    ]
  },
  nav: {
    title: "Example Docs",
    url: "/docs"
  },
  themeToggle: { enabled: true, default: "dark" },
  breadcrumb: { enabled: true },
  metadata: {
    titleTemplate: "%s – Docs",
    description: "Awesome docs powered by @farming-labs/docs (SvelteKit)"
  },
  pageActions: {
    alignment: "right",
    copyMarkdown: { enabled: true },
    openDocs: {
      enabled: true,
      providers: [
        {
          name: "ChatGPT",
          urlTemplate: "https://chatgpt.com/?hints=search&q=Read+{mdxUrl},+I+want+to+ask+questions+about+it."
        },
        {
          name: "Claude",
          urlTemplate: "https://claude.ai/new?q=Read+{mdxUrl},+I+want+to+ask+questions+about+it."
        }
      ]
    }
  },
  lastUpdated: { enabled: true, position: "below-title" },
  llmsTxt: { enabled: true, baseUrl: "https://docs.farming-labs.dev" },
  ordering: "numeric"
});
export {
  config as c
};
