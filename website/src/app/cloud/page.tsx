import type { Metadata } from "@farm.js/core";
import {
  BadgeCheck,
  Building2,
  Cloud,
  Github,
  Headset,
  Layers3,
  Rocket,
  ServerCog,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CloudEditorDemo, CloudSearchDemo } from "@/components/ui/cloud-feature-demos";
import { CloudTerminalDemo } from "@/components/ui/cloud-terminal-demo";
import CloudWaitlistForm from "@/components/ui/cloud-waitlist-form";
import { EnterpriseSupportForm } from "@/components/ui/enterprise-support-form";
import { AnimatedBackground } from "@/components/ui/animated-bg-black";
import { CopyLine } from "@/components/marketing/copy-line";
import { DecodeWord } from "@/components/marketing/decode-word";
import { FlickeringGrid } from "@/components/marketing/flickering-grid";
import {
  CloudDeployFigure,
  CloudDocsFlowFigure,
  CloudSyncFigure,
} from "@/components/marketing/iso/cloud-figures";
import {
  Cell,
  CellGrid,
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

export const metadata: Metadata = {
  title: "Cloud",
  description:
    "Managed docs infrastructure for teams shipping with @farming-labs/docs. Git-backed editing, AI drafts, managed search, analytics, and one-command deploys.",
};

const heroWords = ["docs.", "guides.", "changelogs.", "API refs."] as const;

const stripItems = [
  { label: "Editing", href: "#editing" },
  { label: "Search + AI", href: "#search" },
  { label: "Review flow", href: "#review" },
  { label: "Repo sync", href: "#sync" },
  { label: "Plans", href: "#plans" },
  { label: "Enterprise", href: "#enterprise-support" },
] as const;

const dashboardStats = [
  { label: "Indexed sections", value: "12.4k" },
  { label: "Search misses", value: "16" },
  { label: "Open drafts", value: "08" },
  { label: "Healthy pages", value: "91%" },
] as const;

const dashboardRows = [
  { title: "GitHub sync", meta: "main · docs branch", status: "Healthy" },
  { title: "Search provider", meta: "Algolia hybrid", status: "Indexed" },
  { title: "Agent delivery", meta: "MCP + llms.txt", status: "Online" },
] as const;

const plans: ReadonlyArray<{
  icon: LucideIcon;
  label: string;
  title: string;
  body: string;
  items: readonly string[];
}> = [
  {
    icon: Github,
    label: "Open source",
    title: "Self-host",
    body: "The full runtime, free and open.",
    items: ["Themes", "Ask AI hooks", "MCP", "Search adapters", "API docs", "llms.txt"],
  },
  {
    icon: Cloud,
    label: "Managed",
    title: "Cloud",
    body: "Managed ops at a small-team price.",
    items: ["*.docs.app", "RAG pipelines", "Knowledge workers", "Custom branding", "Analytics"],
  },
  {
    icon: Building2,
    label: "Partner",
    title: "Enterprise",
    body: "The whole stack, with a team behind it.",
    items: ["Migration help", "Private docs", "Custom theme", "Dedicated support"],
  },
];

const supportItems = [
  { icon: ServerCog, title: "Infrastructure", body: "Setup, routing, private docs, blockers." },
  { icon: Sparkles, title: "Brand systems", body: "Custom themes and launch polish." },
  { icon: ShieldCheck, title: "Agent readiness", body: "MCP, llms.txt, and search tuning." },
] as const;

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
        <div className="mb-7 text-mk-fg/50">
          <IndexedLabel icon={Cloud} index="00" label="Docs cloud · Private preview" />
        </div>
        <h1
          aria-label="You ship the code. We write the docs."
          className="text-[clamp(2rem,4.8vw,3.5rem)] font-medium leading-[1.08] tracking-[-0.045em] text-mk-fg"
        >
          <span className="block">You ship the code.</span>
          <span className="mt-1 block sm:whitespace-nowrap">
            We write the <DecodeWord words={heroWords} />
          </span>
        </h1>
        <p className="mt-6 max-w-[34rem] text-pretty text-[16px] leading-7 text-mk-fg/55 sm:text-[17px]">
          A managed layer around the open runtime.{" "}
          <strong className="font-medium text-mk-fg">GitHub stays canonical.</strong>
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="#waitlist">Join the waitlist</ButtonLink>
          <ButtonLink href="#enterprise-support" variant="secondary">
            Enterprise support
          </ButtonLink>
        </div>
        <CopyLine
          className="mt-6 w-full max-w-[30rem] text-left"
          command="pnpm dlx @farming-labs/docs deploy"
        />
      </div>

      <div className="relative z-10 mx-auto mt-16 max-w-[1000px] px-4 sm:mt-20 sm:px-10">
        <div className="relative">
          <span aria-hidden className="mk-cross -left-[7px] -top-[7px] hidden sm:block" />
          <span aria-hidden className="mk-cross -right-[7px] -top-[7px] hidden sm:block" />
          <div className="overflow-hidden border border-b-0 border-mk-fg/15 bg-mk-bg shadow-[0_40px_120px_-20px_rgb(0_0_0/0.25)] dark:shadow-[0_40px_120px_-20px_rgb(0_0_0/0.9)]">
            <div className="flex h-10 items-center justify-between border-b border-mk-line bg-mk-fg/[0.03] px-4 font-mono text-[11px] text-mk-fg/45">
              <span className="flex items-center gap-3">
                <span aria-hidden className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-mk-fg/20" />
                  <span className="size-2.5 rounded-full bg-mk-fg/14" />
                  <span className="size-2.5 rounded-full bg-mk-fg/10" />
                </span>
                cloud · acme/docs
              </span>
              <span className="flex items-center gap-1.5 uppercase">
                <Rocket aria-hidden className="size-3" strokeWidth={1.6} /> deploy
              </span>
            </div>
            <div className="mk-dots px-6 pb-14 pt-10 sm:px-14">
              <CloudDeployFigure className="mx-auto max-w-[720px]" />
            </div>
          </div>
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-mk-bg to-transparent"
      />
    </Section>
  );
}

