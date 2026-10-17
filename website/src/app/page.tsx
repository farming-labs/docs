import type { CSSProperties } from "react";
import type { Metadata } from "@farm.js/core";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Cloud,
  FileJson,
  Layers3,
  Palette,
  Route,
} from "lucide-react";
import {
  FarmingLabsMark,
  SimpleIcon,
  type SimpleIconName,
} from "@/components/marketing/brand-icons";
import { DecodeWord } from "@/components/marketing/decode-word";
import {
  AgentReadableVisual,
  AgentScoreVisual,
  ApiReferenceVisual,
  AskAiVisual,
  PageActionsVisual,
  SearchVisual,
} from "@/components/marketing/feature-visuals";
import { FlickeringGrid } from "@/components/marketing/flickering-grid";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import { AgentPromptButton, InstallBox } from "@/components/marketing/install-command";
import { ProductShot } from "@/components/marketing/product-shot";
import { QuickStart } from "@/components/marketing/quick-start";
import { ShellCommand } from "@/components/marketing/shell-command";
import {
  Cell,
  CellGrid,
  FeatureItem,
  NumberedStrip,
  Section,
  SectionHeader,
  Tray,
} from "@/components/marketing/sections";
import { DocsCommandSearch } from "@/components/docs-command-search";
import { ButtonLink, IndexedLabel } from "@/components/marketing/primitives";
import {
  AnnouncementBar,
  MarketingFooter,
  MarketingHeader,
} from "@/components/marketing/site-chrome";
import { getLatestRelease } from "@/lib/latest-release";
import { UsedByLogos } from "@/components/marketing/used-by";
import { MigrationSourceIcon, migrationSources } from "@/components/ui/migration-source-icon";

export const metadata: Metadata = {
  title: { absolute: "@farming-labs/docs — documentation for people and agents" },
  description:
    "An AI-native documentation framework for Next.js, TanStack Start, Farm.js, SvelteKit, Astro, and Nuxt. Ask AI, MCP, llms.txt, search, themes, and API reference from one config.",
};

const heroWords = ["AI.", "agents.", "humans.", "MCP.", "search."] as const;

type FrameworkIcon = SimpleIconName | "farm";

const frameworks: ReadonlyArray<{ name: string; icon: FrameworkIcon; body: string }> = [
  {
    name: "Next.js",
    icon: "nextjs",
    body: "One withDocs() wrapper in next.config.",
  },
  {
    name: "TanStack Start",
    icon: "tanstack",
    body: "A Vite plugin and a docs server.",
  },
  {
    name: "Farm.js",
    icon: "farm",
    body: "Built-in adapter, edge-ready builds.",
  },
  {
    name: "SvelteKit",
    icon: "svelte",
    body: "createDocsServer() for load and routes.",
  },
  {
    name: "Astro",
    icon: "astro",
    body: "Server helpers and one middleware.",
  },
  {
    name: "Nuxt",
    icon: "nuxt",
    body: "One defineDocsHandler() via Nitro.",
  },
];

const stripItems = [
  { label: "Ask AI", href: "#ask-ai" },
  { label: "Search", href: "#search" },
  { label: "Markdown mirrors", href: "#markdown" },
  { label: "Page actions", href: "#page-actions" },
  { label: "API reference", href: "#api-reference" },
  { label: "Agent score", href: "#agent-score" },
] as const;

const builtIn = [
  {
    title: "Twelve themes",
    href: "/themes",
    body: "Presets or createTheme().",
  },
  {
    title: "llms.txt and sitemaps",
    href: "/docs/customization/llms-txt",
    body: "Generated from your content.",
  },
  {
    title: "Analytics",
    href: "/docs/customization/analytics",
    body: "Docs, search, AI, and MCP events.",
  },
  {
    title: "Changelogs",
    href: "/docs/configuration",
    body: "Release notes from MDX, built in.",
  },
  {
    title: "CLI scaffolding",
    href: "/docs/cli",
    body: "init scaffolds everything.",
  },
  {
    title: "Open Graph images",
    href: "/docs/customization/og-images",
    body: "Static or dynamic, per page.",
  },
  {
    title: "Internationalization",
    href: "/docs/configuration",
    body: "Locales and localized navigation.",
  },
  {
    title: "Feedback",
    href: "/docs/configuration",
    body: "Send it anywhere with onFeedback().",
  },
] as const;

