"use client";

import { Check, Code2, Copy } from "lucide-react";
import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { highlight } from "sugar-high";
import { cn } from "@/lib/utils";

export type CodeTab = {
  id: string;
  label: string;
  language: string;
  code: string;
  highlightLines?: readonly number[];
};

function renderCode(code: string, highlightLines: readonly number[] = []) {
  const marked = new Set(highlightLines);
  return highlight(code)
    .split("\n")
    .map((line, index) =>
      marked.has(index + 1)
        ? line.replace('class="sh__line"', 'class="sh__line" data-highlighted=""')
        : line,
    )
    .join("");
}

function CodeBody({
  code,
  highlightLines,
  compact,
  label,
}: {
  code: string;
  highlightLines?: readonly number[];
  compact?: boolean;
  label: string;
}) {
  return (
    <pre
      aria-label={label}
      className={cn(
        "min-h-0 flex-1 overflow-auto py-4 font-mono tracking-normal",
        compact ? "text-[10.5px] leading-5" : "text-[11px] leading-6",
      )}
      tabIndex={0}
    >
      <code
        className={cn("mk-code block min-w-full", compact && "mk-code--compact")}
        dangerouslySetInnerHTML={{ __html: renderCode(code, highlightLines) }}
      />
    </pre>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      aria-label={copied ? "Copied" : "Copy code"}
      className="grid size-10 shrink-0 place-items-center border-l border-mk-line text-mk-fg/40 transition-colors duration-150 hover:bg-mk-fg/[0.05] hover:text-mk-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-mk-fg"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setCopied(false), 1600);
        } catch {}
      }}
      type="button"
    >
      {copied ? (
        <Check aria-hidden className="size-3.5" strokeWidth={1.6} />
      ) : (
        <Copy aria-hidden className="size-3.5" strokeWidth={1.5} />
      )}
    </button>
  );
}

/** A framed code file: header with name + language, numbered lines, highlighted rows. */
export function CodePanel({
  code,
  label,
  language,
  highlightLines,
  compact,
  copyable,
  prefix,
  footer,
  className,
}: {
  code: string;
  label: string;
  language: string;
  highlightLines?: readonly number[];
  compact?: boolean;
  copyable?: boolean;
  prefix?: string;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-mk-line bg-mk-bg shadow-[0_24px_60px_rgb(0_0_0/0.06)] dark:shadow-[0_24px_60px_rgb(0_0_0/0.3)]",
        className,
      )}
    >
      <figcaption className="flex h-10 min-w-0 shrink-0 items-stretch justify-between border-b border-mk-line font-mono text-[10px] tracking-normal text-mk-fg/45">
        <span className="flex min-w-0 items-center gap-2 px-4">
          {prefix ? (
            <span className="border border-mk-line px-1.5 py-0.5 text-[9px] uppercase text-mk-fg/70">
              {prefix}
            </span>
          ) : (
            <Code2 aria-hidden className="size-3 shrink-0" strokeWidth={1.5} />
          )}
          <span className="truncate">{label}</span>
        </span>
        <span className="flex items-stretch">
          <span className="flex items-center px-4 uppercase text-mk-fg/30">{language}</span>
          {copyable ? <CopyButton value={code} /> : null}
        </span>
      </figcaption>
      <CodeBody code={code} compact={compact} highlightLines={highlightLines} label={label} />
      {footer}
    </figure>
  );
}

/** Several files in one frame, switched by keyboard-accessible tabs. */
export function CodeTabsPanel({
  tabs,
  tabsLabel,
  compact,
  className,
}: {
  tabs: readonly [CodeTab, ...CodeTab[]];
  tabsLabel: string;
  compact?: boolean;
  className?: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = tabs[activeIndex] ?? tabs[0];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setActiveIndex(next);
    refs.current[next]?.focus();
  }

  return (
    <figure
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border border-mk-line bg-mk-bg shadow-[0_24px_60px_rgb(0_0_0/0.06)] dark:shadow-[0_24px_60px_rgb(0_0_0/0.3)]",
        className,
      )}
    >
      <div
        aria-label={tabsLabel}
        className="flex h-10 min-w-0 shrink-0 items-stretch overflow-x-auto border-b border-mk-line [scrollbar-width:none]"
        role="tablist"
      >
        {tabs.map((tab, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={tab.id}
              ref={(node) => {
                refs.current[index] = node;
              }}
              aria-selected={selected}
              className="relative flex shrink-0 items-center gap-2 border-r border-mk-line px-4 font-mono text-[10px] tracking-normal text-mk-fg/40 transition-colors duration-150 hover:bg-mk-fg/[0.04] hover:text-mk-fg/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-mk-fg aria-selected:bg-mk-fg/[0.04] aria-selected:text-mk-fg"
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {selected ? (
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-mk-fg" />
              ) : null}
              {tab.label}
            </button>
          );
        })}
        <span className="ml-auto flex items-center px-4 font-mono text-[11px] uppercase text-mk-fg/30">
          {active.language}
        </span>
      </div>
      <div key={active.id} className="mk-panel-in flex min-h-0 flex-1 flex-col" role="tabpanel">
        <CodeBody
          code={active.code}
          compact={compact}
          highlightLines={active.highlightLines}
          label={active.label}
        />
      </div>
    </figure>
  );
}
