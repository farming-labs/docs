"use client";

import React, { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface WebsiteThemePromptProps {
  title?: string;
  description?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  children?: React.ReactNode;
}

type BrandfetchRouteResponse = {
  source?: string;
  domain?: string;
  brand?: unknown;
  error?: string;
};

type SubmitState = "idle" | "bootstrapping" | "done";

const FRAMEWORK_OPTIONS = ["Next.js", "TanStack Start", "SvelteKit", "Astro", "Nuxt"] as const;

const fieldControlClassName =
  "h-10 rounded-none border border-[var(--color-fd-border)] bg-[var(--color-fd-background)] px-3 text-sm font-normal text-[var(--color-fd-foreground)] outline-none transition-colors placeholder:text-[var(--color-fd-muted-foreground)] focus:border-[var(--color-fd-primary)]";

function normalizePromptText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function extractPromptTextFromElement(element: HTMLElement | null): string {
  if (!element) return "";

  function inner(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (!(node instanceof HTMLElement)) return "";

    const tagName = node.tagName.toLowerCase();
    if (tagName === "button" || node.getAttribute("aria-hidden") === "true") return "";
    if (tagName === "br") return "\n";
    if (tagName === "pre") return `${node.textContent?.trim() ?? ""}\n\n`;

    const childText = Array.from(node.childNodes)
      .map((child) => inner(child))
      .join("");

    if (tagName === "li") return `- ${childText.trim()}\n`;
    if (tagName === "p") return `${childText.trim()}\n\n`;
    if (tagName === "ul" || tagName === "ol") return `${childText.trim()}\n`;
    if (/^h[1-6]$/.test(tagName)) return `${childText.trim()}\n\n`;

    return childText;
  }

  return normalizePromptText(inner(element));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fillPromptTemplate(text: string, values: Record<string, string>): string {
  let next = text;

  for (const [name, rawValue] of Object.entries(values)) {
    const value = rawValue.trim();
    if (!value) continue;

    const escaped = escapeRegExp(name);
    next = next
      .replace(new RegExp(`\\[${escaped}\\]`, "g"), value)
      .replace(new RegExp(`\\{${escaped}\\}`, "g"), value);
  }

  return next;
}

async function fallbackCopyText(text: string): Promise<boolean> {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return fallbackCopyText(text);
  }

  return fallbackCopyText(text);
}

async function fetchBrandContext(websiteUrl: string): Promise<string> {
  const response = await fetch("/api/brandfetch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: websiteUrl }),
  });
  const result = (await response.json().catch(() => ({}))) as BrandfetchRouteResponse;

  if (!response.ok) {
    throw new Error(result.error ?? "Brandfetch lookup failed.");
  }

  return JSON.stringify(
    {
      source: result.source ?? "brandfetch",
      domain: result.domain,
      brand: result.brand,
    },
    null,
    2,
  );
}

