import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

interface MigrationCardProps {
  href: string;
  name: string;
  description: string;
  sourceType: "Git-based" | "Hosted";
  effort: "Low" | "Medium";
  preserves: string[];
}

export function MigrationCard({
  href,
  name,
  description,
  sourceType,
  effort,
  preserves,
}: MigrationCardProps) {
  return (
    <Link
      href={href}
      className="group relative flex min-h-56 flex-col overflow-hidden border border-black/10 bg-black/[0.018] p-5 text-black no-underline transition-colors hover:border-black/20 hover:bg-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/45 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-white/[0.018] dark:text-white dark:hover:border-white/20 dark:hover:bg-white/[0.04] dark:focus-visible:ring-white/55 dark:focus-visible:ring-offset-black"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-black/25 to-transparent dark:via-white/25"
      />

      <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-black/45 dark:text-white/45">
        <span>{sourceType}</span>
        <span className="border border-black/10 px-2 py-1 dark:border-white/10">
          {effort} effort
        </span>
      </div>

      <div className="mt-5">
        <h2 className="text-xl font-semibold tracking-tight">{name}</h2>
        <p className="mt-2 text-sm leading-6 text-black/60 dark:text-white/58">{description}</p>
      </div>

      <ul className="mt-5 flex flex-wrap gap-2" aria-label={`What the ${name} guide preserves`}>
        {preserves.map((item) => (
          <li
            key={item}
            className="inline-flex items-center gap-1.5 border border-black/8 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-black/50 dark:border-white/10 dark:text-white/48"
          >
            <Check aria-hidden="true" className="h-3 w-3" strokeWidth={2} />
            {item}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between border-t border-black/8 pt-4 font-mono text-[11px] uppercase tracking-[0.12em] dark:border-white/10">
        <span>Open migration guide</span>
        <ArrowRight
          aria-hidden="true"
          className="h-4 w-4 transition-transform group-hover:translate-x-1"
        />
      </div>
    </Link>
  );
}
