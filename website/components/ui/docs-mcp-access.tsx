"use client";

import { useEffect, useRef, useState } from "react";
import { Blocks, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";

const mcpEndpoint = "https://docs.farming-labs.dev/api/docs/mcp";

const cursorInstallUrl =
  "cursor://anysphere.cursor-deeplink/mcp/install?name=farming-labs-docs&config=eyJ1cmwiOiJodHRwczovL2RvY3MuZmFybWluZy1sYWJzLmRldi9hcGkvZG9jcy9tY3AifQ==";

const vscodeInstallUrl = `vscode:mcp/install?${encodeURIComponent(
  JSON.stringify({
    name: "farming-labs-docs",
    type: "http",
    url: mcpEndpoint,
  }),
)}`;

const genericConfig = `{
  "mcpServers": {
    "farming-labs-docs": {
      "url": "${mcpEndpoint}"
    }
  }
}`;

function CopyIcon({ copied, className }: { copied: boolean; className?: string }) {
  if (copied) {
    return (
      <svg
        className={className}
        width="1.25em"
        height="1.25em"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden
      >
        <path
          d="M5 10.8l3.1 3.1 6.2-6.8"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      width="1.25em"
      height="1.25em"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <rect x="5" y="7" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="8" y="5" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function CopyableBlock({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), 1200) as unknown as number;
    } catch {
      // ignore clipboard failures in restricted environments
    }
  };

  return (
    <div className={className}>
      <div className="mb-2 inline-flex min-w-0 items-center gap-2 text-black/60 dark:text-white/72">
        <Blocks className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
        <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em]">{label}</p>
      </div>
      <div className="relative border border-black/10 bg-black/[0.03] dark:border-white/10 dark:bg-black/30">
        <button
          type="button"
          aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
          onClick={handleCopy}
          className="absolute top-2.5 right-2.5 z-10 inline-flex size-7 items-center justify-center border border-black/10 bg-white/80 text-black/55 transition-colors hover:bg-white hover:text-black/80 dark:border-white/10 dark:bg-black/45 dark:text-white/58 dark:hover:bg-white/[0.06] dark:hover:text-white/80"
        >
          <CopyIcon copied={copied} className="size-4" />
        </button>
        <pre className="overflow-x-auto px-4 py-3 pr-12 font-mono text-[0.68rem] leading-6 text-black/80 dark:text-white/82">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
}

function CursorIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 167 191" className={className} fill="none" role="img">
      <path
        fill="currentColor"
        d="M83.395 95.5 166 143.297c-.507.881-1.243 1.633-2.155 2.159L86.636 190.13c-2.004 1.16-4.477 1.16-6.482 0l-77.209-44.674c-.911-.526-1.648-1.278-2.155-2.159L83.395 95.5Z"
        opacity="0.55"
      />
      <path
        fill="currentColor"
        d="M83.395 0v95.5L.79 143.297A4.302 4.302 0 0 1 0 140.346V50.654c0-2.109 1.122-4.054 2.945-5.11L80.15.87A6.48 6.48 0 0 1 83.391 0h.004Z"
        opacity="0.72"
      />
      <path
        fill="currentColor"
        d="M165.996 47.703a6.452 6.452 0 0 0-2.155-2.159L86.632.87A6.477 6.477 0 0 0 83.395 0v95.5L166 143.297a4.302 4.302 0 0 0 .789-2.951V50.654A5.88 5.88 0 0 0 166 47.703h-.004Z"
      />
      <path
        fill="currentColor"
        d="M160.218 51.049c.468.809.533 1.847 0 2.771L85.235 183.974c-.503.881-1.843.519-1.843-.495V97.713c0-.684-.183-1.343-.515-1.919l77.338-44.749h.003Z"
        opacity="0.4"
      />
      <path
        fill="currentColor"
        d="m160.218 51.049-77.338 44.748a5.129 5.129 0 0 0-1.4-1.403L7.369 51.511c-.879-.505-.518-1.848.493-1.848h149.962c1.065 0 1.93.576 2.394 1.386Z"
      />
    </svg>
  );
}

