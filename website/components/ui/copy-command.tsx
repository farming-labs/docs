"use client";

import { useState } from "react";
import { Terminal, Copy, Check } from "lucide-react";

interface CopyCommandProps {
  command: string;
  className?: string;
}

export default function CopyCommand({ command, className = "" }: CopyCommandProps) {
  const [copied, setCopied] = useState(false);

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
      className={`group flex font-mono items-center gap-2 border border-white/10 md:border-b-0 px-3 sm:px-4 py-2.5 text-[11px] sm:text-sm text-white/70 hover:bg-white/[0.04] transition-all cursor-pointer overflow-hidden ${className}`}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      <Terminal className="w-3.5 h-3.5 text-white/40" />
      <span className="select-all truncate">{command}</span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400 ml-1" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
      )}
    </button>
  );
}
