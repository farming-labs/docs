import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDocsAPI, createDocsMCPAPI } from "./docs-api.js";

async function parseMcpPayload<T>(response: Response): Promise<T> {
  const body = await response.text();

  try {
    return JSON.parse(body) as T;
  } catch {
    const dataLines = body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => line.slice("data: ".length).trim())
      .filter(Boolean);
    const payload = dataLines.at(-1);

    if (!payload) {
      throw new Error(`Expected MCP response payload, got: ${body}`);
    }

    return JSON.parse(payload) as T;
  }
}

describe("createDocsMCPAPI", () => {
  const tempDirs: string[] = [];
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns Next-compatible route handlers for the default MCP endpoint", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-mcp-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction

Welcome to the docs.
`,
    );

    const { POST } = createDocsMCPAPI({
      rootDir,
      entry: "docs",
      nav: { title: "Example Docs" },
      mcp: { enabled: true },
    });

    const response = await POST(
      new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-05",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-05",
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    const sessionId = response.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();

    const listPagesResponse = await POST(
      new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25",
          "mcp-session-id": sessionId!,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "list_pages",
            arguments: {},
          },
        }),
      }),
    );

    const payload = await parseMcpPayload<{
      result?: { content?: Array<{ text?: string }> };
    }>(listPagesResponse);

    expect(payload.result?.content?.[0]?.text).toContain("/docs");
  });

  it("ignores commented or quoted mcp flags when real config enables MCP", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-mcp-config-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction
`,
    );

    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `export default {
  note: "mcp: false",
  // mcp: false
  mcp: {
    enabled: true,
  },
};
`,
    );

    const { POST } = createDocsMCPAPI({
      rootDir,
      entry: "docs",
      nav: { title: "Example Docs" },
    });

    const response = await POST(
      new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBeTruthy();
  });

  it("ignores nested mcp booleans outside the root config property", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-mcp-nested-config-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction
`,
    );

    writeFileSync(
      join(rootDir, "docs.config.ts"),
      `import { defineDocs } from "@farming-labs/docs";

export default defineDocs({
  theme: someTheme({
    mcp: false,
  }),
  mcp: true,
});
`,
    );

    const { POST } = createDocsMCPAPI({
      rootDir,
      entry: "docs",
      nav: { title: "Example Docs" },
    });

    const response = await POST(
      new Request("http://localhost/api/docs/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: {
              name: "vitest",
              version: "1.0.0",
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBeTruthy();
  });

  it("uses the provided custom search adapter for GET search requests", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-search-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction

Welcome to the docs.
`,
    );

    process.chdir(rootDir);

    const { GET } = createDocsAPI({
      entry: "docs",
      search: {
        provider: "custom",
        adapter: {
          name: "custom",
          async search() {
            return [
              {
                id: "custom-1",
                url: "/docs/installation",
                content: "Custom search result",
                description: "Returned from the custom adapter",
                type: "page",
              },
            ];
          },
        },
      },
    });

    const response = await GET(new Request("http://localhost/api/docs?query=install"));
    const payload = (await response.json()) as Array<{
      id: string;
      content: string;
      description?: string;
    }>;

    expect(payload).toEqual([
      {
        id: "custom-1",
        url: "/docs/installation",
        content: "Custom search result",
        description: "Returned from the custom adapter",
        type: "page",
      },
    ]);
  });

  it("routes GET search through an MCP search provider with a relative endpoint", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "fumadocs-mcp-search-route-"));
    tempDirs.push(rootDir);

    mkdirSync(join(rootDir, "app", "docs"), { recursive: true });
    writeFileSync(
      join(rootDir, "app", "docs", "page.mdx"),
      `---
title: "Introduction"
---

# Introduction

Welcome to the docs.
`,
    );

    process.chdir(rootDir);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            result: {
              protocolVersion: "2025-11-25",
              capabilities: {},
              serverInfo: { name: "docs-mcp", version: "1.0.0" },
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "mcp-session-id": "session-1",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    results: [
                      {
                        id: "mcp-1",
                        url: "/docs/installation",
                        content: "Installation — Quickstart",
                        description: "Returned from MCP search_docs.",
                        type: "heading",
                        section: "Quickstart",
                      },
                    ],
                  }),
                },
              ],
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 })) as typeof fetch;

    try {
      const { GET } = createDocsAPI({
        entry: "docs",
        search: {
          provider: "mcp",
          endpoint: "/api/docs/mcp",
        },
      });

      const response = await GET(new Request("http://localhost/api/docs?query=quickstart"));
      const payload = (await response.json()) as Array<{
        id: string;
        url: string;
        content: string;
        description?: string;
        type: string;
        section?: string;
      }>;

      expect(payload).toEqual([
        {
          id: "mcp-1",
          url: "/docs/installation",
          content: "Installation — Quickstart",
          description: "Returned from MCP search_docs.",
          type: "heading",
          section: "Quickstart",
        },
      ]);

      expect(vi.mocked(globalThis.fetch).mock.calls[0]?.[0]).toBe("http://localhost/api/docs/mcp");
      expect(vi.mocked(globalThis.fetch).mock.calls[1]?.[0]).toBe("http://localhost/api/docs/mcp");
    } finally {
      globalThis.fetch = originalFetch;
      vi.restoreAllMocks();
    }
  });
});
