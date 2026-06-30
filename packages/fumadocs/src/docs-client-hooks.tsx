"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { emitDocsAnalyticsEvent, resolveDocsAnalyticsConfig } from "@farming-labs/docs";
import { createDocsCloudClient, type DocsCloudClientOptions } from "@farming-labs/docs/client";
import { emitClientAnalyticsEvent } from "./client-analytics.js";
import type {
  CodeBlockCopyData,
  DocsAnalyticsConfig,
  DocsAnalyticsEvent,
  DocsAskAIActionData,
  DocsAskAIFeedbackData,
  DocsFeedbackData,
} from "@farming-labs/docs";

type CopyHandler = (data: CodeBlockCopyData) => void;
type FeedbackHandler = (data: DocsFeedbackData) => void | Promise<void>;
type AIActionHandler = (data: DocsAskAIActionData) => void | Promise<void>;
type AIFeedbackHandler = (data: DocsAskAIFeedbackData) => void | Promise<void>;
type AnalyticsHandler = (event: DocsAnalyticsEvent) => void | Promise<void>;
export type DocsCloudClientConfig = boolean | DocsCloudClientOptions;

interface DocsWindowHooks extends Window {
  __fdOnCopyClick__?: CopyHandler;
  __fdOnFeedback__?: FeedbackHandler;
  __fdOnAIActions__?: AIActionHandler;
  __fdOnAIFeedback__?: AIFeedbackHandler;
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

function isAnalyticsDisabled(analytics?: boolean | DocsAnalyticsConfig) {
  return (
    analytics === false ||
    (analytics && typeof analytics === "object" && analytics.enabled === false)
  );
}

function isDocsCloudAnalyticsDisabled(
  analytics: boolean | DocsAnalyticsConfig | undefined,
  docsCloud: DocsCloudClientConfig | undefined,
) {
  return (
    docsCloud === false ||
    analytics === false ||
    (analytics &&
      typeof analytics === "object" &&
      (analytics.enabled === false || analytics.cloud === false))
  );
}

function resolveDocsCloudClient(
  analytics: boolean | DocsAnalyticsConfig | undefined,
  docsCloud: DocsCloudClientConfig | undefined,
) {
  if (isDocsCloudAnalyticsDisabled(analytics, docsCloud)) return undefined;
  if (docsCloud === undefined) return undefined;
  if (docsCloud === false) return undefined;

  const client = createDocsCloudClient(docsCloud === true ? undefined : docsCloud);
  return client.isConfigured() ? client : undefined;
}

function withoutDocsCloudAnalytics(
  analytics: boolean | DocsAnalyticsConfig | undefined,
  hasDocsCloudClient: boolean,
): boolean | DocsAnalyticsConfig | undefined {
  if (!hasDocsCloudClient) return analytics;
  if (analytics === true) return { enabled: true, console: true, cloud: false };
  if (analytics && typeof analytics === "object") return { ...analytics, cloud: false };
  return false;
}

export function isDocsClientAnalyticsEnabled(
  analytics?: boolean | DocsAnalyticsConfig,
  docsCloud?: DocsCloudClientConfig,
) {
  if (isAnalyticsDisabled(analytics)) return false;

  const docsCloudClient = resolveDocsCloudClient(analytics, docsCloud);
  const localAnalytics = withoutDocsCloudAnalytics(analytics, Boolean(docsCloudClient));

  return resolveDocsAnalyticsConfig(localAnalytics).enabled || Boolean(docsCloudClient);
}

function useAnalyticsHook(
  analytics?: boolean | DocsAnalyticsConfig,
  docsCloud?: DocsCloudClientConfig,
) {
  const docsCloudClient = useMemo(
    () => resolveDocsCloudClient(analytics, docsCloud),
    [analytics, docsCloud],
  );
  const localAnalytics = useMemo(
    () => withoutDocsCloudAnalytics(analytics, Boolean(docsCloudClient)),
    [analytics, docsCloudClient],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const localAnalyticsEnabled = resolveDocsAnalyticsConfig(localAnalytics).enabled;
    if (!localAnalyticsEnabled && !docsCloudClient) return;

    const target = window as DocsWindowHooks;
    const handler = (event: DocsAnalyticsEvent) => {
      if (localAnalyticsEnabled) {
        void emitDocsAnalyticsEvent(localAnalytics, event);
      }

      if (docsCloudClient) {
        void docsCloudClient.trackEvent(event);
      }
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
  }, [docsCloudClient, localAnalytics]);
}

function useCodeCopyAnalytics(
  analytics?: boolean | DocsAnalyticsConfig,
  docsCloud?: DocsCloudClientConfig,
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isDocsClientAnalyticsEnabled(analytics, docsCloud)) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest?.("button")) return;

      const figure = target.closest("figure");
      if (!figure) return;

      const code = figure.querySelector("pre code");
      if (!code) return;

      const content = code.textContent ?? "";
      const language =
        code.getAttribute("data-language") ?? figure.getAttribute("data-language") ?? undefined;
      const title =
        figure.querySelector("[data-title]")?.textContent?.trim() ??
        (figure.querySelector(".fd-codeblock-title-text") as HTMLElement)?.textContent?.trim() ??
        undefined;

      emitClientAnalyticsEvent({
        type: "code_block_copy",
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
  }, [analytics, docsCloud]);
}

export function DocsClientHooks({
  onCopyClick,
  onFeedback,
  onAIActions,
  onAIFeedback,
  analytics,
  docsCloud,
}: {
  onCopyClick?: CopyHandler;
  onFeedback?: FeedbackHandler;
  onAIActions?: AIActionHandler;
  onAIFeedback?: AIFeedbackHandler;
  analytics?: boolean | DocsAnalyticsConfig;
  docsCloud?: DocsCloudClientConfig;
}) {
  useWindowHook("__fdOnCopyClick__", onCopyClick);
  useWindowHook("__fdOnFeedback__", onFeedback);
  useWindowHook("__fdOnAIActions__", onAIActions);
  useWindowHook("__fdOnAIFeedback__", onAIFeedback);
  useAnalyticsHook(analytics, docsCloud);
  useCodeCopyAnalytics(analytics, docsCloud);

  return null;
}

export function DocsCloudAnalyticsProvider({
  analytics,
  children,
  ...docsCloudOptions
}: DocsCloudClientOptions & {
  analytics?: boolean | DocsAnalyticsConfig;
  children?: ReactNode;
}) {
  useAnalyticsHook(analytics, docsCloudOptions);

  return children;
}
