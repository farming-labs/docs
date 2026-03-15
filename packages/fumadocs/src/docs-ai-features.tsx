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
 * never needs to be modified — AI features work purely from `docs.config.ts`.
 */

import { useState, useEffect } from "react";
import { DocsSearchDialog, FloatingAIChat, AIModalDialog } from "./ai-search-dialog.js";
import { useWindowSearchParams } from "./client-location.js";
import { resolveClientLocale, withLangInUrl } from "./i18n.js";

interface DocsAIFeaturesProps {
  mode: "search" | "floating" | "sidebar-icon";
  api?: string;
  locale?: string;
  position?: "bottom-right" | "bottom-left" | "bottom-center";
  floatingStyle?: "panel" | "modal" | "popover" | "full-modal";
  triggerComponentHtml?: string;
  suggestedQuestions?: string[];
  aiLabel?: string;
  loaderVariant?: string;
  loadingComponentHtml?: string;
  models?: { id: string; label: string }[];
  defaultModelId?: string;
}

export function DocsAIFeatures({
  mode,
  api = "/api/docs",
  locale,
  position = "bottom-right",
  floatingStyle = "panel",
  triggerComponentHtml,
  suggestedQuestions,
  aiLabel,
  loaderVariant,
  loadingComponentHtml,
  models,
  defaultModelId,
}: DocsAIFeaturesProps) {
  const searchParams = useWindowSearchParams();
  const activeLocale = resolveClientLocale(searchParams, locale);
  const localizedApi = withLangInUrl(api, activeLocale);

  if (mode === "search") {
    return (
      <SearchModeAI
        api={localizedApi}
        suggestedQuestions={suggestedQuestions}
        aiLabel={aiLabel}
        loaderVariant={loaderVariant}
        loadingComponentHtml={loadingComponentHtml}
        models={models}
        defaultModelId={defaultModelId}
      />
    );
  }

  if (mode === "sidebar-icon") {
    return (
      <SidebarIconModeAI
        api={localizedApi}
        suggestedQuestions={suggestedQuestions}
        aiLabel={aiLabel}
        loaderVariant={loaderVariant}
        loadingComponentHtml={loadingComponentHtml}
        models={models}
        defaultModelId={defaultModelId}
      />
    );
  }

  return (
    <FloatingAIChat
      api={localizedApi}
      position={position}
      floatingStyle={floatingStyle}
      triggerComponentHtml={triggerComponentHtml}
      suggestedQuestions={suggestedQuestions}
      aiLabel={aiLabel}
      loaderVariant={loaderVariant as any}
      loadingComponentHtml={loadingComponentHtml}
      models={models}
      defaultModelId={defaultModelId}
    />
  );
}

function SearchModeAI({
  api,
  suggestedQuestions,
  aiLabel,
  loaderVariant,
  loadingComponentHtml,
  models,
  defaultModelId,
}: {
  api: string;
  suggestedQuestions?: string[];
  aiLabel?: string;
  loaderVariant?: string;
  loadingComponentHtml?: string;
  models?: { id: string; label: string }[];
  defaultModelId?: string;
}) {
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
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const button = target.closest("button");
      if (!button) return;
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

  return (
    <DocsSearchDialog
      open={open}
      onOpenChange={setOpen}
      api={api}
      suggestedQuestions={suggestedQuestions}
      aiLabel={aiLabel}
      loaderVariant={loaderVariant as any}
      loadingComponentHtml={loadingComponentHtml}
      models={models}
      defaultModelId={defaultModelId}
    />
  );
}

function SidebarIconModeAI({
  api,
  suggestedQuestions,
  aiLabel,
  loaderVariant,
  loadingComponentHtml,
  models,
  defaultModelId,
}: {
  api: string;
  suggestedQuestions?: string[];
  aiLabel?: string;
  loaderVariant?: string;
  loadingComponentHtml?: string;
  models?: { id: string; label: string }[];
  defaultModelId?: string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

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

  useEffect(() => {
    function onSearch() {
      setSearchOpen(true);
    }
    function onAI() {
      setAiOpen(true);
    }
    window.addEventListener("fd-open-search", onSearch);
    window.addEventListener("fd-open-ai", onAI);
    return () => {
      window.removeEventListener("fd-open-search", onSearch);
      window.removeEventListener("fd-open-ai", onAI);
    };
  }, []);

  return (
    <>
      <DocsSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        api={api}
        suggestedQuestions={suggestedQuestions}
        aiLabel={aiLabel}
        loaderVariant={loaderVariant as any}
        loadingComponentHtml={loadingComponentHtml}
        models={models}
        defaultModelId={defaultModelId}
      />
      <AIModalDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        api={api}
        suggestedQuestions={suggestedQuestions}
        aiLabel={aiLabel}
        loaderVariant={loaderVariant as any}
        loadingComponentHtml={loadingComponentHtml}
        models={models}
        defaultModelId={defaultModelId}
      />
    </>
  );
}
