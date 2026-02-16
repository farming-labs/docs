import Link from "next/link";
import { ArrowRight, ArrowUpRight, Github, Terminal } from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import CodeBlock from "@/components/ui/code-block";
import PixelCard from "@/components/ui/pixel-card";

function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-[1000] border-b border-white/5 bg-black/40 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
        {/* <div className="h-px w-full bg-white/5" /> */}

        {/* <Link
          href="/"
          className="font-mono text-sm tracking-tighter text-white uppercase hover:no-underline"
        >
          @farming-labs/docs
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="/docs"
            className="text-sm text-white/60 hover:text-white transition-colors hover:no-underline"
          >
            Docs
          </Link>
          <Link
            href="https://github.com/farming-labs/docs"
            target="_blank"
            className="text-sm text-white/60 hover:text-white transition-colors hover:no-underline"
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
  const features = [
    "Zero config — one docs.config.ts, no layout files",
    "Three themes — default, darksharp, pixel-border",
    "Built-in search powered by Orama",
    "MDX first with frontmatter routing",
    "Custom components, icons, code tabs from config",
    "CLI scaffolding — npx farming-docs init",
    "Colors, typography, sidebar — all customizable",
    "Syntax highlighting with Shiki + code titles",
  ];

  return (
    <section className="relative min-h-screen flex items-end">
      <div className="absolute top-14 w-[calc(100%+200px)] z-[999] -left-[100px] mx-auto h-px bg-white/[8%]" />
      <div className="absolute bottom-16 w-[calc(100%+200px)] z-[999] -left-[100px] mx-auto h-px bg-white/[8%]" />
      <AnimatedBackground />
      <div className="relative z-[999] w-full pb-12 sm:pb-16 pt-24">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-10 sm:gap-16">
          {/* Left — headline + CTA */}
          <div className="max-w-[85%] sm:max-w-md">
            <div className="flex flex-col gap-2">
              <div className="inline-block">
                <span className="text-[10px] font-mono tracking-[0.2em] text-white/40 px-0 py-1.5 flex items-center">
                  <div className="h-[12px] w-px bg-white/50 mr-2" />
                  v0.0.1
                </span>
              </div>
              <div className="inline-block mb-2">
                <span className="text-[10px] font-mono tracking-[0.2em] text-white/40 px-0 py-1.5 flex items-center">
                  <div className="h-[12px] w-px bg-white/50 mr-2" />
                  v0.0.2.beta-1
                </span>
              </div>
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-semibold tracking-tighter text-white leading-[0.95]">
              documentation
              <br />
              that just <span className="text-black bg-white -leading-10">works.</span>
            </h1>
            <p className="mt-4 text-sm sm:text-base font-mono uppercase text-white/45 max-w-md leading-relaxed">
              A modern MDX documentation framework for Next.js. One config file,
              zero boilerplate.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/docs"
                className="group inline-flex items-center gap-2 bg-white text-black px-5 py-2.5 text-xs font-mono uppercase tracking-wider hover:bg-white/90 transition-all hover:no-underline"
              >
                Get Started
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <div className="flex font-mono items-center gap-2 border border-white/10 px-4 py-2.5 text-sm text-white/70">
                <Terminal className="w-3.5 h-3.5 text-white/40" />
                <span>npx farming-docs init</span>
              </div>
            </div>
          </div>

          <div className="sm:max-w-xs">
            {/* <ul className="space-y-1.5">
              {features.map((f) => (
                <li
                  key={f}
                  className="text-[11px] sm:text-[12px] text-white/30 font-mono uppercase tracking-wide leading-relaxed flex items-start gap-2"
                >
                  <span className="text-white/15 mt-px">—</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul> */}
            <div className="mt-6 flex items-center justify-end">
              <Link
                href="https://github.com/farming-labs/docs"
                className="group uppercase font-mono tracking-tighter text-white/30 hover:text-white/60 hover:no-underline relative ease-in after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:translate-y-[3px] after:bg-white/30 after:opacity-0 after:duration-300 after:content-[''] hover:after:-translate-y-0.5 hover:after:opacity-100 text-[11px] transition-all duration-300"
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

