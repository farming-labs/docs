// Marketing building blocks with no client components below them. Pages pass these
// JSX children, which Farm can only keep on the server when the module stays
// client-free (see the island rules in Farm's server-rendering docs).

import type { ReactNode } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg";

export function isExternal(href: string) {
  return href.startsWith("http");
}

/** Small mono eyebrow: `02 / Label`. Carries the farm.js index rhythm into each section. */
export function IndexedLabel({
  index,
  icon: Icon,
  label,
  className,
}: {
  index: string;
  icon?: LucideIcon;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 font-mono text-[11px] font-normal uppercase tracking-normal text-current",
        className,
      )}
    >
      <span aria-hidden className="opacity-50">
        {index}
      </span>
      <span aria-hidden className="opacity-35">
        /
      </span>
      {Icon ? <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={1.5} /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

export function ButtonLink({
  href,
  children,
  icon,
  size = "default",
  variant = "primary",
  className,
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  size?: "default" | "compact";
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const external = isExternal(href);

  return (
    <a
      className={cn(
        "group inline-flex min-w-0 items-center justify-center gap-2 rounded-none border font-medium tracking-[-0.01em] whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 hover:no-underline active:scale-[0.98]",
        focusRing,
        size === "default" && "h-11 px-5 text-[15px]",
        size === "compact" && "h-9 px-3.5 text-[14px]",
        variant === "primary" &&
          "border-mk-fg bg-mk-fg text-mk-bg hover:bg-mk-fg/85 hover:text-mk-bg",
        variant === "secondary" &&
          "border-mk-fg/15 bg-mk-bg text-mk-fg hover:border-mk-fg/35 hover:bg-mk-fg/[0.05] hover:text-mk-fg",
        variant === "ghost" &&
          "border-transparent text-mk-fg/70 hover:bg-mk-fg/[0.05] hover:text-mk-fg",
        className,
      )}
      href={href}
      rel={external ? "noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {icon}
      <span>{children}</span>
      {external ? (
        <ArrowUpRight aria-hidden className="size-3.5 opacity-60" strokeWidth={1.8} />
      ) : variant !== "ghost" ? (
        <ArrowRight
          aria-hidden
          className="size-3.5 opacity-60 transition-transform duration-150 group-hover:translate-x-0.5"
          strokeWidth={1.8}
        />
      ) : null}
    </a>
  );
}
