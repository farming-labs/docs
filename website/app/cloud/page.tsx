import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Cloud,
  Github,
  type LucideIcon,
  Palette,
  Sparkles,
  Workflow,
} from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import { CloudDocsManageIllustration } from "@/components/ui/cloud-feature-illustrations";
import { CloudFeatures } from "@/components/ui/cloud-features";
import CloudWaitlistForm from "@/components/ui/cloud-waitlist-form";
import PixelCard from "@/components/ui/pixel-card";
import Shuffle from "@/components/ui/shuffle";

export const metadata: Metadata = {
  title: "Cloud",
  description:
    "Managed docs infrastructure for teams shipping with @farming-labs/docs. Git-backed CMS, AI search, MCP, analytics, and workflows.",
};

const heroTitle = "infrastructure for teams shipping docs like product.";

const heroSignals = [
  "GitHub-backed CMS",
  "AI-assisted drafts",
  "Synced knowledge graph",
  "Draft + PR workflows",
  "One-shot deploy",
  "Managed search",
  "Cited AI answers",
  "Feedback analytics",
  "MCP-ready delivery",
  "Private docs controls",
  "Release workflows",
] as const;

const workflowSteps = [
  {
    step: "01",
    title: "Connect the docs project",
    body: "Link the repo and sync the docs model that already lives in your MDX files.",
  },
  {
    step: "02",
    title: "Operate it from one control plane",
    body: "Draft with AI help, search, analyze, and manage providers from one place.",
  },
  {
    step: "03",
    title: "Push back to GitHub and deploy",
    body: "Keep GitHub canonical. The repo still remains the thing that ships.",
  },
] as const;

const capabilityColumns = [
  {
    label: "Content",
    items: ["MDX editing", "AI drafting", "Frontmatter forms", "Review queues"],
  },
  {
    label: "Search",
    items: ["Typesense sync", "Algolia sync", "Query analytics", "Answer cards"],
  },
  {
    label: "Agents",
    items: ["MCP hosting", "llms.txt", "Tool analytics", "API surface delivery"],
  },
  {
    label: "Ops",
    items: ["Feedback inbox", "Version workflows", "Private docs", "Release signals"],
  },
] as const;

const mobileHeroSignals = heroSignals.slice(0, 6);

const accessCards = [
  {
    title: "Self-hostable",
    icon: Github,
    backgroundIcon: Github,
    description:
      "Run the full docs runtime yourself. Themes, AI hooks, MCP delivery, API pages, and search integrations stay available without forcing the managed layer.",
    label: "Everything core stays open",
    chips: ["Themes", "AI hooks", "MCP", "Search", "API docs", "llm.txt" , "Customization" , "Page Actions" ],
  },
  {
    title: "Affordable cloud",
    icon: Sparkles,
    backgroundIcon: Cloud,
    description:
      "Add managed deploys, RAG pipelines, knowledge workers, branded docs, and search operations at a price that still makes sense for solos and small teams.",
    label: "Built for small teams too",
    chips: ["*.docs.app", "RAG ops", "Knowledge workers", "Custom branding", "Analytics"],
  },
  {
    title: "Enterprise layer",
    icon: Building2,
    backgroundIcon: Building2,
    description:
      "Get the whole managed stack, migration support, deeper branding, private workflows, exclusive maintenance, and long-term support as the docs platform evolves with your team.",
    label: "For teams that need a partner",
    chips: [
      "Migration support",
      "Private docs",
      "Custom theme",
      "Dedicated support",
      "Exclusive maintenance",
    ],
  },
] as const;

