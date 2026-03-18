import path from "node:path";

// ---------------------------------------------------------------------------
// File templates for the init CLI.
// Each function returns the file content as a string.
// ---------------------------------------------------------------------------

export interface TemplateConfig {
  /** Docs entry folder, e.g. "docs" */
  entry: string;
  /** Theme name, e.g. "fumadocs", or "custom" when using a custom theme */
  theme: string;
  /** When theme is "custom", the name for the theme file (e.g. "my-theme") */
  customThemeName?: string;
  /** Project name from package.json */
  projectName: string;
  /** Framework being used */
  framework: "nextjs" | "tanstack-start" | "sveltekit" | "astro" | "nuxt";
  /** Whether to use path aliases (@/ for Next.js, $lib/ for SvelteKit, ~/ for Nuxt) */
  useAlias: boolean;
  /** Astro deployment adapter (only used when framework is "astro") */
  astroAdapter?: "vercel" | "netlify" | "node" | "cloudflare";
  /** Next.js only: "app" or "src/app" — where the App Router lives. Default "app". */
  nextAppDir?: "app" | "src/app";
  /** Optional i18n scaffold config for query-param locale support. */
  i18n?: {
    locales: string[];
    defaultLocale: string;
  };
  /** Optional API reference scaffold config. */
  apiReference?: {
    path: string;
    routeRoot: string;
  };
}

// ---------------------------------------------------------------------------
// Theme info
// ---------------------------------------------------------------------------

interface ThemeInfo {
  factory: string;
  nextImport: string;
  svelteImport: string;
  astroImport: string;
  nuxtImport: string;
  nextCssImport: string;
  svelteCssTheme: string;
  astroCssTheme: string;
  nuxtCssTheme: string;
}

const THEME_INFO: Record<string, ThemeInfo> = {
  fumadocs: {
    factory: "fumadocs",
    nextImport: "@farming-labs/theme",
    svelteImport: "@farming-labs/svelte-theme",
    astroImport: "@farming-labs/astro-theme",
    nuxtImport: "@farming-labs/nuxt-theme",
    nextCssImport: "default",
    svelteCssTheme: "fumadocs",
    astroCssTheme: "fumadocs",
    nuxtCssTheme: "fumadocs",
  },
  darksharp: {
    factory: "darksharp",
    nextImport: "@farming-labs/theme/darksharp",
    svelteImport: "@farming-labs/svelte-theme/darksharp",
    astroImport: "@farming-labs/astro-theme/darksharp",
    nuxtImport: "@farming-labs/nuxt-theme/darksharp",
    nextCssImport: "darksharp",
    svelteCssTheme: "darksharp",
    astroCssTheme: "darksharp",
    nuxtCssTheme: "darksharp",
  },
  "pixel-border": {
    factory: "pixelBorder",
    nextImport: "@farming-labs/theme/pixel-border",
    svelteImport: "@farming-labs/svelte-theme/pixel-border",
    astroImport: "@farming-labs/astro-theme/pixel-border",
    nuxtImport: "@farming-labs/nuxt-theme/pixel-border",
    nextCssImport: "pixel-border",
    svelteCssTheme: "pixel-border",
    astroCssTheme: "pixel-border",
    nuxtCssTheme: "pixel-border",
  },
  colorful: {
    factory: "colorful",
    nextImport: "@farming-labs/theme/colorful",
    svelteImport: "@farming-labs/svelte-theme/colorful",
    astroImport: "@farming-labs/astro-theme/colorful",
    nuxtImport: "@farming-labs/nuxt-theme/colorful",
    nextCssImport: "colorful",
    svelteCssTheme: "colorful",
    astroCssTheme: "colorful",
    nuxtCssTheme: "colorful",
  },
  darkbold: {
    factory: "darkbold",
    nextImport: "@farming-labs/theme/darkbold",
    svelteImport: "@farming-labs/svelte-theme/darkbold",
    astroImport: "@farming-labs/astro-theme/darkbold",
    nuxtImport: "@farming-labs/nuxt-theme/darkbold",
    nextCssImport: "darkbold",
    svelteCssTheme: "darkbold",
    astroCssTheme: "darkbold",
    nuxtCssTheme: "darkbold",
  },
  shiny: {
    factory: "shiny",
    nextImport: "@farming-labs/theme/shiny",
    svelteImport: "@farming-labs/svelte-theme/shiny",
    astroImport: "@farming-labs/astro-theme/shiny",
    nuxtImport: "@farming-labs/nuxt-theme/shiny",
    nextCssImport: "shiny",
    svelteCssTheme: "shiny",
    astroCssTheme: "shiny",
    nuxtCssTheme: "shiny",
  },
  greentree: {
    factory: "greentree",
    nextImport: "@farming-labs/theme/greentree",
    svelteImport: "@farming-labs/svelte-theme/greentree",
    astroImport: "@farming-labs/astro-theme/greentree",
    nuxtImport: "@farming-labs/nuxt-theme/greentree",
    nextCssImport: "greentree",
    svelteCssTheme: "greentree",
    astroCssTheme: "greentree",
    nuxtCssTheme: "greentree",
  },
};

