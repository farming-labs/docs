import Link from "next/link";
import { ArrowRight, ArrowUpRight, Github } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import CodeBlock from "@/components/ui/code-block";
import PixelCard from "@/components/ui/pixel-card";
import CopyCommand from "@/components/ui/copy-command";
import FrameworkTabs from "@/components/ui/framework-tabs";
import SvelteRouteTabs from "@/components/ui/svelte-route-tabs";
import AstroRouteTabs from "@/components/ui/astro-route-tabs";
import InitBlockTabs from "@/components/ui/init-block-tabs";

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[1000] border-b border-black/10 dark:border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
        {/* <div className="h-px w-full bg-white/5" /> */}

        {/* <Link
          href="/"
          className="font-mono text-sm tracking-tighter text-black dark:text-white uppercase hover:no-underline"
        >
          @farming-labs/docs
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/docs"
            className="text-sm text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors hover:no-underline"
          >
            Docs
          </Link>
          <Link
            href="https://github.com/farming-labs/docs"
            target="_blank"
            className="text-sm text-black/60 dark:text-white/60 hover:text-black dark:hover:text-white transition-colors hover:no-underline"
          >
            GitHub
            <ArrowUpRight className="inline w-3 h-3 ml-0.5 mb-0.5" />
          </Link> */}
        {/* </div> */}
      </div>
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative md:mx-0 -mx-[5%] min-h-screen flex items-end overflow-y-hidden">
      <div className="absolute bottom-[70px] sm:bottom-16 left-0 right-0 z-[999] h-px bg-black/[8%] dark:bg-white/[8%]" />
      <AnimatedBackground />
      <div className="relative z-[999] w-full pb-12 sm:pb-16 pt-24 px-5 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 sm:gap-16">
          <div className="max-w-full sm:max-w-lg">
            <div className="flex flex-col gap-2">
              <div className="inline-block">
                <a
                  href="/changelog#v0.0.1"
                  className="text-[10px] font-mono tracking-tighter no-underline hover:underline duration-500 transition-all decoration-dotted text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:underline-offset-2 hover:decoration-black/30 dark:hover:decoration-white/30 px-0 py-1.5 flex items-center"
                >
                  <div className="h-[12px] w-px bg-black/50 dark:bg-white/50 mr-2" />
                  v0.0.1
                </a>
              </div>
              <div className="inline-block">
                <a
                  href="/changelog#v0.0.2-beta.16-20"
                  className="text-[10px] font-mono tracking-tighter no-underline hover:underline duration-500 transition-all decoration-dotted text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:underline-offset-2 hover:decoration-black/30 dark:hover:decoration-white/30 px-0 py-1.5 flex items-center"
                >
                  <div className="h-[12px] w-px bg-black/50 dark:bg-white/50 mr-2" />
                  v0.0.2-beta.20
                </a>
              </div>
              <div className="inline-block">
                <a
                  href="/changelog#v0.0.2-beta.11-15"
                  className="text-[10px] font-mono tracking-tighter no-underline hover:underline duration-500 transition-all decoration-dotted text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:underline-offset-2 hover:decoration-black/30 dark:hover:decoration-white/30 px-0 py-1.5 flex items-center"
                >
                  <div className="h-[12px] w-px bg-black/50 dark:bg-white/50 mr-2" />
                  v0.0.2-beta.15
                </a>
              </div>
              <div className="inline-block">
                <a
                  href="/changelog#v0.0.2-beta.5-10"
                  className="text-[10px] font-mono tracking-tighter no-underline hover:underline duration-500 transition-all decoration-dotted text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:underline-offset-2 hover:decoration-black/30 dark:hover:decoration-white/30 px-0 py-1.5 flex items-center"
                >
                  <div className="h-[12px] w-px bg-black/50 dark:bg-white/50 mr-2" />
                  v0.0.2-beta.10
                </a>
              </div>
              <div className="inline-block">
                <a
                  href="/changelog#v0.0.2-beta.1-4"
                  className="text-[10px] font-mono tracking-tighter no-underline hover:underline duration-500 transition-all decoration-dotted text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white hover:underline-offset-2 hover:decoration-black/30 dark:hover:decoration-white/30 px-0 py-1.5 flex items-center"
                >
                  <div className="h-[12px] w-px bg-black/50 dark:bg-white/50 mr-2" />
                  v0.0.2-beta.4
                </a>
              </div>
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tighter text-black dark:text-white leading-[0.95]">
              a documentation
              <br />
              <div className="mt-2" />
              that just <span className="bg-black text-white dark:bg-white dark:text-black p-0 mt-2">works.</span>
            </h1>
            <p className="mt-4 text-xs sm:text-base font-mono uppercase text-black/45 dark:text-white/45 max-w-md leading-relaxed">
              A modern documentation framework that works. One config file, zero boilerplate.
            </p>

            <div className="-mb-5 sm:mb-0 mt-6 sm:mt-8 flex flex-col md:flex-wrap md:flex-row-reverse items-start md:items-center gap-0">
              <Link
                href="/docs"
                className="group inline-flex items-center gap-2 bg-black text-white dark:bg-white dark:text-black px-5 py-[11px] mb-[0.5px] text-xs font-mono uppercase tracking-wider hover:bg-black/90 dark:hover:bg-white/90 transition-all hover:no-underline"
              >
                Get Started
                <ArrowRight className="w-3.5 h-3.5 -rotate-45 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <CopyCommand
                className="border-b-0 sm:border-b border-l-0 border-black/10 dark:border-white/10"
                command="pnpx @farming-labs/docs init"
              />
            </div>
          </div>

          <div className="sm:max-w-xs">
            <div className="flex justify-end">
              <Link
                href="https://github.com/farming-labs/docs"
                className="group uppercase font-mono tracking-tighter text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 hover:no-underline relative ease-in after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:translate-y-[3px] after:bg-black/30 dark:after:bg-white/30 after:opacity-0 after:duration-300 after:content-[''] hover:after:-translate-y-0.5 hover:after:opacity-100 text-[11px] transition-all duration-300"
              >
                <Github className="w-3 h-3 mr-1 inline-flex mb-1" />
                GET THE GITHUB
                <ArrowUpRight className="inline w-3 h-3 group-hover:-translate-y-0.5 transition-all duration-700 ml-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function NextJsSteps() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            1
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Install</h3>
            <p className="text-sm text-black/40 dark:text-white/40">Add the core packages to your Next.js project.</p>
          </div>
        </div>
        <CodeBlock
          title="Terminal"
          filename="shell"
          language="bash"
          code="pnpm add @farming-labs/docs @farming-labs/theme @farming-labs/next"
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            2
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Configure</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              One file. Theme, metadata, components, icons — everything.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Config"
          filename="docs.config.tsx"
          code={`import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/theme/pixel-border";

export default defineDocs({
  entry: "docs",
  theme: pixelBorder(),
  metadata: {
    titleTemplate: "%s – My Docs",
  },
});`}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            3
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Next Config</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Wrap your config with <code className="text-black/60 dark:text-white/60 text-xs">withDocs()</code>.
              Handles MDX, routing, and search.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Next Config"
          filename="next.config.ts"
          code={`import { withDocs } from "@farming-labs/next/config";

export default withDocs({});`}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            4
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Root Layout</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Wrap your app with <code className="text-black/60 dark:text-white/60 text-xs">RootProvider</code> for
              search, theme switching, and AI.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Root Layout"
          filename="app/layout.tsx"
          code={`import { RootProvider } from "@farming-labs/theme";
import "./global.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}`}
        />

        <p className="text-xs text-black/50 dark:text-white/50 -mt-1 mb-2">
          In <code className="text-black/70 dark:text-white/70">app/global.css</code>, import your theme&apos;s CSS so
          docs styling applies (e.g.{" "}
          <code className="text-black/70 dark:text-white/70">{`@import "@farming-labs/theme/default/css";`}</code> —
          use the path that matches your theme).
        </p>

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            5
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Write docs</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create MDX files under <code className="text-black/60 dark:text-white/60 text-xs">app/docs/</code>.
              Frontmatter for metadata. That&#39;s it.
            </p>
          </div>
        </div>
        <CodeBlock
          title="MDX Page"
          filename="app/docs/getting-started/page.mdx"
          code={`---
title: "Getting Started"
description: "Set up in 5 minutes"
icon: "rocket"
---

# Getting Started

Write your content in **MDX** with
frontmatter for metadata.

\`\`\`ts title="auth.ts"
export const auth = betterAuth({
  database: { provider: "postgresql" },
});
\`\`\``}
        />

        <p className="text-xs text-black/30 dark:text-white/30 mt-2">
          See the full{" "}
          <a
            href="/docs/installation"
            className="text-black/50 dark:text-white/50 underline underline-offset-2 hover:text-black/70 dark:hover:text-white/70"
          >
            installation walkthrough
          </a>{" "}
          for all generated files and options.
        </p>
      </div>
    </div>
  );
}

