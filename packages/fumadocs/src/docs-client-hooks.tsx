"use client";

import { useEffect } from "react";
import { emitDocsAnalyticsEvent } from "@farming-labs/docs";
import type {
  CodeBlockCopyData,
  DocsAnalyticsConfig,
  DocsAnalyticsEvent,
  DocsFeedbackData,
} from "@farming-labs/docs";

type CopyHandler = (data: CodeBlockCopyData) => void;
type FeedbackHandler = (data: DocsFeedbackData) => void | Promise<void>;
type AnalyticsHandler = (event: DocsAnalyticsEvent) => void | Promise<void>;

interface DocsWindowHooks extends Window {
  __fdOnCopyClick__?: CopyHandler;
  __fdOnFeedback__?: FeedbackHandler;
  __fdAnalytics__?: AnalyticsHandler;
  __fdAnalyticsQueue__?: DocsAnalyticsEvent[];
}

function useWindowHook<K extends keyof DocsWindowHooks>(key: K, handler: DocsWindowHooks[K]) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof handler !== "function") return;

    const target = window as DocsWindowHooks;
    const previous = target[key];
    target[key] = handler;

    return () => {
      if (target[key] === handler) {
        if (typeof previous === "function") {
          target[key] = previous;
        } else {
          delete target[key];
        }
      }
    };
  }, [handler, key]);
}

function useAnalyticsHook(analytics?: boolean | DocsAnalyticsConfig) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!analytics) return;

    const target = window as DocsWindowHooks;
    const handler = (event: DocsAnalyticsEvent) => {
      void emitDocsAnalyticsEvent(analytics, event);
    };
    const previous = target.__fdAnalytics__;
    target.__fdAnalytics__ = handler;

    const queued = target.__fdAnalyticsQueue__ ?? [];
    delete target.__fdAnalyticsQueue__;
    for (const event of queued) handler(event);

    return () => {
      if (target.__fdAnalytics__ === handler) {
        if (typeof previous === "function") {
          target.__fdAnalytics__ = previous;
        } else {
          delete target.__fdAnalytics__;
        }
      }
    };
  }, [analytics]);
}

function useCodeCopyAnalytics(analytics?: boolean | DocsAnalyticsConfig) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!analytics) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest?.("button")) return;

      const figure = target.closest("figure");
      if (!figure) return;

      const code = figure.querySelector("pre code");
      if (!code) return;

      const content = code.textContent ?? "";
      const url = window.location.href;
      const language =
        code.getAttribute("data-language") ?? figure.getAttribute("data-language") ?? undefined;
      const title =
        figure.querySelector("[data-title]")?.textContent?.trim() ??
        (figure.querySelector(".fd-codeblock-title-text") as HTMLElement)?.textContent?.trim() ??
        undefined;

      void emitDocsAnalyticsEvent(analytics, {
        type: "code_block_copy",
        source: "client",
        url,
        path: window.location.pathname,
        input: { content },
        properties: {
          title,
          language,
          contentLength: content.length,
        },
      });
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [analytics]);
}

export function DocsClientHooks({
  onCopyClick,
  onFeedback,
  analytics,
}: {
  onCopyClick?: CopyHandler;
  onFeedback?: FeedbackHandler;
  analytics?: boolean | DocsAnalyticsConfig;
}) {
  useWindowHook("__fdOnCopyClick__", onCopyClick);
  useWindowHook("__fdOnFeedback__", onFeedback);
  useAnalyticsHook(analytics);
  useCodeCopyAnalytics(analytics);

  return null;
}
