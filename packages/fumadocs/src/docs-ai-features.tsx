"use client";

/**
 * Client component injected by `createDocsLayout` when `ai` is configured.
 *
 * Handles multiple modes:
 * - "search": Intercepts Cmd+K / Ctrl+K and opens the custom search dialog
 *   with Search + Ask AI tabs (prevents fumadocs' default dialog from opening).
 * - "floating": Renders the floating chat widget with configurable position,
 *   style, and trigger component.
 * - "sidebar-icon": Injects an AI trigger icon button next to the search bar
 *   in the sidebar header area (Mintlify-style).
 *
 * This component is rendered inside the docs layout so the user's root layout
 * never needs to be modified — AI features work purely from `docs.config.tsx`.
 */

import { useState, useEffect, type ReactNode, cloneElement, isValidElement } from "react";
import { DocsSearchDialog, FloatingAIChat, AIModalDialog } from "./ai-search-dialog.js";

interface DocsAIFeaturesProps {
  mode: "search" | "floating" | "sidebar-icon";
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  floatingStyle?: "panel" | "modal" | "popover" | "full-modal";
  triggerComponentHtml?: string;
  suggestedQuestions?: string[];
  aiLabel?: string;
  loadingComponentHtml?: string;
}

export function DocsAIFeatures({
  mode,
  position = "bottom-right",
  floatingStyle = "panel",
  triggerComponentHtml,
  suggestedQuestions,
  aiLabel,
  loadingComponentHtml,
}: DocsAIFeaturesProps) {
  if (mode === "search") {
    return <SearchModeAI suggestedQuestions={suggestedQuestions} aiLabel={aiLabel} loadingComponentHtml={loadingComponentHtml} />;
  }

  if (mode === "sidebar-icon") {
    return <SidebarIconModeAI suggestedQuestions={suggestedQuestions} aiLabel={aiLabel} loadingComponentHtml={loadingComponentHtml} />;
  }

  return (
    <FloatingAIChat
      api="/api/docs"
      position={position}
      floatingStyle={floatingStyle}
      triggerComponentHtml={triggerComponentHtml}
      suggestedQuestions={suggestedQuestions}
      aiLabel={aiLabel}
      loadingComponentHtml={loadingComponentHtml}
    />
  );
}

/**
 * Search mode: intercepts Cmd+K / Ctrl+K globally and opens the
 * custom search dialog (with Search + Ask AI tabs) instead of
 * fumadocs' built-in search dialog.
 */
function SearchModeAI({ suggestedQuestions, aiLabel, loadingComponentHtml }: { suggestedQuestions?: string[]; aiLabel?: string; loadingComponentHtml?: string }) {
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

  return <DocsSearchDialog open={open} onOpenChange={setOpen} api="/api/docs" suggestedQuestions={suggestedQuestions} aiLabel={aiLabel} loadingComponentHtml={loadingComponentHtml} />;
}

/**
 * Sidebar-icon mode: injects a sparkle icon button next to the search bar
 * in the sidebar header. The search button opens the Cmd+K search dialog,
 * and the AI sparkle button opens a pure AI modal (no search tabs).
 */
function SidebarIconModeAI({ suggestedQuestions, aiLabel, loadingComponentHtml }: { suggestedQuestions?: string[]; aiLabel?: string; loadingComponentHtml?: string }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  // Intercept Cmd+K / Ctrl+K for search
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setSearchOpen(true);
      }
    }
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  // Listen for custom events from SidebarSearchWithAI component
  useEffect(() => {
    function onSearch() { setSearchOpen(true); }
    function onAI() { setAiOpen(true); }
    window.addEventListener("fd-open-search", onSearch);
    window.addEventListener("fd-open-ai", onAI);
    return () => {
      window.removeEventListener("fd-open-search", onSearch);
      window.removeEventListener("fd-open-ai", onAI);
    };
  }, []);

  return (
    <>
      <DocsSearchDialog open={searchOpen} onOpenChange={setSearchOpen} api="/api/docs" suggestedQuestions={suggestedQuestions} aiLabel={aiLabel} loadingComponentHtml={loadingComponentHtml} />
      <AIModalDialog open={aiOpen} onOpenChange={setAiOpen} api="/api/docs" suggestedQuestions={suggestedQuestions} aiLabel={aiLabel} loadingComponentHtml={loadingComponentHtml} />
    </>
  );
}
