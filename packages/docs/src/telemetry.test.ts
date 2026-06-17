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
  delete process.env.DOCS_TELEMETRY_INGEST_KEY;
  delete process.env.DOCS_SITE_URL;
  delete process.env.NEXT_PUBLIC_BASE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.SITE_URL;
  delete process.env.URL;
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
  delete process.env.NETLIFY;
  delete process.env.CONTEXT;
  delete process.env.CF_PAGES;
}

function resetTelemetryGlobals() {
  const globalValue = globalThis as typeof globalThis & {
    __farmingLabsDocsTelemetryProjectKeys__?: Map<string, number>;
  };

  delete globalValue.__farmingLabsDocsTelemetryProjectKeys__;
}

function telemetryEvent(overrides: Partial<DocsTelemetryEvent> = {}): DocsTelemetryEvent {
  return {
    type: "project_detected",
    timestamp: "2026-06-17T00:00:00.000Z",
    package: {
      name: "@farming-labs/docs",
      version: "0.2.25",
    },
    ...overrides,
  };
}

describe("telemetry", () => {
  beforeEach(() => {
    resetEnv();
    resetTelemetryGlobals();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    resetEnv();
    resetTelemetryGlobals();
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
          version: "0.2.25",
        },
      },
    });
  });

  it("uses configured site origin for project events", async () => {
    process.env.NODE_ENV = "production";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(null, { status: 202 });
    });
    vi.stubGlobal("fetch", fetchMock);

    emitDocsTelemetryProjectEvent(
      {
        entry: "docs",
        telemetry: {
          siteOrigin: "docs.example.com/path",
        },
      },
      {
        framework: "next",
        request: new Request("https://preview.example.com/api/docs"),
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      event: {
        site: {
          origin: "https://docs.example.com",
        },
      },
    });
  });

  it("sends an ingest key header when configured", async () => {
    process.env.NODE_ENV = "production";
    process.env.DOCS_TELEMETRY_INGEST_KEY = "secret-key";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(null, { status: 202 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await emitDocsTelemetryEvent(undefined, telemetryEvent());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init?.headers).toMatchObject({
      "content-type": "application/json",
      "x-docs-telemetry-key": "secret-key",
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

  it("bounds the project detected dedupe cache", async () => {
    process.env.NODE_ENV = "production";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(null, { status: 202 });
    });
    vi.stubGlobal("fetch", fetchMock);

    for (let index = 0; index < 300; index += 1) {
      emitDocsTelemetryProjectEvent(
        { entry: "docs" },
        { framework: "next", siteOrigin: `https://site-${index}.example.com` },
      );
    }

    emitDocsTelemetryProjectEvent(
      { entry: "docs" },
      { framework: "next", siteOrigin: "https://site-0.example.com" },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(301);
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
