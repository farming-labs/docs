"use client";

import Link from "next/link";
import { ArrowRight, X } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import CodeBlock from "@/components/ui/code-block";
import { useIsDark } from "@/components/ui/animated-bg-black";

const themes = [
  {
    key: "default",
    name: "Default",
    description:
      "Clean neutral palette with an indigo accent. Great starting point for any project.",
    cssImport: '@import "@farming-labs/theme/default/css";',
    colors: ["#6366f1", "#0a0a0a", "#fafafa", "#262626"],
    accent: "#6366f1",
    configSnippet: `import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/theme";

export default defineDocs({
  entry: "docs",
  theme: fumadocs(),
});`,
    globalCss: `@import "tailwindcss";
@import "@farming-labs/theme/default/css";`,
  },
  {
    key: "colorful",
    name: "Colorful",
    description:
      "Warm amber accent with a tree-line directional TOC. Inspired by fumadocs default.",
    cssImport: '@import "@farming-labs/theme/colorful/css";',
    colors: ["#eab308", "#0a0a0a", "#fafafa", "#262626"],
    accent: "#eab308",
    configSnippet: `import { defineDocs } from "@farming-labs/docs";
import { colorful } from "@farming-labs/theme/colorful";

export default defineDocs({
  entry: "docs",
  theme: colorful(),
});`,
    globalCss: `@import "tailwindcss";
@import "@farming-labs/theme/colorful/css";`,
  },
  {
    key: "darksharp",
    name: "Darksharp",
    description: "All-black with sharp edges and zero border radius. Minimal and bold.",
    cssImport: '@import "@farming-labs/theme/darksharp/css";',
    colors: ["#fafaf9", "#000000", "#a8a29e", "#292524"],
    accent: "#fafaf9",
    configSnippet: `import { defineDocs } from "@farming-labs/docs";
import { darksharp } from "@farming-labs/theme/darksharp";

export default defineDocs({
  entry: "docs",
  theme: darksharp(),
});`,
    globalCss: `@import "tailwindcss";
@import "@farming-labs/theme/darksharp/css";`,
  },
  {
    key: "pixel-border",
    name: "Pixel Border",
    description: "Refined dark UI with visible borders. Inspired by better-auth.com docs.",
    cssImport: '@import "@farming-labs/theme/pixel-border/css";',
    colors: ["#fbfbfa", "#050505", "#8c8c8c", "#262626"],
    accent: "#fbfbfa",
    configSnippet: `import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/theme/pixel-border";

export default defineDocs({
  entry: "docs",
  theme: pixelBorder(),
});`,
    globalCss: `@import "tailwindcss";
@import "@farming-labs/theme/pixel-border/css";`,
  },
  {
    key: "shiny",
    name: "Shiny",
    description: "Shiny-inspired, polished purple",
    cssImport: '@import "@farming-labs/theme/shiny/css";',
    colors: ["#f0f0f0", "#000000", "#a8a29e", "#292524"],
    accent: "#f0f0f0",
    configSnippet: `import { defineDocs } from "@farming-labs/docs";
import { shiny } from "@farming-labs/theme/shiny";

export default defineDocs({
  entry: "docs",
  theme: shiny(),
});`,
    globalCss: `@import "tailwindcss";
@import "@farming-labs/theme/shiny/css";`,
  },
  {
    key: "greentree",
    name: "GreenTree",
    description: "Bold, GreenTree inspired, emerald green",
    cssImport: '@import "@farming-labs/theme/greentree/css";',
    colors: ["#0D9373", "#26BD6C", "#171A18", "#DFE1E0"],
    accent: "#0D9373",
    configSnippet: `import { defineDocs } from "@farming-labs/docs";
import { greentree } from "@farming-labs/theme/greentree";

export default defineDocs({
  entry: "docs",
  theme: greentree(),
});`,
    globalCss: `@import "tailwindcss";
@import "@farming-labs/theme/greentree/css";`,
  },
];

type Theme = (typeof themes)[number];

function CodeModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto rounded-none border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-xl dark:shadow-none">
        <div className="flex items-center justify-between mb-4 p-4 border-b border-neutral-200 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {theme.colors.map((c, i) => (
                <div
                  key={i}
                  className="size-3 rounded-none border border-neutral-300 dark:border-white/10"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <span className="text-xs font-mono uppercase tracking-wide text-neutral-500 dark:text-white/60">
              {theme.name}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:text-white/40 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Code blocks */}
        <div className="space-y-4 p-4">
          <CodeBlock title="Config" filename="docs.config.ts" code={theme.configSnippet} />
          <CodeBlock title="Styles" filename="global.css" language="css" code={theme.globalCss} />
        </div>
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  onShowCode,
  isDark,
}: {
  theme: Theme;
  onShowCode: () => void;
  isDark: boolean;
}) {
  return (
    <div className="group relative rounded-none border border-neutral-200 dark:border-white/[6%] bg-neutral-50/80 dark:bg-white/[2%] p-6 transition-all hover:border-neutral-300 hover:bg-neutral-100/80 dark:hover:border-white/[12%] dark:hover:bg-white/[3%]">
      <div className="flex items-center gap-2 mb-4">
        {theme.colors.map((c, i) => (
          <div
            key={i}
            className="size-4 rounded-none border border-neutral-300 dark:border-white/10"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <h2 className="text-sm uppercase font-mono tracking-wide mb-1 text-neutral-900 dark:text-white">
        {theme.name}
      </h2>
      <p className="text-[12px] text-neutral-500 dark:text-white/40 mb-4 leading-relaxed">
        {theme.description}
      </p>

      <code className="block text-[11px] font-mono text-neutral-400 dark:text-white/20 mb-5 break-all">
        {theme.cssImport}
      </code>

      <div className="flex items-center gap-2">
        <Link
          href={`/docs?theme=${theme.key}`}
          className="inline-flex items-center gap-2 text-[11px] font-mono px-4 py-2 rounded-none uppercase border transition-all hover:no-underline border-neutral-300 dark:border-transparent shadow-sm dark:shadow-none hover:opacity-90"
          style={{
            borderColor: isDark
              ? `${theme.accent}20`
              : ["shiny", "pixel-border", "darksharp"].includes(theme.key)
                ? `#00000030`
                : `${theme.accent}20`,
            color: isDark
              ? ["shiny", "pixel-border", "darksharp"].includes(theme.key)
                ? theme.accent
                : theme.accent
              : "black",
            background: isDark ? `${theme.accent}04` : `${theme.accent}12`,
          }}
        >
          Try it live
          <ArrowRight className="size-3.5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
        </Link>

        <button
          onClick={onShowCode}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono px-4 py-2 rounded-none uppercase border border-neutral-300 dark:border-white/6 text-neutral-500 dark:text-white/40 hover:border-neutral-400 hover:text-neutral-700 dark:hover:border-white/12 dark:hover:text-white/60 transition-all cursor-pointer"
        >
          <span className="ml-0.5">Show code</span>
        </button>
      </div>
    </div>
  );
}

export default function ThemesPage() {
  const [activeTheme, setActiveTheme] = useState<Theme | null>(null);
  const isDark = useIsDark();
  const closeModal = useCallback(() => setActiveTheme(null), []);

  return (
    <div
      className="min-h-dvh relative bg-white text-neutral-900 dark:bg-black dark:text-white"
      style={{ fontFamily: "var(--font-geist-sans, system-ui, sans-serif)" }}
    >
      <div className="absolute w-full top-14 right-0 z-[999] h-px bg-neutral-200 dark:bg-white/[8%]" />
      <div className="pointer-events-none fixed inset-0 z-[999] hidden lg:block">
        <div className="mx-auto md:max-w-[90%] max-w-full h-full relative">
          <div className="absolute left-0 top-0 h-full w-px bg-neutral-200 dark:bg-white/[8%]" />
          <div className="absolute right-0 top-0 h-full w-px bg-neutral-200 dark:bg-white/[8%]" />
        </div>
      </div>
      <header className="px-6 py-5">
        <div className="mx-auto md:max-w-[90%] max-w-full flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 dark:text-white/80 pb-8">
              <Link
                href={"/"}
                className="hover:text-neutral-900 dark:hover:text-white transition-colors hover:no-underline font-mono uppercase text-neutral-500 dark:text-white/50"
              >
                Home <span className="ml-2 text-neutral-400 dark:text-white/50">/</span>
              </Link>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="13.5" cy="6.5" r="2.5" />
                <circle cx="17.5" cy="10.5" r="2.5" />
                <circle cx="8.5" cy="7.5" r="2.5" />
                <circle cx="6.5" cy="12.5" r="2.5" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
              <p className="font-mono uppercase">Themes</p>
            </div>
          </div>
        </div>
      </header>

      <main className="overflow-x-hidden mx-auto md:max-w-[90%] max-w-full px-6 py-12">
        <div className="mb-10 max-w-2xl">
          <p className="text-[13px] text-neutral-500 dark:text-white/40 leading-relaxed">
            Each theme ships as a single CSS import and a factory function. Click{" "}
            <strong className="text-neutral-800 dark:text-white/80">Try it live</strong> to open the
            docs with that theme applied and the customizer drawer open, or click{" "}
            <strong className="text-neutral-800 dark:text-white/80">Show code</strong> to see the
            config files you need.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.key}
              theme={theme}
              onShowCode={() => setActiveTheme(theme)}
              isDark={isDark}
            />
          ))}
        </div>
        <div className="h-px w-[calc(100%+200px)] -ml-[100px] mx-auto bg-neutral-200 dark:bg-white/[8%] my-12" />
      </main>

      {activeTheme && <CodeModal theme={activeTheme} onClose={closeModal} />}
    </div>
  );
}
