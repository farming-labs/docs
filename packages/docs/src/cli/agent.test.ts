import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { compactAgentDocs, parseAgentCompactArgs } from "./agent.js";
import { parseGeneratedAgentDocument } from "../agent-provenance.js";

describe("parseAgentCompactArgs", () => {
  it("treats -h as help instead of a positional page", () => {
    expect(parseAgentCompactArgs(["-h"])).toEqual({
      help: true,
      pages: [],
    });
  });

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

  it("parses separated boolean values for --protect-json", () => {
    expect(parseAgentCompactArgs(["--protect-json", "false"])).toEqual({
      protectJson: false,
      pages: [],
    });
  });

  it("parses stale compaction flags", () => {
    expect(parseAgentCompactArgs(["--stale", "--include-missing", "installation"])).toEqual({
      stale: true,
      includeMissing: true,
      pages: ["installation"],
    });
  });

  it("parses changed compaction flags", () => {
    expect(parseAgentCompactArgs(["--changed", "installation"])).toEqual({
      changed: true,
      pages: ["installation"],
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
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "installation", "agent.md"),
      "Installation compacted",
      "resolved-page",
    );
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "configuration", "agent.md"),
      "Configuration compacted",
      "resolved-page",
    );
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "existing", "agent.md"),
      "Existing agent compacted",
      "agent-md",
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

    expect(
      logs.some((line) =>
        line.includes("Compaction complete: 3 pages processed (2 created, 1 overwritten)."),
      ),
    ).toBe(true);
  });

  it("uses per-page agent.tokenBudget for pages with and without agent.md", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default defineDocs({
        entry: "docs",
        agent: {
          compact: {
            maxOutputTokens: 900,
            minOutputTokens: 500,
          },
        },
      });`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "docs", "installation"), { recursive: true });
    mkdirSync(path.join(tmpDir, "app", "docs", "existing"), { recursive: true });
    mkdirSync(path.join(tmpDir, "app", "docs", "quickstart"), { recursive: true });

    writeFileSync(
      path.join(tmpDir, "app", "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "Install the framework"
agent:
  tokenBudget: 777
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
      path.join(tmpDir, "app", "docs", "existing", "page.mdx"),
      `---
title: "Existing"
description: "This page already has an agent file"
agent:
  tokenBudget: 333
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

    writeFileSync(
      path.join(tmpDir, "app", "docs", "quickstart", "page.mdx"),
      `---
title: "Quickstart"
description: "No page override"
---

# Quickstart

Body.
`,
      "utf-8",
    );

    const seenRequests: Array<{
      input: string;
      maxOutputTokens?: number;
      minOutputTokens?: number;
    }> = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const payload = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as {
        input: string;
        compression_settings?: {
          max_output_tokens?: number;
          min_output_tokens?: number;
        };
      };

      seenRequests.push({
        input: payload.input,
        maxOutputTokens: payload.compression_settings?.max_output_tokens,
        minOutputTokens: payload.compression_settings?.min_output_tokens,
      });

      let output = "Compacted output";
      if (payload.input.includes("URL: /docs/installation")) {
        output = "Installation compacted";
      } else if (payload.input.includes("Existing agent-only instructions.")) {
        output = "Existing compacted";
      } else if (payload.input.includes("URL: /docs/quickstart")) {
        output = "Quickstart compacted";
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          output,
          original_input_tokens: 120,
          output_tokens: 35,
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
        maxOutputTokens: 1200,
        pages: ["installation", "existing", "quickstart"],
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    expect(seenRequests).toHaveLength(3);
    expect(seenRequests[0]).toMatchObject({
      maxOutputTokens: 777,
      minOutputTokens: 500,
    });
    expect(seenRequests[0].input).toContain("URL: /docs/installation");

    expect(seenRequests[1]).toMatchObject({
      maxOutputTokens: 333,
      minOutputTokens: 333,
    });
    expect(seenRequests[1].input).toContain("Existing agent-only instructions.");
    expect(seenRequests[1].input).not.toContain("URL: /docs/existing");

    expect(seenRequests[2]).toMatchObject({
      maxOutputTokens: 1200,
      minOutputTokens: 500,
    });
    expect(seenRequests[2].input).toContain("URL: /docs/quickstart");

    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "installation", "agent.md"),
      "Installation compacted",
      "resolved-page",
    );
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "existing", "agent.md"),
      "Existing compacted",
      "agent-md",
    );
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "quickstart", "agent.md"),
      "Quickstart compacted",
      "resolved-page",
    );
  });

  it("supports --all with dry-run without writing files", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default { entry: "docs" };`,
      "utf-8",
    );
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
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
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
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "installation", "agent.md"),
      "Configured compacted output",
      "resolved-page",
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
      `export default {
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
};`,
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
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "installation", "agent.md"),
      "TSX compacted output",
      "resolved-page",
    );
  });

  it("loads TOKEN_COMPANY_API_KEY from project .env files", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default defineDocs({
        entry: "docs",
        agent: {
          compact: {
            apiKeyEnv: "TOKEN_COMPANY_API_KEY",
            baseUrl: "http://127.0.0.1:0",
            model: "bear-1.2",
          },
        },
      });`,
      "utf-8",
    );

    writeFileSync(path.join(tmpDir, ".env"), `TOKEN_COMPANY_API_KEY=dotenv-key\n`, "utf-8");

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
    const server = createServer(async (req, res) => {
      for await (const _chunk of req) {
        // drain request body
      }

      seenAuthHeader = String(req.headers.authorization ?? "");

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          output: "Dotenv compacted output",
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
            apiKeyEnv: "TOKEN_COMPANY_API_KEY",
            baseUrl: "http://127.0.0.1:${port}",
            model: "bear-1.2",
          },
        },
      });`,
      "utf-8",
    );

    try {
      process.chdir(tmpDir);
      delete process.env.TOKEN_COMPANY_API_KEY;
      await compactAgentDocs({
        pages: ["installation"],
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    expect(seenAuthHeader).toBe("Bearer dotenv-key");
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "installation", "agent.md"),
      "Dotenv compacted output",
      "resolved-page",
    );
  });

  it("strips ttc_safe tags from compressed output before writing agent.md", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default { entry: "docs" };`,
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

    const server = createServer(async (_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          output: "<ttc_safe>Clean output</ttc_safe>",
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
        pages: ["installation"],
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "installation", "agent.md"),
      "Clean output",
      "resolved-page",
    );
  });

  it("rejects --include-missing without --stale", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default { entry: "docs" };`,
      "utf-8",
    );
    mkdirSync(path.join(tmpDir, "app", "docs"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "app", "docs", "page.mdx"),
      `---
title: "Overview"
description: "Docs home"
---

# Overview
`,
      "utf-8",
    );

    process.chdir(tmpDir);

    await expect(
      compactAgentDocs({
        apiKey: "test-key",
        includeMissing: true,
        pages: ["."],
      }),
    ).rejects.toThrow("Use --include-missing together with --stale.");
  });

  it("refreshes stale generated agent.md files with --stale", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default {
  entry: "docs",
  agent: {
    compact: {
      maxOutputTokens: 800,
    },
  },
};`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "docs", "installation"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "app", "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "Install the framework"
---

# Installation

First body.
`,
      "utf-8",
    );

    const seenInputs: string[] = [];
    let generation = 0;
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const payload = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { input: string };
      seenInputs.push(payload.input);
      generation += 1;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          output: generation === 1 ? "Initial compacted" : "Refreshed compacted",
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
        pages: ["installation"],
      });

      writeFileSync(
        path.join(tmpDir, "app", "docs", "installation", "page.mdx"),
        `---
title: "Installation"
description: "Install the framework"
---

# Installation

Updated body.
`,
        "utf-8",
      );

      await compactAgentDocs({
        apiKey: "test-key",
        baseUrl: `http://127.0.0.1:${port}`,
        stale: true,
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    expect(seenInputs).toHaveLength(2);
    expect(seenInputs[0]).toContain("First body.");
    expect(seenInputs[1]).toContain("Updated body.");
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "installation", "agent.md"),
      "Refreshed compacted",
      "resolved-page",
    );
    expect(
      logs.some((line) =>
        line.includes("Compaction complete: 1 page processed (0 created, 1 overwritten)."),
      ),
    ).toBe(true);
  });

  it("skips modified generated agent.md files during --stale runs", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default { entry: "docs" };`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "docs", "installation"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "app", "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "Install the framework"
---

# Installation

Body.
`,
      "utf-8",
    );

    let requestCount = 0;
    const server = createServer(async (_req, res) => {
      requestCount += 1;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          output: "Initial compacted",
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
        pages: ["installation"],
      });

      const raw = readFileSync(
        path.join(tmpDir, "app", "docs", "installation", "agent.md"),
        "utf-8",
      );
      writeFileSync(
        path.join(tmpDir, "app", "docs", "installation", "agent.md"),
        raw.replace("Initial compacted", "Manual edit"),
        "utf-8",
      );

      await compactAgentDocs({
        apiKey: "test-key",
        baseUrl: `http://127.0.0.1:${port}`,
        stale: true,
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    expect(requestCount).toBe(1);
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "installation", "agent.md"),
      "Manual edit",
      "resolved-page",
    );
    expect(
      logs.some((line) => line.includes("No stale generated agent.md files needed updates.")),
    ).toBe(true);
    expect(
      logs.some((line) =>
        line.includes("Skipped 0 fresh, 1 modified, 0 unknown, and 0 missing page"),
      ),
    ).toBe(true);
  });

  it("uses --stale --include-missing for token-budget pages and explicit missing pages", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default { entry: "docs" };`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "docs", "budgeted"), { recursive: true });
    mkdirSync(path.join(tmpDir, "app", "docs", "plain"), { recursive: true });

    writeFileSync(
      path.join(tmpDir, "app", "docs", "budgeted", "page.mdx"),
      `---
title: "Budgeted"
description: "Has a page token budget"
agent:
  tokenBudget: 420
---

# Budgeted

Body.
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "app", "docs", "plain", "page.mdx"),
      `---
title: "Plain"
description: "No page token budget"
---

# Plain

Body.
`,
      "utf-8",
    );

    const seenInputs: string[] = [];
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const payload = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { input: string };
      seenInputs.push(payload.input);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          output: payload.input.includes("/docs/budgeted")
            ? "Budgeted compacted"
            : "Plain compacted",
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
        stale: true,
        includeMissing: true,
      });

      await compactAgentDocs({
        apiKey: "test-key",
        baseUrl: `http://127.0.0.1:${port}`,
        stale: true,
        includeMissing: true,
        pages: ["plain"],
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    expect(seenInputs).toHaveLength(2);
    expect(seenInputs[0]).toContain("URL: /docs/budgeted");
    expect(seenInputs[1]).toContain("URL: /docs/plain");
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "budgeted", "agent.md"),
      "Budgeted compacted",
      "resolved-page",
    );
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "plain", "agent.md"),
      "Plain compacted",
      "resolved-page",
    );
  });

  it("uses --changed to compact only docs sources changed in the current git working tree", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default { entry: "docs" };`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "docs", "installation"), { recursive: true });
    mkdirSync(path.join(tmpDir, "app", "docs", "handwritten"), { recursive: true });
    mkdirSync(path.join(tmpDir, "app", "docs", "generated"), { recursive: true });

    writeFileSync(
      path.join(tmpDir, "app", "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "Install the framework"
---

# Installation

First body.
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "app", "docs", "handwritten", "page.mdx"),
      `---
title: "Handwritten"
description: "Custom machine page"
---

# Handwritten

Body.
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "app", "docs", "handwritten", "agent.md"),
      `Handwritten source.
`,
      "utf-8",
    );

    writeFileSync(
      path.join(tmpDir, "app", "docs", "generated", "page.mdx"),
      `---
title: "Generated"
description: "Generated agent file"
---

# Generated

Body.
`,
      "utf-8",
    );

    process.chdir(tmpDir);
    initializeGitRepo(tmpDir);

    const seenInputs: string[] = [];
    let generatedPass = false;
    const server = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const payload = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as { input: string };
      seenInputs.push(payload.input);

      let output = "Compacted";
      if (payload.input.includes("URL: /docs/generated")) {
        generatedPass = true;
        output = "Generated compacted";
      } else if (payload.input.includes("URL: /docs/installation")) {
        output = "Installation changed compacted";
      } else if (payload.input.includes("Handwritten source updated.")) {
        output = "Handwritten changed compacted";
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
      await compactAgentDocs({
        apiKey: "test-key",
        baseUrl: `http://127.0.0.1:${port}`,
        pages: ["generated"],
      });

      expect(generatedPass).toBe(true);
      commitAllGitChanges(tmpDir, "initial");
      seenInputs.length = 0;
      generatedPass = false;

      writeFileSync(
        path.join(tmpDir, "app", "docs", "installation", "page.mdx"),
        `---
title: "Installation"
description: "Install the framework"
---

# Installation

Updated body.
`,
        "utf-8",
      );

      writeFileSync(
        path.join(tmpDir, "app", "docs", "handwritten", "agent.md"),
        `Handwritten source updated.
`,
        "utf-8",
      );

      await compactAgentDocs({
        apiKey: "test-key",
        baseUrl: `http://127.0.0.1:${port}`,
        changed: true,
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    expect(seenInputs).toHaveLength(2);
    expect(seenInputs.some((input) => input.includes("URL: /docs/installation"))).toBe(true);
    expect(seenInputs.some((input) => input.includes("Handwritten source updated."))).toBe(true);
    expect(
      seenInputs.some(
        (input) =>
          input.includes("Handwritten source updated.") &&
          !input.includes("URL: /docs/handwritten"),
      ),
    ).toBe(true);
    expect(seenInputs.some((input) => input.includes("URL: /docs/generated"))).toBe(false);
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "installation", "agent.md"),
      "Installation changed compacted",
      "resolved-page",
    );
    expectGeneratedAgentFile(
      path.join(tmpDir, "app", "docs", "handwritten", "agent.md"),
      "Handwritten changed compacted",
      "agent-md",
    );
  });

  it("prints a friendly message when --changed finds no changed docs sources", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      `export default { entry: "docs" };`,
      "utf-8",
    );

    mkdirSync(path.join(tmpDir, "app", "docs", "installation"), { recursive: true });
    writeFileSync(
      path.join(tmpDir, "app", "docs", "installation", "page.mdx"),
      `---
title: "Installation"
description: "Install the framework"
---

# Installation

Body.
`,
      "utf-8",
    );

    process.chdir(tmpDir);
    initializeGitRepo(tmpDir);

    await compactAgentDocs({
      changed: true,
    });

    expect(logs.some((line) => line.includes("No changed docs pages needed compaction."))).toBe(
      true,
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

function runGit(rootDir: string, args: string[]) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf-8",
  });
}

function initializeGitRepo(rootDir: string) {
  runGit(rootDir, ["init"]);
  runGit(rootDir, ["config", "user.name", "Docs Test"]);
  runGit(rootDir, ["config", "user.email", "docs@example.com"]);
  runGit(rootDir, ["add", "."]);
  runGit(rootDir, ["commit", "-m", "initial"]);
}

function commitAllGitChanges(rootDir: string, message: string) {
  runGit(rootDir, ["add", "."]);
  runGit(rootDir, ["commit", "-m", message]);
}

function expectGeneratedAgentFile(
  filePath: string,
  expectedContent: string,
  expectedSourceKind: "resolved-page" | "agent-md",
) {
  const parsed = parseGeneratedAgentDocument(readFileSync(filePath, "utf-8"));
  expect(parsed.provenance).toBeDefined();
  expect(parsed.provenance?.sourceKind).toBe(expectedSourceKind);
  expect(parsed.provenance?.sourceHash).toMatch(/^fnv1a64:/);
  expect(parsed.provenance?.settingsHash).toMatch(/^fnv1a64:/);
  expect(parsed.provenance?.outputHash).toMatch(/^fnv1a64:/);
  expect(parsed.content).toBe(`${expectedContent}\n`);
}