export default function CloudPage() {
  return (
    <div className="min-h-dvh bg-white text-black dark:bg-black dark:text-white">
      <div className="fixed inset-0 hidden pointer-events-none lg:block">
        <div className="mx-auto h-full max-w-[90%]">
          <div className="relative h-full">
            <div className="absolute inset-y-0 left-0 w-px bg-black/10 dark:bg-white/8" />
            <div className="absolute inset-y-0 right-0 w-px bg-black/10 dark:bg-white/8" />
          </div>
        </div>
      </div>

      <div className="absolute left-0 right-0 top-14 z-[1] h-px bg-black/10 dark:bg-white/8" />

      <header className="relative z-10 px-0 md:px-6 py-0">
        <div className="mx-auto flex max-w-[90%] items-center justify-between">
          <div className="flex items-center gap-2 pb-8 pt-5 text-xs uppercase font-medium text-black/65 dark:text-white/80 md:pb-0">
            <Link
              href="/"
              className="font-mono text-black/45 transition-colors hover:text-black hover:no-underline dark:text-white/45 dark:hover:text-white"
            >
              Home <span className="ml-2 text-black/25 dark:text-white/25">/</span>
            </Link>
            <Cloud className="size-3.5" strokeWidth={1.8} />
            <p className="font-mono uppercase tracking-[0.22em]">Cloud</p>
          </div>

          <Link
            href="https://github.com/farming-labs/docs"
            className="group hidden font-mono text-[11px] uppercase tracking-[0.2em] text-black/35 transition-colors hover:text-black hover:no-underline dark:text-white/35 dark:hover:text-white md:inline-flex md:items-end mt-6 md:gap-1.5"
          >
            GitHub
            <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[92%] space-y-16 pb-20 pt-4 sm:max-w-[90%] sm:space-y-20 sm:pt-6 md:space-y-24 md:px-0 md:pt-14">
        <section className="relative grid gap-10 pb-10 lg:grid-cols-[minmax(0,5.5fr)_minmax(360px,3fr)] lg:items-stretch lg:gap-0 lg:pb-0">
          <div className="pointer-events-none absolute bottom-0 left-[calc(50%-50vw)] right-[calc(50%-50vw)] h-px bg-black/10 dark:bg-white/10" />
          <div className="relative min-w-0 overflow-hidden lg:flex">
            <div className="pointer-events-none absolute -top-6 bottom-0 left-0 z-20 hidden w-px bg-black/10 dark:bg-white/5 sm:block md:-top-24" />
            <div
              className="absolute inset-0 hidden overflow-hidden opacity-45 sm:block"
              aria-hidden
            >
              <AnimatedBackground />
            </div>

            <div className="relative z-10 flex max-w-3xl flex-col pt-1 sm:pt-0 lg:min-h-full lg:justify-end">
              <h1 className="max-w-[11ch] text-balance text-[2.6rem] font-semibold leading-[0.92] tracking-[-0.08em] text-black dark:text-white sm:hidden">
                {heroTitle}
              </h1>

              <Shuffle
                text={heroTitle}
                shuffleDirection="right"
                duration={0.35}
                animationMode="evenodd"
                shuffleTimes={1}
                ease="power3.out"
                stagger={0.03}
                threshold={0.1}
                triggerOnce={true}
                triggerOnHover
                respectReducedMotion={true}
                loop={false}
                loopDelay={0}
                tag="h1"
                textAlign="left"
                className="hidden max-w-4xl font-semibold tracking-[-0.06em] text-black dark:text-white sm:block sm:text-5xl lg:text-6xl"
              />

              <p className="mt-3 max-w-[34rem] text-[15px] leading-6 text-black/55 dark:text-white/45 sm:mt-6 sm:text-lg sm:leading-relaxed">
                Keep the open runtime. Add the layer for editing, search, analytics, AI, and docs
                operations.
              </p>

              <div className="mt-5 flex flex-wrap gap-1.5 sm:mt-7 sm:gap-2">
                {heroSignals.map((signal, index) => (
                  <span
                    key={signal}
                    className={index >= mobileHeroSignals.length
                      ? "hidden items-center border border-black/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-black/45 dark:border-white/10 dark:text-white/45 sm:inline-flex sm:px-2.5 sm:text-[10px] sm:tracking-[0.2em]"
                      : "inline-flex items-center border border-black/10 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-black/45 dark:border-white/10 dark:text-white/45 sm:px-2.5 sm:text-[10px] sm:tracking-[0.2em]"}
                  >
                    {signal}
                  </span>
                ))}
              </div>

              <div className="-mb-px mt-7 flex flex-col items-stretch gap-3 sm:mt-8 sm:items-start sm:flex-row sm:items-center">
                <a
                  href="/docs"
                  className="group inline-flex w-full items-center justify-center gap-2 border border-black bg-black px-5 py-3 font-mono text-[11px] uppercase tracking-[0.24em] text-white transition-all hover:bg-black/90 hover:no-underline sm:w-auto sm:justify-start dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
                >
                  Read Docs
                  <ArrowRight className="size-3.5 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
                </a>
              </div>

            </div>
          </div>

          <div id="waitlist" className="relative gap-2 lg:flex lg:self-stretch lg:flex-col">
            <CloudWaitlistForm />
            <div
              aria-hidden
              className="hidden -mt-2 border-x border-black/5 dark:border-white/5 lg:flex lg:min-h-0 lg:flex-1 lg:items-center"
            >
              <div className="-mx-px w-[calc(100%+2px)]">
                <hr className="h-px w-full border-black/5 dark:border-white/5" />
                <div className="relative border border-l z-20 h-10 w-full bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.45),rgba(0,0,0,0.45)_1px,transparent_1px,transparent_6px)] opacity-[0.08] dark:bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.7),rgba(255,255,255,0.7)_1px,transparent_1px,transparent_6px)] dark:opacity-[0.1]" />
                <hr className="h-px w-full border-black/5 dark:border-white/5" />
              </div>
            </div>
          </div>
        </section>

        <CloudFeatures />

        <section className="grid gap-6 lg:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] lg:items-stretch xl:gap-8">
          <PixelCard className="h-full border-black/10 bg-white/95 dark:border-white/10 dark:bg-black/35">
            <div className="border-b border-black/10 pb-5 dark:border-white/10">
              <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
                How it works
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-black dark:text-white sm:text-4xl">
                Keep your docs runtime. Add the cloud layer around it.
              </h2>

              <div className="mt-4 flex min-h-[120px] items-center justify-center overflow-hidden border-y border-black/10 bg-black/[0.02] px-3 py-2 sm:px-4 dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex w-full items-center justify-center">
                  <CloudDocsManageIllustration className="w-[280px] max-w-full opacity-85 sm:w-[360px] sm:translate-x-8 sm:-mb-10 dark:opacity-70" />
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-black/55 dark:text-white/45 sm:text-base">
                Keep the repo and deploy model you already trust. Add the layer around it.
              </p>
            </div>

            <div className="mt-5 grid gap-3">
              {workflowSteps.map((item) => (
                <div
                  key={item.step}
                  className="grid min-w-0 gap-4 border border-black/10 bg-black/[0.02] px-4 py-4 dark:border-white/10 dark:bg-white/[0.02] sm:grid-cols-[56px_minmax(0,1fr)] sm:items-start"
                >
                  <div className="flex h-11 w-11 items-center justify-center border border-black/10 font-mono text-[11px] uppercase tracking-[0.22em] text-black/45 dark:border-white/10 dark:text-white/45">
                    {item.step}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-medium tracking-tight text-black dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-black/55 dark:text-white/45">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </PixelCard>

          <PixelCard className="h-full border-black/10 bg-white/95 dark:border-white/10 dark:bg-black/35">
            <div className="flex min-w-0 items-center justify-between gap-4 border-b border-black/10 pb-4 dark:border-white/10">
              <div className="min-w-0">
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
                  Cloud dashboard
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-black dark:text-white">
                  Operate docs from one place.
                </h3>
              </div>
              <Workflow
                className="size-5 shrink-0 text-black/40 dark:text-white/40"
                strokeWidth={1.8}
              />
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <DashboardStat label="Indexed sections" value="12.4k" />
              <DashboardStat label="Search misses" value="16" />
              <DashboardStat label="Open drafts" value="08" />
              <DashboardStat label="Healthy pages" value="91%" />
            </div>

            <div className="mt-5 space-y-3">
              {[
                {
                  title: "GitHub sync",
                  meta: "main · docs branch",
                  status: "Healthy",
                },
                {
                  title: "Search provider",
                  meta: "Algolia hybrid",
                  status: "Indexed",
                },
                {
                  title: "Agent delivery",
                  meta: "MCP + llms.txt",
                  status: "Online",
                },
              ].map((row) => (
                <div
                  key={row.title}
                  className="flex flex-col items-start gap-2 border border-black/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"
                >
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                      {row.title}
                    </p>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/45">{row.meta}</p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/55 dark:text-white/55">
                    {row.status}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-black/10 pt-4 dark:border-white/10">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
                    First release scope
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-black/55 dark:text-white/45">
                    The first release should feel operational, not abstract. These are the product
                    areas teams should touch first.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {capabilityColumns.map((column) => (
                  <div
                    key={column.label}
                    className="border border-black/10 bg-black/[0.02] px-3 py-3 dark:border-white/10 dark:bg-white/[0.02]"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-black/10 pb-3 dark:border-white/10">
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/60 dark:text-white/55">
                        # {column.label}
                      </p>
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/35 dark:text-white/35">
                        {String(column.items.length).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {column.items.map((item) => (
                        <span
                          key={item}
                          className="inline-flex border border-black/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-black/55 dark:border-white/10 dark:text-white/50"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </PixelCard>
        </section>

        <section className="space-y-8">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
              Works at every size
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-black dark:text-white sm:text-4xl">
              Self-host first. Add cloud when it saves time.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-black/55 dark:text-white/45 sm:text-base">
              The point is not lock-in. Self-host stays powerful. Cloud adds deploys, retrieval
              ops, branding, and knowledge workflows at a price smaller teams can actually use.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {accessCards.map((card) => (
              <CloudAccessCard key={card.title} {...card} />
            ))}
          </div>

          <div className="flex mx-0 -mt-[16px] flex-wrap items-center gap-3 border border-black/10 bg-black/[0.02] px-4 py-4 font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/45">
            <span className="inline-flex items-center gap-2">
              <Palette className="size-3.5" />
              custom branding available across cloud and enterprise
            </span>
            <span className="hidden h-3 w-px bg-black/10 md:block dark:bg-white/10" />
            <span className="hidden sm:inline-flex items-center gap-2">
              no forced upgrade path
            </span>
          </div>
        </section>

        <section>
          <PixelCard className="border-black/10 bg-black px-5 py-7 text-white hover:bg-black dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-black sm:px-8 sm:py-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/55 dark:text-white/55">
                  Early access
                </p>
                <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">
                  Help shape the first release around the parts your team actually needs.
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 dark:text-white/70">
                  Tell us which part of your docs stack is hardest today. We’re using that to shape
                  the first release.
                </p>
              </div>

              <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-8">
                <a
                  href="#waitlist"
                  className="group inline-flex items-center gap-2 border border-white/20 px-5 py-3 font-mono text-[10px] uppercase tracking-normal text-white transition-all hover:bg-white hover:text-black hover:no-underline"
                >
                  Join waitlist
                  <ArrowRight className="size-3.5 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
                </a>
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-normal text-white/65 transition-colors hover:text-white hover:no-underline"
                >
                  Docs
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </PixelCard>
        </section>
      </main>

      <CloudFooterSection />
    </div>
  );
}

function DashboardStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-black/10 px-3 py-3 dark:border-white/10">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-black dark:text-white">
        {value}
      </p>
    </div>
  );
}

function CloudAccessCard({
  title,
  icon: Icon,
  backgroundIcon: BackgroundIcon,
  description,
  label,
  chips,
}: {
  title: string;
  icon: LucideIcon;
  backgroundIcon?: LucideIcon;
  description: string;
  label: string;
  chips: readonly string[];
}) {
  return (
    <div className="relative flex h-full flex-col justify-between gap-6 bg-white px-5 pb-5 pt-6 shadow-xs dark:bg-black">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-2 top-1 h-28 w-28 rounded-full bg-black/[0.012] blur-3xl dark:bg-white/[0.018] sm:h-32 sm:w-32" />
        <div className="absolute inset-0 bg-[radial-gradient(44%_46%_at_84%_18%,rgba(0,0,0,0.02),transparent_72%)] dark:bg-[radial-gradient(44%_46%_at_84%_18%,rgba(255,255,255,0.03),transparent_72%)]" />
        {BackgroundIcon ? (
          <div className="absolute -right-2 -top-2 z-0 flex items-start justify-end sm:-right-12 sm:-top-12">
            <BackgroundIcon className="size-36 stroke-1 text-black/[0.03] dark:text-white/[0.025] sm:size-52" />
          </div>
        ) : null}
        <div className="absolute inset-0 hidden bg-[radial-gradient(50%_80%_at_25%_0%,rgba(255,255,255,0.08),transparent)] dark:block" />
      </div>
      <div className="absolute -inset-y-4 -left-px z-20 w-px bg-black/10 dark:bg-white/10" />
      <div className="absolute -inset-y-4 -right-px z-20 w-px bg-black/10 dark:bg-white/10" />
      <div className="absolute -inset-x-4 -top-px z-20 h-px bg-black/10 dark:bg-white/10" />
      <div className="absolute -bottom-px -left-4 -right-4 z-20 h-px bg-black/10 dark:bg-white/10" />
      <span className="absolute -left-px -top-px z-20 block size-2 border-l-2 border-t-2 border-black dark:border-white" />

      <div className="relative z-10 space-y-5">
        <div className="flex w-fit items-center justify-center rounded-none border border-black/10 bg-black/[0.03] p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <Icon className="size-5 stroke-[1.5] text-black dark:text-white" />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/45 dark:text-white/45">
            # {label}
          </p>
          <h3 className="text-xl font-semibold tracking-tight text-black dark:text-white">
            {title}
          </h3>
          <p className="text-sm leading-relaxed text-black/55 dark:text-white/45">
            {description}
          </p>
        </div>
      </div>
      <hr className="bg-black/10 dark:bg-white/10 mt-4 -mx-5"/>
      <div className="relative z-10 flex flex-wrap gap-2 ">
        {chips.map((chip) => (
          <span
            key={chip}
            className="inline-flex border border-black/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-black/50 dark:border-white/10 dark:text-white/45"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function CloudFooterSection() {
  return (
    <footer className="relative z-10">
      <div className="absolute bottom-10 left-0 h-px w-full bg-black/[8%] dark:bg-white/[8%]" />
      <div className="absolute bottom-24 left-0 h-px w-full bg-black/[8%] dark:bg-white/[8%]" />
      <div className="mx-auto max-w-[92%] py-12 sm:max-w-[90%]">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="w-full">
            <span className="font-mono text-xs uppercase tracking-tighter text-black/40 dark:text-white/40">
              <Link
                href="https://github.com/farming-labs/docs"
                target="_blank"
                className="font-mono lowercase text-black/30 transition-colors hover:text-black/50 hover:underline hover:underline-offset-2 hover:decoration-dotted hover:decoration-black/30 hover:no-underline dark:text-white/30 dark:hover:text-white/50 dark:hover:decoration-white/30"
              >
                @farming-labs/docs
              </Link>
            </span>
            <p className="mt-1 font-mono text-[10px] uppercase text-black/30 dark:text-white/30">
              Built by{" "}
              <Link
                href="https://farming-labs.dev"
                target="_blank"
                className="font-mono uppercase text-black/30 underline decoration-black/30 decoration-dotted underline-offset-2 transition-colors hover:text-black/50 hover:no-underline dark:text-white/30 dark:decoration-white/30 dark:hover:text-white/50"
              >
               Farming-Labs 
              </Link>
            </p>
          </div>

          <div className="flex w-full max-w-full items-center justify-end gap-6">
            <Link
              href="/docs"
              className="font-mono text-xs uppercase text-black/30 transition-colors hover:text-black/60 hover:no-underline dark:text-white/30 dark:hover:text-white/60"
            >
              Documentation
            </Link>
            <Link
              href="https://github.com/farming-labs/docs"
              target="_blank"
              className="font-mono text-xs uppercase text-black/30 transition-colors hover:text-black/60 hover:no-underline dark:text-white/30 dark:hover:text-white/60"
            >
              GitHub
            </Link>
            <Link
              href="https://www.npmjs.com/package/@farming-labs/docs"
              target="_blank"
              className="font-mono text-xs uppercase text-black/30 transition-colors hover:text-black/60 hover:no-underline dark:text-white/30 dark:hover:text-white/60"
            >
              npm
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