export function DocsMcpAccess({ className }: { className?: string }) {
  return (
    <section className={cn("not-prose py-6 md:py-8", className)} aria-label="MCP access">
      <div className="relative overflow-hidden border border-black/10 bg-neutral-50/90 dark:border-white/10 dark:bg-white/[0.03]">
        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(-45deg,rgba(0,0,0,0.03),rgba(0,0,0,0.03)_1px,transparent_1px,transparent_10px)] opacity-70 dark:bg-[repeating-linear-gradient(-45deg,rgba(255,255,255,0.035),rgba(255,255,255,0.035)_1px,transparent_1px,transparent_10px)] dark:opacity-60" />
        <div className="relative grid gap-0 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className="border-b border-black/10 p-5 md:border-b-0 md:border-r md:p-6 dark:border-white/10">
            <div className="inline-flex items-center gap-2 text-black/60 dark:text-white/70">
              <PlugZap className="size-4" strokeWidth={1.5} aria-hidden />
              <p className="font-mono text-[10px] uppercase tracking-[0.18em]">Docs MCP</p>
            </div>

            <h2 className="mt-4 max-w-sm font-sans text-[0.9rem] uppercase tracking-[0.12em] text-black/92 sm:text-[0.98rem] dark:text-white/92">
              Add to MCP
            </h2>

            <p className="mt-4 max-w-md text-sm leading-7 text-black/58 dark:text-white/58">
              Connect the live docs endpoint directly in clients that support one-click or manual
              MCP setup.
            </p>

            <div className="mt-5 flex max-w-md flex-col gap-2.5">
              <a
                href={cursorInstallUrl}
                className="group inline-flex min-h-12 w-full items-center gap-2.5 border border-black/12 bg-black/[0.02] px-3 py-2.5 text-black transition-[border-color,background-color] hover:border-black/20 hover:bg-black/[0.04] hover:no-underline dark:border-white/12 dark:bg-white/[0.045] dark:text-white dark:hover:border-white/20 dark:hover:bg-white/[0.07]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center border border-black/10 bg-white/70 dark:border-white/12 dark:bg-black/35">
                  <CursorIcon className="size-4 text-black/70 dark:text-white/80" />
                </span>
                <span className="flex min-w-0 flex-col items-start">
                  <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-black/92 dark:text-white/92">
                    Cursor
                  </span>
                  <span className="-mt-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-black/45 dark:text-white/45">
                    Deep link
                  </span>
                </span>
              </a>
              <a
                href={vscodeInstallUrl}
                className="group inline-flex min-h-12 w-full items-center gap-2.5 border border-black/12 bg-black/[0.02] px-3 py-2.5 text-black transition-[border-color,background-color] hover:border-black/20 hover:bg-black/[0.04] hover:no-underline dark:border-white/12 dark:bg-white/[0.045] dark:text-white dark:hover:border-white/20 dark:hover:bg-white/[0.07]"
              >
                <span className="flex size-8 shrink-0 items-center justify-center border border-black/10 bg-white/70 dark:border-white/12 dark:bg-black/35">
                  <img
                    src="https://code.visualstudio.com/assets/branding/code-stable.png"
                    alt=""
                    className="size-4 object-contain"
                    aria-hidden="true"
                  />
                </span>
                <span className="flex min-w-0 flex-col items-start">
                  <span className="font-mono text-[0.64rem] uppercase tracking-[0.14em] text-black/92 dark:text-white/92">
                    VS Code
                  </span>
                  <span className="-mt-0.5 font-mono text-[0.6rem] uppercase tracking-wider text-black/45 dark:text-white/45">
                    Install link
                  </span>
                </span>
              </a>
            </div>
          </div>

          <div className="grid gap-5 p-5 md:p-6">
            <CopyableBlock label="Endpoint" value={mcpEndpoint} />
            <CopyableBlock label="MCP config" value={genericConfig} />
          </div>
        </div>
      </div>
    </section>
  );
}
