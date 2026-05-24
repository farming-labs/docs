import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCodeBlocksValidate } from "./codeblocks.js";

describe("codeblocks validate cli", () => {
  let tmpDir: string;
  let previousCwd: string;
  let logs: string[];

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "docs-codeblocks-cli-"));
    previousCwd = process.cwd();
    logs = [];
    process.chdir(tmpDir);
    vi.spyOn(console, "log").mockImplementation((value?: unknown) => {
      logs.push(String(value));
    });
  });

  afterEach(() => {
    process.chdir(previousCwd);
    rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it("redacts planner api keys from disabled JSON output", async () => {
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      [
        "export default {",
        '  entry: "docs",',
        "  codeBlocks: {",
        "    validate: {",
        "      enabled: false,",
        "      planner: { provider: 'openai', apiKey: 'secret-key' },",
        "    },",
        "  },",
        "};",
      ].join("\n"),
      "utf-8",
    );

    await runCodeBlocksValidate({ json: true });

    const output = logs.join("\n");
    expect(output).not.toContain("secret-key");
    expect(JSON.parse(output).config.planner.apiKey).toBe("[REDACTED]");
  });

  it("labels --run output as validation when config mode is plan", async () => {
    mkdirSync(path.join(tmpDir, "docs"));
    writeFileSync(
      path.join(tmpDir, "docs.config.ts"),
      [
        "export default {",
        '  entry: "docs",',
        "  codeBlocks: {",
        "    validate: {",
        '      mode: "plan",',
        "    },",
        "  },",
        "};",
      ].join("\n"),
      "utf-8",
    );
    writeFileSync(
      path.join(tmpDir, "docs", "page.mdx"),
      ['```js title="hello.js" runnable', 'console.log("hello")', "```"].join("\n"),
      "utf-8",
    );

    await runCodeBlocksValidate({ run: true });

    expect(logs[0]).toBe("Code block validation");
    expect(logs.join("\n")).toContain("1 pass");
  });
});
