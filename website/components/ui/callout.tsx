"use client";

import type { ReactNode } from "react";
import { Info, AlertTriangle, Lightbulb, MessageSquare, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalloutType =
  | "note"
  | "info"
  | "warning"
  | "warn"
  | "tip"
  | "important"
  | "caution"
  | "error";

export interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
  className?: string;
}

const typeToVariant = (type: CalloutType): "note" | "warning" | "tip" | "important" | "caution" => {
  switch (type) {
    case "info":
      return "note";
    case "warn":
      return "warning";
    case "error":
      return "caution";
    default:
      return type as "note" | "warning" | "tip" | "important" | "caution";
  }
};

const variantStyles = {
  note: {
    icon: Info,
    iconClass: "text-black/50 dark:text-white/50",
    titleClass: "text-black/70 dark:text-white/70",
    border:
      "border-black/10 dark:border-white/10 border-l-4 border-l-black/25 dark:border-l-white/25",
    bg: "bg-black/[0.03] dark:bg-white/[0.025]",
  },
  warning: {
    icon: AlertTriangle,
    iconClass: "text-black/55 dark:text-white/55",
    titleClass: "text-black/75 dark:text-white/75",
    border:
      "border-black/12 dark:border-white/12 border-l-4 border-l-black/35 dark:border-l-white/35",
    bg: "bg-black/[0.04] dark:bg-white/[0.035]",
  },
  tip: {
    icon: Lightbulb,
    iconClass: "text-black/50 dark:text-white/50",
    titleClass: "text-black/70 dark:text-white/70",
    border:
      "border-black/10 dark:border-white/10 border-l-4 border-l-black/30 dark:border-l-white/30",
    bg: "bg-black/[0.03] dark:bg-white/[0.025]",
  },
  important: {
    icon: MessageSquare,
    iconClass: "text-black/55 dark:text-white/55",
    titleClass: "text-black/75 dark:text-white/75",
    border:
      "border-black/12 dark:border-white/12 border-l-4 border-l-black/35 dark:border-l-white/35",
    bg: "bg-black/[0.04] dark:bg-white/[0.035]",
  },
  caution: {
    icon: AlertCircle,
    iconClass: "text-black/60 dark:text-white/60",
    titleClass: "text-black/80 dark:text-white/80",
    border:
      "border-black/15 dark:border-white/15 border-l-4 border-l-black/40 dark:border-l-white/40",
    bg: "bg-black/[0.05] dark:bg-white/[0.045]",
  },
} as const;

/**
 * Custom Callout for the docs website. Matches design system: borders, font-mono, subtle bg.
 * Compatible with MDX usage: <Callout type="info" title="...">...</Callout>
 */
export function Callout({ type = "note", title, children, className }: CalloutProps) {
  const variant = typeToVariant(type);
  const style = variantStyles[variant];
  const Icon = style.icon;

  return (
    <div
      role="note"
      className={cn(
        "callout-custom my-4 flex gap-0 overflow-x-hidden rounded-none border p-4 font-mono text-[9px]!",
        style.border,
        style.bg,
        className,
      )}
    >
      <div className={cn("shrink-0 -mt-1", style.iconClass)} aria-hidden>
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </div>
      <div className="min-w-0 -mt-6 ml-2 flex-1 space-y-1">
        {title && (
          <p className={cn("font-mono uppercase tracking-tight", style.titleClass)}>{title}</p>
        )}
        <div className="h-px w-[calc(100%+10rem)] -mt-2 mx-auto ml-[-5rem] bg-black/10 dark:bg-white/10" />
        <div className="text-black/80 pt-2 font-sans dark:text-white/80 [&>p:last-child]:mb-0 [&>p]:my-0">
          {children}
        </div>
      </div>
    </div>
  );
}
