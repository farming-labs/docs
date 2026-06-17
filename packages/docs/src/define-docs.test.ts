import { describe, expect, it, vi } from "vitest";
import { defineDocs } from "./define-docs.js";

describe("defineDocs", () => {
  it("preserves feedback and copy callbacks in the normalized config", () => {
    const onCopyClick = vi.fn();
    const onFeedback = vi.fn();
    const onAgentFeedback = vi.fn();
    const actionsComponent = { type: "div" };

    const config = defineDocs({
      entry: "docs",
      onCopyClick,
      feedback: {
        enabled: true,
        onFeedback,
        agent: {
          enabled: true,
          route: "/api/docs/agent/feedback",
          onFeedback: onAgentFeedback,
        },
      },
      search: {
        provider: "typesense",
        baseUrl: "https://typesense.example.com",
        collection: "docs",
        apiKey: "search-key",
      },
      mcp: {
        enabled: true,
        route: "/api/docs/mcp",
      },
      changelog: {
        enabled: true,
        path: "changelog",
        description: "Latest changes",
        actionsComponent,
      },
    });

    expect(config.onCopyClick).toBe(onCopyClick);
    expect(config.feedback).toEqual({
      enabled: true,
      onFeedback,
      agent: {
        enabled: true,
        route: "/api/docs/agent/feedback",
        onFeedback: onAgentFeedback,
      },
    });
    expect(config.search).toEqual({
      provider: "typesense",
      baseUrl: "https://typesense.example.com",
      collection: "docs",
      apiKey: "search-key",
    });
    expect(config.mcp).toEqual({
      enabled: true,
      route: "/api/docs/mcp",
    });
    expect(config.changelog).toEqual({
      enabled: true,
      path: "changelog",
      description: "Latest changes",
      actionsComponent,
    });
  });

  it("keeps analytics and observability as separate event stream configs", () => {
    const onAnalyticsEvent = vi.fn();
    const onObservabilityEvent = vi.fn();

    const config = defineDocs({
      entry: "docs",
      analytics: {
        console: "info",
        onEvent: onAnalyticsEvent,
      },
      telemetry: {
        enabled: true,
        endpoint: "https://telemetry.example.com/events",
      },
      observability: {
        console: "debug",
        onEvent: onObservabilityEvent,
      },
    });

    expect(config.analytics).toEqual({
      console: "info",
      onEvent: onAnalyticsEvent,
    });
    expect(config.telemetry).toEqual({
      enabled: true,
      endpoint: "https://telemetry.example.com/events",
    });
    expect(config.observability).toEqual({
      console: "debug",
      onEvent: onObservabilityEvent,
    });
    expect(config.analytics).not.toBe(config.observability);
  });

  it("preserves cloud settings for CLI docs.json materialization", () => {
    const config = defineDocs({
      entry: "docs",
      cloud: {
        apiKey: {
          env: "CUSTOM_DOCS_CLOUD_KEY",
        },
        preview: {
          enabled: true,
        },
        publish: {
          mode: "draft-pr",
          baseBranch: "main",
        },
      },
    });

    expect(config.cloud).toEqual({
      apiKey: {
        env: "CUSTOM_DOCS_CLOUD_KEY",
      },
      preview: {
        enabled: true,
      },
      publish: {
        mode: "draft-pr",
        baseBranch: "main",
      },
    });
  });
});