function getThemeInfo(theme: string): ThemeInfo {
  return THEME_INFO[theme] ?? THEME_INFO.fumadocs;
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

function stripScriptExtension(value: string): string {
  return value.replace(/\.(?:[cm]?[jt]sx?)$/i, "");
}

function relativeImport(fromFile: string, toFile: string): string {
  const fromPosix = toPosixPath(fromFile);
  const toPosix = stripScriptExtension(toPosixPath(toFile));
  const rel = path.posix.relative(path.posix.dirname(fromPosix), toPosix);
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function relativeAssetPath(fromFile: string, toFile: string): string {
  const fromPosix = toPosixPath(fromFile);
  const toPosix = toPosixPath(toFile);
  const rel = path.posix.relative(path.posix.dirname(fromPosix), toPosix);
  return rel.startsWith(".") ? rel : `./${rel}`;
}

function extractImportSpecifier(importLine: string): string | null {
  const fromMatch = importLine.match(/\bfrom\s+["']([^"']+)["']/);
  if (fromMatch) return fromMatch[1];

  const bareImportMatch = importLine.match(/^\s*import\s+["']([^"']+)["']/);
  if (bareImportMatch) return bareImportMatch[1];

  return null;
}

function addImportLine(content: string, importLine: string): string {
  if (content.includes(importLine)) return content;

  const specifier = extractImportSpecifier(importLine);
  if (specifier) {
    const importPattern = new RegExp(
      String.raw`\bimport(?:\s+type)?[\s\S]*?\bfrom\s+["']${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']|^\s*import\s+["']${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
      "m",
    );
    if (importPattern.test(content)) return content;
  }

  const lines = content.split("\n");
  const lastImportIdx = lines.reduce((acc, line, index) => {
    const trimmed = line.trimStart();
    return trimmed.startsWith("import ") || trimmed.startsWith("import type ") ? index : acc;
  }, -1);

  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  } else {
    lines.unshift(importLine, "");
  }

  return lines.join("\n");
}

function renderI18nConfig(cfg: TemplateConfig, indent = "  "): string {
  const i18n = cfg.i18n;
  if (!i18n || i18n.locales.length === 0) return "";

  const localeList = i18n.locales.map((locale) => `"${locale}"`).join(", ");
  return `${indent}i18n: {\n${indent}  locales: [${localeList}],\n${indent}  defaultLocale: "${i18n.defaultLocale}",\n${indent}},\n`;
}

function renderApiReferenceConfig(cfg: TemplateConfig, indent = "  "): string {
  const apiReference = cfg.apiReference;
  if (!apiReference) return "";

  return `${indent}apiReference: {\n${indent}  enabled: true,\n${indent}  path: "${apiReference.path}",\n${indent}  routeRoot: "${apiReference.routeRoot}",\n${indent}},\n`;
}

function toLocaleImportName(locale: string): string {
  return `LocalePage_${locale.replace(/[^a-zA-Z0-9_$]/g, "_")}`;
}

export function getThemeExportName(themeName: string): string {
  const base = themeName.replace(/\.ts$/i, "").trim();
  if (!base) return "customTheme";
  return base.replace(/-([a-z])/g, (_, c) => c.toUpperCase()).replace(/^./, (c) => c.toLowerCase());
}

export function getCustomThemeCssImportPath(globalCssRelPath: string, themeName: string): string {
  if (globalCssRelPath.startsWith("app/")) return `../themes/${themeName}.css`;
  if (globalCssRelPath.startsWith("src/")) return `../../themes/${themeName}.css`;
  return `../themes/${themeName}.css`;
}

/** Content for themes/{name}.ts - createTheme with the given name */
export function customThemeTsTemplate(themeName: string): string {
  const exportName = getThemeExportName(themeName);
  return `\
import { createTheme } from "@farming-labs/docs";

export const ${exportName} = createTheme({
  name: "${themeName.replace(/\.ts$/i, "")}",
  ui: {
    colors: {
      primary: "#e11d48",
      background: "#09090b",
      foreground: "#fafafa",
      muted: "#71717a",
      border: "#27272a",
    },
    radius: "0.5rem",
  },
});
`;
}

export function customThemeCssTemplate(themeName: string): string {
  return `\
/* Custom theme: ${themeName} - edit variables and selectors as needed */
@import "@farming-labs/theme/presets/black";

.dark {
  --color-fd-primary: #e11d48;
  --color-fd-background: #09090b;
  --color-fd-border: #27272a;
  --radius: 0.5rem;
}
`;
}

// ---------------------------------------------------------------------------
// Import path helpers
//
// Next.js: docs.config.ts at project root
//   alias:    @/docs.config
//   relative: computed from file location to root
//
// SvelteKit: docs.config.ts at src/lib/docs.config.ts
//   alias:    $lib/docs.config.js
//   relative: computed from file location to src/lib/
// ---------------------------------------------------------------------------

/** Config import for Next.js root layout → root docs.config */
function nextRootLayoutConfigImport(
  useAlias: boolean,
  nextAppDir: "app" | "src/app" = "app",
): string {
  if (useAlias) return "@/docs.config";
  return nextAppDir === "src/app" ? "../../docs.config" : "../docs.config";
}

/** Config import for Next.js app/{entry}/layout.tsx → root docs.config */
function nextDocsLayoutConfigImport(
  useAlias: boolean,
  nextAppDir: "app" | "src/app" = "app",
): string {
  if (useAlias) return "@/docs.config";
  return nextAppDir === "src/app" ? "../../../docs.config" : "../../docs.config";
}

function nextApiReferenceConfigImport(
  useAlias: boolean,
  nextAppDir: "app" | "src/app" = "app",
  filePath: string,
): string {
  if (useAlias) return "@/docs.config";
  return relativeImport(filePath, "docs.config.ts");
}

/** Config import for SvelteKit src/lib/docs.server.ts → src/lib/docs.config */
function svelteServerConfigImport(useAlias: boolean): string {
  return useAlias ? "$lib/docs.config" : "./docs.config";
}

/** Config import for SvelteKit src/routes/{entry}/+layout.svelte → src/lib/docs.config */
function svelteLayoutConfigImport(useAlias: boolean): string {
  return useAlias ? "$lib/docs.config" : "../../lib/docs.config";
}

/** Config import for SvelteKit src/routes/{entry}/[...slug]/+page.svelte → src/lib/docs.config */
function sveltePageConfigImport(useAlias: boolean): string {
  return useAlias ? "$lib/docs.config" : "../../../lib/docs.config";
}

/** Server import for SvelteKit +layout.server.js → src/lib/docs.server */
function svelteLayoutServerImport(useAlias: boolean): string {
  return useAlias ? "$lib/docs.server" : "../../lib/docs.server";
}

// ---------------------------------------------------------------------------
// Astro import path helpers
// ---------------------------------------------------------------------------

function astroServerConfigImport(useAlias: boolean): string {
  return useAlias ? "@/lib/docs.config" : "./docs.config";
}

function astroPageConfigImport(useAlias: boolean, depth: number): string {
  if (useAlias) return "@/lib/docs.config";
  const prefix = "../".repeat(depth);
  return `${prefix}lib/docs.config`;
}

function astroPageServerImport(useAlias: boolean, depth: number): string {
  if (useAlias) return "@/lib/docs.server";
  const prefix = "../".repeat(depth);
  return `${prefix}lib/docs.server`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Next.js templates
// ═══════════════════════════════════════════════════════════════════════════

export function docsConfigTemplate(cfg: TemplateConfig): string {
  if (cfg.theme === "custom" && cfg.customThemeName) {
    const exportName = getThemeExportName(cfg.customThemeName);
    const themePath = cfg.useAlias
      ? "@/themes/" + cfg.customThemeName.replace(/\.ts$/i, "")
      : "./themes/" + cfg.customThemeName.replace(/\.ts$/i, "");
    return `\
import { defineDocs } from "@farming-labs/docs";
import { ${exportName} } from "${themePath}";

export default defineDocs({
  entry: "${cfg.entry}",
  ${renderI18nConfig(cfg)}${renderApiReferenceConfig(cfg)}  theme: ${exportName}({
    ui: {
      colors: { primary: "#6366f1" },
    },
  }),

  metadata: {
    titleTemplate: "%s – ${cfg.projectName}",
    description: "Documentation for ${cfg.projectName}",
  },
});
`;
  }
  const t = getThemeInfo(cfg.theme);
  return `\
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.nextImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  ${renderI18nConfig(cfg)}${renderApiReferenceConfig(cfg)}  theme: ${t.factory}({
    ui: {
      colors: { primary: "#6366f1" },
    },
  }),

  metadata: {
    titleTemplate: "%s – ${cfg.projectName}",
    description: "Documentation for ${cfg.projectName}",
  },
});
`;
}

export function nextConfigTemplate(): string {
  return `\
import { withDocs } from "@farming-labs/next/config";

export default withDocs();
`;
}

export function nextConfigMergedTemplate(existingContent: string): string {
  if (existingContent.includes("withDocs")) return existingContent;

  const lines = existingContent.split("\n");
  const importLine = 'import { withDocs } from "@farming-labs/next/config";';

  const exportIdx = lines.findIndex((l) => l.match(/export\s+default/));

  if (exportIdx === -1) {
    return `${importLine}\n\n${existingContent}\n\nexport default withDocs();\n`;
  }

  const lastImportIdx = lines.reduce(
    (acc, l, i) => (l.trimStart().startsWith("import ") ? i : acc),
    -1,
  );

  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  } else {
    lines.unshift(importLine, "");
  }

  const adjustedExportIdx =
    exportIdx + (lastImportIdx >= 0 ? (exportIdx > lastImportIdx ? 1 : 0) : 2);
  const exportLine = lines[adjustedExportIdx];

  const simpleMatch = exportLine.match(/^(\s*export\s+default\s+)(.*?)(;?\s*)$/);
  if (simpleMatch) {
    const [, prefix, value, suffix] = simpleMatch;
    lines[adjustedExportIdx] = `${prefix}withDocs(${value})${suffix}`;
  }

  return lines.join("\n");
}

export function rootLayoutTemplate(
  cfg: TemplateConfig,
  globalCssRelPath = "app/globals.css",
): string {
  let cssImport: string;
  if (globalCssRelPath.startsWith("app/")) {
    cssImport = "./" + globalCssRelPath.slice("app/".length);
  } else if (globalCssRelPath.startsWith("src/app/")) {
    cssImport = "./" + globalCssRelPath.slice("src/app/".length);
  } else {
    cssImport = "../" + globalCssRelPath;
  }

  const appDir = cfg.nextAppDir ?? "app";
  const configImport = nextRootLayoutConfigImport(cfg.useAlias, appDir);

  return `\
import type { Metadata } from "next";
import { RootProvider } from "@farming-labs/theme";
import docsConfig from "${configImport}";
import "${cssImport}";

export const metadata: Metadata = {
  title: {
    default: "Docs",
    template: docsConfig.metadata?.titleTemplate ?? "%s",
  },
  description: docsConfig.metadata?.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
`;
}

/**
 * Injects RootProvider (import + wrapper) into an existing root layout without overwriting.
 * Returns the modified content, or null if RootProvider is already present or injection isn't possible.
 */
export function injectRootProviderIntoLayout(content: string): string | null {
  if (!content || content.includes("RootProvider")) return null;

  let out = content;

  // Add import: after the last line that looks like an import
  const themeImport = 'import { RootProvider } from "@farming-labs/theme";';
  if (!out.includes("@farming-labs/theme")) {
    const lines = out.split("\n");
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();
      if (trimmed.startsWith("import ") || trimmed.startsWith("import type ")) {
        lastImportIdx = i;
      }
    }
    if (lastImportIdx >= 0) {
      lines.splice(lastImportIdx + 1, 0, themeImport);
      out = lines.join("\n");
    } else {
      out = themeImport + "\n" + out;
    }
  }

  if (!out.includes("<RootProvider>")) {
    const childrenPattern = /\{children\}/;
    if (childrenPattern.test(out)) {
      out = out.replace(childrenPattern, "<RootProvider>{children}</RootProvider>");
    }
  }

  return out === content ? null : out;
}

export function globalCssTemplate(
  theme: string,
  customThemeName?: string,
  globalCssRelPath?: string,
): string {
  if (theme === "custom" && customThemeName && globalCssRelPath) {
    const cssPath = getCustomThemeCssImportPath(
      globalCssRelPath,
      customThemeName.replace(/\.css$/i, ""),
    );
    return `\
@import "tailwindcss";
@import "${cssPath}";
`;
  }
  const t = getThemeInfo(theme);
  return `\
@import "tailwindcss";
@import "@farming-labs/theme/${t.nextCssImport}/css";
`;
}

export function injectCssImport(
  existingContent: string,
  theme: string,
  customThemeName?: string,
  globalCssRelPath?: string,
): string | null {
  const importLine =
    theme === "custom" && customThemeName && globalCssRelPath
      ? `@import "${getCustomThemeCssImportPath(globalCssRelPath, customThemeName.replace(/\.css$/i, ""))}";`
      : `@import "@farming-labs/theme/${getThemeInfo(theme).nextCssImport}/css";`;
  if (existingContent.includes(importLine)) return null;
  if (
    theme !== "custom" &&
    existingContent.includes("@farming-labs/theme/") &&
    existingContent.includes("/css")
  )
    return null;
  if (theme === "custom" && existingContent.includes("themes/") && existingContent.includes(".css"))
    return null;
  const lines = existingContent.split("\n");
  const lastImportIdx = lines.reduce(
    (acc, l, i) => (l.trimStart().startsWith("@import") ? i : acc),
    -1,
  );
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  } else {
    lines.unshift(importLine);
  }
  return lines.join("\n");
}

export function docsLayoutTemplate(cfg: TemplateConfig): string {
  const appDir = cfg.nextAppDir ?? "app";
  const configImport = nextDocsLayoutConfigImport(cfg.useAlias, appDir);
  return `\
import docsConfig from "${configImport}";
import { createDocsLayout, createDocsMetadata } from "@farming-labs/theme";

export const metadata = createDocsMetadata(docsConfig);

const DocsLayout = createDocsLayout(docsConfig);

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DocsLayout>{children}</DocsLayout>
    </>
  );
}
`;
}

export function nextApiReferenceRouteTemplate(cfg: TemplateConfig, filePath: string): string {
  const appDir = cfg.nextAppDir ?? "app";
  const configImport = nextApiReferenceConfigImport(cfg.useAlias, appDir, filePath);

  return `
import docsConfig from "${configImport}";
import { createNextApiReference } from "@farming-labs/next/api-reference";

export const GET = createNextApiReference(docsConfig);

export const revalidate = false;
`;
}

export function nextLocaleDocPageTemplate(defaultLocale: string): string {
  return `\
import type { ComponentType } from "react";

type SearchParams = Promise<{ lang?: string | string[] | undefined }> | undefined;

function normalizeLang(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function resolveLocaleDocPage<T extends ComponentType>(
  searchParams: SearchParams,
  pages: Record<string, T>,
  fallbackLocale = "${defaultLocale}",
) {
  const params = (await searchParams) ?? {};
  const locale = normalizeLang(params.lang) ?? fallbackLocale;

  return pages[locale] ?? pages[fallbackLocale];
}
`;
}

export function nextLocalizedPageTemplate(options: {
  locales: string[];
  defaultLocale: string;
  componentName: string;
  helperImport: string;
  pageImports: Array<{ locale: string; importPath: string }>;
}): string {
  const importLines = options.pageImports
    .map(({ locale, importPath }) => `import ${toLocaleImportName(locale)} from "${importPath}";`)
    .join("\n");
  const pageMap = options.pageImports
    .map(({ locale }) => `    ${JSON.stringify(locale)}: ${toLocaleImportName(locale)},`)
    .join("\n");

  return `\
${importLines}
import { resolveLocaleDocPage } from "${options.helperImport}";

type PageProps = {
  searchParams?: Promise<{ lang?: string | string[] | undefined }>;
};

export default async function ${options.componentName}({ searchParams }: PageProps) {
  const Page = await resolveLocaleDocPage(searchParams, {
${pageMap}
  }, "${options.defaultLocale}");

  return <Page />;
}
`;
}

export function postcssConfigTemplate(): string {
  return `\
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
`;
}

/** @param useAlias - When false, paths (e.g. @/*) are omitted so no alias is added. */
export function tsconfigTemplate(useAlias = false): string {
  const pathsBlock = useAlias ? ',\n    "paths": { "@/*": ["./*"] }' : "";
  return `\
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }]${pathsBlock}
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
`;
}

// ---------------------------------------------------------------------------
// Next.js sample pages
// ---------------------------------------------------------------------------

export function welcomePageTemplate(cfg: TemplateConfig): string {
  const appDir = cfg.nextAppDir ?? "app";
  return `\
---
title: "Documentation"
description: "Welcome to ${cfg.projectName} documentation"
---

# Welcome to ${cfg.projectName}

Get started with our documentation. Browse the pages on the left to learn more.

<Callout type="info">
  This documentation was generated by \`@farming-labs/docs\`. Edit the MDX files in \`${appDir}/${cfg.entry}/\` to customize.
</Callout>

## Overview

This is your documentation home page. From here you can navigate to:

- [Installation](/${cfg.entry}/installation) — How to install and set up the project
- [Quickstart](/${cfg.entry}/quickstart) — Get up and running in minutes

## Features

- **MDX Support** — Write docs with Markdown and React components
- **Syntax Highlighting** — Code blocks with automatic highlighting
- **Dark Mode** — Built-in theme switching
- **Search** — Full-text search across all pages
- **Responsive** — Works on any screen size

---

## Next Steps

Start by reading the [Installation](/${cfg.entry}/installation) guide, then follow the [Quickstart](/${cfg.entry}/quickstart) to build something.
`;
}

