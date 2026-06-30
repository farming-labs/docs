"use client";

import { useEffect, type ReactNode } from "react";
import {
  createDocsCloudClient,
  type DocsCloudClientOptions,
  type DocsCloudClientRuntimeValue,
} from "../docs-cloud-client.js";
import type { DocsAnalyticsConfig, DocsAnalyticsEvent } from "../types.js";

type AnalyticsHandler = (event: DocsAnalyticsEvent) => void | Promise<void>;

interface DocsCloudAnalyticsWindow extends Window {
  __fdAnalytics__?: AnalyticsHandler;
  __fdAnalyticsQueue__?: DocsAnalyticsEvent[];
}

export interface DocsCloudAnalyticsProps extends DocsCloudClientOptions {
  analytics?: boolean | DocsAnalyticsConfig;
  children?: ReactNode;
}

export type DocsCloudAnalyticsOptions = Omit<DocsCloudAnalyticsProps, "children">;
export type DocsCloudAnalyticsProjectId = DocsCloudClientRuntimeValue;

function isDocsCloudAnalyticsDisabled(
  analytics: boolean | DocsAnalyticsConfig | undefined,
  enabled: DocsCloudClientOptions["enabled"],
): boolean {
  return Boolean(
    enabled === false ||
      analytics === false ||
      (analytics &&
        typeof analytics === "object" &&
        (analytics.enabled === false || analytics.cloud === false)),
  );
}

function callAnalyticsHandler(handler: AnalyticsHandler | undefined, event: DocsAnalyticsEvent) {
  if (!handler) return;

  try {
    void Promise.resolve(handler(event)).catch(() => {});
  } catch {
    // Analytics handlers must never break page interactions.
  }
}

export function DocsCloudAnalytics({
  analytics,
  children,
  projectId,
  endpoint,
  analyticsEndpoint,
  apiBaseUrl,
  analyticsKey,
  enabled,
  includeInputs,
  env,
  fetch,
  metadata,
  properties,
}: DocsCloudAnalyticsProps): ReactNode {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isDocsCloudAnalyticsDisabled(analytics, enabled)) return;

    const client = createDocsCloudClient({
      projectId,
      endpoint,
      analyticsEndpoint,
      apiBaseUrl,
      analyticsKey,
      enabled,
      includeInputs:
        includeInputs ?? (typeof analytics === "object" && analytics.includeInputs === true),
      env,
      fetch,
      metadata,
      properties,
    });

    if (!client.isConfigured()) return;

    const target = window as DocsCloudAnalyticsWindow;
    const previous = target.__fdAnalytics__;
    const handler = (event: DocsAnalyticsEvent) => {
      callAnalyticsHandler(previous, event);
      void client.trackEvent(event).catch(() => {});
    };

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
  }, [
    analytics,
    analyticsEndpoint,
    analyticsKey,
    apiBaseUrl,
    enabled,
    endpoint,
    env,
    fetch,
    includeInputs,
    metadata,
    projectId,
    properties,
  ]);

  return children ?? null;
}

export const DocsCloudAnalyticsProvider = DocsCloudAnalytics;