export function WebsiteThemePrompt({
  title = "Create a docs theme from my website",
  description = "Copy this into your coding agent when you want docs that match an existing site.",
  dialogTitle = "Create a website-matching docs prompt",
  dialogDescription = "Add your website URL and we will fetch Brandfetch details before copying it.",
  children,
}: WebsiteThemePromptProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [docsEntry, setDocsEntry] = useState("docs");
  const [framework, setFramework] = useState<(typeof FRAMEWORK_OPTIONS)[number]>("Next.js");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [brandError, setBrandError] = useState<string | null>(null);
  const promptSourceRef = useRef<HTMLDivElement>(null);
  const isSubmitting = submitState !== "idle";
  const submitLabel =
    submitState === "bootstrapping"
      ? "Bootstrapping..."
      : submitState === "done"
        ? "Done & copied"
        : "Copy filled prompt";

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBrandError(null);
      setSubmitState("bootstrapping");

      try {
        const promptText = extractPromptTextFromElement(promptSourceRef.current);
        if (!promptText) {
          setSubmitState("idle");
          return;
        }

        const brandContext = await fetchBrandContext(websiteUrl);
        const filledPrompt = fillPromptTemplate(promptText, {
          WEBSITE_URL: websiteUrl,
          DOCS_ENTRY: docsEntry,
          FRAMEWORK: framework,
          BRAND_CONTEXT: brandContext,
        });
        const didCopy = await copyText(filledPrompt);

        if (!didCopy) return;

        setCopied(true);
        setSubmitState("done");
        window.setTimeout(() => {
          setCopied(false);
          setSubmitState("idle");
          setOpen(false);
        }, 900);
      } catch (error) {
        setBrandError(error instanceof Error ? error.message : "Brandfetch lookup failed.");
        setSubmitState("idle");
      }
    },
    [docsEntry, framework, websiteUrl],
  );

  return (
    <>
      <div className="fd-prompt" data-prompt-card style={{ borderRadius: 0 }}>
        <div className="fd-prompt-header">
          <span className="fd-prompt-icon">
            <Sparkles size={16} />
          </span>
          <div className="fd-prompt-copy">
            <p className="fd-prompt-title">{title}</p>
            <p className="fd-prompt-description">{description}</p>
          </div>
        </div>

        <div className="fd-prompt-actions">
          <button
            type="button"
            className="fd-prompt-action-btn"
            data-copied={copied}
            onClick={() => setOpen(true)}
            style={{ borderRadius: 0 }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span>{copied ? "Copied" : "Copy prompt"}</span>
          </button>
        </div>
      </div>

      <div ref={promptSourceRef} hidden>
        {children}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[30rem] rounded-none border-[var(--color-fd-border)] bg-[var(--color-fd-popover)] text-[var(--color-fd-popover-foreground)] shadow-[3px_3px_0_color-mix(in_srgb,var(--color-fd-border)_65%,transparent)] sm:rounded-none">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle className="text-[var(--color-fd-foreground)]">{dialogTitle}</DialogTitle>
              <DialogDescription className="text-[var(--color-fd-muted-foreground)]">
                {dialogDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-[var(--color-fd-foreground)]">
                Website URL
                <input
                  type="url"
                  required
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(event) => setWebsiteUrl(event.target.value)}
                  className={fieldControlClassName}
                />
                <span className="text-xs font-normal leading-5 text-[var(--color-fd-muted-foreground)]">
                  Used to fetch logos, colors, fonts, and brand metadata from Brandfetch.
                </span>
              </label>

              <label className="grid gap-2 text-sm font-medium text-[var(--color-fd-foreground)]">
                Docs entry folder
                <input
                  type="text"
                  required
                  value={docsEntry}
                  onChange={(event) => setDocsEntry(event.target.value)}
                  className={fieldControlClassName}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium text-[var(--color-fd-foreground)]">
                Framework
                <span className="relative">
                  <select
                    required
                    value={framework}
                    onChange={(event) =>
                      setFramework(event.target.value as (typeof FRAMEWORK_OPTIONS)[number])
                    }
                    className={`${fieldControlClassName} w-full appearance-none pr-9`}
                  >
                    {FRAMEWORK_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-fd-muted-foreground)]"
                  />
                </span>
              </label>

              {brandError ? (
                <p className="border border-[var(--color-fd-border)] bg-[var(--color-fd-secondary)] px-3 py-2 text-xs leading-5 text-[var(--color-fd-muted-foreground)]">
                  {brandError}
                </p>
              ) : null}
            </div>

            <DialogFooter className="mt-5 gap-2 sm:space-x-0">
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-none border border-[var(--color-fd-border)] bg-[var(--color-fd-secondary)] px-3 text-sm font-medium text-[var(--color-fd-muted-foreground)] transition-colors hover:bg-[var(--color-fd-accent)] hover:text-[var(--color-fd-accent-foreground)]"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-9 items-center justify-center rounded-none border border-[var(--color-fd-primary)] bg-[var(--color-fd-primary)] px-3 text-sm font-medium text-[var(--color-fd-primary-foreground)] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
              >
                {submitState === "done" ? <Check className="mr-1.5 size-3.5" /> : null}
                {submitLabel}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
