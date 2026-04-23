import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { compactAgentDocs, parseAgentCompactArgs } from "./agent.js";

describe("parseAgentCompactArgs", () => {
  it("parses positional pages and repeated page flags", () => {
    expect(
      parseAgentCompactArgs([
        "installation",
        "configuration",
        "--page",
        "/docs/overview",
        "--page=quickstart",
      ]),
    ).toEqual({
      pages: ["installation", "configuration", "/docs/overview", "quickstart"],
    });
  });

  it("parses compact command options", () => {
    expect(
      parseAgentCompactArgs([
        "--all",
        "--api-key",
        "secret",
        "--api-key-env",
        "MY_CUSTOM_TTC_KEY",
        "--base-url=http://127.0.0.1:4321",
        "--model",
        "bear-1.1",
        "--aggressiveness",
        "0.6",
        "--max-output-tokens",
        "500",
        "--min-output-tokens=120",
        "--protect-json=false",
        "--dry-run",
      ]),
    ).toEqual({
      all: true,
      apiKey: "secret",
      apiKeyEnv: "MY_CUSTOM_TTC_KEY",
      baseUrl: "http://127.0.0.1:4321",
      model: "bear-1.1",
      aggressiveness: 0.6,
      maxOutputTokens: 500,
      minOutputTokens: 120,
      protectJson: false,
      dryRun: true,
      pages: [],
    });
  });
});

