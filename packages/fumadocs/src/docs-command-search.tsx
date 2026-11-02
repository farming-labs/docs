"use client";

import { lazy, useCallback, useEffect, useState } from "react";
import { DeferredDialog } from "./deferred-dialog.js";
import { useWindowSearchParams } from "./client-location.js";
import { resolveClientLocale } from "./i18n.js";
import { emitClientAnalyticsEvent } from "./client-analytics.js";

const CommandSearchDialog = lazy(() =>
  import("./command-search-dialog.js").then((module) => ({ default: module.CommandSearchDialog })),
);

export function DocsCommandSearch({
  api = "/api/docs",
  locale,
  analytics = false,
}: {
  api?: string;
  locale?: string;
  analytics?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const searchParams = useWindowSearchParams();
  const activeLocale = resolveClientLocale(searchParams, locale);

  const setOpenWithAnalytics = useCallback(
    (nextOpen: boolean, trigger: string) => {
      setOpen(nextOpen);
      if (!analytics) return;
      emitClientAnalyticsEvent({
        type: nextOpen ? "search_open" : "search_close",
        locale: activeLocale,
        properties: {
          trigger,
          mode: "command",
        },
      });
    },
    [activeLocale, analytics],
  );

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setOpenWithAnalytics(true, "keyboard");
      }
    }
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [setOpenWithAnalytics]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const button = target.closest("button");
      if (!button) return;
      const text = button.textContent || "";
      const ariaLabel = (button.getAttribute("aria-label") || "").toLowerCase();
      const isSearchButton =
        (text.includes("Search") && (text.includes("⌘") || text.includes("K"))) ||
        ariaLabel.includes("search") ||
        text === "Open Search";
      if (isSearchButton) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setOpenWithAnalytics(true, "button");
      }
    }
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [setOpenWithAnalytics]);

  return (
    <DeferredDialog open={open} onOpenChange={setOpenWithAnalytics}>
      <CommandSearchDialog
        api={api}
        locale={locale}
        analytics={analytics}
        open={open}
        setOpen={setOpen}
        setOpenWithAnalytics={setOpenWithAnalytics}
      />
    </DeferredDialog>
  );
}
