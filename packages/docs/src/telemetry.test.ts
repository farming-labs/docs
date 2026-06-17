import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  emitDocsTelemetryEvent,
  emitDocsTelemetryProjectEvent,
  getDocsTelemetryFeatures,
  inferDocsTelemetryAgentSurface,
  resolveDocsTelemetryConfig,
} from "./telemetry.js";
import type { DocsTelemetryEvent } from "./types.js";

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.DOCS_TELEMETRY;
  delete process.env.DOCS_TELEMETRY_DISABLED;
  delete process.env.DOCS_TELEMETRY_ENDPOINT;
  delete process.env.VERCEL_ENV;
  delete process.env.NETLIFY;
  delete process.env.CONTEXT;
  delete process.env.CF_PAGES;
}

function telemetryEvent(overrides: Partial<DocsTelemetryEvent> = {}): DocsTelemetryEvent {
  return {
    type: "project_detected",
    timestamp: "2026-06-17T00:00:00.000Z",
    package: {
      name: "@farming-labs/docs",
      version: "0.2.24",
    },
    ...overrides,
  };
}

describe("telemetry", () => {
  beforeEach(() => {
    resetEnv();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    resetEnv();
    vi.unstubAllGlobals();
  });

  it("enables telemetry by default in production", () => {
    process.env.NODE_ENV = "production";

    expect(resolveDocsTelemetryConfig()).toMatchObject({
      enabled: true,
      endpoint: "https://docs.farming-labs.dev/api/telemetry/events",
    });
  });

  it("lets env opt-out win over config", async () => {
    process.env.NODE_ENV = "production";
    process.env.DOCS_TELEMETRY = "false";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(null, { status: 202 });
    });
    vi.stubGlobal("fetch", fetchMock);

    expect(resolveDocsTelemetryConfig(true)).toMatchObject({ enabled: false });

    await emitDocsTelemetryEvent(true, telemetryEvent());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts telemetry events to the configured endpoint", async () => {
    process.env.NODE_ENV = "production";
    process.env.DOCS_TELEMETRY_ENDPOINT = "https://telemetry.example.com/events";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(null, { status: 202 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await emitDocsTelemetryEvent(undefined, telemetryEvent({ framework: "next" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://telemetry.example.com/events");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      event: {
        type: "project_detected",
        framework: "next",
        package: {
          name: "@farming-labs/docs",
          version: "0.2.24",
        },
      },
    });
  });

  it("deduplicates project detected events per runtime key", async () => {
    process.env.NODE_ENV = "production";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(null, { status: 202 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const request = new Request("https://example.com/api/docs");
    emitDocsTelemetryProjectEvent({ entry: "docs" }, { framework: "next", request });
    emitDocsTelemetryProjectEvent({ entry: "docs" }, { framework: "next", request });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("summarizes enabled docs features without raw user content", () => {
    expect(
      getDocsTelemetryFeatures({
        search: { provider: "typesense", collection: "docs", apiKey: "secret" } as any,
        ai: { enabled: true, apiKey: "secret" } as any,
        mcp: { enabled: true },
        pageActions: { copyMarkdown: true },
        feedback: { agent: { enabled: true } } as any,
        staticExport: true,
        apiReference: { enabled: true } as any,
        codeBlocks: { validate: true } as any,
      }),
    ).toMatchObject({
      search: true,
      ai: true,
      mcp: true,
      pageActions: true,
      agentFeedback: true,
      staticExport: true,
      apiReference: true,
      codeBlocksValidate: true,
    });
  });

  it("classifies agent-facing request surfaces", () => {
    expect(
      inferDocsTelemetryAgentSurface(new Request("https://example.com/api/docs?format=skill"), {
        entry: "docs",
      }),
    ).toBe("skill");

    expect(
      inferDocsTelemetryAgentSurface(new Request("https://example.com/docs/getting-started.md"), {
        entry: "docs",
      }),
    ).toBe("markdown");

    expect(
      inferDocsTelemetryAgentSurface(
        new Request("https://example.com/api/docs?feedback=agent", { method: "POST" }),
        {
          entry: "docs",
        },
      ),
    ).toBe("agent_feedback_submit");

    expect(
      inferDocsTelemetryAgentSurface(
        new Request("https://example.com/api/docs", { method: "POST" }),
        {
          entry: "docs",
        },
      ),
    ).toBe("ask_ai");
  });
});
