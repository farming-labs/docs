"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Terminal } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const TEMPLATES = ["next", "nuxt", "sveltekit", "astro"] as const;
const BASE_CMD = "pnpx @farming-labs/docs init --template ";
const DURATION = 2800;

const motionProps = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 8 },
  transition: { duration: 0.2, ease: "easeOut" },
};

interface CopyCommandTemplateProps {
  className?: string;
}

export default function CopyCommandTemplate({ className = "" }: CopyCommandTemplateProps) {
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((i) => (i + 1) % TEMPLATES.length);
    }, DURATION);
    return () => clearInterval(interval);
  }, []);

  const currentTemplate = TEMPLATES[index];
  const fullCommand = BASE_CMD + currentTemplate;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <button
      onClick={copy}
      className={cn(
        "group flex overflow-hidden font-mono items-center gap-2 border border-black/10 dark:border-white/10 md:border-b-0 px-3 sm:px-4 py-2 text-[11px] sm:text-sm text-black/70 dark:text-white/70 hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all cursor-pointer overflow-hidden",
        className,
      )}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      <Terminal className="w-3.5 h-3.5 text-black/40 dark:text-white/40 shrink-0" />
      <span className="select-all truncate flex items-center gap-2 min-w-0">
        <span className="text-black dark:text-white/30">pnpx</span>
        <span className="text-black/30 dark:text-white/30">@farming-labs/docs</span>
        <span className="text-black/60 dark:text-white/30">init</span>
        <span className="text-black/30 dark:text-white/30">--template</span>
        <span className="inline-block w-[6ch] min-w-[6ch] overflow-hidden py-0.5 align-baseline text-left">
          <AnimatePresence mode="wait">
            {/*@ts-ignore */}
            <motion.span
              key={currentTemplate}
              className="inline-block text-black/60 dark:text-white/50"
              {...motionProps}
            >
              {currentTemplate}
            </motion.span>
          </AnimatePresence>
        </span>
      </span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-400 ml-1 shrink-0" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0" />
      )}
    </button>
  );
}