export function installationPageTemplate(cfg: TemplateConfig): string {
  const t = getThemeInfo(cfg.theme);
  return `\
---
title: "Installation"
description: "How to install and set up ${cfg.projectName}"
---

# Installation

Follow these steps to install and configure ${cfg.projectName}.

<Callout type="info">
  Prerequisites: Node.js 18+ and a package manager (pnpm, npm, or yarn).
</Callout>

## Install Dependencies

\`\`\`bash
pnpm add @farming-labs/docs
\`\`\`

## Configuration

Your project includes a \`docs.config.ts\` at the root:

\`\`\`ts
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.nextImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  theme: ${t.factory}({
    ui: { colors: { primary: "#6366f1" } },
  }),
});
\`\`\`

## Project Structure

\`\`\`
${cfg.nextAppDir ?? "app"}/
  ${cfg.entry}/
    layout.tsx          # Docs layout
    page.mdx            # /${cfg.entry}
    installation/
      page.mdx          # /${cfg.entry}/installation
    quickstart/
      page.mdx          # /${cfg.entry}/quickstart
docs.config.ts          # Docs configuration
next.config.ts          # Next.js config with withDocs()
\`\`\`

## What's Next?

Head to the [Quickstart](/${cfg.entry}/quickstart) guide to start writing your first page.
`;
}

export function quickstartPageTemplate(cfg: TemplateConfig): string {
  const t = getThemeInfo(cfg.theme);
  return `\
---
title: "Quickstart"
description: "Get up and running in minutes"
---

# Quickstart

This guide walks you through creating your first documentation page.

## Creating a Page

Create a new folder under \`${cfg.nextAppDir ?? "app"}/${cfg.entry}/\` with a \`page.mdx\` file:

\`\`\`bash
mkdir -p ${cfg.nextAppDir ?? "app"}/${cfg.entry}/my-page
\`\`\`

Then create \`${cfg.nextAppDir ?? "app"}/${cfg.entry}/my-page/page.mdx\`:

\`\`\`mdx
---
title: "My Page"
description: "A custom documentation page"
---

# My Page

Write your content here using **Markdown** and JSX components.
\`\`\`

Your page is now available at \`/${cfg.entry}/my-page\`.

## Using Components

### Callouts

<Callout type="info">
  This is an informational callout. Use it for tips and notes.
</Callout>

<Callout type="warn">
  This is a warning callout. Use it for important caveats.
</Callout>

### Code Blocks

Code blocks are automatically syntax-highlighted:

\`\`\`typescript
function greet(name: string): string {
  return \\\`Hello, \\\${name}!\\\`;
}

console.log(greet("World"));
\`\`\`

## Customizing the Theme

Edit \`docs.config.ts\` to change colors, typography, and component defaults:

\`\`\`ts
theme: ${t.factory}({
  ui: {
    colors: { primary: "#22c55e" },
  },
}),
\`\`\`

## Deploying

Build your docs for production:

\`\`\`bash
pnpm build
\`\`\`

Deploy to Vercel, Netlify, or any Node.js hosting platform.
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TanStack Start templates
// ═══════════════════════════════════════════════════════════════════════════

export function tanstackDocsConfigTemplate(cfg: TemplateConfig): string {
  if (cfg.theme === "custom" && cfg.customThemeName) {
    const exportName = getThemeExportName(cfg.customThemeName);
    return `\
import { defineDocs } from "@farming-labs/docs";
import { ${exportName} } from "./themes/${cfg.customThemeName.replace(/\.ts$/i, "")}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  ${renderApiReferenceConfig(cfg)}  theme: ${exportName}({
    ui: {
      colors: { primary: "#6366f1" },
    },
  }),
  nav: {
    title: "${cfg.projectName} Docs",
    url: "/${cfg.entry}",
  },
  themeToggle: {
    enabled: true,
    default: "dark",
  },
  metadata: {
    titleTemplate: "%s – ${cfg.projectName}",
    description: "Documentation for ${cfg.projectName}",
  },
});
`;
  }

  const t = getThemeInfo(cfg.theme);
  return `\
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.nextImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  ${renderApiReferenceConfig(cfg)}  theme: ${t.factory}({
    ui: {
      colors: { primary: "#6366f1" },
    },
  }),
  nav: {
    title: "${cfg.projectName} Docs",
    url: "/${cfg.entry}",
  },
  themeToggle: {
    enabled: true,
    default: "dark",
  },
  metadata: {
    titleTemplate: "%s – ${cfg.projectName}",
    description: "Documentation for ${cfg.projectName}",
  },
});
`;
}

export function tanstackDocsServerTemplate(): string {
  return `\
