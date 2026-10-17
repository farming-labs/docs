"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ShellCommand } from "@/components/marketing/shell-command";
import { cn } from "@/lib/utils";

/** A single copyable shell command on one line. */
export function CopyLine({ command, className }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div
      className={cn(
        "flex h-11 items-center gap-3 border border-mk-line bg-mk-bg pl-4 pr-1.5",
        className,
      )}
    >
      <code className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-mk-fg/85">
        <ShellCommand command={command} />
      </code>
      <button
        aria-label={copied ? "Copied command" : "Copy command"}
        className="grid size-8 shrink-0 place-items-center text-mk-fg/45 transition-colors hover:bg-mk-fg/[0.06] hover:text-mk-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-mk-fg"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setCopied(false), 1600);
          } catch {}
        }}
        type="button"
      >
        {copied ? (
          <Check aria-hidden className="size-3.5" strokeWidth={2} />
        ) : (
          <Copy aria-hidden className="size-3.5" strokeWidth={1.6} />
        )}
      </button>
    </div>
  );
}
