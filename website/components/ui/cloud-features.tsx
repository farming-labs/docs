import { ReactNode } from "react";
import { FilePenLine, Globe, LucideIcon, Search, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CloudEditorDemo, CloudSearchDemo } from "@/components/ui/cloud-feature-demos";
import {
  CloudDeployIllustration,
  CloudSyncIllustration,
} from "@/components/ui/cloud-feature-illustrations";
import { cn } from "@/lib/utils";

const surfaces = [
  {
    icon: FilePenLine,
    title: "Git-backed editing",
    description: "Draft in the dashboard. Publish through GitHub.",
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
          Feature surface
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-black dark:text-white sm:text-4xl">
          The dashboard should feel like part of the runtime, not an extra tool beside it.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-black/55 dark:text-white/45 sm:text-base">
          These are the first cloud surfaces we want teams to actually use: edit, retrieve, review,
          and ship.
        </p>
      </div>

      <div className="mx-auto grid gap-4 lg:grid-cols-2">
        <FeatureCard>
          <CardHeader className="pb-2">
            <CardHeading
              icon={FilePenLine}
              title="Git-backed editing"
              description="Draft docs, keep frontmatter clean, and open pull requests from the same place."
            />
          </CardHeader>

          <div className="relative mb-6 border-t border-dashed border-black/10 sm:mb-0 dark:border-white/10">
            <div className="absolute inset-0 bg-[radial-gradient(125%_125%_at_50%_0%,transparent_40%,rgba(0,0,0,0.03),white_125%)] dark:bg-[radial-gradient(125%_125%_at_50%_0%,transparent_40%,rgba(255,255,255,0.03),rgba(0,0,0,0.92)_125%)]" />
            <div className="aspect-[76/59] p-4 sm:px-6">
              <CloudEditorDemo />
            </div>
          </div>
        </FeatureCard>

        <FeatureCard>
          <CardHeader className="pb-2">
            <CardHeading
              icon={Search}
              title="Managed search + AI"
              description="Run search, snippets, and cited retrieval from the same docs graph."
            />
          </CardHeader>

          <CardContent>
            <div className="relative mb-6 sm:mb-0">
              <div className="absolute -inset-6 bg-[radial-gradient(50%_50%_at_75%_50%,transparent,rgba(255,255,255,1)_100%)] dark:bg-[radial-gradient(50%_50%_at_75%_50%,transparent,rgba(0,0,0,1)_100%)]" />
              <div className="relative aspect-[76/59] overflow-hidden border border-black/10 bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:border-white/10 dark:bg-black/70 dark:shadow-none">
                <CloudSearchDemo />
              </div>
            </div>
          </CardContent>
        </FeatureCard>

        <FeatureCard className="p-6 lg:col-span-2">
          <p className="mx-auto my-4 max-w-2xl text-balance text-center text-2xl font-semibold text-black dark:text-white">
            One loop for syncing content, improving retrieval, reviewing edits, and shipping docs
            changes with confidence.
          </p>

          <div className="grid gap-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    <Globe className="size-3.5" />
                    one-shot deploy
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    *.docs.app
                  </span>
                </div>

                <div className="relative flex min-h-[220px] items-center overflow-visible px-4 py-4">
                  <CloudDeployIllustration className="relative z-10 mx-auto max-w-[430px] opacity-90 dark:opacity-75" />
                </div>

                <div className="border-t border-black/10 px-4 py-4 dark:border-white/10">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/55 dark:text-white/50">
                    pnpm dlx @farming-labs/docs deploy
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-black/60 dark:text-white/50">
                    Provision a live docs URL, ingest the repo knowledge graph, and keep pushes
                    flowing back through GitHub.
                  </p>
                </div>
              </div>

              <div className="border border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    <Search className="size-3.5" />
                    knowledge sync
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/45 dark:text-white/45">
                    repo ingest
                  </span>
                </div>

                <div className="flex min-h-[220px] items-center px-4 py-4">
                  <CloudSyncIllustration className="mx-auto max-w-[360px] opacity-85 dark:opacity-70" />
                </div>

                <div className="border-t border-black/10 px-4 py-4 dark:border-white/10">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/55 dark:text-white/50">
                    continuous docs sync
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-black/60 dark:text-white/50">
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
    <div className="p-6">
      <span className="text-muted-foreground flex items-center gap-2 text-black/55 dark:text-white/50">
        <Icon className="size-4" />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em]">{title}</span>
      </span>
      <p className="mt-6 text-2xl font-semibold text-black dark:text-white">{description}</p>
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