function SvelteKitSteps() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            1
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Install</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Add the core packages to your SvelteKit project.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Terminal"
          filename="shell"
          language="bash"
          code="pnpm add @farming-labs/docs @farming-labs/svelte @farming-labs/svelte-theme"
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            2
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Configure</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              One config file. Theme, metadata, navigation — everything.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Config"
          filename="docs.config.ts"
          code={`import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/svelte-theme";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s – My Docs",
  },
});`}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            3
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Server</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create the server helper. Handles loading, search, and AI.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Server"
          filename="src/lib/docs.server.ts"
          code={`import { createDocsServer } from "@farming-labs/svelte/server";
import config from "./docs.config";

export const { load, GET, POST } = createDocsServer(config);`}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            4
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Write docs</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create Markdown files under <code className="text-black/60 dark:text-white/60 text-xs">docs/</code>.
              That&#39;s it.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Markdown Page"
          filename="docs/getting-started/page.md"
          code={`---
title: "Getting Started"
description: "Set up in 5 minutes"
icon: "rocket"
---

# Getting Started

Write your content in **Markdown** with
frontmatter for metadata.

\`\`\`ts title="auth.ts"
export const auth = betterAuth({
  database: { provider: "postgresql" },
});
\`\`\``}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            5
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Routes</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Three small files for layout, server loader, and page.
            </p>
          </div>
        </div>
        <SvelteRouteTabs />
      </div>
    </div>
  );
}

