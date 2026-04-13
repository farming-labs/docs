import { ReactNode } from "react";
import { CloudSyncIcon, FilePenLine, GitBranch, Globe, LucideIcon, Search, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CloudEditorDemo, CloudSearchDemo } from "@/components/ui/cloud-feature-demos";
import {
  CloudDeployIllustration,
  CloudSyncIllustration,
} from "@/components/ui/cloud-feature-illustrations";
import CopyCommand from "@/components/ui/copy-command";
import { cn } from "@/lib/utils";

const surfaces = [
  {
    icon: FilePenLine,
    title: "Git-backed editing",
    description: "Draft with AI in the dashboard. Publish through GitHub.",
  },
  {
    icon: Search,
    title: "Search and AI",
    description: "Sync sections, rank better results, answer with citations.",
  },
  {
    icon: ShieldCheck,
    title: "Ops loop",
    description: "Track feedback, review changes, and ship clean releases.",
  },
] as const;

export function CloudFeatures() {
  return (
    <section className="space-y-5">
      <div className="max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
          What cloud adds
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-black dark:text-white sm:text-4xl">
          Cloud should feel built into the docs runtime.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-black/55 dark:text-white/45 sm:text-base">
          These are the first cloud surfaces teams should actually use: edit, retrieve, review, and
          ship.
        </p>
      </div>

      <div className="mx-auto grid gap-4 lg:grid-cols-2">
        <FeatureCard>
          <CardHeader className="px-4 pb-3 pt-4 sm:p-6 sm:pb-2">
            <CardHeading
              icon={FilePenLine}
              title="Git-backed editing"
              description="Draft docs with AI help, keep frontmatter clean, and open pull requests from the same place."
            />
          </CardHeader>

          <div className="relative mb-6 border-t border-dashed border-black/10 sm:mb-0 dark:border-white/10">
            <div className="absolute inset-0 bg-[radial-gradient(125%_125%_at_50%_0%,transparent_40%,rgba(0,0,0,0.03),white_125%)] dark:bg-[radial-gradient(125%_125%_at_50%_0%,transparent_40%,rgba(255,255,255,0.03),rgba(0,0,0,0.92)_125%)]" />
            <div className="min-h-[21.5rem] p-3 sm:aspect-[76/59] sm:min-h-0 sm:p-4 sm:px-6">
              <CloudEditorDemo />
            </div>
          </div>
        </FeatureCard>

        <FeatureCard>
          <CardHeader className="px-4 pb-3 pt-4 sm:p-6 sm:pb-2">
            <CardHeading
              icon={Search}
              title="Managed search + AI"
              description="Run search, retrieval, and cited answers from the same docs graph."
            />
          </CardHeader>

          <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
            <div className="relative mb-6 sm:mb-0">
              <div className="absolute -inset-6 bg-[radial-gradient(50%_50%_at_75%_50%,transparent,rgba(255,255,255,1)_100%)] dark:bg-[radial-gradient(50%_50%_at_75%_50%,transparent,rgba(0,0,0,1)_100%)]" />
              <div className="relative min-h-[21.5rem] overflow-hidden border border-black/10 bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] sm:aspect-[76/59] sm:min-h-0 sm:p-4 dark:border-white/10 dark:bg-black/70 dark:shadow-none">
                <CloudSearchDemo />
              </div>
            </div>
          </CardContent>
        </FeatureCard>

        <FeatureCard className="p-6 lg:col-span-2">
          <div className="mx-auto my-4 max-w-2xl mb-10 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-black/45 dark:text-white/45">
              Sync • search • review • ship
            </p>
            <p className="mt-3 text-balance text-center text-2xl font-semibold text-black dark:text-white">
              One loop to sync, search, review, and ship docs.
            </p>
          </div>

          <div className="grid gap-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    <Globe className="size-3.5" />
                    instant deploy
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-black/45 dark:text-white/45">
                    *.docs.app
                  </span>
                </div>

                <div className="relative flex min-h-[180px] items-center overflow-visible px-4 py-4 sm:min-h-[220px]">
                  <IllustrationHalo className="scale-110" />
                  <CloudDeployIllustration className="relative z-10 mx-auto max-w-[430px] opacity-90 dark:opacity-75" />
                </div>

                <div className="border-t overflow-x-hidden border-black/10 px-4 py-4 dark:border-white/10">
                  <div
                    aria-hidden
                    className="hidden border-x-0 -mt-2 border-black/5 dark:border-white/5 lg:flex lg:min-h-0 lg:flex-1 lg:items-center"
                  >
                    <div className="-mx-4 -mt-2 w-[calc(100%+32px)]">
                      <div className="relative border-l-0 z-20 h-4 w-full bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.45),rgba(0,0,0,0.45)_1px,transparent_1px,transparent_6px)] opacity-[0.08] dark:bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.7),rgba(255,255,255,0.7)_1px,transparent_1px,transparent_6px)] dark:opacity-[0.1]" />
                    </div>
                  </div>
                  <CopyCommand
                    className="w-[calc(100%+32px)] md:border-b-1 md:border-black/10 border border-x-0 -mx-4 px-2 sm:px-0 hover:bg-transparent"
                    command="pnpm dlx @farming-labs/docs deploy"
                  />
                  <p className="mt-3 py-2 text-sm leading-relaxed text-black/60 dark:text-white/50">
                    Provision a live docs URL, ingest the repo knowledge graph, and keep pushes
                    flowing back through GitHub.
                  </p>
                </div>
              </div>

              <div className="border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    <CloudSyncIcon className="size-3.5" />
                    repo sync
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    <GitBranch className="size-3.5 inline-flex mr-2 justify-center items-center" />
                    repo ingest
                  </span>
                </div>

                <div className="relative flex min-h-[180px] items-center overflow-visible px-4 py-4 sm:min-h-[220px]">
                  <IllustrationHalo />
                  <CloudSyncIllustration className="relative z-10 mx-auto max-w-[360px] opacity-85 dark:opacity-70" />
                </div>

                <div className="border-t overflow-x-hidden border-black/10 px-4 py-4 dark:border-white/10">
                  <div
                    aria-hidden
                    className="hidden border-x-0 -mt-2 border-black/5 dark:border-white/5 lg:flex lg:min-h-0 lg:flex-1 lg:items-center"
                  >
                    <div className="-mx-4 -mt-2 w-[calc(100%+32px)]">
                      <div className="relative border-l-0 z-20 h-4 w-full bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.45),rgba(0,0,0,0.45)_1px,transparent_1px,transparent_6px)] opacity-[0.08] dark:bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.7),rgba(255,255,255,0.7)_1px,transparent_1px,transparent_6px)] dark:opacity-[0.1]" />
                    </div>
                  </div>
                  <CopyCommand
                    className="w-[calc(100%+32px)] md:border-b-1 md:border-black/10 border border-x-0 -mx-4 px-2 sm:px-0 hover:bg-transparent"
                    command="pnpm dlx @farming-labs/docs sync --search"
                  />
                  <p className="mt-3 py-2 text-sm leading-relaxed text-black/60 dark:text-white/50">
                    Pull content, structure, and metadata from GitHub so search, AI, and release
                    workflows stay current.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-center gap-6 overflow-hidden">
                <SurfaceNode
                  label="Sync"
                  circles={[{ pattern: "border" }, { pattern: "primary" }]}
                />
                <SurfaceNode label="Search" circles={[{ pattern: "none" }, { pattern: "blue" }]} />
                <SurfaceNode
                  label="Review"
                  circles={[{ pattern: "primary" }, { pattern: "none" }]}
                />
                <SurfaceNode
                  label="Ship"
                  circles={[{ pattern: "blue" }, { pattern: "border" }]}
                  className="hidden sm:block"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {surfaces.map((surface) => (
                  <div
                    key={surface.title}
                    className="border border-black/10 bg-black/[0.02] px-4 py-4 dark:border-white/10 dark:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                      <surface.icon className="size-3.5" />
                      {surface.title}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-black/60 dark:text-white/50">
                      {surface.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FeatureCard>
      </div>
    </section>
  );
}

interface FeatureCardProps {
  children: ReactNode;
  className?: string;
}

function FeatureCard({ children, className }: FeatureCardProps) {
  return (
    <Card
      className={cn(
        "group relative rounded-none border-black/10 bg-white/95 shadow-zinc-950/5 dark:border-white/10 dark:bg-black/35",
        className,
      )}
    >
      <CardDecorator />
      {children}
    </Card>
  );
}

function CardDecorator() {
  return (
    <>
      <span className="border-primary absolute -left-px -top-px block size-2 border-l-2 border-t-2" />
      <span className="border-primary absolute -right-px -top-px block size-2 border-r-2 border-t-2" />
      <span className="border-primary absolute -bottom-px -left-px block size-2 border-b-2 border-l-2" />
      <span className="border-primary absolute -bottom-px -right-px block size-2 border-b-2 border-r-2" />
    </>
  );
}

function CardHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="p-0">
      <span className="text-muted-foreground flex items-center gap-2 text-black/55 dark:text-white/50">
        <Icon className="size-4" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{title}</span>
      </span>
      <p className="mt-4 text-xl font-semibold text-black sm:mt-6 sm:text-2xl dark:text-white">
        {description}
      </p>
    </div>
  );
}

interface CircleConfig {
  pattern: "none" | "border" | "primary" | "blue";
}

function SurfaceNode({
  label,
  circles,
  className,
}: {
  label: string;
  circles: CircleConfig[];
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="size-fit rounded-2xl bg-gradient-to-b from-black/10 to-transparent p-px dark:from-white/10">
        <div className="relative flex aspect-square w-fit items-center -space-x-4 rounded-[15px] bg-gradient-to-b from-white to-black/[0.03] p-4 dark:from-black dark:to-white/[0.03]">
          {circles.map((circle, index) => (
            <div
              key={index}
              className={cn("size-7 rounded-full border sm:size-8", {
                "border-black/30 dark:border-white/30": circle.pattern === "none",
                "border-black/30 bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.2),rgba(0,0,0,0.2)_1px,transparent_1px,transparent_4px)] dark:border-white/30 dark:bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.24),rgba(255,255,255,0.24)_1px,transparent_1px,transparent_4px)]":
                  circle.pattern === "border",
                "border-black/50 bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.75),rgba(0,0,0,0.75)_1px,transparent_1px,transparent_4px)] dark:border-white/50 dark:bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.8),rgba(255,255,255,0.8)_1px,transparent_1px,transparent_4px)]":
                  circle.pattern === "primary",
                "z-[1] border-blue-500 bg-[repeating-linear-gradient(-45deg,rgb(59,130,246),rgb(59,130,246)_1px,transparent_1px,transparent_4px)]":
                  circle.pattern === "blue",
              })}
            />
          ))}
        </div>
      </div>
      <span className="mt-1.5 block text-center font-mono text-sm uppercase tracking-[0.16em] text-black/45 dark:text-white/40">
        {label}
      </span>
    </div>
  );
}

function IllustrationHalo({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 flex items-center justify-center", className)}
    >
      <div className="relative h-44 w-80 sm:h-52 sm:w-[26rem]">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.7)_0%,rgba(255,255,255,0.2)_34%,rgba(255,255,255,0.05)_55%,transparent_82%)] opacity-28 blur-3xl dark:bg-[radial-gradient(circle,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0.08)_34%,rgba(255,255,255,0.03)_55%,transparent_82%)] dark:opacity-45" />
        <div className="absolute inset-x-[10%] inset-y-[16%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0.08)_40%,transparent_74%)] opacity-32 blur-2xl dark:bg-[radial-gradient(circle,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_40%,transparent_74%)] dark:opacity-40" />
      </div>
    </div>
  );
}
