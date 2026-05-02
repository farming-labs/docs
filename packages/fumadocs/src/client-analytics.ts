"use client";

import type { DocsAnalyticsEvent, DocsAnalyticsEventInput } from "@farming-labs/docs";

interface DocsAnalyticsWindow extends Window {
  __fdAnalytics__?: (event: DocsAnalyticsEvent) => void | Promise<void>;
  __fdAnalyticsQueue__?: DocsAnalyticsEvent[];
}

export function emitClientAnalyticsEvent(event: DocsAnalyticsEventInput) {
  if (typeof window === "undefined") return;

  const normalized: DocsAnalyticsEvent = {
    ...event,
    source: "client",
    path: window.location.pathname,
    url: window.location.href,
    referrer: document.referrer || undefined,
    timestamp: new Date().toISOString(),
  };

  const target = window as DocsAnalyticsWindow;
  try {
    if (target.__fdAnalytics__) {
      Promise.resolve(target.__fdAnalytics__(normalized)).catch(() => {
        // Analytics should never break the docs UI.
      });
    } else {
      target.__fdAnalyticsQueue__ = [...(target.__fdAnalyticsQueue__ ?? []), normalized].slice(-50);
    }

    window.dispatchEvent(new CustomEvent("fd:analytics", { detail: normalized }));
  } catch {
    // Analytics should never break the docs UI.
  }
}
