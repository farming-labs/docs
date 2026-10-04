import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  MigrationSourceIcon,
  type MigrationSourceSlug,
} from "@/components/ui/migration-source-icon";

const migrationSourceByName = {
  Docusaurus: "docusaurus",
  Mintlify: "mintlify",
  Nextra: "nextra",
  Fumadocs: "fumadocs",
  VitePress: "vitepress",
  Starlight: "starlight",
  GitBook: "gitbook",
  "Material for MkDocs": "mkdocs",
} as const satisfies Record<string, MigrationSourceSlug>;

type MigrationSourceName = keyof typeof migrationSourceByName;

interface MigrationCardProps {
  href: string;
  name: MigrationSourceName;
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
  const source = migrationSourceByName[name];

  return (
    <Link
      href={href}
      className="group flex h-full min-h-52 flex-col border border-black/10 bg-black/[0.012] p-5 text-black no-underline transition-[background-color,border-color,transform] duration-200 hover:border-black/20 hover:bg-black/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/45 focus-visible:ring-offset-2 active:translate-y-px dark:border-white/10 dark:bg-white/[0.012] dark:text-white dark:hover:border-white/20 dark:hover:bg-white/[0.03] dark:focus-visible:ring-white/55 dark:focus-visible:ring-offset-black"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center bg-black/[0.045] text-black/70 dark:bg-white/[0.06] dark:text-white/70">
            <MigrationSourceIcon source={source} className="size-4" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-black/45 dark:text-white/45">
            {sourceType} · {effort} effort
          </span>
        </div>
        <ArrowRight
          aria-hidden="true"
          className="size-4 shrink-0 text-black/35 transition-transform duration-200 group-hover:translate-x-0.5 dark:text-white/35"
        />
      </div>

      <h3 className="mt-5 text-xl font-semibold tracking-tight">{name}</h3>
      <p className="mt-2 text-sm leading-6 text-black/60 dark:text-white/58">{description}</p>

      <div className="mt-auto pt-6">
        <div className="-mx-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-dashed border-black/10 px-5 pt-4 text-xs text-black/48 dark:border-white/10 dark:text-white/45">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em]">Preserves</span>
          <span>{preserves.join(" · ")}</span>
        </div>
      </div>
    </Link>
  );
}
