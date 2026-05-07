import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocsCloudAnalytics } from "./cloud-analytics.js";
import {
  DOCS_AGENT_TRACE_EVENT_TYPES,
  emitDocsAgentTraceEvent,
  emitDocsAnalyticsEvent,
  emitDocsObservabilityEvent,
  resolveDocsAnalyticsConfig,
  resolveDocsObservabilityConfig,
} from "./analytics.js";
import type {
  DocsAnalyticsEvent,
  DocsAnalyticsEventType,
  DocsObservabilityEvent,
} from "./types.js";

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
  "ai_feedback",
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
    const events: DocsObservabilityEvent[] = [];

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

  it("emits every agent trace event type with measurable fields", async () => {
    const events: DocsObservabilityEvent[] = [];

    for (const [index, type] of DOCS_AGENT_TRACE_EVENT_TYPES.entries()) {
      await emitDocsAgentTraceEvent(
        {
          console: false,
          onEvent(event) {
            events.push(event);
          },
        },
        {
          type,
          source: type.startsWith("tool.") ? "mcp" : "server",
          traceId: "run_test",
          spanId: `span_${index}`,
          parentSpanId: index === 0 ? undefined : "run_test",
          name: type,
          startedAt: "2026-01-01T00:00:00.000Z",
          endedAt: "2026-01-01T00:00:00.010Z",
          durationMs: index,
          status:
            type.endsWith(".error") || type === "error"
              ? "error"
              : type === "retry"
                ? "retry"
                : type === "timeout"
                  ? "timeout"
                  : "success",
          inputPreview: { kind: "test" },
          outputPreview: { index },
          metadata: { test: true },
        },
      );
    }

    expect(events.map((event) => event.type)).toEqual(DOCS_AGENT_TRACE_EVENT_TYPES);
    expect(events).toHaveLength(DOCS_AGENT_TRACE_EVENT_TYPES.length);
    expect(events.every((event) => event.traceId === "run_test")).toBe(true);
    expect(events.every((event) => typeof event.spanId === "string")).toBe(true);
    expect(events.every((event) => typeof event.name === "string")).toBe(true);
    expect(events.every((event) => typeof event.durationMs === "number")).toBe(true);
    expect(events.every((event) => typeof event.startedAt === "string")).toBe(true);
    expect(events.every((event) => typeof event.endedAt === "string")).toBe(true);
    expect(events.every((event) => typeof event.status === "string")).toBe(true);
    expect(events[0]).toMatchObject({
      type: "run.start",
      source: "server",
      inputPreview: { kind: "test" },
      outputPreview: { index: 0 },
      metadata: { test: true },
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

  it("resolves observability defaults separately from analytics", () => {
    expect(resolveDocsObservabilityConfig()).toMatchObject({
      enabled: false,
      console: false,
      includeInputs: false,
    });
    expect(resolveDocsObservabilityConfig(true)).toMatchObject({
      enabled: true,
      console: "info",
      includeInputs: false,
    });
    expect(resolveDocsObservabilityConfig({ console: false, includeInputs: true })).toMatchObject({
      enabled: true,
      console: false,
      includeInputs: true,
    });
  });

  it("logs console analytics with the package-scoped prefix", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);

    await emitDocsAnalyticsEvent(
      {
        console: "debug",
      },
      {
        type: "page_view",
        source: "client",
        path: "/docs",
      },
    );

    expect(debug).toHaveBeenCalledWith(
      "[@farming-labs/docs:analytics]",
      expect.objectContaining({
        type: "page_view",
        path: "/docs",
      }),
    );
  });

  it("logs console observability with a separate package-scoped prefix", async () => {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);

    await emitDocsObservabilityEvent(
      {
        console: "debug",
      },
      {
        type: "tool.call",
        source: "mcp",
        name: "read_page",
      },
    );

    expect(debug).toHaveBeenCalledWith(
      "[@farming-labs/docs:observability]",
      expect.objectContaining({
        type: "tool.call",
        name: "read_page",
      }),
    );
  });

  it("posts Docs Cloud analytics events to the configured ingestion endpoint", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 202 }),
    );
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
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 202 }),
    );
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

    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 202 }),
    );
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

    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(async () => {
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

    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 202 }),
    );
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

    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 202 }),
    );
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