function UsedBy() {
  return (
    <Section>
      <p className="px-6 py-7 text-center font-mono text-[11px] uppercase tracking-normal text-mk-fg/45">
        Built on the runtime these teams already use
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
          id="editing"
          index="01"
          label="Editing"
          muted="AI drafts, clean frontmatter, real PRs."
          title="Git-backed editing"
        >
          <Tray className="flex h-auto flex-col lg:aspect-[76/59]" dots={false}>
            <CloudEditorDemo />
          </Tray>
        </Cell>
        <Cell
          id="search"
          index="02"
          label="Search + AI"
          muted="Search and cited answers from one graph."
          title="Managed search and AI"
        >
          <Tray className="flex h-auto flex-col lg:aspect-[76/59]" dots={false}>
            <CloudSearchDemo />
          </Tray>
        </Cell>
        <Cell
          id="review"
          index="03"
          label="Review flow"
          muted="Every change lands as a pull request."
          title="Draft, review, ship"
        >
          <Tray className="flex h-full flex-col gap-4">
            <CloudDocsFlowFigure className="mx-auto w-full max-w-[520px] pt-2" />
            <CopyLine className="mt-auto" command="pnpm exec docs cloud preview" />
          </Tray>
        </Cell>
        <Cell
          id="sync"
          index="04"
          label="Repo sync"
          muted="Content, search, and AI stay current."
          title="Repo sync"
        >
          <Tray className="flex h-full flex-col gap-4">
            <CloudSyncFigure className="mx-auto w-full max-w-[520px] pt-2" />
            <CopyLine className="mt-auto" command="pnpm exec docs cloud sync" />
          </Tray>
        </Cell>
      </CellGrid>
    </Section>
  );
}

