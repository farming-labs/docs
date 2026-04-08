import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createDocsMCPAPI } from "./docs-api.js";

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

  afterEach(() => {
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
});
