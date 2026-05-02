import { afterEach, describe, expect, it, vi } from "vitest";
import type { DocsAnalyticsEvent, DocsAnalyticsEventType } from "@farming-labs/docs";
import { emitClientAnalyticsEvent } from "./client-analytics.js";

const CLIENT_ANALYTICS_EVENTS = [
  "page_view",
  "search_open",
  "search_close",
  "search_query",
  "search_result_click",
  "search_error",
  "ai_open",
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
] as const satisfies readonly DocsAnalyticsEventType[];

interface TestWindow extends Partial<Window> {
  __fdAnalytics__?: (event: DocsAnalyticsEvent) => void | Promise<void>;
  __fdAnalyticsQueue__?: DocsAnalyticsEvent[];
}

function installClientGlobals(onEvent?: (event: DocsAnalyticsEvent) => void) {
  const dispatched: Array<{ type: string; detail?: DocsAnalyticsEvent }> = [];
  const target: TestWindow = {
    location: {
      href: "https://docs.example.com/docs/installation?tab=next",
      pathname: "/docs/installation",
    } as Location,
    dispatchEvent(event) {
      dispatched.push(event as CustomEvent<DocsAnalyticsEvent>);
      return true;
    },
  };

  if (onEvent) target.__fdAnalytics__ = onEvent;

  vi.stubGlobal("window", target);
  vi.stubGlobal("document", {
    referrer: "https://example.com/search",
  });

  return { dispatched, target };
}

describe("client analytics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emits every client analytics event through the browser hook and DOM event", () => {
    const events: DocsAnalyticsEvent[] = [];
    const { dispatched } = installClientGlobals((event) => events.push(event));

    for (const type of CLIENT_ANALYTICS_EVENTS) {
      emitClientAnalyticsEvent({
        type,
        properties: {
          index: events.length,
        },
      });
    }

    expect(events.map((event) => event.type)).toEqual(CLIENT_ANALYTICS_EVENTS);
    expect(events).toHaveLength(CLIENT_ANALYTICS_EVENTS.length);
    expect(events[0]).toMatchObject({
      source: "client",
      url: "https://docs.example.com/docs/installation?tab=next",
      path: "/docs/installation",
      referrer: "https://example.com/search",
    });
    expect(dispatched.map((event) => event.type)).toEqual(
      Array(CLIENT_ANALYTICS_EVENTS.length).fill("fd:analytics"),
    );
    expect(dispatched[0]?.detail?.type).toBe("page_view");
  });

  it("queues client events until the analytics hook is installed", () => {
    const { target } = installClientGlobals();

    emitClientAnalyticsEvent({
      type: "page_view",
      properties: {
        title: "Installation",
      },
    });

    expect(target.__fdAnalyticsQueue__).toHaveLength(1);
    expect(target.__fdAnalyticsQueue__?.[0]).toMatchObject({
      type: "page_view",
      source: "client",
      path: "/docs/installation",
    });
  });
});