function UnderTheHood() {
  return (
    <Section>
      <div className="px-6 py-14 sm:px-10 lg:py-16">
        <SectionHeader
          icon={Layers3}
          index="05"
          label="Under the hood"
          title="Keep your runtime. Add the cloud around it."
        />
      </div>
      <div className="border-t border-mk-line">
        <CellGrid>
          <div className="min-w-0 p-6 sm:p-10">
            <div className="mb-6 text-mk-fg/50">
              <IndexedLabel index="05.1" label="Managed flow" />
            </div>
            <CloudTerminalDemo />
          </div>
          <div className="min-w-0 p-6 sm:p-10">
            <div className="mb-6 flex items-center justify-between text-mk-fg/50">
              <IndexedLabel index="05.2" label="Dashboard" />
              <span className="font-mono text-[11px] text-mk-fg/35">Preview data</span>
            </div>
            <div className="border border-mk-line">
              <div className="grid grid-cols-2">
                {dashboardStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="border-mk-line p-4 [&:nth-child(-n+2)]:border-b [&:nth-child(odd)]:border-r"
                  >
                    <p className="text-[12px] text-mk-fg/45">{stat.label}</p>
                    <p className="mt-1 text-[24px] font-medium tabular-nums tracking-[-0.03em] text-mk-fg">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>
              {dashboardRows.map((row) => (
                <div
                  key={row.title}
                  className="flex items-center justify-between gap-4 border-t border-mk-line px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] text-mk-fg">{row.title}</p>
                    <p className="text-[12.5px] text-mk-fg/45">{row.meta}</p>
                  </div>
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-mk-fg/60">
                    <span aria-hidden className="size-1.5 rounded-full bg-mk-ok" />
                    {row.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CellGrid>
      </div>
    </Section>
  );
}

function Plans() {
  return (
    <Section id="plans">
      <div className="px-6 py-14 sm:px-10 lg:py-16">
        <SectionHeader
          icon={Building2}
          index="06"
          label="Every size"
          title="Self-host first. Add cloud when it saves time."
        />
      </div>
      <ul className="grid border-t border-mk-line md:grid-cols-3">
        {plans.map((plan) => {
          const Icon = plan.icon;
          return (
            <li
              key={plan.title}
              className="flex flex-col gap-6 border-mk-line p-6 max-md:[&:nth-child(n+2)]:border-t sm:p-8 md:[&:not(:last-child)]:border-r"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-9 place-items-center border border-mk-line">
                  <Icon aria-hidden className="size-4" strokeWidth={1.5} />
                </span>
                <span className="font-mono text-[11px] uppercase text-mk-fg/40">{plan.label}</span>
              </div>
              <div>
                <p className="text-[18px] font-medium tracking-[-0.02em] text-mk-fg">
                  {plan.title}
                </p>
                <p className="mt-1 text-[14px] text-mk-fg/50">{plan.body}</p>
              </div>
              <ul className="mt-auto flex flex-wrap gap-1.5">
                {plan.items.map((item) => (
                  <li
                    key={item}
                    className="border border-mk-line px-2 py-1 font-mono text-[11px] text-mk-fg/55"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function Waitlist() {
  return (
    <Section id="waitlist">
      <CellGrid>
        <div className="p-6 sm:p-10">
          <div className="flex flex-col gap-8 lg:sticky lg:top-24">
            <SectionHeader
              body="Tell us what should ship first. We use it to shape the first release."
              icon={Rocket}
              index="07"
              label="Waitlist"
              title="Get first access."
            />
            <ul className="grid gap-2 text-[14px] text-mk-fg/60">
              {[
                "GitHub-backed editing",
                "Managed search and Ask AI",
                "One-command deploys",
                "Private docs",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <BadgeCheck aria-hidden className="size-4 text-mk-fg/50" strokeWidth={1.6} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="min-w-0 p-6 sm:p-10">
          <CloudWaitlistForm bare />
        </div>
      </CellGrid>
    </Section>
  );
}

function Enterprise() {
  return (
    <Section id="enterprise-support">
      <CellGrid>
        <div className="p-6 sm:p-10">
          <div className="flex flex-col gap-10 lg:sticky lg:top-24">
            <SectionHeader
              body="Infrastructure, migrations, custom branding, and private docs."
              icon={Headset}
              index="08"
              label="Enterprise support"
              title="Bring us the blocker."
            />
            <ul className="grid divide-y divide-mk-line border-y border-mk-line">
              {supportItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title} className="flex items-start gap-4 py-4">
                    <span className="grid size-8 shrink-0 place-items-center border border-mk-line">
                      <Icon aria-hidden className="size-4" strokeWidth={1.5} />
                    </span>
                    <span>
                      <span className="block text-[15px] font-medium text-mk-fg">{item.title}</span>
                      <span className="block text-[14px] text-mk-fg/50">{item.body}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
        <div className="min-w-0 p-6 sm:p-10">
          <EnterpriseSupportForm bare />
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
        className="mk-hero-flicker pointer-events-none absolute inset-x-0 bottom-0 h-64 text-mk-fg"
      >
        <FlickeringGrid className="absolute inset-0" maxOpacity={0.2} />
      </div>
      <div className="relative z-10 px-6 py-20 text-center sm:px-10 sm:py-24">
        <div className="mb-5 flex justify-center text-mk-fg/45">
          <IndexedLabel index="09" label="Get early access" />
        </div>
        <h2 className="mx-auto max-w-2xl text-balance text-[clamp(1.6rem,3vw,2.3rem)] font-medium leading-[1.15] tracking-[-0.035em] text-mk-fg">
          Keep shipping code. <span className="text-mk-fg/40">Let the docs keep up.</span>
        </h2>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="#waitlist">Join the waitlist</ButtonLink>
          <ButtonLink href="/docs" variant="secondary">
            Read the docs
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}

export default async function CloudPage() {
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
            <UnderTheHood />
            <Plans />
            <Waitlist />
            <Enterprise />
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