import { createDocsServer } from "@farming-labs/tanstack-start/server";
import docsConfig from "../../docs.config";

export const docsServer = createDocsServer({
  ...docsConfig,
  rootDir: process.cwd(),
});
`;
}

export function tanstackDocsFunctionsTemplate(): string {
  return `\
import { createServerFn } from "@tanstack/react-start";
import { docsServer } from "./docs.server";

export const loadDocPage = createServerFn({ method: "GET" })
  .inputValidator((data: { pathname: string; locale?: string }) => data)
  .handler(async ({ data }) => docsServer.load(data));
`;
}

interface TanstackRouteTemplateOptions {
  entry: string;
  filePath: string;
  useAlias: boolean;
  projectName: string;
}

interface TanstackApiReferenceRouteTemplateOptions {
  filePath: string;
  useAlias: boolean;
  apiReferencePath: string;
  catchAll: boolean;
}

function tanstackDocsFunctionsImport(opts: TanstackRouteTemplateOptions): string {
  if (opts.useAlias) return "@/lib/docs.functions";
  return relativeImport(opts.filePath, "src/lib/docs.functions.ts");
}

function tanstackDocsConfigImport(filePath: string): string {
  return relativeImport(filePath, "docs.config.ts");
}

export function tanstackDocsIndexRouteTemplate(opts: TanstackRouteTemplateOptions): string {
  const entryUrl = `/${opts.entry.replace(/^\/+|\/+$/g, "")}`;
  return `\
import { createFileRoute } from "@tanstack/react-router";
import { TanstackDocsPage } from "@farming-labs/tanstack-start/react";
import { loadDocPage } from "${tanstackDocsFunctionsImport(opts)}";
import docsConfig from "${tanstackDocsConfigImport(opts.filePath)}";

