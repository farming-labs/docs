import { describe, expect, it } from "vitest";
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
});