function AstroSteps() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            1
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Install</h3>
            <p className="text-sm text-black/40 dark:text-white/40">Add the core packages to your Astro project.</p>
          </div>
        </div>
        <CodeBlock
          title="Terminal"
          filename="shell"
          language="bash"
          code="pnpm add @farming-labs/docs @farming-labs/astro @farming-labs/astro-theme"
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            2
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Configure</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              One config file. Theme, metadata, navigation — everything.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Config"
          filename="docs.config.ts"
          code={`import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/astro-theme";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s – My Docs",
  },
});`}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            3
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Server</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create the server helper. Handles loading, search, and AI.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Server"
          filename="src/lib/docs.server.ts"
          code={`import { createDocsServer } from "@farming-labs/astro/server";
import config from "./docs.config";

export const { load, GET, POST } = createDocsServer(config);`}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            4
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Write docs</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create Markdown files under <code className="text-black/60 dark:text-white/60 text-xs">docs/</code>.
              That&#39;s it.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Markdown Page"
          filename="docs/getting-started/page.md"
          code={`---
title: "Getting Started"
description: "Set up in 5 minutes"
icon: "rocket"
---

# Getting Started

Write your content in **Markdown** with
frontmatter for metadata.

\`\`\`ts title="auth.ts"
export const auth = betterAuth({
  database: { provider: "postgresql" },
});
\`\`\``}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            5
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Routes</h3>
            <p className="text-sm text-black/40 dark:text-white/40">Index page, catch-all route, and API endpoint.</p>
          </div>
        </div>
        <AstroRouteTabs />
      </div>
    </div>
  );
}

