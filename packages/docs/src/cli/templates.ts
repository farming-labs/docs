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
}

// ---------------------------------------------------------------------------
// docs.config.ts
// ---------------------------------------------------------------------------

export function docsConfigTemplate(cfg: TemplateConfig): string {
  return `\
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/fumadocs";

export default defineDocs({
  entry: "${cfg.entry}",
  theme: fumadocs({
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

// ---------------------------------------------------------------------------
// next.config.ts
// ---------------------------------------------------------------------------

export function nextConfigTemplate(): string {
  return `\
import { withDocs } from "@farming-labs/next/config";

export default withDocs();
`;
}

export function nextConfigMergedTemplate(existingContent: string): string {
  // If already has withDocs, return as-is
  if (existingContent.includes("withDocs")) return existingContent;

  // Add the import and wrap the export
  const lines = existingContent.split("\n");
  const importLine = 'import { withDocs } from "@farming-labs/next/config";';

  // Find the default export
  const exportIdx = lines.findIndex((l) =>
    l.match(/export\s+default/)
  );

  if (exportIdx === -1) {
    // No default export found — wrap everything
    return `${importLine}\n\n${existingContent}\n\nexport default withDocs();\n`;
  }

  // Insert import at top (after any existing imports)
  const lastImportIdx = lines.reduce(
    (acc, l, i) => (l.trimStart().startsWith("import ") ? i : acc),
    -1,
  );

  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
  } else {
    lines.unshift(importLine, "");
  }

  // Try to wrap the default export value with withDocs()
  const adjustedExportIdx =
    exportIdx + (lastImportIdx >= 0 && exportIdx > lastImportIdx ? 1 : 0);
  const exportLine = lines[adjustedExportIdx];

  // Simple case: export default { ... } or export default nextConfig;
  const simpleMatch = exportLine.match(
    /^(\s*export\s+default\s+)(.*?)(;?\s*)$/,
  );
  if (simpleMatch) {
    const [, prefix, value, suffix] = simpleMatch;
    lines[adjustedExportIdx] = `${prefix}withDocs(${value})${suffix}`;
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// app/layout.tsx (root)
// ---------------------------------------------------------------------------

export function rootLayoutTemplate(globalCssRelPath = "app/globals.css"): string {
  // Compute the CSS import path relative to app/layout.tsx
  // e.g. "app/globals.css" → "./globals.css"
  // e.g. "app/global.css" → "./global.css"
  // e.g. "styles/globals.css" → "../styles/globals.css"
  // e.g. "src/app/globals.css" → "./globals.css" (src/app layout)
  let cssImport: string;
  if (globalCssRelPath.startsWith("app/")) {
    cssImport = "./" + globalCssRelPath.slice("app/".length);
  } else if (globalCssRelPath.startsWith("src/app/")) {
    cssImport = "./" + globalCssRelPath.slice("src/app/".length);
  } else {
    cssImport = "../" + globalCssRelPath;
  }

  return `\
import type { Metadata } from "next";
import { RootProvider } from "@farming-labs/fumadocs";
import docsConfig from "@/docs.config";
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

// ---------------------------------------------------------------------------
// app/global.css
// ---------------------------------------------------------------------------

export function globalCssTemplate(theme: string): string {
  return `\
@import "tailwindcss";
@import "@farming-labs/${theme}/css";
`;
}

/**
 * Inject the fumadocs CSS import into an existing global.css.
 * Returns the modified content, or null if already present.
 */
export function injectCssImport(
  existingContent: string,
  theme: string,
): string | null {
  const importLine = `@import "@farming-labs/${theme}/css";`;
  if (existingContent.includes(importLine)) return null;
  // Append after the last @import (or at the end)
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
// app/{entry}/layout.tsx (docs layout)
// ---------------------------------------------------------------------------

export function docsLayoutTemplate(): string {
  return `\
import docsConfig from "@/docs.config";
import { createDocsLayout } from "@farming-labs/fumadocs";

export default createDocsLayout(docsConfig);
`;
}

// ---------------------------------------------------------------------------
// postcss.config.mjs
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// tsconfig.json (only if missing)
// ---------------------------------------------------------------------------

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
// Sample MDX pages
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
import { fumadocs } from "@farming-labs/fumadocs";

export default defineDocs({
  entry: "${cfg.entry}",
  theme: fumadocs({
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
theme: fumadocs({
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
