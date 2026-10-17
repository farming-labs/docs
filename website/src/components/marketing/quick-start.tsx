"use client";

import type { KeyboardEvent } from "react";
import { useRef, useState } from "react";
import {
  FarmingLabsMark,
  SimpleIcon,
  type SimpleIconName,
} from "@/components/marketing/brand-icons";
import { CodeTabsPanel, type CodeTab } from "@/components/marketing/highlighted-code";
import { cn } from "@/lib/utils";

type Framework = {
  id: string;
  label: string;
  icon: SimpleIconName | "farm";
  tabs: readonly [CodeTab, ...CodeTab[]];
};

const mdxPage = {
  id: "page",
  label: "docs/quickstart.mdx",
  language: "mdx",
  highlightLines: [2, 3],
  code: `---
title: "Quickstart"
description: "Ship docs in five minutes"
---

# Quickstart

Write **MDX** with frontmatter. Search, Ask AI,
MCP, and llms.txt pick it up automatically.`,
} satisfies CodeTab;

const frameworks: readonly Framework[] = [
  {
    id: "next",
    label: "Next.js",
    icon: "nextjs",
    tabs: [
      {
        id: "config",
        label: "docs.config.tsx",
        language: "tsx",
        highlightLines: [5, 6, 7],
        code: `import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/theme/pixel-border";

export default defineDocs({
  entry: "docs",
  theme: pixelBorder(),
  ai: { enabled: true },
  metadata: { titleTemplate: "%s – Acme Docs" },
});`,
      },
      {
        id: "framework",
        label: "next.config.ts",
        language: "ts",
        highlightLines: [3],
        code: `import { withDocs } from "@farming-labs/next/config";

export default withDocs({});`,
      },
      { ...mdxPage, label: "app/docs/quickstart/page.mdx" },
    ],
  },
  {
    id: "tanstack",
    label: "TanStack",
    icon: "tanstack",
    tabs: [
      {
        id: "config",
        label: "docs.config.tsx",
        language: "tsx",
        highlightLines: [6, 7],
        code: `import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
});`,
      },
      {
        id: "framework",
        label: "vite.config.ts",
        language: "ts",
        highlightLines: [3, 6],
        code: `import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { docsMdx } from "@farming-labs/tanstack-start/vite";

export default defineConfig({
  plugins: [docsMdx(), tanstackStart()],
});`,
      },
      {
        id: "server",
        label: "src/lib/docs.server.ts",
        language: "ts",
        highlightLines: [4],
        code: `import { createDocsServer } from "@farming-labs/tanstack-start/server";
import docsConfig from "../../docs.config";

export const docsServer = createDocsServer({
  ...docsConfig,
  rootDir: process.cwd(),
});`,
      },
    ],
  },
  {
    id: "farm",
    label: "Farm.js",
    icon: "farm",
    tabs: [
      {
        id: "config",
        label: "docs.config.ts",
        language: "ts",
        highlightLines: [5, 6],
        code: `import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/theme/pixel-border";

export default defineDocs({
  entry: "docs",
  theme: pixelBorder(),
});`,
      },
      {
        id: "framework",
        label: "farm.config.ts",
        language: "ts",
        highlightLines: [2, 4],
        code: `import { defineConfig } from "@farm.js/core";
import { withDocs } from "@farming-labs/farmjs/config";

export default withDocs(
  defineConfig({ preset: "vercel" }),
);`,
      },
      {
        id: "css",
        label: "src/app/globals.css",
        language: "css",
        highlightLines: [1],
        code: `@import "@farming-labs/theme/pixel-border/css";

:root {
  --color-fd-primary: #8b5cf6;
}`,
      },
    ],
  },
  {
    id: "svelte",
    label: "SvelteKit",
    icon: "svelte",
    tabs: [
      {
        id: "config",
        label: "src/lib/docs.config.ts",
        language: "ts",
        highlightLines: [6, 7],
        code: `import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/svelte-theme";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
});`,
      },
      {
        id: "server",
        label: "src/lib/docs.server.ts",
        language: "ts",
        highlightLines: [4],
        code: `import { createDocsServer } from "@farming-labs/svelte/server";
import config from "./docs.config";

export const { load, GET, HEAD, POST } = createDocsServer(config);`,
      },
      { ...mdxPage, label: "docs/quickstart/page.md", language: "md" },
    ],
  },
  {
    id: "astro",
    label: "Astro",
    icon: "astro",
    tabs: [
      {
        id: "config",
        label: "src/lib/docs.config.ts",
        language: "ts",
        highlightLines: [6, 7],
        code: `import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/astro-theme";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
});`,
      },
      {
        id: "server",
        label: "src/lib/docs.server.ts",
        language: "ts",
        highlightLines: [4],
        code: `import { createDocsServer } from "@farming-labs/astro/server";
import config from "./docs.config";

export const { load, GET, HEAD, POST } = createDocsServer(config);`,
      },
      { ...mdxPage, label: "docs/quickstart/page.md", language: "md" },
    ],
  },
  {
    id: "nuxt",
    label: "Nuxt",
    icon: "nuxt",
    tabs: [
      {
        id: "config",
        label: "docs.config.ts",
        language: "ts",
        highlightLines: [6, 7],
        code: `import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/nuxt-theme/fumadocs";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
});`,
      },
      {
        id: "framework",
        label: "nuxt.config.ts",
        language: "ts",
        highlightLines: [2, 4],
        code: `export default defineNuxtConfig({
  css: ["@farming-labs/theme/default/css"],
  nitro: {
    serverAssets: [{ baseName: "docs", dir: "../docs" }],
  },
});`,
      },
      {
        id: "server",
        label: "server/api/docs.ts",
        language: "ts",
        highlightLines: [4],
        code: `import { defineDocsHandler } from "@farming-labs/nuxt/server";
import config from "../../docs.config";

export default defineDocsHandler(config, useStorage);`,
      },
    ],
  },
];

function FrameworkIcon({ icon, className }: { icon: Framework["icon"]; className?: string }) {
  return icon === "farm" ? (
    <FarmingLabsMark className={cn("h-3 w-auto", className)} />
  ) : (
    <SimpleIcon className={cn("size-3.5", className)} name={icon} />
  );
}

/** Pick a framework, see the exact files the CLI would scaffold for it. */
export function QuickStart() {
  const [activeIndex, setActiveIndex] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = frameworks[activeIndex];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % frameworks.length
        : event.key === "ArrowLeft"
          ? (index - 1 + frameworks.length) % frameworks.length
          : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setActiveIndex(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="flex min-w-0 flex-col">
      <div aria-label="Framework" className="mb-3 flex flex-wrap gap-1" role="tablist">
        {frameworks.map((framework, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={framework.id}
              ref={(node) => {
                refs.current[index] = node;
              }}
              aria-selected={selected}
              className="group flex h-9 min-w-0 items-center justify-center gap-1.5 !rounded-none border border-mk-fg/12 px-2.5 text-[12.5px] font-medium tracking-[-0.01em] text-mk-fg/60 transition-[background-color,border-color,color] duration-150 hover:border-mk-fg/30 hover:text-mk-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg aria-selected:border-mk-fg aria-selected:bg-mk-fg aria-selected:text-mk-bg"
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              <FrameworkIcon className="shrink-0 opacity-80" icon={framework.icon} />
              <span className="truncate">{framework.label}</span>
            </button>
          );
        })}
      </div>
      <CodeTabsPanel
        key={active.id}
        className="h-[340px]"
        tabs={active.tabs}
        tabsLabel={`${active.label} files`}
      />
    </div>
  );
}
