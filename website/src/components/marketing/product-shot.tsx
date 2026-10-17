import Image from "@farm.js/core/image";
import type { CSSProperties } from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Callout = {
  label: string;
  /** Box position and size as percentages of the screenshot. */
  box: { left: number; top: number; width: number; height: number };
  tag: "above" | "below";
  delay: number;
};

/* Regions of /public/marketing/docs-*.jpg (1240×775 capture of /docs). */
const callouts: readonly Callout[] = [
  {
    label: "⌘K search",
    box: { left: 0.8, top: 8.4, width: 24, height: 4.4 },
    tag: "below",
    delay: 600,
  },
  {
    label: "MDX → page",
    box: { left: 28, top: 3, width: 29, height: 6.2 },
    tag: "below",
    delay: 900,
  },
  {
    label: "Copy page · Open in LLM",
    box: { left: 79.4, top: 19.6, width: 18.4, height: 5.2 },
    tag: "below",
    delay: 1200,
  },
];

function SelectionCallout({ callout }: { callout: Callout }) {
  const { box } = callout;
  return (
    <div
      aria-hidden
      className="mk-callout pointer-events-none absolute hidden md:block"
      style={
        {
          left: `${box.left}%`,
          top: `${box.top}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
          "--mk-callout-delay": `${callout.delay}ms`,
        } as CSSProperties
      }
    >
      <span className="absolute inset-0 rounded-[3px] border border-dashed border-mk-fg/60 bg-mk-fg/[0.03]" />
      {(
        [
          "-left-[3.5px] -top-[3.5px]",
          "-right-[3.5px] -top-[3.5px]",
          "-bottom-[3.5px] -left-[3.5px]",
          "-bottom-[3.5px] -right-[3.5px]",
        ] as const
      ).map((position) => (
        <span
          key={position}
          className={cn("absolute size-[7px] border border-mk-fg/70 bg-mk-bg", position)}
        />
      ))}
      <span
        className={cn(
          "absolute right-0 whitespace-nowrap rounded-[4px] bg-mk-fg px-2.5 py-1 font-mono text-[10.5px] text-mk-bg shadow-lg shadow-black/20",
          callout.tag === "below" ? "top-[calc(100%+8px)]" : "bottom-[calc(100%+8px)]",
        )}
      >
        {callout.label}
      </span>
    </div>
  );
}

/** A browser window showing the real docs UI, with design-tool selections naming its parts. */
export function ProductShot({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative max-h-[640px] overflow-hidden rounded-lg border border-mk-fg/15 bg-mk-bg shadow-[0_40px_120px_-20px_rgb(0_0_0/0.25)] dark:shadow-[0_40px_120px_-20px_rgb(0_0_0/0.9)]",
        className,
      )}
    >
      <div className="flex h-10 items-center gap-3 border-b border-mk-line bg-mk-fg/[0.03] px-4">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-mk-fg/20" />
          <span className="size-2.5 rounded-full bg-mk-fg/14" />
          <span className="size-2.5 rounded-full bg-mk-fg/10" />
        </span>
        <span className="mx-auto flex h-6 w-full max-w-sm items-center justify-center gap-1.5 rounded bg-mk-fg/[0.05] px-3 font-mono text-[11px] text-mk-fg/50">
          <Lock aria-hidden className="size-2.5" strokeWidth={2} />
          docs.farming-labs.dev/docs
        </span>
        <span aria-hidden className="w-[42px]" />
      </div>
      <div className="relative aspect-[1240/775]">
        <Image
          alt="The @farming-labs/docs documentation site: sidebar navigation, search, page actions, and MDX content"
          className="object-cover object-top dark:hidden"
          fill
          preload
          sizes="(min-width: 1320px) 1100px, 92vw"
          src="/marketing/docs-light.jpg"
        />
        <Image
          alt=""
          aria-hidden
          className="hidden object-cover object-top dark:block"
          fill
          preload
          sizes="(min-width: 1320px) 1100px, 92vw"
          src="/marketing/docs-dark.jpg"
        />
        {callouts.map((callout) => (
          <SelectionCallout key={callout.label} callout={callout} />
        ))}
      </div>
    </div>
  );
}
