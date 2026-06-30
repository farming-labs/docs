import { describe, expect, it, vi } from "vitest";
import { createDocsCloudRouteHandler, createDocsCloudServer } from "./docs-cloud-server.js";

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("Docs Cloud server SDK", () => {
  it("tracks analytics events with lazily resolved SDK credentials", async () => {
    let projectId = "project_123";
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }),
    );
    const docsCloud = createDocsCloudServer({
      projectId: () => projectId,
      apiKey: () => "fl_key_test",
      apiBaseUrl: "https://cloud.example.com",
      fetch: fetchMock as typeof fetch,
      metadata: { framework: "next" },
    });

    const tracked = await docsCloud.trackEvent(
      {
        type: "search",
        path: "/docs/install",
        input: { query: "deploy" },
      },
      {
        request: new Request("https://docs.example.com/docs/install", {
          headers: { "user-agent": "test-agent" },
        }),
        properties: { fixture: true },
      },
    );

    expect(tracked).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body));

    expect(url).toBe("https://cloud.example.com/v1/analytics/events");
    expect(init?.method).toBe("POST");
    expect(headers.get("authorization")).toBe("Bearer fl_key_test");
    expect(body).toMatchObject({
      projectId: "project_123",
      event: {
        type: "search",
        source: "server",
        path: "/docs/install",
        input: { query: "deploy" },
        metadata: { framework: "next" },
        properties: {
          userAgent: "test-agent",
          fixture: true,
        },
      },
    });

    projectId = "";
    await expect(docsCloud.trackEvent({ type: "search", path: "/docs/install" })).resolves.toBe(
      false,
    );
  });

  it("exposes GET and POST handlers for analytics payloads", async () => {
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }),
    );
    const docsCloud = createDocsCloudServer({
      projectId: "project_route",
      apiKey: "fl_key_route",
      apiBaseUrl: "https://cloud.example.com",
      fetch: fetchMock as typeof fetch,
    });
    const handlers = createDocsCloudRouteHandler(docsCloud);

    const configResponse = await handlers.GET(new Request("https://docs.example.com/api/cloud"));
    await expect(configResponse.json()).resolves.toMatchObject({
      ok: true,
      projectId: "project_route",
      configured: {
        projectId: true,
        apiKey: true,
      },
      features: {
        analytics: true,
        askAI: true,
      },
    });

    const response = await handlers.POST(
      jsonRequest("https://docs.example.com/api/cloud", {
        type: "feedback",
        path: "/docs/install",
        properties: { rating: "up" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, type: "analytics" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("proxies Ask AI requests through the same route handler and records SDK analytics", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, _init?: RequestInit) => {
      const href = String(url);

      if (href.includes("/knowledge/ask")) {
        return Response.json({
          answer: "Deploy normally.\n\n---\n\nRelevant docs\n/docs/deploy",
        });
      }

      return new Response(null, { status: 204 });
    });
    const docsCloud = createDocsCloudServer({
      projectId: "project_ai",
      apiKey: "fl_key_ai",
      apiBaseUrl: "https://cloud.example.com",
      fetch: fetchMock as typeof fetch,
    });

    const response = await docsCloud.handleRequest(
      jsonRequest("https://docs.example.com/api/cloud?action=ask-ai", {
        messages: [{ role: "user", content: "How do I deploy?" }],
        stream: false,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      answer: "Deploy normally.",
    });

    const knowledgeCall = fetchMock.mock.calls.find(([url]) =>
      String(url).includes("/knowledge/ask"),
    );
    const analyticsCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("/analytics/events"),
    );

    expect(knowledgeCall).toBeDefined();
    expect(analyticsCalls.length).toBeGreaterThan(0);
    expect(knowledgeCall?.[0]).toBe(
      "https://cloud.example.com/v1/projects/project_ai/knowledge/ask",
    );
    expect(new Headers(knowledgeCall?.[1]?.headers).get("Authorization")).toBe("Bearer fl_key_ai");
  });
});