function NuxtSteps() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            1
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Install</h3>
            <p className="text-sm text-black/40 dark:text-white/40">Add the core packages to your Nuxt project.</p>
          </div>
        </div>
        <CodeBlock
          title="Terminal"
          filename="shell"
          language="bash"
          code="pnpm add @farming-labs/docs @farming-labs/nuxt @farming-labs/nuxt-theme"
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            2
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Configure</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              One config file. Theme, metadata, navigation — everything.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Config"
          filename="docs.config.ts"
          code={`import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/nuxt-theme/fumadocs";

export default defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: fumadocs(),
  metadata: {
    titleTemplate: "%s – My Docs",
  },
});`}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            3
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Nuxt Config</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Import the theme CSS and configure Nitro server assets.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Nuxt Config"
          filename="nuxt.config.ts"
          code={`export default defineNuxtConfig({
  css: ["@farming-labs/nuxt-theme/fumadocs/css"],
  nitro: {
    serverAssets: [
      { baseName: "docs", dir: "../docs" },
    ],
  },
});`}
        />
      </div>

      <div className="space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            4
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Server API</h3>
            <p className="text-sm text-black/40 dark:text-white/40">One handler for docs loading, search, and AI.</p>
          </div>
        </div>
        <CodeBlock
          title="API Handler"
          filename="server/api/docs.ts"
          code={`import { defineDocsHandler } from "@farming-labs/nuxt/server";
import config from "../../docs.config";

export default defineDocsHandler(config, useStorage);`}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            5
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Write docs</h3>
            <p className="text-sm text-black/40 dark:text-white/40">
              Create Markdown files under <code className="text-black/60 dark:text-white/60 text-xs">docs/</code>.
              That&apos;s it.
            </p>
          </div>
        </div>
        <CodeBlock
          title="Markdown Page"
          filename="docs/getting-started/page.md"
          code={`---
title: "Getting Started"
description: "Set up in 5 minutes"
icon: "rocket"
---

# Getting Started

Write your content in **Markdown** with
frontmatter for metadata.

\`\`\`ts title="auth.ts"
export const auth = betterAuth({
  database: { provider: "postgresql" },
});
\`\`\``}
        />

        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-black/10 dark:border-white/10 text-xs font-mono text-black/40 dark:text-white/40">
            6
          </div>
          <div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Page Route</h3>
            <p className="text-sm text-black/40 dark:text-white/40">A single Vue page that handles all doc routes.</p>
          </div>
        </div>
        <CodeBlock
          title="Doc Page"
          filename="pages/docs/[...slug].vue"
          code={`<script setup lang="ts">
import { DocsLayout, DocsContent } from "@farming-labs/nuxt-theme";
import config from "~/docs.config";

const route = useRoute();
const pathname = computed(() => route.path);

const { data } = await useFetch("/api/docs", {
  query: { pathname },
  watch: [pathname],
});
</script>

<template>
  <DocsLayout :tree="data.tree" :config="config">
    <DocsContent :data="data" :config="config" />
  </DocsLayout>
</template>`}
        />
      </div>
    </div>
  );
}

function InstallSection() {
  return (
    <section className="relative z-10 bg-white dark:bg-black border-t border-black/[8%] dark:border-white/[8%]">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 py-16 sm:py-24">
        <div className="mb-10 sm:mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/30 dark:text-white/30 mb-4 block">
            Quick Start
          </span>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tighter text-black dark:text-white">
            Up and running in minutes
          </h2>
        </div>
        <div className="mb-8">
          <InitBlockTabs />
        </div>

        <div className="mb-4">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/25 dark:text-white/25">
            Or set up manually
          </span>
        </div>

        <FrameworkTabs
          tabs={[
            {
              label: "Next.js",
              value: "nextjs",
              content: <NextJsSteps />,
            },
            {
              label: "SvelteKit",
              value: "sveltekit",
              content: <SvelteKitSteps />,
            },
            {
              label: "Astro",
              value: "astro",
              content: <AstroSteps />,
            },
            {
              label: "Nuxt",
              value: "nuxt",
              content: <NuxtSteps />,
            },
          ]}
        />
      </div>
    </section>
  );
}