export const Route = createFileRoute("${entryUrl}/")({
  loader: () => loadDocPage({ data: { pathname: "${entryUrl}" } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? \`\${loaderData.title} – ${opts.projectName}\` : "${opts.projectName}" },
      ...(loaderData?.description
        ? [{ name: "description", content: loaderData.description }]
        : []),
    ],
  }),
  component: DocsIndexPage,
});

function DocsIndexPage() {
  const data = Route.useLoaderData();
  return <TanstackDocsPage config={docsConfig} data={data} />;
}
`;
}

export function tanstackDocsCatchAllRouteTemplate(opts: TanstackRouteTemplateOptions): string {
  const entryUrl = `/${opts.entry.replace(/^\/+|\/+$/g, "")}`;
  return `\
import { createFileRoute, notFound } from "@tanstack/react-router";
import { TanstackDocsPage } from "@farming-labs/tanstack-start/react";
import { loadDocPage } from "${tanstackDocsFunctionsImport(opts)}";
import docsConfig from "${tanstackDocsConfigImport(opts.filePath)}";

export const Route = createFileRoute("${entryUrl}/$")({
  loader: async ({ location }) => {
    try {
      return await loadDocPage({ data: { pathname: location.pathname } });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        (error as { status?: unknown }).status === 404
      ) {
        throw notFound();
      }
      throw error;
    }
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? \`\${loaderData.title} – ${opts.projectName}\` : "${opts.projectName}" },
      ...(loaderData?.description
        ? [{ name: "description", content: loaderData.description }]
        : []),
    ],
  }),
  component: DocsCatchAllPage,
});

function DocsCatchAllPage() {
  const data = Route.useLoaderData();
  return <TanstackDocsPage config={docsConfig} data={data} />;
}
`;
}

export function tanstackApiDocsRouteTemplate(useAlias: boolean, filePath: string): string {
  const serverImport = useAlias
    ? "@/lib/docs.server"
    : relativeImport(filePath, "src/lib/docs.server.ts");

  return `\
import { createFileRoute } from "@tanstack/react-router";
import { docsServer } from "${serverImport}";

export const Route = createFileRoute("/api/docs")({
  server: {
    handlers: {
      GET: async ({ request }) => docsServer.GET({ request }),
      POST: async ({ request }) => docsServer.POST({ request }),
    },
  },
});
`;
}

export function tanstackApiReferenceRouteTemplate(
  opts: TanstackApiReferenceRouteTemplateOptions,
): string {
  const routePath = `/${opts.apiReferencePath}${opts.catchAll ? "/$" : "/"}`;

  return `\
import { createFileRoute } from "@tanstack/react-router";
import { createTanstackApiReference } from "@farming-labs/tanstack-start/api-reference";
import docsConfig from "${tanstackDocsConfigImport(opts.filePath)}";

const handler = createTanstackApiReference(docsConfig);

export const Route = createFileRoute("${routePath}")({
  server: {
    handlers: {
      GET: handler,
    },
  },
});
`;
}

export function tanstackRootRouteTemplate(globalCssRelPath: string): string {
  const cssImport = relativeAssetPath("src/routes/__root.tsx", globalCssRelPath);
  return `\
import appCss from "${cssImport}?url";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { RootProvider } from "@farming-labs/theme/tanstack";

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: "stylesheet", href: appCss }],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Docs" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <RootProvider>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
`;
}

export function injectTanstackRootProviderIntoRoute(content: string): string | null {
  if (!content || content.includes("RootProvider")) return null;

  let out = addImportLine(content, 'import { RootProvider } from "@farming-labs/theme/tanstack";');

  if (out.includes("<Outlet />")) {
    out = out.replace("<Outlet />", "<RootProvider><Outlet /></RootProvider>");
  } else if (out.includes("<Outlet></Outlet>")) {
    out = out.replace("<Outlet></Outlet>", "<RootProvider><Outlet /></RootProvider>");
  } else {
    return null;
  }

  return out === content ? null : out;
}

export function tanstackViteConfigTemplate(useAlias: boolean): string {
  return `\
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
${useAlias ? 'import tsconfigPaths from "vite-tsconfig-paths";\n' : ""}import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { docsMdx } from "@farming-labs/tanstack-start/vite";

export default defineConfig({
  plugins: [tailwindcss(), docsMdx(), ${useAlias ? "tsconfigPaths({ ignoreConfigErrors: true }), " : ""}tanstackStart()],
});
`;
}

export function injectTanstackVitePlugins(content: string, useAlias: boolean): string | null {
  if (!content) return null;

  let out = content;
  out = addImportLine(out, 'import tailwindcss from "@tailwindcss/vite";');
  if (useAlias) {
    out = addImportLine(out, 'import tsconfigPaths from "vite-tsconfig-paths";');
  }
  out = addImportLine(out, 'import { docsMdx } from "@farming-labs/tanstack-start/vite";');

  const additions: string[] = [];
  if (!out.includes("tailwindcss()")) additions.push("tailwindcss()");
  if (!out.includes("docsMdx()")) additions.push("docsMdx()");
  if (useAlias && !out.includes("tsconfigPaths("))
    additions.push("tsconfigPaths({ ignoreConfigErrors: true })");

  if (additions.length === 0) {
    return out === content ? null : out;
  }

  const pluginsMatch = out.match(/plugins\s*:\s*\[([\s\S]*?)\]/m);
  if (pluginsMatch) {
    const current = pluginsMatch[1].trim();
    const existing = current ? `${current}${current.endsWith(",") ? "" : ","}` : "";
    const replacement = `plugins: [\n    ${existing}${existing ? "\n    " : ""}${additions.join(",\n    ")}\n  ]`;
    return out.replace(pluginsMatch[0], replacement);
  }

  const configMatch = out.match(/defineConfig\(\s*\{/);
  if (configMatch) {
    const insertion = `defineConfig({\n  plugins: [${additions.join(", ")}],`;
    return out.replace(configMatch[0], insertion);
  }

  return out === content ? null : out;
}

export function tanstackWelcomePageTemplate(cfg: TemplateConfig): string {
  return `\
---
title: "Documentation"
description: "Welcome to ${cfg.projectName} documentation"
---

# Welcome to ${cfg.projectName}

This docs site is powered by \`@farming-labs/docs\` and TanStack Start.

## Overview

- Content lives in \`${cfg.entry}/\`
- Routes live in \`src/routes/${cfg.entry}/\`
- Search is served from \`/api/docs\`

## Next Steps

Read the [Installation](/${cfg.entry}/installation) guide, then continue to [Quickstart](/${cfg.entry}/quickstart).
`;
}

export function tanstackInstallationPageTemplate(cfg: TemplateConfig): string {
  if (cfg.theme === "custom" && cfg.customThemeName) {
    const baseName = cfg.customThemeName.replace(/\.(ts|css)$/i, "");
    const exportName = getThemeExportName(baseName);
    const cssImportPath = getCustomThemeCssImportPath("src/styles/app.css", baseName);
    return `\
---
title: "Installation"
description: "How to install and set up ${cfg.projectName}"
---

# Installation

Add the docs packages to your TanStack Start app:

\`\`\`bash
pnpm add @farming-labs/docs @farming-labs/theme @farming-labs/tanstack-start
\`\`\`

The scaffold also configures MDX through \`docsMdx()\` in \`vite.config.ts\`.

## Theme CSS

Keep your config theme and global CSS import aligned:

\`\`\`ts title="docs.config.ts"
import { defineDocs } from "@farming-labs/docs";
import { ${exportName} } from "./themes/${baseName}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  theme: ${exportName}(),
});
\`\`\`

\`\`\`css title="src/styles/app.css"
@import "tailwindcss";
@import "${cssImportPath}";
\`\`\`

## Generated Files

\`\`\`
docs.config.ts
themes/${baseName}.ts
themes/${baseName}.css
${cfg.entry}/
src/lib/docs.server.ts
src/lib/docs.functions.ts
src/routes/${cfg.entry}/index.tsx
src/routes/${cfg.entry}/$.tsx
src/routes/api/docs.ts
\`\`\`
`;
  }

  const t = getThemeInfo(cfg.theme);
  return `\
---
title: "Installation"
description: "How to install and set up ${cfg.projectName}"
---

# Installation

Add the docs packages to your TanStack Start app:

\`\`\`bash
pnpm add @farming-labs/docs @farming-labs/theme @farming-labs/tanstack-start
\`\`\`

The scaffold also configures MDX through \`docsMdx()\` in \`vite.config.ts\`.

## Theme CSS

Keep your config theme and global CSS import aligned:

\`\`\`ts title="docs.config.ts"
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.nextImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  theme: ${t.factory}(),
});
\`\`\`

\`\`\`css title="src/styles/app.css"
@import "tailwindcss";
@import "@farming-labs/theme/${t.nextCssImport}/css";
\`\`\`

## Generated Files

\`\`\`
docs.config.ts
${cfg.entry}/
src/lib/docs.server.ts
src/lib/docs.functions.ts
src/routes/${cfg.entry}/index.tsx
src/routes/${cfg.entry}/$.tsx
src/routes/api/docs.ts
\`\`\`
`;
}

export function tanstackQuickstartPageTemplate(cfg: TemplateConfig): string {
  return `\
---
title: "Quickstart"
description: "Get up and running in minutes"
---

# Quickstart

Create a new page under \`${cfg.entry}/\`:

\`\`\`bash
mkdir -p ${cfg.entry}/my-page
\`\`\`

Then add \`${cfg.entry}/my-page/page.mdx\`:

\`\`\`mdx
---
title: "My Page"
description: "A custom documentation page"
---

# My Page

Write your content here using **MDX**.
\`\`\`

Visit [/${cfg.entry}/my-page](/${cfg.entry}/my-page) after starting the dev server.
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SvelteKit templates
// ═══════════════════════════════════════════════════════════════════════════

export function svelteDocsConfigTemplate(cfg: TemplateConfig): string {
  if (cfg.theme === "custom" && cfg.customThemeName) {
    const exportName = getThemeExportName(cfg.customThemeName);
    const themePath = "../../themes/" + cfg.customThemeName.replace(/\.ts$/i, "");
    return `\
import { defineDocs } from "@farming-labs/docs";
import { ${exportName} } from "${themePath}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  ${renderI18nConfig(cfg)}${renderApiReferenceConfig(cfg)}  theme: ${exportName}({
    ui: {
      colors: { primary: "#6366f1" },
    },
  }),

  nav: {
    title: "${cfg.projectName}",
    url: "/${cfg.entry}",
  },

  breadcrumb: { enabled: true },

  metadata: {
    titleTemplate: "%s – ${cfg.projectName}",
    description: "Documentation for ${cfg.projectName}",
  },
});
`;
  }
  const t = getThemeInfo(cfg.theme);
  return `\
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.svelteImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  ${renderI18nConfig(cfg)}${renderApiReferenceConfig(cfg)}  theme: ${t.factory}({
    ui: {
      colors: { primary: "#6366f1" },
    },
  }),

  nav: {
    title: "${cfg.projectName}",
    url: "/${cfg.entry}",
  },

  breadcrumb: { enabled: true },

  metadata: {
    titleTemplate: "%s – ${cfg.projectName}",
    description: "Documentation for ${cfg.projectName}",
  },
});
`;
}

export function svelteDocsServerTemplate(cfg: TemplateConfig): string {
  const configImport = svelteServerConfigImport(cfg.useAlias);
  const contentDirName = cfg.entry ?? "docs";
  return `\
import { createDocsServer } from "@farming-labs/svelte/server";
import config from "${configImport}";

// preload for production
const contentFiles = import.meta.glob("/${contentDirName}/**/*.{md,mdx,svx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const { load, GET, POST } = createDocsServer({
  ...config,
  _preloadedContent: contentFiles,
});
`;
}

export function svelteDocsLayoutTemplate(cfg: TemplateConfig): string {
  const configImport = svelteLayoutConfigImport(cfg.useAlias);
  return `\
<script>
  import { DocsLayout } from "@farming-labs/svelte-theme";
  import config from "${configImport}";

  let { data, children } = $props();
</script>

<DocsLayout tree={data.tree} {config}>
  {@render children()}
</DocsLayout>
`;
}

export function svelteDocsLayoutServerTemplate(cfg: TemplateConfig): string {
  const serverImport = svelteLayoutServerImport(cfg.useAlias);
  return `\
export { load } from "${serverImport}";
`;
}

export function svelteDocsPageTemplate(cfg: TemplateConfig): string {
  const configImport = sveltePageConfigImport(cfg.useAlias);
  return `\
<script>
  import { DocsContent } from "@farming-labs/svelte-theme";
  import config from "${configImport}";

  let { data } = $props();
</script>

<DocsContent {data} {config} />
`;
}

export function svelteApiReferenceRouteTemplate(filePath: string, useAlias: boolean): string {
  const configImport = useAlias
    ? "$lib/docs.config"
    : relativeImport(filePath, "src/lib/docs.config.ts");

  return `\
import { createSvelteApiReference } from "@farming-labs/svelte/api-reference";
import config from "${configImport}";

export const GET = createSvelteApiReference(config);
`;
}

export function svelteRootLayoutTemplate(globalCssRelPath: string): string {
  let cssImport: string;
  if (globalCssRelPath.startsWith("src/")) {
    cssImport = "./" + globalCssRelPath.slice("src/".length);
  } else {
    cssImport = "../" + globalCssRelPath;
  }

  return `\
<script>
  import "${cssImport}";

  let { children } = $props();
</script>

{@render children()}
`;
}

export function svelteGlobalCssTemplate(
  theme: string,
  customThemeName?: string,
  globalCssRelPath?: string,
): string {
  if (theme === "custom" && customThemeName && globalCssRelPath)
    return `\
@import "${getCustomThemeCssImportPath(globalCssRelPath, customThemeName.replace(/\.css$/i, ""))}";
`;
  return `\
