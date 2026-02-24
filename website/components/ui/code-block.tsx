"use client";

import { useState } from "react";
import { highlight } from "sugar-high";
import { Copy } from "lucide-react";
import PixelCard from "./pixel-card";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  filename?: string;
  showCopy?: boolean;
  className?: string;
}

export default function CodeBlock({
  code,
  language,
  title,
  filename,
  showCopy = true,
  className = "",
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const highlighted = highlight(code);

  return (
    <div className={`relative group max-w-full ${className}`}>
      <PixelCard variant="code" className="p-0!">
        {(title || filename) && (
          <div
            className="relative flex items-center justify-between border-b border-white/10 px-3 sm:px-4 py-2.5 min-w-0 overflow-hidden bg-[repeating-linear-gradient(-45deg,#ffffff,#ffffff_1px,transparent_1px,transparent_6px)] bg-clip-padding"
            style={{ backgroundSize: "8px 8px" }}
          >
            <div className="absolute inset-0 bg-black/95" />
            <div className="relative z-10 flex items-center gap-2 min-w-0">
              {filename && (
                <span className="text-[11px] sm:text-xs font-mono text-white/50 truncate">
                  {filename}
                </span>
              )}
            </div>
            <div className="relative z-[999] flex items-center gap-2 flex-shrink-0">
              {title && (
                <span className="text-[9.5px] border px-2 bg-black border-white/10 font-mono uppercase tracking-wider text-white/20">
                  {title}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="relative">
          <pre className="px-3 sm:px-4 py-3.5 text-[12px] sm:text-[13px] leading-relaxed overflow-x-auto font-mono">
            <code className="sh-code" dangerouslySetInnerHTML={{ __html: highlighted }} />
          </pre>
          {showCopy && (
            <button
              onClick={copyToClipboard}
              className="absolute top-2.5 right-2.5 p-1.5 border border-white/10 bg-black/80 hover:bg-white/10 transition-colors duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
              title={copied ? "Copied!" : "Copy code"}
            >
              {copied ? (
                <svg
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  className="w-3.5 h-3.5 text-green-400"
                >
                  <path
                    d="M18 6h2v2h-2V6zm-2 4V8h2v2h-2zm-2 2v-2h2v2h-2zm-2 2h2v-2h-2v2zm-2 2h2v-2h-2v2zm-2 0v2h2v-2H8zm-2-2h2v2H6v-2zm0 0H4v-2h2v2z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <Copy className="w-3.5 h-3.5 text-white/50" />
              )}
            </button>
          )}
        </div>
      </PixelCard>
    </div>
  );
}
