import {
  resolveDocsCloudAnalyticsOptions,
  sendDocsCloudAnalyticsEvent,
} from "./cloud-analytics.js";
import type { DocsAnalyticsConfig, DocsAnalyticsEvent, DocsAnalyticsEventInput } from "./types.js";

export interface ResolvedDocsAnalyticsConfig {
  enabled: boolean;
  console: false | "log" | "info" | "debug";
  includeInputs: boolean;
  onEvent?: (event: DocsAnalyticsEvent) => void | Promise<void>;
}

function composeAnalyticsHandlers(
  userOnEvent: DocsAnalyticsConfig["onEvent"] | undefined,
  cloudOnEvent: ((event: DocsAnalyticsEvent) => Promise<void>) | undefined,
): ((event: DocsAnalyticsEvent) => Promise<void>) | undefined {
  if (typeof userOnEvent !== "function" && !cloudOnEvent) {
    return undefined;
  }

  return async (event: DocsAnalyticsEvent) => {
    let userError: unknown;

    if (typeof userOnEvent === "function") {
      try {
        await userOnEvent(event);
      } catch (error) {
        userError = error;
      }
    }

    if (cloudOnEvent) {
      try {
        await cloudOnEvent(event);
      } catch {
        // Docs Cloud delivery should never interfere with user analytics hooks.
      }
    }

    if (typeof userError !== "undefined") {
      throw userError;
    }
  };
}

function resolveConsoleLevel(
  value: boolean | "log" | "info" | "debug" | undefined,
  hasEventHandler: boolean,
): false | "log" | "info" | "debug" {
  if (value === false) return false;
  if (value === true) return "info";
  if (value === "log" || value === "info" || value === "debug") return value;
  return hasEventHandler ? false : "info";
}

export function resolveDocsAnalyticsConfig(
  analytics?: boolean | DocsAnalyticsConfig,
): ResolvedDocsAnalyticsConfig {
  const cloudOptions = resolveDocsCloudAnalyticsOptions(analytics);
  const cloudOnEvent = cloudOptions
    ? async (event: DocsAnalyticsEvent) => {
        await sendDocsCloudAnalyticsEvent(cloudOptions, event);
      }
    : undefined;

  if (!analytics) {
    if (!cloudOnEvent) {
      return {
        enabled: false,
        console: false,
        includeInputs: false,
      };
    }

    return {
      enabled: true,
      console: false,
      includeInputs: false,
      onEvent: cloudOnEvent,
    };
  }

  if (analytics === true) {
    return {
      enabled: true,
      console: "info",
      includeInputs: false,
      onEvent: cloudOnEvent,
    };
  }

  const userOnEvent = analytics.onEvent;
  const hasEventHandler = typeof userOnEvent === "function" || Boolean(cloudOnEvent);
  const onEvent = composeAnalyticsHandlers(userOnEvent, cloudOnEvent);

  return {
    enabled: analytics.enabled !== false,
    console: resolveConsoleLevel(analytics.console, hasEventHandler),
    includeInputs: analytics.includeInputs === true,
    onEvent,
  };
}

function normalizeAnalyticsEvent(
  event: DocsAnalyticsEventInput,
  config: ResolvedDocsAnalyticsConfig,
): DocsAnalyticsEvent {
  const normalized: DocsAnalyticsEvent = {
    ...event,
    source: event.source ?? "server",
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  if (!config.includeInputs && normalized.input) {
    delete normalized.input;
  }

  return normalized;
}

export async function emitDocsAnalyticsEvent(
  analytics: boolean | DocsAnalyticsConfig | undefined,
  event: DocsAnalyticsEventInput,
): Promise<void> {
  const resolved = resolveDocsAnalyticsConfig(analytics);
  if (!resolved.enabled) return;

  const normalized = normalizeAnalyticsEvent(event, resolved);

  if (resolved.console) {
    const logger = console[resolved.console] ?? console.info;
    logger.call(console, "[farming-labs:analytics]", normalized);
  }

  if (!resolved.onEvent) return;

  try {
    await resolved.onEvent(normalized);
  } catch (error) {
    if (resolved.console !== false) {
      console.warn("[farming-labs:analytics] onEvent failed", error);
    }
  }
}