@import "@farming-labs/svelte-theme/${theme}/css";
`;
}

export function svelteCssImportLine(
  theme: string,
  customThemeName?: string,
  globalCssRelPath?: string,
): string {
  if (theme === "custom" && customThemeName && globalCssRelPath)
    return `@import "${getCustomThemeCssImportPath(globalCssRelPath, customThemeName.replace(/\.css$/i, ""))}";`;
  return `@import "@farming-labs/svelte-theme/${theme}/css";`;
}

export function injectSvelteCssImport(
  existingContent: string,
  theme: string,
  customThemeName?: string,
  globalCssRelPath?: string,
): string | null {
  const importLine = svelteCssImportLine(theme, customThemeName, globalCssRelPath);
  if (existingContent.includes(importLine)) return null;
  if (
    theme !== "custom" &&
    existingContent.includes("@farming-labs/svelte-theme/") &&
    existingContent.includes("/css")
  )
    return null;
  if (theme === "custom" && existingContent.includes("themes/") && existingContent.includes(".css"))
    return null;
  const lines = existingContent.split("\n");
  const lastImportIdx = lines.reduce(
    (acc, l, i) => (l.trimStart().startsWith("@import") ? i : acc),
    -1,
  );
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  } else {
    lines.unshift(importLine);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// SvelteKit sample pages
// ---------------------------------------------------------------------------

export function svelteWelcomePageTemplate(cfg: TemplateConfig): string {
  return `\
---
title: "Documentation"
description: "Welcome to ${cfg.projectName} documentation"
---

# Welcome to ${cfg.projectName}

Get started with our documentation. Browse the pages on the left to learn more.

## Overview

This documentation was generated by \`@farming-labs/docs\`. Edit the markdown files in \`${cfg.entry}/\` to customize.

## Features

- **Markdown Support** — Write docs with standard Markdown
- **Syntax Highlighting** — Code blocks with automatic highlighting
- **Dark Mode** — Built-in theme switching
- **Search** — Full-text search across all pages
- **Responsive** — Works on any screen size

---

## Next Steps

Start by reading the [Installation](/${cfg.entry}/installation) guide, then follow the [Quickstart](/${cfg.entry}/quickstart) to build something.
`;
}

export function svelteInstallationPageTemplate(cfg: TemplateConfig): string {
  const t = getThemeInfo(cfg.theme);
  return `\
---
title: "Installation"
description: "How to install and set up ${cfg.projectName}"
---

# Installation

Follow these steps to install and configure ${cfg.projectName}.

## Prerequisites

- Node.js 18+
- A package manager (pnpm, npm, or yarn)

## Install Dependencies

\`\`\`bash
pnpm add @farming-labs/docs @farming-labs/svelte @farming-labs/svelte-theme
\`\`\`

## Configuration

Your project includes a \`docs.config.ts\` in \`src/lib/\`:

\`\`\`ts title="src/lib/docs.config.ts"
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.svelteImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  theme: ${t.factory}({
    ui: { colors: { primary: "#6366f1" } },
  }),
});
\`\`\`

## Project Structure

\`\`\`
${cfg.entry}/                   # Markdown content
  page.md                      # /${cfg.entry}
  installation/
    page.md                    # /${cfg.entry}/installation
  quickstart/
    page.md                    # /${cfg.entry}/quickstart
src/
  lib/
    docs.config.ts             # Docs configuration
    docs.server.ts             # Server-side docs loader
  routes/
    ${cfg.entry}/
      +layout.svelte           # Docs layout
      +layout.server.js        # Layout data loader
      [...slug]/
        +page.svelte           # Dynamic doc page
\`\`\`

## What's Next?

Head to the [Quickstart](/${cfg.entry}/quickstart) guide to start writing your first page.
`;
}

export function svelteQuickstartPageTemplate(cfg: TemplateConfig): string {
  const t = getThemeInfo(cfg.theme);
  return `\
---
title: "Quickstart"
description: "Get up and running in minutes"
---

# Quickstart

This guide walks you through creating your first documentation page.

## Creating a Page

Create a new folder under \`${cfg.entry}/\` with a \`page.md\` file:

\`\`\`bash
mkdir -p ${cfg.entry}/my-page
\`\`\`

Then create \`${cfg.entry}/my-page/page.md\`:

\`\`\`md
---
title: "My Page"
description: "A custom documentation page"
---

# My Page

Write your content here using **Markdown**.
\`\`\`

Your page is now available at \`/${cfg.entry}/my-page\`.

## Code Blocks

Code blocks are automatically syntax-highlighted:

\`\`\`typescript
function greet(name: string): string {
  return \\\`Hello, \\\${name}!\\\`;
}

console.log(greet("World"));
\`\`\`

## Customizing the Theme

Edit \`src/lib/docs.config.ts\` to change colors, typography, and component defaults:

\`\`\`ts title="src/lib/docs.config.ts"
theme: ${t.factory}({
  ui: {
    colors: { primary: "#22c55e" },
  },
}),
\`\`\`

## Deploying

Build your docs for production:

\`\`\`bash
pnpm build
\`\`\`

Deploy to Vercel, Netlify, or any Node.js hosting platform.
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Astro templates
// ═══════════════════════════════════════════════════════════════════════════

export function astroDocsConfigTemplate(cfg: TemplateConfig): string {
  if (cfg.theme === "custom" && cfg.customThemeName) {
    const exportName = getThemeExportName(cfg.customThemeName);
    const themePath = "../../themes/" + cfg.customThemeName.replace(/\.ts$/i, "");
    return `\
import { defineDocs } from "@farming-labs/docs";
import { ${exportName} } from "${themePath}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  ${renderI18nConfig(cfg)}${renderApiReferenceConfig(cfg)}  theme: ${exportName}({
    ui: {
      colors: { primary: "#6366f1" },
    },
  }),

  nav: {
    title: "${cfg.projectName}",
    url: "/${cfg.entry}",
  },

  breadcrumb: { enabled: true },

  metadata: {
    titleTemplate: "%s – ${cfg.projectName}",
    description: "Documentation for ${cfg.projectName}",
  },
});
`;
  }
  const t = getThemeInfo(cfg.theme);
  return `\
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.astroImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  ${renderI18nConfig(cfg)}${renderApiReferenceConfig(cfg)}  theme: ${t.factory}({
    ui: {
      colors: { primary: "#6366f1" },
    },
  }),

  nav: {
    title: "${cfg.projectName}",
    url: "/${cfg.entry}",
  },

  breadcrumb: { enabled: true },

  metadata: {
    titleTemplate: "%s – ${cfg.projectName}",
    description: "Documentation for ${cfg.projectName}",
  },
});
`;
}

export function astroDocsServerTemplate(cfg: TemplateConfig): string {
  const configImport = astroServerConfigImport(cfg.useAlias);
  const contentDirName = cfg.entry ?? "docs";
  return `\
import { createDocsServer } from "@farming-labs/astro/server";
import config from "${configImport}";

const contentFiles = import.meta.glob("/${contentDirName}/**/*.{md,mdx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const { load, GET, POST } = createDocsServer({
  ...config,
  _preloadedContent: contentFiles,
});
`;
}

const ASTRO_ADAPTER_INFO: Record<string, { pkg: string; import: string }> = {
  vercel: { pkg: "@astrojs/vercel", import: "@astrojs/vercel" },
  netlify: { pkg: "@astrojs/netlify", import: "@astrojs/netlify" },
  node: { pkg: "@astrojs/node", import: "@astrojs/node" },
  cloudflare: { pkg: "@astrojs/cloudflare", import: "@astrojs/cloudflare" },
};

export function getAstroAdapterPkg(adapter: string): string {
  return ASTRO_ADAPTER_INFO[adapter]?.pkg ?? ASTRO_ADAPTER_INFO.vercel.pkg;
}

export function astroConfigTemplate(adapter: string = "vercel"): string {
  const info = ASTRO_ADAPTER_INFO[adapter] ?? ASTRO_ADAPTER_INFO.vercel;
  const adapterCall = adapter === "node" ? `${adapter}({ mode: "standalone" })` : `${adapter}()`;

  return `\
import { defineConfig } from "astro/config";
import ${adapter} from "${info.import}";

export default defineConfig({
  output: "server",
  adapter: ${adapterCall},
});
`;
}

export function astroDocsPageTemplate(cfg: TemplateConfig): string {
  const configImport = astroPageConfigImport(cfg.useAlias, 2);
  const serverImport = astroPageServerImport(cfg.useAlias, 2);
  const t = getThemeInfo(cfg.theme);
  const cssImport = `@farming-labs/astro-theme/${t.astroCssTheme}/css`;
  return `\
---
import DocsLayout from "@farming-labs/astro-theme/src/components/DocsLayout.astro";
import DocsContent from "@farming-labs/astro-theme/src/components/DocsContent.astro";
import SearchDialog from "@farming-labs/astro-theme/src/components/SearchDialog.astro";
import config from "${configImport}";
import { load } from "${serverImport}";
import "${cssImport}";