describe("compactAgentDocs", () => {
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };
  let tmpDir: string;
  let logs: string[] = [];

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "docs-agent-compact-"));
    logs = [];
    vi.spyOn(console, "log").mockImplementation((value?: unknown) => {
      logs.push(String(value ?? ""));
    });
  });

  afterEach(() => {
    process.chdir(originalCwd);
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates missing agent.md files from resolved docs markdown and overwrites existing ones", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default { entry: "docs", nav: { title: "Example Docs" } };`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "docs", "installation"), { recursive: true });
    mkdirSync(path.join(tmpDir, "app", "docs", "configuration"), { recursive: true });
    mkdirSync(path.join(tmpDir, "app", "docs", "existing"), { recursive: true });

    writeFileSync(
      path.join(tmpDir, "app", "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "Install the framework"
related:
  - /docs/configuration
---

# Installation

Run this:

\`\`\`bash
pnpm add @farming-labs/docs
\`\`\`
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "app", "docs", "configuration", "page.mdx"),
      `---
title: "Configuration"
description: "Tune the docs site"
---

# Configuration

Visible text.

<Agent>
Hidden agent notes should appear in the resolved markdown.
</Agent>
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "app", "docs", "existing", "page.mdx"),
      `---
title: "Existing"
description: "This page already has an agent file"
---

# Existing

Human page body.
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "app", "docs", "existing", "agent.md"),
      `Existing agent-only instructions.

Keep this focused.
`,
      "utf-8",
    );

    const seenInputs: string[] = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const payload = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as {
        input: string;
      };
      seenInputs.push(payload.input);

      let output = "COMPACTED";
      if (payload.input.includes("Existing agent-only instructions.")) {
        output = "Existing agent compacted";
      } else if (payload.input.includes("URL: /docs/installation")) {
        output = "Installation compacted";
      } else if (payload.input.includes("URL: /docs/configuration")) {
        output = "Configuration compacted";
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          output,
          original_input_tokens: 100,
          output_tokens: 25,
        }),
      );
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const { port } = server.address() as AddressInfo;

    try {
      process.chdir(tmpDir);

      await compactAgentDocs({
        apiKey: "test-key",
        baseUrl: `http://127.0.0.1:${port}`,
        pages: ["installation", "/docs/configuration", "existing"],
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }

    expect(readFileSync(path.join(tmpDir, "app", "docs", "installation", "agent.md"), "utf-8")).toBe(
      "Installation compacted\n",
    );
    expect(readFileSync(path.join(tmpDir, "app", "docs", "configuration", "agent.md"), "utf-8")).toBe(
      "Configuration compacted\n",
    );
    expect(readFileSync(path.join(tmpDir, "app", "docs", "existing", "agent.md"), "utf-8")).toBe(
      "Existing agent compacted\n",
    );

    expect(seenInputs).toHaveLength(3);
    expect(seenInputs[0]).toContain("URL: /docs/installation");
    expect(seenInputs[0]).toContain("Description: Install the framework");
    expect(seenInputs[0]).toContain("Related: /docs/configuration");
    expect(seenInputs[0]).toContain("<ttc_safe>```bash");

    expect(seenInputs[1]).toContain("URL: /docs/configuration");
    expect(seenInputs[1]).toContain("Hidden agent notes should appear in the resolved markdown.");

    expect(seenInputs[2]).toContain("Existing agent-only instructions.");
    expect(seenInputs[2]).not.toContain("URL: /docs/existing");

    expect(logs.some((line) => line.includes("Compaction complete: 3 pages processed (2 created, 1 overwritten)."))).toBe(true);
  });

  it("supports --all with dry-run without writing files", async () => {
    writeFileSync(path.join(tmpDir, "docs.config.ts"), `export default { entry: "docs" };`, "utf-8");
    mkdirSync(path.join(tmpDir, "app", "docs", "quickstart"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "app", "docs", "quickstart", "page.mdx"),
      `---
title: "Quickstart"
description: "Start here"
---

# Quickstart

Body.
`,
      "utf-8",
    );

    let requestCount = 0;
    const server = createServer(async (req, res) => {
      requestCount += 1;
      for await (const _chunk of req) {
        // drain request body
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          output: "Dry run compacted",
          original_input_tokens: 10,
          output_tokens: 5,
        }),
      );
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const { port } = server.address() as AddressInfo;

    try {
      process.chdir(tmpDir);

      await compactAgentDocs({
        apiKey: "test-key",
        baseUrl: `http://127.0.0.1:${port}`,
        all: true,
        dryRun: true,
      });
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }

    expect(requestCount).toBe(1);
    expect(path.join(tmpDir, "app", "docs", "quickstart", "agent.md")).not.toSatisfy(existsAtPath);
    expect(logs.some((line) => line.includes("Dry run complete: 1 page processed."))).toBe(true);
  });

  it("reads compact defaults including apiKeyEnv from docs.config.ts", async () => {
    process.env.CUSTOM_TTC_KEY = "config-key";

    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default defineDocs({
        entry: "docs",
        agent: {
          compact: {
            apiKeyEnv: "CUSTOM_TTC_KEY",
            baseUrl: "http://127.0.0.1:0",
            model: "bear-1.1",
            aggressiveness: 0.55,
            protectJson: false,
          },
        },
      });`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "docs", "installation"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "app", "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "Install it"
---

# Installation

Body.
`,
      "utf-8",
    );

    let seenAuthHeader = "";
    let seenPayload: Record<string, unknown> | undefined;
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      seenAuthHeader = String(req.headers.authorization ?? "");
      seenPayload = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as Record<string, unknown>;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          output: "Configured compacted output",
          original_input_tokens: 10,
          output_tokens: 5,
        }),
      );
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const { port } = server.address() as AddressInfo;

    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default defineDocs({
        entry: "docs",
        agent: {
          compact: {
            apiKeyEnv: "CUSTOM_TTC_KEY",
            baseUrl: "http://127.0.0.1:${port}",
            model: "bear-1.1",
            aggressiveness: 0.55,
            protectJson: false,
          },
        },
      });`,
      "utf-8",
    );

    try {
      process.chdir(tmpDir);
      await compactAgentDocs({
        pages: ["installation"],
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    expect(seenAuthHeader).toBe("Bearer config-key");
    expect(seenPayload).toMatchObject({
      model: "bear-1.1",
      compression_settings: {
        aggressiveness: 0.55,
        protect_json: false,
      },
    });
    expect(readFileSync(path.join(tmpDir, "app", "docs", "installation", "agent.md"), "utf-8")).toBe(
      "Configured compacted output\n",
    );
  });

  it("loads docs.config.tsx and resolves apiKey from process.env expressions", async () => {
    process.env.CUSTOM_TTC_KEY = "tsx-env-key";

    mkdirSync(path.join(tmpDir, "app", "docs", "installation"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "app", "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "Install it"
---

# Installation

Body.
`,
      "utf-8",
    );

    let seenAuthHeader = "";
    let seenPayload: Record<string, unknown> | undefined;
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      seenAuthHeader = String(req.headers.authorization ?? "");
      seenPayload = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as Record<string, unknown>;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          output: "TSX compacted output",
          original_input_tokens: 10,
          output_tokens: 5,
        }),
      );
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const { port } = server.address() as AddressInfo;

    writeFileSync(
      path.join(tmpDir, "docs.config.tsx"),
      `import { defineDocs } from "/Users/mac/oss/docs_/packages/docs/src/define-docs.ts";

export default defineDocs({
  entry: "docs",
  nav: {
    title: <span>Example Docs</span>,
  },
  agent: {
    compact: {
      apiKey: process.env.CUSTOM_TTC_KEY,
      baseUrl: "http://127.0.0.1:${port}",
      model: "bear-1.2",
      aggressiveness: 0.2,
    },
  },
});`,
      "utf-8",
    );

    try {
      process.chdir(tmpDir);
      await compactAgentDocs({
        pages: ["installation"],
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    expect(seenAuthHeader).toBe("Bearer tsx-env-key");
    expect(seenPayload).toMatchObject({
      model: "bear-1.2",
      compression_settings: {
        aggressiveness: 0.2,
      },
    });
    expect(readFileSync(path.join(tmpDir, "app", "docs", "installation", "agent.md"), "utf-8")).toBe(
      "TSX compacted output\n",
    );
  });
});

function existsAtPath(value: string): boolean {
  try {
    readFileSync(value, "utf-8");
    return true;
  } catch {
    return false;
  }
}
