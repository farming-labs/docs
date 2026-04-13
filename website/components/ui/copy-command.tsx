"use client";

import { useState } from "react";
import { Terminal, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyCommandProps {
  command: string;
  className?: string;
}

export default function CopyCommand({ command, className = "" }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);
  const parts = command.split(" ");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <button
      onClick={copy}
      className={cn(
        "group flex font-mono items-center gap-2 overflow-hidden border border-black/10 px-3 py-2.5 text-[11px] text-black/70 transition-all cursor-pointer hover:bg-black/[0.04] sm:px-4 sm:text-sm dark:border-white/10 dark:text-white/70 dark:hover:bg-white/[0.04] md:border-b-0",
        className,
      )}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      <Terminal className="h-3.5 w-3.5 shrink-0 text-black/40 dark:text-white/40" />
      <span className="min-w-0 flex-1 select-all truncate flex items-center gap-2">
        {parts.map((item, index) => (
          <span
            className={cn(
              "inline-block",
              index === 0
                ? "text-black dark:text-white"
                : index === parts.length - 1
                  ? "text-black/50 dark:text-white/50"
                  : "text-black/30 dark:text-white/30",
            )}
            key={index}
          >
            {item}
          </span>
        ))}
      </span>
      {copied ? (
        <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-green-400" />
      ) : (
        <Copy className="ml-auto h-3.5 w-3.5 shrink-0 text-black/20 opacity-0 transition-opacity group-hover:opacity-100 dark:text-white/20" />
      )}
    </button>
  );
}