const data = await load(Astro.url.pathname);
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{data.title} – Docs</title>
  </head>
  <body>
    <DocsLayout tree={data.tree} config={config}>
      <DocsContent data={data} config={config} />
    </DocsLayout>
    <SearchDialog config={config} />
  </body>
</html>
`;
}

export function astroDocsIndexTemplate(cfg: TemplateConfig): string {
  const configImport = astroPageConfigImport(cfg.useAlias, 2);
  const serverImport = astroPageServerImport(cfg.useAlias, 2);
  const t = getThemeInfo(cfg.theme);
  const cssImport = `@farming-labs/astro-theme/${t.astroCssTheme}/css`;
  return `\
---
import DocsLayout from "@farming-labs/astro-theme/src/components/DocsLayout.astro";
import DocsContent from "@farming-labs/astro-theme/src/components/DocsContent.astro";
import SearchDialog from "@farming-labs/astro-theme/src/components/SearchDialog.astro";
import config from "${configImport}";
import { load } from "${serverImport}";
import "${cssImport}";

const data = await load(Astro.url.pathname);
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{data.title} – Docs</title>
  </head>
  <body>
    <DocsLayout tree={data.tree} config={config}>
      <DocsContent data={data} config={config} />
    </DocsLayout>
    <SearchDialog config={config} />
  </body>
</html>
`;
}

export function astroApiRouteTemplate(cfg: TemplateConfig): string {
  const serverImport = astroPageServerImport(cfg.useAlias, 2);
  return `\
import type { APIRoute } from "astro";
import { GET as docsGET, POST as docsPOST } from "${serverImport}";

export const GET: APIRoute = async ({ request }) => {
  return docsGET({ request });
};

export const POST: APIRoute = async ({ request }) => {
  return docsPOST({ request });
};
`;
}

export function astroApiReferenceRouteTemplate(filePath: string): string {
  const configImport = relativeImport(filePath, "src/lib/docs.config.ts");

  return `\
import { createAstroApiReference } from "@farming-labs/astro/api-reference";
import config from "${configImport}";

export const GET = createAstroApiReference(config);
`;
}

export function astroGlobalCssTemplate(
  theme: string,
  customThemeName?: string,
  globalCssRelPath?: string,
): string {
  if (theme === "custom" && customThemeName && globalCssRelPath)
    return `\
@import "${getCustomThemeCssImportPath(globalCssRelPath, customThemeName.replace(/\.css$/i, ""))}";
`;
  return `\
@import "@farming-labs/astro-theme/${theme}/css";
`;
}

export function astroCssImportLine(
  theme: string,
  customThemeName?: string,
  globalCssRelPath?: string,
): string {
  if (theme === "custom" && customThemeName && globalCssRelPath)
    return `@import "${getCustomThemeCssImportPath(globalCssRelPath, customThemeName.replace(/\.css$/i, ""))}";`;
  return `@import "@farming-labs/astro-theme/${theme}/css";`;
}

export function injectAstroCssImport(
  existingContent: string,
  theme: string,
  customThemeName?: string,
  globalCssRelPath?: string,
): string | null {
  const importLine = astroCssImportLine(theme, customThemeName, globalCssRelPath);
  if (existingContent.includes(importLine)) return null;
  if (
    theme !== "custom" &&
    existingContent.includes("@farming-labs/astro-theme/") &&
    existingContent.includes("/css")
  )
    return null;
  if (theme === "custom" && existingContent.includes("themes/") && existingContent.includes(".css"))
    return null;
  const lines = existingContent.split("\n");
  const lastImportIdx = lines.reduce(
    (acc, l, i) => (l.trimStart().startsWith("@import") ? i : acc),
    -1,
  );
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  } else {
    lines.unshift(importLine);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Astro sample pages
// ---------------------------------------------------------------------------

export function astroWelcomePageTemplate(cfg: TemplateConfig): string {
  return `\
---
title: "Documentation"
description: "Welcome to ${cfg.projectName} documentation"
---

# Welcome to ${cfg.projectName}

Get started with our documentation. Browse the pages on the left to learn more.

## Overview

This documentation was generated by \`@farming-labs/docs\`. Edit the markdown files in \`${cfg.entry}/\` to customize.

## Features

- **Markdown Support** — Write docs with standard Markdown
- **Syntax Highlighting** — Code blocks with automatic highlighting
- **Dark Mode** — Built-in theme switching
- **Search** — Full-text search across all pages
- **Responsive** — Works on any screen size

---

## Next Steps

Start by reading the [Installation](/${cfg.entry}/installation) guide, then follow the [Quickstart](/${cfg.entry}/quickstart) to build something.
`;
}

export function astroInstallationPageTemplate(cfg: TemplateConfig): string {
  const t = getThemeInfo(cfg.theme);
  return `\
---
title: "Installation"
description: "How to install and set up ${cfg.projectName}"
---

# Installation

Follow these steps to install and configure ${cfg.projectName}.

## Prerequisites

- Node.js 18+
- A package manager (pnpm, npm, or yarn)

## Install Dependencies

\\\`\\\`\\\`bash
pnpm add @farming-labs/docs @farming-labs/astro @farming-labs/astro-theme
\\\`\\\`\\\`

## Configuration

Your project includes a \\\`docs.config.ts\\\` in \\\`src/lib/\\\`:

\\\`\\\`\\\`ts title="src/lib/docs.config.ts"
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.astroImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  theme: ${t.factory}({
    ui: { colors: { primary: "#6366f1" } },
  }),
});
\\\`\\\`\\\`

## Project Structure

\\\`\\\`\\\`
${cfg.entry}/                   # Markdown content
  page.md                      # /${cfg.entry}
  installation/
    page.md                    # /${cfg.entry}/installation
  quickstart/
    page.md                    # /${cfg.entry}/quickstart
src/
  lib/
    docs.config.ts             # Docs configuration
    docs.server.ts             # Server-side docs loader
  pages/
    ${cfg.entry}/
      index.astro              # Docs index page
      [...slug].astro          # Dynamic doc page
    api/
      ${cfg.entry}.ts          # Search/AI API route
\\\`\\\`\\\`

## What's Next?

Head to the [Quickstart](/${cfg.entry}/quickstart) guide to start writing your first page.
`;
}

