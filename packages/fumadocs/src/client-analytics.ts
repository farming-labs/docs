"use client";

import type { DocsAnalyticsEvent, DocsAnalyticsEventInput } from "@farming-labs/docs";

interface DocsAnalyticsWindow extends Window {
  __fdAnalytics__?: (event: DocsAnalyticsEvent) => void | Promise<void>;
  __fdAnalyticsQueue__?: DocsAnalyticsEvent[];
  __fdAnalyticsSessionId__?: string;
  __fdAnalyticsVisitorId__?: string;
}

const VISITOR_ID_STORAGE_KEY = "fd:analytics:visitor-id";
const SESSION_ID_STORAGE_KEY = "fd:analytics:session-id";

function createAnalyticsId(prefix: "session" | "visitor") {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

  return `${prefix}_${random}`;
}

function readStorage(storage: Storage | undefined, key: string) {
  try {
    const value = storage?.getItem(key)?.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function writeStorage(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing or locked-down embeds.
  }
}

function getBrowserStorage(target: DocsAnalyticsWindow, key: "localStorage" | "sessionStorage") {
  try {
    return target[key];
  } catch {
    return undefined;
  }
}

function getOrCreateClientId({
  cachedValue,
  create,
  storage,
  storageKey,
}: {
  cachedValue: string | undefined;
  create: () => string;
  storage: Storage | undefined;
  storageKey: string;
}) {
  const stored = readStorage(storage, storageKey);
  const value = stored ?? cachedValue ?? create();

  if (!stored) {
    writeStorage(storage, storageKey, value);
  }

  return value;
}

export function getDocsClientAnalyticsIdentity() {
  if (typeof window === "undefined") return null;

  const target = window as DocsAnalyticsWindow;
  const visitorId = getOrCreateClientId({
    cachedValue: target.__fdAnalyticsVisitorId__,
    create: () => createAnalyticsId("visitor"),
    storage: getBrowserStorage(target, "localStorage"),
    storageKey: VISITOR_ID_STORAGE_KEY,
  });
  const sessionId = getOrCreateClientId({
    cachedValue: target.__fdAnalyticsSessionId__,
    create: () => createAnalyticsId("session"),
    storage: getBrowserStorage(target, "sessionStorage"),
    storageKey: SESSION_ID_STORAGE_KEY,
  });

  target.__fdAnalyticsVisitorId__ = visitorId;
  target.__fdAnalyticsSessionId__ = sessionId;

  return {
    anonymousId: visitorId,
    visitorId,
    sessionId,
    visitor: {
      id: visitorId,
    },
    session: {
      id: sessionId,
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeClientAnalyticsProperties(
  identity: ReturnType<typeof getDocsClientAnalyticsIdentity>,
  properties: DocsAnalyticsEventInput["properties"],
) {
  const provided = properties ?? {};
  const visitorId =
    asString(provided.visitorId) ??
    asString(asRecord(provided.visitor).id) ??
    asString(provided.anonymousId) ??
    identity?.visitorId;
  const sessionId =
    asString(provided.sessionId) ?? asString(asRecord(provided.session).id) ?? identity?.sessionId;
  const merged = {
    ...(identity ?? {}),
    ...provided,
  };

  return {
    ...merged,
    ...(visitorId
      ? {
          anonymousId: asString(provided.anonymousId) ?? visitorId,
          visitorId,
          visitor: {
            ...asRecord(merged.visitor),
            id: visitorId,
          },
        }
      : {}),
    ...(sessionId
      ? {
          sessionId,
          session: {
            ...asRecord(merged.session),
            id: sessionId,
          },
        }
      : {}),
  };
}

export function emitClientAnalyticsEvent(event: DocsAnalyticsEventInput) {
  if (typeof window === "undefined") return;

  const identity = getDocsClientAnalyticsIdentity();
  const normalized: DocsAnalyticsEvent = {
    ...event,
    source: "client",
    path: event.path ?? window.location.pathname,
    url: event.url ?? window.location.href,
    referrer: event.referrer ?? (document.referrer || undefined),
    timestamp: new Date().toISOString(),
    properties: normalizeClientAnalyticsProperties(identity, event.properties),
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
