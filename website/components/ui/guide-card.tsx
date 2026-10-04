import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { FrameJunctions } from "@/components/ui/frame-junctions";

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
        "not-prose group relative isolate my-4 block border border-black/10 bg-black/[0.012] no-underline transition-[background-color,border-color,transform] duration-200 hover:border-black/20 hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/45 focus-visible:ring-offset-2 active:translate-y-px dark:border-white/10 dark:bg-white/[0.012] dark:hover:border-white/20 dark:hover:bg-white/[0.03] dark:focus-visible:ring-white/55 dark:focus-visible:ring-offset-black",
        featured ? "px-6 py-6 sm:px-7 sm:py-7" : "px-5 py-5 sm:px-6 sm:py-6",
      )}
    >
      <div className="flex items-start justify-between gap-5">
        <div className="flex flex-wrap items-center gap-y-2 font-mono text-[10px] uppercase tracking-[0.1em] text-black/45 dark:text-white/45">
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
        <ArrowRight
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-black/35 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-white/35"
        />
      </div>

      <div className="mt-5 max-w-3xl">
        <h3
          className={cn(
            "text-balance font-semibold tracking-tight text-black dark:text-white",
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

      {tags.length > 0 ? (
        <ul
          aria-label={`${title} topics`}
          className="mt-6 flex flex-wrap gap-x-4 gap-y-2 border-t border-dashed border-black/10 pt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-black/45 dark:border-white/10 dark:text-white/42"
        >
          {tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      ) : null}

      <FrameJunctions />
    </Link>
  );
}
