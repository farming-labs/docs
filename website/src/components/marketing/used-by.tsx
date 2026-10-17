import type { ComponentType } from "react";
import {
  AssistantUiMark,
  FarmingLabsMark,
  HopliteMark,
  LimrunMark,
  ScholarXivMark,
} from "@/components/marketing/brand-icons";
import { cn } from "@/lib/utils";

type Adopter = {
  name: string;
  href?: string;
  note?: string;
  mark?: ComponentType<{ className?: string }>;
};

function withReferral(href: string) {
  const url = new URL(href);
  url.searchParams.set("utm_source", "docs.farming-labs.dev");
  url.searchParams.set("utm_medium", "referral");
  url.searchParams.set("utm_campaign", "used_by");
  return url.toString();
}

export const adopters: readonly Adopter[] = [
  {
    name: "assistant-ui",
    href: "https://www.assistant-ui.com/docs",
    note: "React components and runtimes for AI chat",
    mark: AssistantUiMark,
  },
  {
    name: "Hoplite",
    href: "https://hoplite.sh/docs",
    note: "Cloud coding agents that open pull requests",
    mark: HopliteMark,
  },
  {
    name: "Farm.js",
    href: "https://farmjs.dev/docs",
    note: "The framework for product-integrated apps",
    mark: FarmingLabsMark,
  },
  {
    name: "lim.run",
    href: "https://docs.limrun.com/docs",
    note: "Cloud simulators and Xcode builds for agents",
    mark: LimrunMark,
  },
  {
    name: "ScholarXIV",
    href: "https://www.scholarxiv.com",
    mark: ScholarXivMark,
  },
];

function Logo({ adopter }: { adopter: Adopter }) {
  const Mark = adopter.mark;
  return (
    <span className="flex items-center gap-2.5">
      {Mark ? <Mark className="size-[22px]" /> : null}
      <span
        className={cn(
          "whitespace-nowrap font-semibold tracking-[-0.04em]",
          Mark ? "text-[19px]" : "text-[20px]",
        )}
      >
        {adopter.name}
      </span>
    </span>
  );
}

/** Vercel-style logo row: wordmarks only, quiet until hovered. */
export function UsedByLogos() {
  const featured = adopters;

  return (
    <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
      {featured.map((adopter) => {
        const className =
          "flex h-24 items-center justify-center px-4 text-mk-fg/55 transition-[background-color,color] duration-150";
        return (
          <li
            key={adopter.name}
            className="border-t border-mk-line max-sm:[&:nth-child(odd)]:border-r sm:max-lg:[&:not(:nth-child(3n))]:border-r lg:[&:not(:nth-child(6n))]:border-r"
          >
            {adopter.href ? (
              <a
                aria-label={`${adopter.name} documentation (opens in a new tab)`}
                className={cn(
                  className,
                  "hover:bg-mk-fg/[0.03] hover:text-mk-fg hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-mk-fg",
                )}
                href={withReferral(adopter.href)}
                rel="noreferrer"
                target="_blank"
              >
                <Logo adopter={adopter} />
              </a>
            ) : (
              <span className={className}>
                <Logo adopter={adopter} />
              </span>
            )}
          </li>
        );
      })}
      <li className="border-t border-mk-line">
        <span className="flex h-24 items-center justify-center gap-2.5 px-4 text-mk-fg/55">
          <span className="text-[20px] font-semibold tracking-[-0.04em]">100+</span>
          <span className="font-mono text-[11px] uppercase">more teams</span>
        </span>
      </li>
    </ul>
  );
}