const agentEndpoints = [
  { method: "GET", path: "/llms.txt", note: "Compact map of every page", href: "/llms.txt" },
  {
    method: "GET",
    path: "/llms-full.txt",
    note: "The whole site in one file",
    href: "/llms-full.txt",
  },
  {
    method: "GET",
    path: "/docs/{page}.md",
    note: "Markdown mirror of each page",
    href: "/docs/installation.md",
  },
  { method: "POST", path: "/mcp", note: "search_docs · read_page · list_pages" },
  {
    method: "GET",
    path: "/.well-known/agent.json",
    note: "Agent discovery manifest",
    href: "/.well-known/agent.json",
  },
  { method: "GET", path: "/skill.md", note: "Skill file for coding agents", href: "/skill.md" },
] as const;

const themes = [
  {
    name: "Pixel Border",
    slug: "pixel-border",
    colors: ["#fafaf9", "#050505", "#8c8c8c", "#262626"],
  },
  { name: "Default", slug: "default", colors: ["#6366f1", "#ffffff", "#64748b", "#e5e7eb"] },
  { name: "Darksharp", slug: "darksharp", colors: ["#fafaf9", "#000000", "#a8a29e", "#262626"] },
  { name: "Colorful", slug: "colorful", colors: ["#FFFF00", "#f5f5f4", "#64748b", "#e5e7eb"] },
  { name: "Shiny", slug: "shiny", colors: ["#6c47ff", "#f7f7f8", "#73738c", "#e5e5ea"] },
  { name: "Ledger", slug: "ledger", colors: ["#5f6cf6", "#f6f8fb", "#30364a", "#d9deea"] },
  { name: "Shadcn", slug: "shadcn", colors: ["#000000", "#ffffff", "#737373", "#e5e5e5"] },
  { name: "DarkBold", slug: "darkbold", colors: ["#ffffff", "#000000", "#888888", "#2a2a2a"] },
  { name: "GreenTree", slug: "greentree", colors: ["#0D9373", "#ffffff", "#5f6b66", "#DFE1E0"] },
  { name: "Hardline", slug: "hardline", colors: ["#ffd335", "#f2efe8", "#47423a", "#111111"] },
  { name: "Concrete", slug: "concrete", colors: ["#ff5b31", "#f6ead9", "#5b4e42", "#141210"] },
  {
    name: "Command Grid",
    slug: "command-grid",
    colors: ["#141414", "#f8f6ed", "#a8987f", "#d1c0a9"],
  },
] as const;

const deployCommand = "pnpm dlx @farming-labs/docs deploy";

function Framework({ icon, className }: { icon: FrameworkIcon; className?: string }) {
  return icon === "farm" ? (
    <FarmingLabsMark className={className} />
  ) : (
    <SimpleIcon className={className} name={icon} />
  );
}