export function astroQuickstartPageTemplate(cfg: TemplateConfig): string {
  const t = getThemeInfo(cfg.theme);
  return `\
---
title: "Quickstart"
description: "Get up and running in minutes"
---

# Quickstart

This guide walks you through creating your first documentation page.

## Creating a Page

Create a new folder under \\\`${cfg.entry}/\\\` with a \\\`page.md\\\` file:

\\\`\\\`\\\`bash
mkdir -p ${cfg.entry}/my-page
\\\`\\\`\\\`

Then create \\\`${cfg.entry}/my-page/page.md\\\`:

\\\`\\\`\\\`md
---
title: "My Page"
description: "A custom documentation page"
---

# My Page

Write your content here using **Markdown**.
\\\`\\\`\\\`

Your page is now available at \\\`/${cfg.entry}/my-page\\\`.

## Customizing the Theme

Edit \\\`src/lib/docs.config.ts\\\` to change colors, typography, and component defaults:

\\\`\\\`\\\`ts title="src/lib/docs.config.ts"
theme: ${t.factory}({
  ui: {
    colors: { primary: "#22c55e" },
  },
}),
\\\`\\\`\\\`

## Deploying

Build your docs for production:

\\\`\\\`\\\`bash
pnpm build
\\\`\\\`\\\`

Deploy to Vercel, Netlify, or any Node.js hosting platform.
`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Nuxt templates
// ═══════════════════════════════════════════════════════════════════════════

export function nuxtDocsConfigTemplate(cfg: TemplateConfig): string {
  if (cfg.theme === "custom" && cfg.customThemeName) {
    const exportName = getThemeExportName(cfg.customThemeName);
    const themePath = cfg.useAlias
      ? "~/themes/" + cfg.customThemeName.replace(/\.ts$/i, "")
      : "./themes/" + cfg.customThemeName.replace(/\.ts$/i, "");
    return `\
import { defineDocs } from "@farming-labs/docs";
import { ${exportName} } from "${themePath}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  ${renderI18nConfig(cfg)}${renderApiReferenceConfig(cfg)}  theme: ${exportName}({
    ui: {
      colors: { primary: "#6366f1" },
    },
  }),

  nav: {
    title: "${cfg.projectName}",
    url: "/${cfg.entry}",
  },

  breadcrumb: { enabled: true },

  metadata: {
    titleTemplate: "%s – ${cfg.projectName}",
    description: "Documentation for ${cfg.projectName}",
  },
});
`;
  }
  const t = getThemeInfo(cfg.theme);
  return `\
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.nuxtImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  ${renderI18nConfig(cfg)}${renderApiReferenceConfig(cfg)}  theme: ${t.factory}({
    ui: {
      colors: { primary: "#6366f1" },
    },
  }),

  nav: {
    title: "${cfg.projectName}",
    url: "/${cfg.entry}",
  },

  breadcrumb: { enabled: true },

  metadata: {
    titleTemplate: "%s – ${cfg.projectName}",
    description: "Documentation for ${cfg.projectName}",
  },
});
`;
}

export function nuxtDocsServerTemplate(cfg: TemplateConfig): string {
  const contentDirName = cfg.entry ?? "docs";
  const configImport = cfg.useAlias ? "~/docs.config" : "../../docs.config";
  return `\
import { createDocsServer } from "@farming-labs/nuxt/server";
import config from "${configImport}";

const contentFiles = import.meta.glob("/${contentDirName}/**/*.{md,mdx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const docsServer = createDocsServer({
  ...config,
  _preloadedContent: contentFiles,
});
`;
}

export function nuxtServerApiDocsGetTemplate(): string {
  return `\
import { getRequestURL } from "h3";
import { docsServer } from "../utils/docs-server";

export default defineEventHandler((event) => {
  const url = getRequestURL(event);
  const request = new Request(url.href, {
    method: event.method,
    headers: event.headers,
  });
  return docsServer.GET({ request });
});
`;
}

export function nuxtServerApiDocsPostTemplate(): string {
  return `\
import { getRequestURL, readRawBody } from "h3";
import { docsServer } from "../utils/docs-server";

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  const body = await readRawBody(event);
  const request = new Request(url.href, {
    method: "POST",
    headers: event.headers,
    body: body ?? undefined,
  });
  return docsServer.POST({ request });
});
`;
}

export function nuxtServerApiDocsLoadTemplate(): string {
  return `\
import { getQuery } from "h3";
import { docsServer } from "../../utils/docs-server";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const pathname = (query.pathname as string) ?? "/docs";
  return docsServer.load(pathname);
});
`;
}

export function nuxtServerApiReferenceRouteTemplate(filePath: string, useAlias: boolean): string {
  const configImport = useAlias ? "~/docs.config" : relativeImport(filePath, "docs.config.ts");

  return `\
import { defineApiReferenceHandler } from "@farming-labs/nuxt/api-reference";
import config from "${configImport}";

export default defineApiReferenceHandler(config);
`;
}

export function nuxtDocsPageTemplate(cfg: TemplateConfig): string {
  const configImport = cfg.useAlias ? "~/docs.config" : "../../docs.config";
  return `\
<script setup lang="ts">
import { DocsLayout, DocsContent } from "@farming-labs/nuxt-theme";
import config from "${configImport}";

const route = useRoute();
const pathname = computed(() => route.path);

const { data, error } = await useAsyncData(\`docs-\${pathname.value}\`, () =>
  $fetch("/api/docs/load", {
    query: { pathname: pathname.value },
  })
);

if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Page not found",
  });
}
</script>

<template>
  <div v-if="data" class="fd-docs-wrapper">
    <DocsLayout :tree="data.tree" :config="config">
      <DocsContent :data="data" :config="config" />
    </DocsLayout>
  </div>
</template>
`;
}

export function nuxtConfigTemplate(cfg: TemplateConfig): string {
  const t = getThemeInfo(cfg.theme);
  return `\
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",

  css: ["@farming-labs/nuxt-theme/${t.nuxtCssTheme}/css"],

  vite: {
    optimizeDeps: {
      include: ["@farming-labs/docs", "@farming-labs/nuxt", "@farming-labs/nuxt-theme"],
    },
  },

  nitro: {
    moduleSideEffects: ["@farming-labs/nuxt/server"],
  },
});
`;
}

export function nuxtWelcomePageTemplate(cfg: TemplateConfig): string {
  return `\
---
order: 1
title: Documentation
description: Welcome to ${cfg.projectName} documentation
icon: book
---

# Welcome to ${cfg.projectName}

Get started with our documentation. Browse the pages on the left to learn more.

## Overview

This documentation was generated by \`@farming-labs/docs\`. Edit the markdown files in \`${cfg.entry}/\` to customize.

## Features

- **Markdown Support** — Write docs with standard Markdown
- **Syntax Highlighting** — Code blocks with automatic highlighting
- **Dark Mode** — Built-in theme switching
- **Search** — Full-text search across all pages (⌘ K)
- **Responsive** — Works on any screen size

---

## Next Steps

Start by reading the [Installation](/${cfg.entry}/installation) guide, then follow the [Quickstart](/${cfg.entry}/quickstart) to build something.
`;
}

export function nuxtInstallationPageTemplate(cfg: TemplateConfig): string {
  const t = getThemeInfo(cfg.theme);
  return `\
---
order: 3
title: Installation
description: How to install and set up ${cfg.projectName}
icon: terminal
---

# Installation

Follow these steps to install and configure ${cfg.projectName}.

## Prerequisites

- Node.js 18+
- A package manager (pnpm, npm, or yarn)

## Install Dependencies

\`\`\`bash
pnpm add @farming-labs/docs @farming-labs/nuxt @farming-labs/nuxt-theme
\`\`\`

## Configuration

Your project includes a \`docs.config.ts\` at the root:

\`\`\`ts title="docs.config.ts"
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.nuxtImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  theme: ${t.factory}({
    ui: { colors: { primary: "#6366f1" } },
  }),
});
\`\`\`

## Project Structure

\`\`\`
${cfg.entry}/                   # Markdown content
  page.md
  installation/page.md
  quickstart/page.md
server/
  utils/docs-server.ts          # createDocsServer + preloaded content
  api/docs/
    load.get.ts                 # Page data API
    docs.get.ts                 # Search API
    docs.post.ts                # AI chat API
pages/
  ${cfg.entry}/[[...slug]].vue   # Docs catch-all page
docs.config.ts
nuxt.config.ts
\`\`\`

## What's Next?

Head to the [Quickstart](/${cfg.entry}/quickstart) guide to start writing your first page.
`;
}

export function nuxtQuickstartPageTemplate(cfg: TemplateConfig): string {
  const t = getThemeInfo(cfg.theme);
  return `\
---
order: 2
title: Quickstart
description: Get up and running in minutes
icon: rocket
---

# Quickstart

This guide walks you through creating your first documentation page.

## Creating a Page

Create a new folder under \`${cfg.entry}/\` with a \`page.md\` file:

\`\`\`bash
mkdir -p ${cfg.entry}/my-page
\`\`\`

Then create \`${cfg.entry}/my-page/page.md\`:

\`\`\`md
---
title: "My Page"
description: "A custom documentation page"
---

# My Page

Write your content here using **Markdown**.
\`\`\`

Your page is now available at \`/${cfg.entry}/my-page\`.

## Customizing the Theme

Edit \`docs.config.ts\` to change colors and typography:

\`\`\`ts
theme: ${t.factory}({
  ui: {
    colors: { primary: "#22c55e" },
  },
}),
\`\`\`

## Deploying

Build your docs for production:

\`\`\`bash
pnpm build
\`\`\`

Deploy to Vercel, Netlify, or any Node.js hosting platform.
`;
}

export function nuxtGlobalCssTemplate(
  theme: string,
  customThemeName?: string,
  globalCssRelPath?: string,
): string {
  if (theme === "custom" && customThemeName && globalCssRelPath)
    return `\
@import "${getCustomThemeCssImportPath(globalCssRelPath, customThemeName.replace(/\.css$/i, ""))}";
`;
  return `\
@import "@farming-labs/nuxt-theme/${theme}/css";
`;
}

export function nuxtCssImportLine(
  theme: string,
  customThemeName?: string,
  globalCssRelPath?: string,
): string {
  if (theme === "custom" && customThemeName && globalCssRelPath)
    return `@import "${getCustomThemeCssImportPath(globalCssRelPath, customThemeName.replace(/\.css$/i, ""))}";`;
  return `@import "@farming-labs/nuxt-theme/${theme}/css";`;
}

export function injectNuxtCssImport(
  existingContent: string,
  theme: string,
  customThemeName?: string,
  globalCssRelPath?: string,
): string | null {
  const importLine = nuxtCssImportLine(theme, customThemeName, globalCssRelPath);
  if (existingContent.includes(importLine)) return null;
  if (
    theme !== "custom" &&
    existingContent.includes("@farming-labs/nuxt-theme/") &&
    existingContent.includes("/css")
  )
    return null;
  if (theme === "custom" && existingContent.includes("themes/") && existingContent.includes(".css"))
    return null;
  const lines = existingContent.split("\n");
  const lastImportIdx = lines.reduce(
    (acc, l, i) => (l.trimStart().startsWith("@import") ? i : acc),
    -1,
  );
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  } else {
    lines.unshift(importLine);
  }
  return lines.join("\n");
}