function InstallSection() {
  return (
    <section className="relative z-10 bg-black border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-4 block">
            Quick Start
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-white">
            Up and running in minutes
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-white/10 text-xs font-mono text-white/40">
                1
              </div>
              <div>
                <h3 className="text-sm font-medium text-white mb-1">
                  Install
                </h3>
                <p className="text-sm text-white/40">
                  Add the core packages to your Next.js project.
                </p>
              </div>
            </div>
            <CodeBlock
              title="Terminal"
              filename="shell"
              code="pnpm add @farming-labs/docs @farming-labs/fumadocs @farming-labs/next"
            />

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-white/10 text-xs font-mono text-white/40">
                2
              </div>
              <div>
                <h3 className="text-sm font-medium text-white mb-1">
                  Configure
                </h3>
                <p className="text-sm text-white/40">
                  One file. Theme, metadata, components, icons — everything.
                </p>
              </div>
            </div>
            <CodeBlock
              title="Config"
              filename="docs.config.tsx"
              code={`import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/fumadocs/pixel-border";

export default defineDocs({
  entry: "docs",
  theme: pixelBorder(),
  metadata: {
    titleTemplate: "%s – My Docs",
  },
});`}
            />
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-white/10 text-xs font-mono text-white/40">
                3
              </div>
              <div>
                <h3 className="text-sm font-medium text-white mb-1">
                  Write docs
                </h3>
                <p className="text-sm text-white/40">
                  Create MDX files under{" "}
                  <code className="text-white/60 text-xs">app/docs/</code>.
                  That&#39;s it.
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

            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-white/10 text-xs font-mono text-white/40">
                4
              </div>
              <div>
                <h3 className="text-sm font-medium text-white mb-1">Ship</h3>
                <p className="text-sm text-white/40">
                  No layout files. No wrappers. The framework handles
                  everything.
                </p>
              </div>
            </div>
            <CodeBlock
              title="Next Config"
              filename="next.config.ts"
              code={`import { withDocs } from "@farming-labs/next/config";

export default withDocs({});

// That's it. Routing, MDX, search — all handled.`}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ThemesSection() {
  const themes = [
    {
      name: "Default",
      description: "Clean, neutral palette with standard border radius",
      import: '@import "@farming-labs/fumadocs/default/css";',
      colors: ["#6366f1", "#ffffff", "#64748b", "#e5e7eb"],
    },
    {
      name: "Darksharp",
      description: "All-black, sharp corners, no rounded edges",
      import: '@import "@farming-labs/fumadocs/darksharp/css";',
      colors: ["#fafaf9", "#000000", "#a8a29e", "#262626"],
    },
    {
      name: "Pixel Border",
      description: "Inspired by better-auth.com — refined dark UI",
      import: '@import "@farming-labs/fumadocs/pixel-border/css";',
      colors: ["#fafaf9", "#050505", "#8c8c8c", "#262626"],
    },
  ];

  return (
    <section className="relative z-10 bg-black border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-4 block">
            Themes
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-white">
            More themes. Your choice.
          </h2>
          <p className="mt-3 text-white/40 max-w-lg">
            Pick a preset or build your own with{" "}
            <code className="text-white/60 text-xs font-mono">
              createTheme()
            </code>
            . Override any styles from config.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    className="w-4 h-4 border border-white/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <hr className="border-white/[6%] opacity-60 -mx-10" />
              <h3 className="text-xs uppercase font-mono pt-2 text-white mb-0">
                {theme.name}
              </h3>
              <hr className="my-2 border-white/[6%] opacity-60 -mx-10" />
              <p className="text-xs text-white/40 mb-4">{theme.description}</p>
              <code className="text-[11px] font-mono text-white/25 break-all">
                {theme.import}
              </code>
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
      </div>
    </section>
  );
}

function ConfigSection() {
  return (
    <section className="relative z-10 bg-black border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-4 block">
            Configuration
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-white">
            One file. Full control.
          </h2>
        </div>

        <CodeBlock
          title="Full Example"
          filename="docs.config.tsx"
          code={`import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/fumadocs/pixel-border";
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
      description:
        "Core types, defineDocs(), createTheme(), extendTheme(). Framework agnostic.",
    },
    {
      name: "@farming-labs/fumadocs",
      description:
        "Theme presets (default, darksharp, pixel-border), layout components, RootProvider.",
    },
    {
      name: "@farming-labs/next",
      description:
        "Next.js adapter. withDocs() for config, MDX processing, search API generation.",
    },
  ];

  return (
    <section className="relative z-10 bg-black border-t border-white/[0.06]">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16">
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-4 block">
            Packages
          </span>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tighter text-white">
            Modular by design
          </h2>
          <p className="mt-3 text-white/40 max-w-lg">
            Only install what you need. Core stays lean, framework adapters and
            themes are separate.
          </p>
        </div>

        <div className="space-y-px">
          {packages.map((pkg) => (
            <div
              key={pkg.name}
              className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-8 border border-white/[0.06] bg-white/[0.01] p-5 hover:bg-white/[0.03] transition-all"
            >
              <code className="text-sm font-mono text-white/80 shrink-0 min-w-[250px]">
                {pkg.name}
              </code>
              <p className="text-sm text-white/35">{pkg.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <footer className="relative z-10 bg-black">
      <div className="absolute bottom-10 left-0 w-full h-px bg-white/[8%]" />
      <div className="absolute bottom-24 left-0 w-full h-px bg-white/[8%]" />
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="font-mono text-xs tracking-tighter text-white/40 uppercase">
              <Link
                href="https://github.com/farming-labs/docs"
                target="_blank"
                className="text-white/30 hover:underline hover:underline-offset-2 hover:decoration-white/30 hover:decoration-dotted hover:text-white/50 transition-colors no-underline lowercase font-mono"
              >
                @farming-labs/docs
              </Link>
            </span>
            <p className="text-[10px] uppercase font-mono text-white/30 mt-1">
              Built by{" "}
              <Link
                href="https://x.com/kinfishT"
                target="_blank"
                className="text-white/30 underline underline-offset-2 decoration-white/30 decoration-dotted hover:text-white/50 transition-colors hover:no-underline uppercase font-mono"
              >
                @kinfish
              </Link>
            </p>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/docs"
              className="text-xs uppercase font-mono text-white/30 hover:text-white/60 transition-colors hover:no-underline"
            >
              Documentation
            </Link>
            <Link
              href="https://github.com/farming-labs/docs"
              target="_blank"
              className="text-xs uppercase font-mono text-white/30 hover:text-white/60 transition-colors hover:no-underline"
            >
              GitHub
            </Link>
            <Link
              href="https://www.npmjs.com/package/@farming-labs/docs"
              target="_blank"
              className="text-xs uppercase font-mono text-white/30 hover:text-white/60 transition-colors hover:no-underline"
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
    <div className="min-h-screen w-full overflow-hidden relative bg-black">
      <div className="pointer-events-none fixed inset-0 z-[999] hidden lg:block">
        <div className="mx-auto max-w-7xl h-full relative">
          <div className="absolute left-0 top-0 h-full w-px bg-white/[8%]" />
          <div className="absolute right-0 top-0 h-full w-px bg-white/[8%]" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto">
        <HeroSection />
        <InstallSection />
        <ThemesSection />
        <ConfigSection />
        {/* <PackagesSection /> */}
        <FooterSection />
      </div>
    </div>
  );
}