function Hero() {
  return (
    <Section className="overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[44rem] overflow-hidden opacity-60 [mask-image:linear-gradient(to_bottom,black_35%,transparent_95%)] dark:opacity-70"
      >
        <AnimatedBackground />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_50%_42%,var(--mk-bg)_0%,transparent_100%)] opacity-80" />
      </div>
      <div className="relative z-10 mx-auto flex max-w-[64rem] flex-col items-center px-5 pt-16 text-center sm:px-10 sm:pt-24">
        <h1
          aria-label="documentation that just works with AI"
          className="text-[clamp(2rem,4.8vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.045em] text-mk-fg"
        >
          <span className="block">Documentation that</span>
          <span className="mt-1 block sm:whitespace-nowrap">
            just works with <DecodeWord words={heroWords} />
          </span>
        </h1>

        <p className="mt-6 max-w-[34rem] text-pretty text-[16px] leading-7 text-mk-fg/55 sm:text-[17px]">
          Write MDX once. Ship docs for people, with{" "}
          <strong className="font-medium text-mk-fg">Ask AI, MCP, and llms.txt</strong> built in for
          agents.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/docs/installation">Get started</ButtonLink>
          <AgentPromptButton />
        </div>
        <InstallBox className="mt-6 max-w-[30rem]" />

        <ul
          aria-label="Supported frameworks"
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[13px] text-mk-fg/45"
        >
          {frameworks.map((framework) => (
            <li key={framework.name} className="flex items-center gap-2">
              <Framework
                className={framework.icon === "farm" ? "h-3 w-auto" : "size-3.5"}
                icon={framework.icon}
              />
              {framework.name}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 mx-auto mt-16 max-w-[1100px] px-4 sm:mt-20 sm:px-10">
        <div className="relative">
          <span aria-hidden className="mk-cross -left-[7px] -top-[7px] hidden sm:block" />
          <span aria-hidden className="mk-cross -right-[7px] -top-[7px] hidden sm:block" />
          <ProductShot className="rounded-b-none border-b-0" />
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-40 bg-gradient-to-t from-mk-bg to-transparent"
      />
    </Section>
  );
}

function UsedBy() {
  return (
    <Section>
      <p className="px-6 py-7 text-center font-mono text-[11px] uppercase tracking-normal text-mk-fg/45">
        Powering docs for 100+ teams building with AI
      </p>
      <UsedByLogos />
    </Section>
  );
}

function Features() {
  return (
    <Section>
      <CellGrid>
        <Cell
          href="/docs/customization/ai-chat"
          id="ask-ai"
          index="01"
          label="Ask AI"
          muted="Cited answers from your MDX."
          title="Ask AI"
        >
          <Tray>
            <AskAiVisual />
          </Tray>
        </Cell>
        <Cell
          href="/docs/configuration"
          id="search"
          index="02"
          label="Search"
          muted="Built-in, Typesense, Algolia, or MCP."
          title="Search that fits your stack"
        >
          <Tray>
            <SearchVisual />
          </Tray>
        </Cell>
        <Cell
          href="/docs/customization/llms-txt"
          id="markdown"
          index="03"
          label="Markdown mirrors"
          muted="Every page at a .md URL."
          title="Readable by agents"
        >
          <Tray>
            <AgentReadableVisual />
          </Tray>
        </Cell>
        <Cell
          href="/docs/customization/page-actions"
          id="page-actions"
          index="04"
          label="Page actions"
          muted="Open in ChatGPT, Claude, or Cursor."
          title="Hand any page to an LLM"
        >
          <Tray>
            <PageActionsVisual />
          </Tray>
        </Cell>
        <Cell
          href="/api-reference"
          id="api-reference"
          index="05"
          label="API reference"
          muted="Request console and typed SDKs."
          title="OpenAPI reference"
        >
          <Tray>
            <ApiReferenceVisual />
          </Tray>
        </Cell>
        <Cell
          href="/score"
          id="agent-score"
          index="06"
          label="Agent score"
          muted="See what agents see."
          title="Agent score"
        >
          <Tray>
            <AgentScoreVisual />
          </Tray>
        </Cell>
      </CellGrid>
    </Section>
  );
}

function OneSource() {
  return (
    <Section>
      <div className="flex flex-col gap-8 px-6 py-16 sm:px-10 lg:flex-row lg:items-end lg:justify-between lg:py-20">
        <SectionHeader
          icon={Bot}
          index="07"
          label="Under the hood"
          body="Markdown, llms.txt, MCP, and discovery files from the same MDX."
          title="One source, every reader."
        />
        <ButtonLink
          className="shrink-0 self-start lg:self-end"
          href="/docs/customization/mcp"
          variant="secondary"
        >
          MCP guide
        </ButtonLink>
      </div>
      <div className="border-t border-mk-line">
        <CellGrid>
          <div className="p-6 sm:p-10">
            <div className="flex items-center justify-between text-mk-fg/50">
              <IndexedLabel index="07.1" label="Live on this site" />
              <span className="flex items-center gap-2 font-mono text-[11px]">
                <span aria-hidden className="mk-pulse-dot size-1.5 rounded-full bg-mk-ok" />6
                endpoints
              </span>
            </div>
            <ul className="mt-6 overflow-hidden rounded-md border border-mk-line">
              {agentEndpoints.map((endpoint) => {
                const row = (
                  <>
                    <span className="w-12 shrink-0 font-mono text-[10px] text-mk-fg/40">
                      {endpoint.method}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-[12.5px] text-mk-fg">
                        {endpoint.path}
                      </span>
                      <span className="block truncate text-[13px] text-mk-fg/45">
                        {endpoint.note}
                      </span>
                    </span>
                    {"href" in endpoint ? (
                      <ArrowUpRight
                        aria-hidden
                        className="size-3.5 shrink-0 text-mk-fg/30 transition-[color,transform] duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-mk-fg"
                        strokeWidth={1.6}
                      />
                    ) : null}
                  </>
                );
                const className =
                  "group flex min-h-[3.6rem] items-center gap-3 border-b border-mk-line bg-mk-bg px-4 py-2 last:border-b-0";
                return (
                  <li key={endpoint.path}>
                    {"href" in endpoint ? (
                      <a
                        className={`${className} transition-colors duration-150 hover:bg-mk-fg/[0.03] hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mk-fg`}
                        href={endpoint.href}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {row}
                      </a>
                    ) : (
                      <div className={className}>{row}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="p-6 sm:p-10">
            <div className="text-mk-fg/50">
              <IndexedLabel index="07.2" label="Also built in" />
            </div>
            <div className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {builtIn.map((feature) => (
                <FeatureItem key={feature.title} href={feature.href} title={feature.title}>
                  {feature.body}
                </FeatureItem>
              ))}
            </div>
          </div>
        </CellGrid>
      </div>
    </Section>
  );
}

function Frameworks() {
  return (
    <Section id="frameworks">
      <div className="px-6 py-16 sm:px-10 lg:py-20">
        <SectionHeader
          icon={Layers3}
          index="08"
          label="Frameworks"
          title="Runs on the framework you already use."
        />
      </div>
      <ul className="grid border-t border-mk-line sm:grid-cols-2 lg:grid-cols-3">
        {frameworks.map((framework) => (
          <li
            key={framework.name}
            className="border-mk-line max-lg:[&:nth-child(n+2)]:border-t sm:max-lg:[&:nth-child(2)]:border-t-0 sm:max-lg:[&:nth-child(odd)]:border-r lg:[&:nth-child(n+4)]:border-t lg:[&:not(:nth-child(3n))]:border-r"
          >
            <a
              className="group flex h-full min-h-[13rem] flex-col justify-between p-6 transition-colors duration-150 hover:bg-mk-fg/[0.025] hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mk-fg sm:p-8"
              href="/docs/installation"
            >
              <Framework
                className={
                  framework.icon === "farm"
                    ? "h-6 w-auto self-start text-mk-fg"
                    : "size-7 self-start text-mk-fg"
                }
                icon={framework.icon}
              />
              <div>
                <span className="inline-flex items-center gap-1.5 text-[16px] font-medium tracking-[-0.015em] text-mk-fg">
                  {framework.name}
                  <ArrowRight
                    aria-hidden
                    className="size-4 opacity-50 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
                    strokeWidth={1.8}
                  />
                </span>
                <p className="mt-1 text-[14px] leading-6 text-mk-fg/50">{framework.body}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
      <a
        className="group flex flex-col gap-4 border-t border-mk-line p-6 transition-colors duration-150 hover:bg-mk-fg/[0.025] hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mk-fg sm:flex-row sm:items-center sm:gap-6 sm:p-8"
        href="/docs/guides/docs-json"
      >
        <span className="grid size-10 shrink-0 place-items-center border border-mk-line text-mk-fg">
          <FileJson aria-hidden className="size-5" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="inline-flex items-center gap-1.5 text-[16px] font-medium tracking-[-0.015em] text-mk-fg">
            No framework? No problem.
            <ArrowRight
              aria-hidden
              className="size-4 opacity-50 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
              strokeWidth={1.8}
            />
          </span>
          <span className="mt-1 block text-[14px] leading-6 text-mk-fg/50">
            Frameworkless mode: a docs.json and a docs/ folder is all it takes.
          </span>
        </span>
        <code className="shrink-0 border border-mk-line bg-mk-bg px-3 py-2 text-[12.5px]">
          <ShellCommand command="pnpm exec docs dev" />
        </code>
      </a>
    </Section>
  );
}

function Migrations() {
  return (
    <Section id="migrations">
      <CellGrid>
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <SectionHeader
            actions={
              <>
                <ButtonLink href="/docs/migrations">Migration guides</ButtonLink>
                <ButtonLink href="/docs/migrations.md" variant="secondary">
                  migrations.md
                </ButtonLink>
              </>
            }
            body="Move content, navigation, assets, and existing URLs from your current platform. Each guide is agent-readable, so your assistant can run it."
            icon={Route}
            index="09"
            label="Migrations"
            title="Already have docs? Bring them with you."
          />
        </div>
        <ul aria-label="Supported migration sources" className="grid grid-cols-2">
          {migrationSources.map((source) => (
            <li
              key={source.slug}
              className="border-mk-line [&:nth-child(n+3)]:border-t [&:nth-child(odd)]:border-r"
            >
              <a
                aria-label={`Migrate from ${source.name}`}
                className="group flex h-full min-h-[7.5rem] flex-col justify-between p-5 text-mk-fg transition-colors duration-150 hover:bg-mk-fg hover:text-mk-bg hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mk-fg sm:p-6"
                href={`/docs/migrations/${source.slug}`}
              >
                <span className="flex items-start justify-between">
                  <MigrationSourceIcon className="size-5" source={source.slug} />
                  <ArrowRight
                    aria-hidden
                    className="size-4 opacity-30 transition-[opacity,transform] duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                    strokeWidth={1.6}
                  />
                </span>
                <span className="text-[15px] font-medium tracking-[-0.015em]">{source.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </CellGrid>
    </Section>
  );
}

function GetStarted() {
  return (
    <Section id="quick-start">
      <CellGrid>
        <div className="flex flex-col justify-between gap-10 p-6 sm:p-10">
          <SectionHeader
            body="The CLI detects your framework and writes every file for you."
            index="10"
            label="Quick start"
            title="Up and running in one command."
          />
          <div className="flex flex-col gap-4">
            <InstallBox />
            <div className="flex flex-wrap gap-3">
              <ButtonLink href="/docs/installation" size="compact">
                Read the guide
              </ButtonLink>
              <ButtonLink href="/docs/cli" size="compact" variant="secondary">
                CLI reference
              </ButtonLink>
            </div>
          </div>
        </div>
        <div className="min-w-0 p-6 sm:p-10">
          <QuickStart />
        </div>
      </CellGrid>
    </Section>
  );
}

function Themes() {
  return (
    <Section id="themes">
      <div className="px-6 py-16 sm:px-10 lg:py-20">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader
            icon={Palette}
            index="11"
            label="Themes"
            body="Twelve presets, or build your own with createTheme()."
            title="Pick a look."
          />
          <ButtonLink
            className="shrink-0 self-start lg:self-end"
            href="/themes"
            variant="secondary"
          >
            Theme gallery
          </ButtonLink>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {themes.map((theme) => {
            const [primary, background, muted, border] = theme.colors;
            return (
              <a
                key={theme.slug}
                className="group block hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mk-fg"
                href="/themes"
              >
                <div
                  aria-hidden
                  className="relative aspect-[16/10] overflow-hidden rounded-md border transition-transform duration-200 group-hover:-translate-y-1"
                  style={{ background, borderColor: border }}
                >
                  <div
                    className="absolute inset-y-0 left-0 w-[28%] border-r p-2.5"
                    style={{ borderColor: border }}
                  >
                    {[70, 50, 62, 44].map((width, index) => (
                      <div
                        key={index}
                        className="mb-1.5 h-1"
                        style={{
                          width: `${width}%`,
                          background: index === 1 ? primary : muted,
                          opacity: index === 1 ? 1 : 0.45,
                        }}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-y-0 left-[28%] right-0 p-3">
                    <div className="h-2 w-[46%]" style={{ background: muted, opacity: 0.9 }} />
                    <div
                      className="mt-2 h-1 w-[80%]"
                      style={{ background: muted, opacity: 0.35 }}
                    />
                    <div
                      className="mt-1 h-1 w-[66%]"
                      style={{ background: muted, opacity: 0.35 }}
                    />
                    <div
                      className="mt-2.5 h-5 w-full border"
                      style={{ borderColor: border, background: muted, opacity: 0.12 }}
                    />
                    <div className="mt-2 h-2.5 w-10" style={{ background: primary }} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="truncate text-[15px] font-medium tracking-[-0.02em] text-mk-fg">
                    {theme.name}
                  </span>
                  <span className="flex shrink-0">
                    {theme.colors.map((color) => (
                      <span
                        key={color}
                        className="-ml-0.5 size-3 border border-mk-bg first:ml-0"
                        style={{ background: color }}
                      />
                    ))}
                  </span>
                </div>
                <code className="mt-0.5 block truncate font-mono text-[11px] text-mk-fg/40">
                  theme/{theme.slug}/css
                </code>
              </a>
            );
          })}
        </div>
      </div>
    </Section>
  );
}

function CloudBand() {
  return (
    <Section>
      <CellGrid>
        <div className="flex flex-col justify-center p-6 sm:p-10">
          <SectionHeader
            actions={
              <>
                <ButtonLink href="/cloud">Explore cloud</ButtonLink>
                <ButtonLink href="/cloud#waitlist" variant="secondary">
                  Join the waitlist
                </ButtonLink>
              </>
            }
            icon={Cloud}
            index="12"
            label="Docs cloud"
            body="Git-backed editing, AI drafts, managed search, and one-command deploys."
            title="You ship the code. Cloud writes the docs."
          />
        </div>
        <div className="p-6 sm:p-10">
          <Tray className="h-auto p-4 sm:p-6">
            <figure className="overflow-hidden rounded-md border border-mk-line bg-mk-bg">
              <figcaption className="flex h-10 items-center justify-between border-b border-mk-line px-4 font-mono text-[11px] text-mk-fg/45">
                <span className="flex items-center gap-1.5">
                  <FarmingLabsMark className="h-2.5 w-auto" /> docs deploy
                </span>
                <span className="uppercase text-mk-fg/30">preview</span>
              </figcaption>
              <pre className="overflow-hidden p-5 font-mono text-[11.5px] leading-6">
                <code className="block">
                  <span className="block whitespace-nowrap text-mk-fg/50">
                    <span>$ </span>
                    <span
                      className="mk-type text-mk-fg"
                      style={
                        {
                          "--mk-type-steps": deployCommand.length,
                          "--mk-type-duration": "11s",
                        } as CSSProperties
                      }
                    >
                      <ShellCommand command={deployCommand} prompt={false} />
                    </span>
                    <span aria-hidden className="mk-type-cursor" />
                  </span>
                  <span
                    className="mk-type-output mt-2 block text-mk-fg/55"
                    style={{ "--mk-type-duration": "11s", "--mk-type-lines": 5 } as CSSProperties}
                  >
                    <span className="block">
                      <span className="text-mk-ok">✓</span> Synced repo graph · 842 sections
                    </span>
                    <span className="block">
                      <span className="text-mk-ok">✓</span> Drafted 3 pages from merged PRs
                    </span>
                    <span className="block">
                      <span className="text-mk-ok">✓</span> Opened a draft PR for review
                    </span>
                    <span className="block">
                      <span className="text-mk-ok">✓</span> Indexed search · Ask AI ready
                    </span>
                    <span className="mt-1 block text-mk-fg/50">
                      Production: <span className="text-mk-fg">https://acme.docs.app</span>
                    </span>
                  </span>
                </code>
              </pre>
            </figure>
          </Tray>
        </div>
      </CellGrid>
    </Section>
  );
}

function FinalCta() {
  return (
    <Section className="overflow-hidden">
      <div
        aria-hidden
        className="mk-hero-flicker pointer-events-none absolute inset-x-0 bottom-0 h-72 text-mk-fg"
      >
        <FlickeringGrid className="absolute inset-0" maxOpacity={0.2} />
      </div>
      <div className="relative z-10 px-6 py-24 text-center sm:px-10 sm:py-28">
        <div className="mb-6 flex justify-center text-mk-fg/45">
          <IndexedLabel index="13" label="Start building" />
        </div>
        <h2 className="mx-auto max-w-2xl text-balance text-[clamp(1.6rem,3vw,2.3rem)] font-medium leading-[1.15] tracking-[-0.035em] text-mk-fg">
          Docs for your users, <span className="text-mk-fg/40">and their agents.</span>
        </h2>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/docs/installation">Get started</ButtonLink>
          <AgentPromptButton />
        </div>
      </div>
    </Section>
  );
}

export default async function Home() {
  const release = await getLatestRelease();
  return (
    // The shell is plain markup here, not a wrapper component: Farm keeps an async
    // page's client components as islands only when no component holding client code
    // receives JSX from the page.
    <div className="mk-page min-h-screen overflow-x-clip font-sans antialiased">
      <div className="mk-grid">
        <div aria-hidden className="mk-rail" />
        <div className="mk-content min-w-0">
          <AnnouncementBar release={release} />
          <MarketingHeader />
          <main>
            <Hero />
            <UsedBy />
            <NumberedStrip items={stripItems} />
            <Features />
            <OneSource />
            <Frameworks />
            <Migrations />
            <GetStarted />
            <Themes />
            <CloudBand />
            <FinalCta />
          </main>
          <MarketingFooter />
        </div>
        <div aria-hidden className="mk-rail" />
      </div>
      <DocsCommandSearch />
    </div>
  );
}
