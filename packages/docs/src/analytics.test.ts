import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocsCloudAnalytics } from "./cloud-analytics.js";
import { emitDocsAnalyticsEvent, resolveDocsAnalyticsConfig } from "./analytics.js";
import type { DocsAnalyticsEvent, DocsAnalyticsEventType } from "./types.js";

const ALL_ANALYTICS_EVENTS = [
  "page_view",
  "search_open",
  "search_close",
  "search_query",
  "search_result_click",
  "search_error",
  "ai_open",
  "ai_close",
  "ai_question",
  "ai_response",
  "ai_error",
  "ai_clear",
  "page_action_copy_markdown",
  "page_action_open_docs_menu",
  "page_action_open_docs",
  "code_block_copy",
  "feedback_select",
  "feedback_submit",
  "feedback_error",
  "agent_read",
  "agent_spec_request",
  "agent_feedback_schema",
  "agent_feedback_submit",
  "agent_feedback_error",
  "markdown_request",
  "llms_request",
  "skill_request",
  "api_search",
  "api_ai_request",
  "api_ai_response",
  "api_ai_error",
  "mcp_request",
  "mcp_tool",
] as const satisfies readonly DocsAnalyticsEventType[];

describe("analytics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED;
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_KEY;
  });

  it("emits every built-in analytics event type through the shared hook", async () => {
    const events: DocsAnalyticsEvent[] = [];

    for (const type of ALL_ANALYTICS_EVENTS) {
      await emitDocsAnalyticsEvent(
        {
          console: false,
          includeInputs: true,
          onEvent(event) {
            events.push(event);
          },
        },
        {
          type,
          source: type.startsWith("mcp_") ? "mcp" : "server",
          input: {
            query: "install",
            question: "How do I install this?",
            feedbackComment: "Useful",
            content: "pnpm install",
          },
          properties: {
            index: events.length,
          },
        },
      );
    }

    expect(events.map((event) => event.type)).toEqual(ALL_ANALYTICS_EVENTS);
    expect(events).toHaveLength(ALL_ANALYTICS_EVENTS.length);
    expect(events.every((event) => typeof event.timestamp === "string")).toBe(true);
    expect(events[0]?.input).toEqual({
      query: "install",
      question: "How do I install this?",
      feedbackComment: "Useful",
      content: "pnpm install",
    });
  });

  it("omits raw input fields unless includeInputs is enabled", async () => {
    const events: DocsAnalyticsEvent[] = [];

    await emitDocsAnalyticsEvent(
      {
        console: false,
        onEvent(event) {
          events.push(event);
        },
      },
      {
        type: "api_search",
        source: "server",
        input: {
          query: "private query",
        },
        properties: {
          queryLength: 13,
        },
      },
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.input).toBeUndefined();
    expect(events[0]?.properties).toEqual({ queryLength: 13 });
  });

  it("resolves analytics defaults for booleans and object configs", () => {
    expect(resolveDocsAnalyticsConfig()).toMatchObject({
      enabled: false,
      console: false,
      includeInputs: false,
    });
    expect(resolveDocsAnalyticsConfig(true)).toMatchObject({
      enabled: true,
      console: "info",
      includeInputs: false,
    });
    expect(resolveDocsAnalyticsConfig({ console: false, includeInputs: true })).toMatchObject({
      enabled: true,
      console: false,
      includeInputs: true,
    });
  });

  it("posts Docs Cloud analytics events to the configured ingestion endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await emitDocsAnalyticsEvent(
      createDocsCloudAnalytics({
        projectId: "project_123",
        console: false,
        includeInputs: true,
      }),
      {
        type: "page_view",
        source: "client",
        path: "/docs",
        properties: {
          title: "Home",
        },
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://docs.farming-labs.dev/api/analytics/events",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        headers: {
          "content-type": "application/json",
        },
      }),
    );

    const request = fetchMock.mock.calls[0]?.[1];
    expect(typeof request?.body).toBe("string");
    expect(JSON.parse(String(request?.body))).toMatchObject({
      projectId: "project_123",
      event: {
        type: "page_view",
        source: "client",
        path: "/docs",
      },
    });
  });

  it("no-ops Docs Cloud analytics events when endpoint or project id is missing", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    await emitDocsAnalyticsEvent(
      createDocsCloudAnalytics({
        console: false,
      }),
      {
        type: "page_view",
        source: "client",
      },
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("internally wraps analytics with the Docs Cloud sink when cloud env is enabled", async () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED = "true";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_env";

    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const seen: DocsAnalyticsEvent[] = [];

    await emitDocsAnalyticsEvent(
      {
        console: false,
        onEvent(event) {
          seen.push(event);
        },
      },
      {
        type: "feedback_submit",
        source: "client",
        path: "/docs",
        properties: {
          value: "positive",
        },
      },
    );

    expect(seen).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://docs.farming-labs.dev/api/analytics/events",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });

  it("preserves the user onEvent callback when Docs Cloud delivery fails", async () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED = "true";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_env_failure";

    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);

    const seen: DocsAnalyticsEvent[] = [];

    await emitDocsAnalyticsEvent(
      {
        console: false,
        onEvent(event) {
          seen.push(event);
        },
      },
      {
        type: "page_view",
        source: "client",
        path: "/docs",
      },
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]?.path).toBe("/docs");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still sends Docs Cloud analytics when the user onEvent throws", async () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED = "true";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_env_user_throw";

    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const userOnEvent = vi.fn(async () => {
      throw new Error("user callback failed");
    });

    await emitDocsAnalyticsEvent(
      {
        console: false,
        onEvent: userOnEvent,
      },
      {
        type: "feedback_submit",
        source: "client",
        path: "/docs",
      },
    );

    expect(userOnEvent).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("enables analytics by default when Docs Cloud env is enabled and config is omitted", async () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED = "true";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_default";

    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const resolved = resolveDocsAnalyticsConfig();
    expect(resolved.enabled).toBe(true);

    await emitDocsAnalyticsEvent(undefined, {
      type: "page_view",
      source: "client",
      path: "/docs",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
