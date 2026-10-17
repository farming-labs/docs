"use client";

import { Check, Copy } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { SimpleIcon } from "@/components/marketing/brand-icons";
import { ShellCommand } from "@/components/marketing/shell-command";
import { AGENT_FRIENDLY_DOCS_PROMPT } from "@/lib/agent-friendly-docs-prompt";
import { cn } from "@/lib/utils";

const packageManagers = [
  { id: "pnpm", command: "pnpm dlx @farming-labs/docs init" },
  { id: "npm", command: "npx @farming-labs/docs init" },
  { id: "yarn", command: "yarn dlx @farming-labs/docs init" },
  { id: "bun", command: "bunx @farming-labs/docs init" },
] as const;

function copyWithSelection(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const didCopy = document.execCommand("copy");
  textarea.remove();
  return didCopy;
}

function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy(value: string) {
    let didCopy = false;
    try {
      await navigator.clipboard.writeText(value);
      didCopy = true;
    } catch {
      didCopy = copyWithSelection(value);
    }
    if (!didCopy) return;
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  }

  return { copied, copy };
}

/** Install box: package-manager tabs above a copyable command. */
export function InstallBox({ className }: { className?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const { copied, copy } = useCopy();
  const active = packageManagers[activeIndex];

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = packageManagers.length;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % count
        : event.key === "ArrowLeft"
          ? (index - 1 + count) % count
          : undefined;
    if (next === undefined) return;
    event.preventDefault();
    setActiveIndex(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden border border-mk-line bg-mk-fg/[0.025] text-left",
        className,
      )}
    >
      <div
        aria-label="Package manager"
        className="flex items-center gap-1 border-b border-mk-line px-1.5 py-1.5"
        role="tablist"
      >
        {packageManagers.map((manager, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={manager.id}
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
              aria-controls="mk-install-command"
              aria-selected={selected}
              className="h-7 !rounded-none border border-transparent px-2.5 font-mono text-[12px] text-mk-fg/50 transition-colors duration-150 hover:text-mk-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-mk-fg aria-selected:border-mk-line aria-selected:bg-mk-bg aria-selected:text-mk-fg aria-selected:shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
              id={`mk-install-${manager.id}`}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {manager.id}
            </button>
          );
        })}
      </div>
      <div
        aria-labelledby={`mk-install-${active.id}`}
        className="flex h-12 items-center gap-3 bg-mk-bg pl-4 pr-2"
        id="mk-install-command"
        role="tabpanel"
      >
        <code className="min-w-0 flex-1 truncate font-mono text-[13px] tracking-normal text-mk-fg/85">
          <ShellCommand command={active.command} />
        </code>
        <button
          aria-label={copied ? "Copied install command" : "Copy install command"}
          className="grid size-8 shrink-0 place-items-center rounded-none text-mk-fg/45 transition-colors duration-150 hover:bg-mk-fg/[0.06] hover:text-mk-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-mk-fg"
          onClick={() => copy(active.command)}
          type="button"
        >
          {copied ? (
            <Check aria-hidden className="size-3.5" strokeWidth={2} />
          ) : (
            <Copy aria-hidden className="size-3.5" strokeWidth={1.6} />
          )}
        </button>
        <span aria-live="polite" className="sr-only">
          {copied ? "Copied to clipboard" : ""}
        </span>
      </div>
    </div>
  );
}

/** Copies a project-aware setup prompt for coding agents. */
export function AgentPromptButton({ className }: { className?: string }) {
  const { copied, copy } = useCopy();

  return (
    <button
      aria-label={copied ? "Copied agent prompt" : "Copy agent prompt"}
      className={cn(
        "group inline-flex h-11 items-center gap-2.5 rounded-none border border-mk-fg/15 bg-transparent pl-2 pr-4 text-[15px] font-medium tracking-[-0.01em] text-mk-fg transition-[border-color,background-color] duration-150 hover:border-mk-fg/35 hover:bg-mk-fg/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mk-fg",
        className,
      )}
      onClick={() => copy(AGENT_FRIENDLY_DOCS_PROMPT)}
      type="button"
    >
      <span aria-hidden className="flex -space-x-1">
        {(["anthropic", "openai", "cursor"] as const).map((icon) => (
          <span
            key={icon}
            className="grid size-7 place-items-center rounded-none border border-mk-fg/15 bg-transparent text-mk-fg/80"
          >
            <SimpleIcon className="size-3.5" name={icon} />
          </span>
        ))}
      </span>
      <span>{copied ? "Prompt copied" : "Copy agent prompt"}</span>
      {copied ? (
        <Check aria-hidden className="size-3.5 text-mk-fg/60" strokeWidth={2} />
      ) : (
        <Copy
          aria-hidden
          className="size-3.5 text-mk-fg/45 transition-colors group-hover:text-mk-fg"
          strokeWidth={1.6}
        />
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>
    </button>
  );
}
