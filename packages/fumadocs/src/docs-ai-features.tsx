"use client";

/**
 * Client component injected by `createDocsLayout` when `ai` is configured.
 *
 * Handles both modes:
 * - "search": Intercepts Cmd+K / Ctrl+K and opens the custom search dialog
 *   with Search + Ask AI tabs (prevents fumadocs' default dialog from opening).
 * - "floating": Renders the floating chat widget with configurable position,
 *   style, and trigger component.
 *
 * This component is rendered inside the docs layout so the user's root layout
 * never needs to be modified — AI features work purely from `docs.config.tsx`.
 */

import { useState, useEffect, type ReactNode, cloneElement, isValidElement } from "react";
import { DocsSearchDialog, FloatingAIChat } from "./ai-search-dialog.js";

interface DocsAIFeaturesProps {
  mode: "search" | "floating";
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  floatingStyle?: "panel" | "modal" | "popover";
  triggerComponentHtml?: string;
}

export function DocsAIFeatures({
  mode,
  position = "bottom-right",
  floatingStyle = "panel",
  triggerComponentHtml,
}: DocsAIFeaturesProps) {
  if (mode === "search") {
    return <SearchModeAI />;
  }

  return (
    <FloatingAIChat
      api="/api/docs"
      position={position}
      floatingStyle={floatingStyle}
      triggerComponentHtml={triggerComponentHtml}
    />
  );
}

/**
 * Search mode: intercepts Cmd+K / Ctrl+K globally and opens the
 * custom search dialog (with Search + Ask AI tabs) instead of
 * fumadocs' built-in search dialog.
 */
function SearchModeAI() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setOpen(true);
      }
    }
    // Use capture phase so we intercept before fumadocs' handler
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  // Also intercept sidebar search button clicks
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const button = target.closest("button");
      if (!button) return;
      // Fumadocs search button has text "Search" and ⌘ K badge
      const text = button.textContent || "";
      if (text.includes("Search") && (text.includes("⌘") || text.includes("K"))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setOpen(true);
      }
    }
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return <DocsSearchDialog open={open} onOpenChange={setOpen} api="/api/docs" />;
}
