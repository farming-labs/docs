import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuideCardProps {
  href: string;
  title: string;
  description: string;
  label?: string;
  meta?: string;
  metaItems?: string[];
  tags?: string[];
  featured?: boolean;
}

export function GuideCard({
  href,
  title,
  description,
  label = "Guide",
  meta,
  metaItems,
  tags = [],
  featured = false,
}: GuideCardProps) {
  const metadata = [label, ...(metaItems ?? []), ...(meta ? [meta] : [])];

  return (
    <Link
      href={href}
      className={cn(
        "not-prose group relative block overflow-hidden border border-black/10 bg-black/[0.02] no-underline transition-colors hover:border-black/20 hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.02] dark:hover:border-white/20 dark:hover:bg-white/[0.04]",
        featured ? "px-6 py-6 sm:px-7 sm:py-7" : "px-5 py-5 sm:px-6 sm:py-6",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-45deg, transparent, transparent 5px, color-mix(in srgb, var(--color-fd-foreground) 5%, transparent) 5px, color-mix(in srgb, var(--color-fd-foreground) 5%, transparent) 6px)",
        }}
      />
      <div className="absolute inset-y-0 left-0 w-px bg-black/10 dark:bg-white/10" />
      <div className="absolute inset-y-0 right-0 w-px bg-black/10 dark:bg-white/10" />
      <div className="absolute left-0 top-0 h-px w-full bg-black/10 dark:bg-white/10" />
      <div className="absolute bottom-0 left-0 h-px w-full bg-black/10 dark:bg-white/10" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-y-2 font-mono text-[11px] uppercase tracking-normal text-black/45 dark:text-white/45">
          {metadata.map((item, index) => (
            <div key={`${item}-${index}`} className="inline-flex items-center">
              {index > 0 ? (
                <span aria-hidden="true" className="mx-2 text-black/30 dark:text-white/28">
                  ·
                </span>
              ) : null}
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="max-w-3xl">
            <h3
              className={cn(
                "text-balance font-medium tracking-tight text-black dark:text-white",
                featured ? "text-2xl sm:text-[1.9rem]" : "text-xl",
              )}
            >
              {title}
            </h3>
            <p
              className={cn(
                "mt-3 max-w-2xl text-pretty leading-7 text-black/62 dark:text-white/56",
                featured ? "text-base" : "text-sm",
              )}
            >
              {description}
            </p>
          </div>

          <span className="mt-1 inline-flex size-9 shrink-0 items-center justify-center border border-black/10 bg-white/70 text-black/55 transition-transform group-hover:translate-x-0.5 dark:border-white/10 dark:bg-black/40 dark:text-white/55">
            <ArrowRight className="size-4" />
          </span>
        </div>

        {tags.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex border border-black/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-black/50 dark:border-white/10 dark:text-white/45"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </Link>
  );
}
