import { describe, expect, it, vi } from "vitest";
import { createDocsCloudAskAIResponse, isDocsCloudAskAIProvider } from "./cloud-ask-ai.js";

async function readResponseText(response: Response): Promise<string> {
  return await response.text();
}

function createAskRequest(body: unknown, headers?: HeadersInit): Request {
  return new Request("https://docs.example.com/api/docs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("Docs Cloud Ask AI server helper", () => {
  it("detects the docs-cloud provider only when Ask AI is enabled", () => {
    expect(isDocsCloudAskAIProvider({ enabled: true, provider: "docs-cloud" })).toBe(true);
    expect(isDocsCloudAskAIProvider({ enabled: false, provider: "docs-cloud" })).toBe(false);
    expect(isDocsCloudAskAIProvider({ enabled: true })).toBe(false);
  });

  it("proxies questions with server env defaults and strips streamed relevant docs footer", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: "Use Bearer tokens." } }] })}\n\n`,
            ),
          );
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ choices: [{ delta: { content: "\n\n---\n\nRelevant docs\n/docs/auth" } }] })}\n\n`,
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream" },
      });
    });

    const response = await createDocsCloudAskAIResponse(
      createAskRequest({
        messages: [{ role: "user", content: "How do I auth?" }],
      }),
      {
        config: {
          ai: { enabled: true, provider: "docs-cloud" },
          cloud: { apiKey: { env: "DOCS_CLOUD_API_KEY" } },
        },
        env: {
          PUBLIC_DOCS_CLOUD_PROJECT_ID: "project_123",
          DOCS_CLOUD_API_KEY: "fl_key_test",
        },
        fetch: fetchMock as typeof fetch,
        publicBaseUrl: "https://docs.example.com",
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.farming-labs.dev/v1/projects/project_123/knowledge/ask");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer fl_key_test",
      "Content-Type": "application/json",
      "X-Docs-Cloud-Public-Base-Url": "https://docs.example.com",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      question: "How do I auth?",
      answerStyle: "public",
      publicBaseUrl: "https://docs.example.com",
      stream: true,
    });

    const text = await readResponseText(response);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(text).toContain("Use Bearer tokens.");
    expect(text).toContain("data: [DONE]");
    expect(text).not.toContain("Relevant docs");
  });

  it("returns a clean JSON answer when streaming is disabled", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        answer: "Deploy normally.\n\n---\n\nRelevant docs\n/docs/deploy",
        citations: ["/docs/deploy"],
      }),
    );

    const response = await createDocsCloudAskAIResponse(
      createAskRequest(
        {
          messages: [{ role: "user", content: "How do I deploy?" }],
          stream: false,
        },
        { Accept: "application/json" },
      ),
      {
        config: {
          ai: { enabled: true, provider: "docs-cloud", stream: false },
          cloud: { apiKey: { env: "DOCS_CLOUD_API_KEY" } },
        },
        env: {
          DOCS_CLOUD_PROJECT_ID: "project_server",
          DOCS_CLOUD_API_KEY: "fl_key_test",
        },
        fetch: fetchMock as typeof fetch,
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      answer: "Deploy normally.",
      citations: ["/docs/deploy"],
    });
  });

  it("strips heading-style relevant docs footers and standalone separators", async () => {
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const content of [
            "## Transport Details\n\n",
            "| Property | Value |\n|----------|-------|\n",
            "| Type | Streamable HTTP |\n\n---\n\n",
            "## Claude Code (CLI)\n\n```bash\nclaude mcp add scholarxiv\n```\n\n",
            "---\n\n## Relevant Docs\n\n- [MCP overview](/docs/mcp/connect)",
          ]) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`),
            );
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream" },
      });
    });

    const response = await createDocsCloudAskAIResponse(
      createAskRequest({
        messages: [{ role: "user", content: "How do I connect MCP?" }],
      }),
      {
        config: {
          ai: { enabled: true, provider: "docs-cloud" },
          cloud: { apiKey: { env: "DOCS_CLOUD_API_KEY" } },
        },
        env: {
          PUBLIC_DOCS_CLOUD_PROJECT_ID: "project_123",
          DOCS_CLOUD_API_KEY: "fl_key_test",
        },
        fetch: fetchMock as typeof fetch,
      },
    );

    const text = await readResponseText(response);
    expect(text).toContain("Transport Details");
    expect(text).toContain("|----------|-------|");
    expect(text).toContain("claude mcp add scholarxiv");
    expect(text).not.toContain("\n---\n");
    expect(text).not.toContain("Relevant Docs");
    expect(text).not.toContain("MCP overview");
  });

  it("reports missing Docs Cloud project configuration before calling upstream", async () => {
    const fetchMock = vi.fn();
    const response = await createDocsCloudAskAIResponse(
      createAskRequest({
        messages: [{ role: "user", content: "Can you answer?" }],
      }),
      {
        config: {
          ai: { enabled: true, provider: "docs-cloud" },
          cloud: { apiKey: { env: "DOCS_CLOUD_API_KEY" } },
        },
        env: { DOCS_CLOUD_API_KEY: "fl_key_test" },
        fetch: fetchMock as typeof fetch,
      },
    );

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining("Docs Cloud Ask AI is missing"),
    });
  });
});
