import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  FilePenLine,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import CloudWaitlistForm from "@/components/ui/cloud-waitlist-form";
import PixelCard from "@/components/ui/pixel-card";
import Shuffle from "@/components/ui/shuffle";

export const metadata: Metadata = {
  title: "Cloud",
  description:
    "Managed docs infrastructure for teams shipping with @farming-labs/docs. Git-backed CMS, AI search, MCP, analytics, and workflows.",
};

const heroSignals = [
  "GitHub-backed CMS",
  "Draft + PR workflows",
  "Managed search sync",
  "Answer-first AI",
  "Feedback analytics",
  "MCP-ready delivery",
  "Private docs controls",
  "Release workflows",
] as const;

const platformPillars = [
  {
    eyebrow: "Git-backed editing",
    title: "Edit MDX in a dashboard without giving up Git as the source of truth.",
    description:
      "Edit in the browser, keep review workflows, and publish back to GitHub when you're ready.",
    icon: FilePenLine,
    items: [
      "Browser-based MDX editor with frontmatter and nav controls",
      "Draft branches, PR creation, and direct commit flows",
      "Preview-safe publishing instead of one-off custom scripts",
      "Content snapshots for conflict-aware editing and review",
    ],
  },
  {
    eyebrow: "Search and AI",
    title: "Give teams a stronger search layer than plain lexical matching.",
    description:
      "Managed indexing and answer-first retrieval make docs better for both people and AI tools.",
    icon: Search,
    items: [
      "Managed Typesense or Algolia sync from your docs project",
      "Answer-first search with citations and section-level retrieval",
      "Query analytics, zero-result tracking, and docs gap detection",
      "Quality controls for snippets, result ranking, and section anchors",
    ],
  },
  {
    eyebrow: "Agents and APIs",
    title: "Treat your docs as a structured knowledge surface for tools, not just pages.",
    description: "Run the agent-facing layer so assistants and internal tools get clean context.",
    icon: Bot,
    items: [
      "Managed MCP endpoints and project-scoped tool access",
      "Agent-ready docs delivery for llms.txt, llms-full, and API reference",
      "Search providers and AI providers configured from a control plane",
      "Action-aware responses that can open pages, copy snippets, and route workflows",
    ],
  },
  {
    eyebrow: "Ops and governance",
    title: "Run docs like product infrastructure, not a side folder everyone hopes is current.",
    description:
      "Handle the operational layer around docs health, collaboration, and release confidence.",
    icon: ShieldCheck,
    items: [
      "Feedback inboxes, page health, and release-level docs signals",
      "Private docs controls, team roles, and publish approvals",
      "Versioned releases, migrations, and rollout-aware content workflows",
      "Change tracking across search, content, AI usage, and publishing",
    ],
  },
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
    body: "Edit, search, analyze, and manage providers from one place.",
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
    items: ["MDX editing", "Frontmatter forms", "Sidebar ordering", "Review queues"],
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

      <header className="relative z-10 px-6 py-0">
        <div className="mx-auto flex max-w-[90%] items-center justify-between">
          <div className="flex items-center gap-2 pb-8 pt-5 text-xs uppercase font-medium text-black/65 dark:text-white/80 md:pb-0">
            <Link
              href="/"
              className="font-mono text-black/45 transition-colors hover:text-black hover:no-underline dark:text-white/45 dark:hover:text-white"
            >
              Home <span className="ml-2 text-black/25 dark:text-white/25">/</span>
            </Link>
            <Sparkles className="size-3.5" strokeWidth={1.8} />
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

      <main className="relative z-10 mx-auto max-w-[90%] space-y-20 pb-24 pt-6 md:space-y-24 md:px-0 md:pt-14">
        <section className="relative grid gap-10 pb-10 lg:grid-cols-[minmax(0,5.5fr)_minmax(360px,3fr)] lg:items-stretch lg:gap-0 lg:pb-0">
          <div className="pointer-events-none absolute bottom-0 left-[calc(50%-50vw)] right-[calc(50%-50vw)] h-px bg-black/10 dark:bg-white/10" />
          <div className="relative min-w-0 overflow-hidden lg:flex">
            <div className="pointer-events-none absolute -top-6 bottom-0 left-0 z-20 w-px bg-black/10 dark:bg-white/5 md:-top-24" />
            <div
              className="absolute inset-0 hidden overflow-hidden opacity-45 sm:block"
              aria-hidden
            >
              <AnimatedBackground />
            </div>

            <div className="relative z-10 flex max-w-3xl flex-col lg:min-h-full lg:justify-end">
              <Shuffle
                text="infrastructure for teams shipping docs like product."
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
                className="block max-w-4xl font-semibold tracking-[-0.06em] text-black dark:text-white sm:text-5xl lg:text-6xl"
              />

              <p className="mt-6 max-w-2xl text-base leading-relaxed text-black/55 dark:text-white/45 sm:text-lg">
                Keep the open runtime. Add the layer for editing, search, analytics, AI, and docs
                operations.
              </p>

              <div className="mt-7 flex flex-wrap gap-2">
                {heroSignals.map((signal) => (
                  <span
                    key={signal}
                    className="inline-flex items-center border border-black/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-black/45 dark:border-white/10 dark:text-white/45"
                  >
                    {signal}
                  </span>
                ))}
              </div>

              <div className="-mb-px mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                <a
                  href="/docs"
                  className="group inline-flex items-center gap-2 border border-black bg-black px-5 py-3 font-mono text-[11px] uppercase tracking-[0.24em] text-white transition-all hover:bg-black/90 hover:no-underline dark:border-white dark:bg-white dark:text-black dark:hover:bg-white/90"
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
                <div className="relative border-l-0 z-20 h-10 w-full bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.45),rgba(0,0,0,0.45)_1px,transparent_1px,transparent_6px)] opacity-[0.08] dark:bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.7),rgba(255,255,255,0.7)_1px,transparent_1px,transparent_6px)] dark:opacity-[0.1]" />
                <hr className="h-px w-full border-black/5 dark:border-white/5" />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <SectionHeading
            eyebrow="Feature surface"
            title="Everything we want cloud to carry for teams using the open runtime."
            body="Take the operational burden out of the parts teams keep wiring themselves."
          />

          <div className="grid gap-5 lg:grid-cols-2">
            {platformPillars.map((pillar) => (
              <FeatureCard key={pillar.title} {...pillar} />
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] lg:gap-10">
          <div className="space-y-6">
            <SectionHeading
              eyebrow="How it works"
              title="A cloud layer around the runtime, not a rewrite of how your docs ship."
              body="Keep the repo and deploy model you already trust. Add the layer around it."
            />

            <div className="space-y-4">
              {workflowSteps.map((item) => (
                <div
                  key={item.step}
                  className="grid gap-4 border-t border-black/10 pt-4 dark:border-white/10 sm:grid-cols-[52px_minmax(0,1fr)]"
                >
                  <div className="font-mono text-xs uppercase tracking-[0.26em] text-black/35 dark:text-white/35">
                    {item.step}
                  </div>
                  <div>
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
          </div>

          <PixelCard className="border-black/10 bg-white/95 dark:border-white/10 dark:bg-black/35">
            <div className="flex items-center justify-between border-b border-black/10 pb-4 dark:border-white/10">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
                  Dashboard surface
                </p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-black dark:text-white">
                  One place to operate docs.
                </h3>
              </div>
              <Workflow className="size-5 text-black/40 dark:text-white/40" strokeWidth={1.8} />
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
                  className="flex items-center justify-between border border-black/10 px-3 py-3 dark:border-white/10"
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
                    First release surface
                  </p>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-black/55 dark:text-white/45">
                    The dashboard should feel operational, not abstract. These are the four product
                    surfaces we expect teams to touch first.
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
                        {column.label}
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

        <section>
          <PixelCard className="border-black/10 bg-black px-6 py-8 text-white hover:bg-black dark:border-white/10 dark:bg-black dark:text-white dark:hover:bg-black sm:px-8">
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

              <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
                <a
                  href="#waitlist"
                  className="group inline-flex items-center gap-2 border border-white/20 px-5 py-3 font-mono text-[10px] uppercase tracking-normal text-white transition-all hover:bg-white hover:text-black hover:no-underline"
                >
                  Join waitlist
                  <ArrowRight className="size-3.5 -rotate-45 transition-transform duration-300 group-hover:rotate-0" />
                </a>
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-white/65 transition-colors hover:text-white hover:no-underline"
                >
                  Docs
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </PixelCard>
        </section>
      </main>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-black dark:text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-black/55 dark:text-white/45 sm:text-base">
        {body}
      </p>
    </div>
  );
}

function FeatureCard({
  eyebrow,
  title,
  description,
  items,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: readonly string[];
  icon: LucideIcon;
}) {
  return (
    <PixelCard className="border-black/10 bg-white/95 dark:border-white/10 dark:bg-black/35">
      <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4 dark:border-white/10">
        <div className="max-w-xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
            {eyebrow}
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-black dark:text-white">
            {title}
          </h3>
        </div>
        <Icon className="mt-1 size-5 shrink-0 text-black/35 dark:text-white/35" strokeWidth={1.8} />
      </div>

      <p className="mt-5 text-sm leading-relaxed text-black/55 dark:text-white/45">{description}</p>

      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="border-t border-black/10 pt-3 text-sm leading-relaxed text-black/65 dark:border-white/10 dark:text-white/55"
          >
            {item}
          </li>
        ))}
      </ul>
    </PixelCard>
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
