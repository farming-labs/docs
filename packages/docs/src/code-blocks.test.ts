import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractCodeBlocksFromMarkdown,
  resolveDocsCodeBlocksValidateConfig,
  validateCodeBlocks,
} from "./code-blocks.js";

describe("code block validation", () => {
  it("resolves disabled and enabled validate config", () => {
    expect(resolveDocsCodeBlocksValidateConfig().enabled).toBe(false);

    const config = resolveDocsCodeBlocksValidateConfig({
      planner: {
        provider: "openai",
        model: "gpt-4.1-mini",
        apiKeyEnv: "OPENAI_API_KEY",
      },
      runner: {
        provider: "vercel-sandbox",
        tokenEnv: "VERCEL_TOKEN",
      },
      env: {
        OPENAI_API_KEY: "OPENAI_TEST_API_KEY",
      },
    });

    expect(config.enabled).toBe(true);
    expect(config.planner).toMatchObject({
      provider: "openai",
      model: "gpt-4.1-mini",
      apiKeyEnv: "OPENAI_API_KEY",
    });
    expect(config.runner).toMatchObject({
      provider: "vercel-sandbox",
      tokenEnv: "VERCEL_TOKEN",
    });
    expect(config.env).toEqual({
      OPENAI_API_KEY: "OPENAI_TEST_API_KEY",
    });
  });

  it("extracts code fence metadata used by agents and validators", () => {
    const blocks = extractCodeBlocksFromMarkdown({
      filePath: "/repo/docs/page.mdx",
      relativePath: "docs/page.mdx",
      source: [
        "Intro",
        "",
        '```ts title="app/api/chat/route.ts" framework="nextjs" packageManager="pnpm" env="OPENAI_API_KEY" runnable',
        "console.log(process.env.OPENAI_API_KEY)",
        "```",
      ].join("\n"),
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({
      id: "docs/page.mdx#code-1",
      lineStart: 3,
      lineEnd: 5,
      language: "ts",
      title: "app/api/chat/route.ts",
      framework: "nextjs",
      packageManager: "pnpm",
      runnable: true,
      env: ["OPENAI_API_KEY"],
      code: "console.log(process.env.OPENAI_API_KEY)",
    });
  });

  it("builds a metadata execution plan without running when plan mode is requested", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "docs-codeblocks-plan-"));
    writeFileSync(
      path.join(rootDir, "page.mdx"),
      ['```js title="hello.js" runnable', 'console.log("hello")', "```"].join("\n"),
      "utf-8",
    );

    const report = await validateCodeBlocks({
      rootDir,
      contentDir: ".",
      planOnly: true,
      config: resolveDocsCodeBlocksValidateConfig(true),
    });

    expect(report.targets).toHaveLength(1);
    expect(report.plans[0]).toMatchObject({
      action: "execute",
      template: "node",
      runtime: "node",
      command: {
        cmd: "node",
      },
    });
    expect(report.summary).toEqual({
      total: 1,
      planned: 1,
      pass: 0,
      skip: 0,
      fail: 0,
    });
    expect(report.results[0]).toMatchObject({
      status: "PLAN",
      reason: "planned",
    });
  });

  it("runs local executable and syntax-validation plans", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "docs-codeblocks-run-"));
    writeFileSync(
      path.join(rootDir, "page.mdx"),
      [
        '```js title="hello.js" runnable',
        'console.log("hello")',
        "```",
        "",
        '```json title="payload.json" runnable',
        '{"ok": true}',
        "```",
      ].join("\n"),
      "utf-8",
    );

    const report = await validateCodeBlocks({
      rootDir,
      contentDir: ".",
      config: resolveDocsCodeBlocksValidateConfig(true),
    });

    expect(report.summary).toEqual({
      total: 2,
      planned: 0,
      pass: 2,
      skip: 0,
      fail: 0,
    });
    expect(report.results.map((result) => result.status)).toEqual(["PASS", "PASS"]);
  });

  it("skips runnable blocks when mapped env is missing", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "docs-codeblocks-env-"));
    writeFileSync(
      path.join(rootDir, "page.mdx"),
      [
        '```js title="needs-env.js" env="OPENAI_API_KEY" runnable',
        "console.log(Boolean(process.env.OPENAI_API_KEY))",
        "```",
      ].join("\n"),
      "utf-8",
    );

    const report = await validateCodeBlocks({
      rootDir,
      contentDir: ".",
      config: resolveDocsCodeBlocksValidateConfig({
        env: {
          OPENAI_API_KEY: "OPENAI_TEST_API_KEY",
        },
      }),
    });

    expect(report.summary).toMatchObject({
      total: 1,
      pass: 0,
      skip: 1,
      fail: 0,
    });
    expect(report.results[0]?.reason).toBe("missing env: OPENAI_API_KEY");
  });
});
