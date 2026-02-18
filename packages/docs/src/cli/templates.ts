// ---------------------------------------------------------------------------
// File templates for the init CLI.
// Each function returns the file content as a string.
// ---------------------------------------------------------------------------

export interface TemplateConfig {
  /** Docs entry folder, e.g. "docs" */
  entry: string;
  /** Theme name, e.g. "fumadocs" */
  theme: string;
  /** Project name from package.json */
  projectName: string;
  /** Framework being used */
  framework: "nextjs" | "sveltekit";
  /** Whether to use path aliases (@/ for Next.js, $lib/ for SvelteKit) */
  useAlias: boolean;
}

// ---------------------------------------------------------------------------
// Theme info
// ---------------------------------------------------------------------------

interface ThemeInfo {
  factory: string;
  nextImport: string;
  svelteImport: string;
  nextCssImport: string;
  svelteCssTheme: string;
}

const THEME_INFO: Record<string, ThemeInfo> = {
  fumadocs: {
    factory: "fumadocs",
    nextImport: "@farming-labs/theme",
    svelteImport: "@farming-labs/svelte-theme",
    nextCssImport: "default",
    svelteCssTheme: "fumadocs",
  },
  darksharp: {
    factory: "darksharp",
    nextImport: "@farming-labs/theme/darksharp",
    svelteImport: "@farming-labs/svelte-theme/darksharp",
    nextCssImport: "darksharp",
    svelteCssTheme: "darksharp",
  },
  "pixel-border": {
    factory: "pixelBorder",
    nextImport: "@farming-labs/theme/pixel-border",
    svelteImport: "@farming-labs/svelte-theme/pixel-border",
    nextCssImport: "pixel-border",
    svelteCssTheme: "pixel-border",
  },
};

function getThemeInfo(theme: string): ThemeInfo {
  return THEME_INFO[theme] ?? THEME_INFO.fumadocs;
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

/** Config import for Next.js app/layout.tsx → root docs.config */
function nextRootLayoutConfigImport(useAlias: boolean): string {
  return useAlias ? "@/docs.config" : "../docs.config";
}

/** Config import for Next.js app/{entry}/layout.tsx → root docs.config */
function nextDocsLayoutConfigImport(useAlias: boolean): string {
  return useAlias ? "@/docs.config" : "../../docs.config";
}

/** Config import for SvelteKit src/lib/docs.server.ts → src/lib/docs.config.js */
function svelteServerConfigImport(useAlias: boolean): string {
  return useAlias ? "$lib/docs.config.js" : "./docs.config.js";
}

/** Config import for SvelteKit src/routes/{entry}/+layout.svelte → src/lib/docs.config.js */
function svelteLayoutConfigImport(useAlias: boolean): string {
  return useAlias ? "$lib/docs.config.js" : "../../lib/docs.config.js";
}

/** Config import for SvelteKit src/routes/{entry}/[...slug]/+page.svelte → src/lib/docs.config.js */
function sveltePageConfigImport(useAlias: boolean): string {
  return useAlias ? "$lib/docs.config.js" : "../../../lib/docs.config.js";
}

/** Server import for SvelteKit +layout.server.js → src/lib/docs.server.js */
function svelteLayoutServerImport(useAlias: boolean): string {
  return useAlias ? "$lib/docs.server.js" : "../../lib/docs.server.js";
}

// ═══════════════════════════════════════════════════════════════════════════
// Next.js templates
// ═══════════════════════════════════════════════════════════════════════════

export function docsConfigTemplate(cfg: TemplateConfig): string {
  const t = getThemeInfo(cfg.theme);
  return `\
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.nextImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  theme: ${t.factory}({
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
    exportIdx + (lastImportIdx >= 0 && exportIdx > lastImportIdx ? 1 : 0);
  const exportLine = lines[adjustedExportIdx];

  const simpleMatch = exportLine.match(
    /^(\s*export\s+default\s+)(.*?)(;?\s*)$/,
  );
  if (simpleMatch) {
    const [, prefix, value, suffix] = simpleMatch;
    lines[adjustedExportIdx] = `${prefix}withDocs(${value})${suffix}`;
  }

  return lines.join("\n");
}

export function rootLayoutTemplate(cfg: TemplateConfig, globalCssRelPath = "app/globals.css"): string {
  let cssImport: string;
  if (globalCssRelPath.startsWith("app/")) {
    cssImport = "./" + globalCssRelPath.slice("app/".length);
  } else if (globalCssRelPath.startsWith("src/app/")) {
    cssImport = "./" + globalCssRelPath.slice("src/app/".length);
  } else {
    cssImport = "../" + globalCssRelPath;
  }

  const configImport = nextRootLayoutConfigImport(cfg.useAlias);

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

export function globalCssTemplate(theme: string): string {
  const t = getThemeInfo(theme);
  return `\
@import "tailwindcss";
@import "@farming-labs/theme/${t.nextCssImport}/css";
`;
}

export function injectCssImport(
  existingContent: string,
  theme: string,
): string | null {
  const t = getThemeInfo(theme);
  const importLine = `@import "@farming-labs/theme/${t.nextCssImport}/css";`;
  if (existingContent.includes(importLine)) return null;
  if (existingContent.includes("@farming-labs/theme/") && existingContent.includes("/css")) return null;
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
  const configImport = nextDocsLayoutConfigImport(cfg.useAlias);
  return `\
import docsConfig from "${configImport}";
import { createDocsLayout } from "@farming-labs/theme";

export default createDocsLayout(docsConfig);
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

export function tsconfigTemplate(): string {
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
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
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
  return `\
---
title: "Documentation"
description: "Welcome to ${cfg.projectName} documentation"
---

# Welcome to ${cfg.projectName}

Get started with our documentation. Browse the pages on the left to learn more.

<Callout type="info">
  This documentation was generated by \`@farming-labs/docs\`. Edit the MDX files in \`app/${cfg.entry}/\` to customize.
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
app/
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

Create a new folder under \`app/${cfg.entry}/\` with a \`page.mdx\` file:

\`\`\`bash
mkdir -p app/${cfg.entry}/my-page
\`\`\`

Then create \`app/${cfg.entry}/my-page/page.mdx\`:

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
// SvelteKit templates
// ═══════════════════════════════════════════════════════════════════════════

export function svelteDocsConfigTemplate(cfg: TemplateConfig): string {
  const t = getThemeInfo(cfg.theme);
  return `\
import { defineDocs } from "@farming-labs/docs";
import { ${t.factory} } from "${t.svelteImport}";

export default defineDocs({
  entry: "${cfg.entry}",
  contentDir: "${cfg.entry}",
  theme: ${t.factory}({
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
  return `\
import { createDocsServer } from "@farming-labs/svelte/server";
import config from "${configImport}";

export const { load, GET, POST } = createDocsServer(config);
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

export function svelteGlobalCssTemplate(theme: string): string {
  return `\
@import "@farming-labs/svelte-theme/${theme}/css";
`;
}

export function svelteCssImportLine(theme: string): string {
  return `@import "@farming-labs/svelte-theme/${theme}/css";`;
}

export function injectSvelteCssImport(
  existingContent: string,
  theme: string,
): string | null {
  const importLine = svelteCssImportLine(theme);
  if (existingContent.includes(importLine)) return null;
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
