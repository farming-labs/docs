const DEFAULT_DOCS_CLOUD_ANALYTICS_ENDPOINT = "https://api.farming-labs.dev/v1/analytics/events";
const VISITOR_ID_STORAGE_KEY = "fd:analytics:visitor-id";
const SESSION_ID_STORAGE_KEY = "fd:analytics:session-id";

function createAnalyticsId(prefix) {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;

  return `${prefix}_${random}`;
}

function normalizeValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isFalsyEnv(value) {
  return /^(0|false|no|off)$/i.test(normalizeValue(value) ?? "");
}

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function getRuntimeEnvValue(env, ...names) {
  for (const name of names) {
    const value = normalizeValue(env?.[name]) ?? normalizeValue(globalThis.process?.env?.[name]);
    if (value) return value;
  }

  return undefined;
}

function readStorage(storage, key) {
  try {
    return normalizeValue(storage?.getItem(key));
  } catch {
    return undefined;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Storage can be unavailable in private browsing or locked-down embeds.
  }
}

function getBrowserStorage(target, key) {
  try {
    return target[key];
  } catch {
    return undefined;
  }
}

function getOrCreateClientId({ cachedValue, create, storage, storageKey }) {
  const stored = readStorage(storage, storageKey);
  const value = stored ?? cachedValue ?? create();

  if (!stored) {
    writeStorage(storage, storageKey, value);
  }

  return value;
}

export function getSvelteDocsClientAnalyticsIdentity() {
  if (typeof window === "undefined") return null;

  const target = window;
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

function normalizeClientAnalyticsProperties(identity, properties) {
  const provided = properties ?? {};
  const visitorId =
    normalizeValue(provided.visitorId) ??
    normalizeValue(asRecord(provided.visitor).id) ??
    normalizeValue(provided.anonymousId) ??
    identity?.visitorId;
  const sessionId =
    normalizeValue(provided.sessionId) ??
    normalizeValue(asRecord(provided.session).id) ??
    identity?.sessionId;
  const merged = {
    ...identity,
    ...provided,
  };

  return {
    ...merged,
    ...(visitorId
      ? {
          anonymousId: normalizeValue(provided.anonymousId) ?? visitorId,
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

export function emitSvelteDocsClientAnalyticsEvent(event) {
  if (typeof window === "undefined") return;

  const identity = getSvelteDocsClientAnalyticsIdentity();
  const normalized = {
    ...event,
    source: "client",
    path: event.path ?? window.location.pathname,
    url: event.url ?? window.location.href,
    referrer: event.referrer ?? (document.referrer || undefined),
    timestamp: new Date().toISOString(),
    properties: normalizeClientAnalyticsProperties(identity, event.properties),
  };

  const target = window;
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

function resolveConsoleLevel(analytics, hasEventHandler) {
  if (!analytics || analytics === true) return analytics === true ? "info" : false;
  if (analytics.console === false) return false;
  if (analytics.console === true) return "info";
  if (["log", "info", "debug"].includes(analytics.console)) return analytics.console;
  return hasEventHandler ? false : "info";
}

function resolveSvelteDocsAnalyticsOptions({ analytics, env }) {
  if (
    analytics === false ||
    (analytics && typeof analytics === "object" && analytics.enabled === false)
  ) {
    return null;
  }

  const enabled = getRuntimeEnvValue(
    env,
    "PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED",
    "NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED",
    "DOCS_CLOUD_ANALYTICS_ENABLED",
  );

  if (isFalsyEnv(enabled)) {
    return null;
  }

  const projectId = getRuntimeEnvValue(
    env,
    "PUBLIC_DOCS_CLOUD_PROJECT_ID",
    "NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID",
    "DOCS_CLOUD_PROJECT_ID",
  );
  const endpoint =
    getRuntimeEnvValue(
      env,
      "PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT",
      "NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT",
      "DOCS_CLOUD_ANALYTICS_ENDPOINT",
    ) ?? DEFAULT_DOCS_CLOUD_ANALYTICS_ENDPOINT;
  const userOnEvent =
    analytics && typeof analytics === "object" && typeof analytics.onEvent === "function"
      ? analytics.onEvent
      : undefined;
  const hasEventHandler = typeof userOnEvent === "function" || Boolean(projectId);

  if (!analytics && !hasEventHandler) {
    return null;
  }

  return {
    console: resolveConsoleLevel(analytics, hasEventHandler),
    endpoint,
    includeInputs: analytics && typeof analytics === "object" && analytics.includeInputs === true,
    onEvent: userOnEvent,
    projectId,
  };
}

function normalizeAnalyticsEvent(event, options) {
  const normalized = {
    ...event,
    source: event.source ?? "client",
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  if (!options.includeInputs && normalized.input) {
    delete normalized.input;
  }

  return normalized;
}

async function sendDocsCloudAnalyticsEvent(options, event) {
  if (typeof fetch !== "function") return;
  if (!options.projectId) return;

  try {
    await fetch(options.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectId: options.projectId,
        event,
      }),
      credentials: "omit",
      keepalive: true,
    });
  } catch {
    // Docs Cloud delivery should never interfere with the docs runtime.
  }
}

async function emitAnalyticsEvent(options, event) {
  const normalized = normalizeAnalyticsEvent(event, options);

  if (options.console) {
    const logger = console[options.console] ?? console.info;
    logger.call(console, "[@farming-labs/docs:analytics]", normalized);
  }

  if (typeof options.onEvent === "function") {
    try {
      await options.onEvent(normalized);
    } catch {
      // User analytics hooks should never break the docs UI.
    }
  }

  await sendDocsCloudAnalyticsEvent(options, normalized);
}

export function installSvelteDocsAnalytics({ analytics, env } = {}) {
  if (typeof window === "undefined") return () => {};

  const options = resolveSvelteDocsAnalyticsOptions({ analytics, env });
  if (!options) return () => {};

  const target = window;
  const previous = target.__fdAnalytics__;
  const handler = (event) => {
    void emitAnalyticsEvent(options, event);
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
}
