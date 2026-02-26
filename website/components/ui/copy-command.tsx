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
  const [splitted, setSplitted] = useState<string[]>(command.split(" "));
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      onClick={copy}
      className={`group flex font-mono items-center gap-2 border border-black/10 dark:border-white/10 md:border-b-0 px-3 sm:px-4 py-2.5 text-[11px] sm:text-sm text-black/70 dark:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all cursor-pointer overflow-hidden ${className}`}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      <Terminal className="w-3.5 h-3.5 text-black/40 dark:text-white/40" />
      <span className="select-all truncate flex items-center gap-2">
        {splitted.map((item, index) => (
          <span
            className={cn(
              "inline-block",
              index === 0
                ? "text-black dark:text-white"
                : index === splitted.length - 1
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
        <Check className="w-3.5 h-3.5 text-green-400 ml-1" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-black/20 dark:text-white/20 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
      )}
    </button>
  );
}
