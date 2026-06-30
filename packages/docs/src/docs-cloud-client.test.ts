import { afterEach, describe, expect, it, vi } from "vitest";
import { createDocsCloudClient, trackDocsCloudEvent } from "./docs-cloud-client.js";

interface TestWindow extends Partial<Window> {
  location: Location;
}

function installBrowserGlobals() {
  vi.stubGlobal("window", {
    location: {
      href: "https://docs.example.com/docs/install?tab=next",
      pathname: "/docs/install",
    } as Location,
  } satisfies TestWindow);
  vi.stubGlobal("document", {
    referrer: "https://example.com/search",
  });
}

describe("Docs Cloud client SDK", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID;
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT;
    delete process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED;
  });

  it("tracks client analytics with explicit project configuration", async () => {
    installBrowserGlobals();

    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 202 }),
    );
    const docsCloud = createDocsCloudClient({
      projectId: "project_client",
      apiBaseUrl: "https://cloud.example.com",
      fetch: fetchMock as typeof fetch,
      metadata: { framework: "next" },
      properties: { surface: "layout" },
    });

    await expect(
      docsCloud.trackEvent({
        type: "page_view",
        properties: {
          title: "Install",
        },
      }),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));

    expect(url).toBe("https://cloud.example.com/v1/analytics/events");
    expect(init?.method).toBe("POST");
    expect(body).toMatchObject({
      projectId: "project_client",
      event: {
        type: "page_view",
        source: "client",
        path: "/docs/install",
        url: "https://docs.example.com/docs/install?tab=next",
        referrer: "https://example.com/search",
        metadata: {
          framework: "next",
        },
        properties: {
          surface: "layout",
          title: "Install",
        },
      },
    });
  });

  it("resolves public env defaults and exposes a convenience tracker", async () => {
    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_env";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENDPOINT = "https://cloud.example.com/events";

    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 202 }),
    );

    await expect(
      trackDocsCloudEvent(
        { type: "search", path: "/docs/install" },
        { fetch: fetchMock as typeof fetch },
      ),
    ).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://cloud.example.com/events",
      expect.objectContaining({
        body: expect.stringContaining('"projectId":"project_env"'),
      }),
    );
  });

  it("no-ops when the client project id is missing or analytics is disabled", async () => {
    const fetchMock = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 202 }),
    );

    await expect(
      createDocsCloudClient({ fetch: fetchMock as typeof fetch }).trackEvent({
        type: "page_view",
      }),
    ).resolves.toBe(false);

    process.env.NEXT_PUBLIC_DOCS_CLOUD_PROJECT_ID = "project_disabled";
    process.env.NEXT_PUBLIC_DOCS_CLOUD_ANALYTICS_ENABLED = "false";

    await expect(
      createDocsCloudClient({ fetch: fetchMock as typeof fetch }).trackEvent({
        type: "page_view",
      }),
    ).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