function ThemesSection() {
  const themes = [
    {
      name: "Default",
      description: "Clean, neutral palette with standard border radius",
      import: '@import "@farming-labs/theme/default/css";',
      colors: ["#6366f1", "#ffffff", "#64748b", "#e5e7eb"],
    },
    {
      name: "Darksharp",
      description: "All-black, sharp corners, no rounded edges",
      import: '@import "@farming-labs/theme/darksharp/css";',
      colors: ["#fafaf9", "#000000", "#a8a29e", "#262626"],
    },
    {
      name: "Pixel Border",
      description: "Inspired by better-auth.com — refined dark UI",
      import: '@import "@farming-labs/theme/pixel-border/css";',
      colors: ["#fafaf9", "#050505", "#8c8c8c", "#262626"],
    },
    {
      name: "Colorful",
      description: "Faithful clone of the fumadocs default neutral theme",
      import: '@import "@farming-labs/theme/colorful/css";',
      colors: ["#FFFF00", "#f5f5f4", "#64748b", "#e5e7eb"],
    },
    {
      name: "Shiny",
      description: "Clerk docs-inspired — clean, polished purple accents",
      import: '@import "@farming-labs/theme/shiny/css";',
      colors: ["#6c47ff", "#f7f7f8", "#73738c", "#e5e5ea"],
    },
    {
      name: "DarkBold",
      description: "Pure monochrome design — clean, bold, minimal",
      import: '@import "@farming-labs/theme/darkbold/css";',
      colors: ["#000", "#fff", "#888", "#eaeaea"],
    },
    {
      name: "GreenTree",
      description: "Mintlify-inspired — emerald green, Inter font, modern",
      import: '@import "@farming-labs/theme/greentree/css";',
      colors: ["#0D9373", "#26BD6C", "#171A18", "#DFE1E0"],
    },
  ];

  return (
    <section className="relative z-10 bg-white dark:bg-black border-t border-black/[8%] dark:border-white/[8%]">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 py-16 sm:py-24">
        <div className="mb-10 sm:mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/30 dark:text-white/30 mb-4 block">
            Themes
          </span>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tighter text-black dark:text-white">
            More themes. Your choice.
          </h2>
          <p className="mt-3 text-black/40 dark:text-white/40 max-w-lg">
            Pick a preset or build your own with{" "}
            <code className="text-black/60 dark:text-white/60 text-xs font-mono">createTheme()</code>. Override any
            styles from config.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {themes.map((theme) => (
            <PixelCard
              key={theme.name}
              variant="default"
              className="transition-all overflow-x-hidden"
            >
              <div className="flex items-center gap-2 mb-4">
                {theme.colors.map((c, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 border border-black/10 dark:border-white/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <hr className="border-black/[6%] dark:border-white/[6%] opacity-60 -mx-10" />
              <h3 className="text-xs uppercase font-mono pt-2 text-black dark:text-white mb-0">{theme.name}</h3>
              <hr className="my-2 border-black/[6%] dark:border-white/[6%] opacity-60 -mx-10" />
              <p className="text-xs text-black/40 dark:text-white/40 mb-4">{theme.description}</p>
              <code className="text-[11px] font-mono text-black/25 dark:text-white/25 break-all">{theme.import}</code>
            </PixelCard>
          ))}
        </div>

        <div className="mt-8">
          <CodeBlock
            title="Custom Colors"
            filename="docs.config.tsx"
            code={`theme: pixelBorder({
  ui: {
    colors: {
      primary: "oklch(0.72 0.19 149)",     // green
      accent: "hsl(220 80% 60%)",          // blue
    },
  },
}),`}
          />
        </div>

        <div className="mt-10 flex items-center gap-4">
          <a className="group" href="/themes">
            <span className="inline-flex group items-center gap-2 rounded-none uppercase font-mono text-xs border border-black/10 dark:border-white/10 bg-black/[3%] dark:bg-white/[3%] px-5 py-2.5 cursor-pointer text-black/80 dark:text-white/80 transition-all hover:bg-black/[4%] dark:hover:bg-white/[4%] hover:text-black dark:hover:text-white hover:border-black/10 dark:hover:border-white/10 hover:no-underline">
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
              expore themes
              <ArrowRight className="w-3.5 h-3.5 -rotate-45 group-hover:rotate-0 transition-transform duration-300" />
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}

function ConfigSection() {
  return (
    <section className="relative z-10 bg-white dark:bg-black border-t border-black/[8%] dark:border-white/[8%]">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 py-16 sm:py-24">
        <div className="mb-10 sm:mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/30 dark:text-white/30 mb-4 block">
            Configuration
          </span>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tighter text-black dark:text-white">
            One file. Full control.
          </h2>
        </div>

        <CodeBlock
          title="Full Example"
          filename="docs.config.tsx"
          code={`import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/theme/pixel-border";
import { Rocket, BookOpen, Code } from "lucide-react";

export default defineDocs({
  entry: "docs",
  theme: pixelBorder({
    ui: {
      colors: { primary: "oklch(0.72 0.19 149)" },
      typography: {
        font: {
          h1: { size: "2.25rem", weight: 700 },
          body: { size: "0.975rem", lineHeight: "1.8" },
        },
      },
    },
  }),

  nav: {
    title: <div style={{ display: "flex", gap: 8 }}>
      <Rocket size={14} /> My Docs
    </div>,
  },

  icons: {
    rocket: <Rocket size={16} />,
    book: <BookOpen size={16} />,
    code: <Code size={16} />,
  },

  components: { MyCustomCallout },

  breadcrumb: { enabled: true },
  themeToggle: { enabled: false, default: "dark" },

  pageActions: {
    copyMarkdown: { enabled: true },
    openDocs: {
      enabled: true,
      providers: [
        { name: "ChatGPT", urlTemplate: "https://chatgpt.com/?q={url}" },
      ],
    },
  },

  metadata: {
    titleTemplate: "%s – Docs",
    description: "My documentation site",
  },
});`}
        />
      </div>
    </section>
  );
}

function PackagesSection() {
  const packages = [
    {
      name: "@farming-labs/docs",
      description: "Core types, defineDocs(), createTheme(), extendTheme(). Framework agnostic.",
    },
    {
      name: "@farming-labs/theme",
      description:
        "Theme presets (default, darksharp, pixel-border) for Next.js. Layout components, RootProvider.",
    },
    {
      name: "@farming-labs/next",
      description: "Next.js adapter. withDocs() for config, MDX processing, search API generation.",
    },
    {
      name: "@farming-labs/svelte",
      description: "SvelteKit adapter. Server-side docs loader, markdown processing, search API.",
    },
    {
      name: "@farming-labs/svelte-theme",
      description:
        "Theme presets (default, pixel-border) for SvelteKit. DocsLayout, DocsContent components.",
    },
    {
      name: "@farming-labs/astro",
      description: "Astro adapter. Server-side docs loader, markdown processing, search API.",
    },
    {
      name: "@farming-labs/astro-theme",
      description:
        "Theme presets (default, darksharp, pixel-border) for Astro. DocsLayout, DocsContent components.",
    },
    {
      name: "@farming-labs/nuxt",
      description: "Nuxt 3 adapter. defineDocsHandler() for API, markdown processing, search API.",
    },
    {
      name: "@farming-labs/nuxt-theme",
      description: "Theme presets for Nuxt. DocsLayout, DocsContent components.",
    },
  ];

  return (
    <section className="relative z-10 bg-white dark:bg-black border-t border-black/[0.06] dark:border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-5 sm:px-6 py-16 sm:py-24">
        <div className="mb-10 sm:mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-black/30 dark:text-white/30 mb-4 block">
            Packages
          </span>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tighter text-black dark:text-white">
            Modular by design
          </h2>
          <p className="mt-3 text-black/40 dark:text-white/40 max-w-lg">
            Only install what you need. Core stays lean, framework adapters and themes are separate.
          </p>
        </div>

        <div className="space-y-px">
          {packages.map((pkg) => (
            <div
              key={pkg.name}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 border border-black/[0.06] dark:border-white/[0.06] bg-black/[0.01] dark:bg-white/[0.01] p-5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-all"
            >
              <code className="text-sm font-mono text-black/80 dark:text-white/80 shrink-0 min-w-[250px]">
                {pkg.name}
              </code>
              <p className="text-sm text-black/35 dark:text-white/35">{pkg.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <footer className="relative z-10 bg-white dark:bg-black">
      <div className="absolute bottom-10 left-0 w-full h-px bg-black/[8%] dark:bg-white/[8%]" />
      <div className="absolute bottom-24 left-0 w-full h-px bg-black/[8%] dark:bg-white/[8%]" />
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="w-full">
            <span className="font-mono text-xs tracking-tighter text-black/40 dark:text-white/40 uppercase">
              <Link
                href="https://github.com/farming-labs/docs"
                target="_blank"
                className="text-black/30 dark:text-white/30 hover:underline hover:underline-offset-2 hover:decoration-black/30 dark:hover:decoration-white/30 hover:decoration-dotted hover:text-black/50 dark:hover:text-white/50 transition-colors no-underline lowercase font-mono"
              >
                @farming-labs/docs
              </Link>
            </span>
            <p className="text-[10px] uppercase font-mono text-black/30 dark:text-white/30 mt-1">
              Built by{" "}
              <Link
                href="https://x.com/kinfishT"
                target="_blank"
                className="text-black/30 dark:text-white/30 underline underline-offset-2 decoration-black/30 dark:decoration-white/30 decoration-dotted hover:text-black/50 dark:hover:text-white/50 transition-colors hover:no-underline uppercase font-mono"
              >
                @kinfish
              </Link>
            </p>
          </div>
          <div className="flex max-w-full w-full justify-end items-center gap-6">
            <Link
              href="/docs"
              className="text-xs uppercase font-mono text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-colors hover:no-underline"
            >
              Documentation
            </Link>
            <Link
              href="https://github.com/farming-labs/docs"
              target="_blank"
              className="text-xs uppercase font-mono text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-colors hover:no-underline"
            >
              GitHub
            </Link>
            <Link
              href="https://www.npmjs.com/package/@farming-labs/docs"
              target="_blank"
              className="text-xs uppercase font-mono text-black/30 dark:text-white/30 hover:text-black/60 dark:hover:text-white/60 transition-colors hover:no-underline"
            >
              npm
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen w-full overflow-y-hidden relative bg-white dark:bg-black">
      <div className="absolute top-14 w-full right-0 z-[999] h-px bg-black/[8%] dark:bg-white/[8%]" />
      <div className="pointer-events-none fixed inset-0 z-[999]">
        <div className="mx-auto max-w-[90%] h-full relative">
          <div className="absolute left-0 top-0 h-full w-px bg-black/[8%] dark:bg-white/[8%]" />
          <div className="absolute right-0 top-0 h-full w-px bg-black/[8%] dark:bg-white/[8%]" />
        </div>
      </div>
      <div className="max-w-[90%] mx-auto">
        <HeroSection />
        <InstallSection />
        <ThemesSection />
        <ConfigSection />
        <FooterSection />
      </div>
    </div>
  );
}
