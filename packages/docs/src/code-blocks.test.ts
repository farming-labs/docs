import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractCodeBlocksFromMarkdown,
  resolveDocsCodeBlocksValidateConfig,
  validateCodeBlocks,
} from "./code-blocks.js";

const sandboxMock = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: sandboxMock.create,
  },
}));

describe("code block validation", () => {
  afterEach(() => {
    sandboxMock.create.mockReset();
    vi.unstubAllGlobals();
    delete process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_PROJECT_ID;
    delete process.env.VERCEL_TEAM_ID;
  });

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
      projectIdEnv: "VERCEL_PROJECT_ID",
      teamIdEnv: "VERCEL_TEAM_ID",
      projectJson: ".vercel/project.json",
    });
    expect(config.env).toEqual({
      OPENAI_API_KEY: "OPENAI_TEST_API_KEY",
    });
  });

  it("does not execute code blocks unless they are marked runnable", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "docs-codeblocks-not-runnable-"));
    writeFileSync(
      path.join(rootDir, "page.mdx"),
      ['```js title="example.js"', "throw new Error('should not run')", "```"].join("\n"),
      "utf-8",
    );

    const report = await validateCodeBlocks({
      rootDir,
      contentDir: ".",
      config: resolveDocsCodeBlocksValidateConfig(true),
    });

    expect(report.summary).toMatchObject({
      total: 1,
      pass: 0,
      skip: 1,
      fail: 0,
    });
    expect(report.results[0]?.reason).toBe("code block is not marked runnable");
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

  it("does not convert non-env skips to failures when missingEnv is error", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "docs-codeblocks-non-env-skip-"));
    writeFileSync(
      path.join(rootDir, "page.mdx"),
      ['```mermaid title="flow.mmd" runnable', "graph TD; A-->B;", "```"].join("\n"),
      "utf-8",
    );

    const report = await validateCodeBlocks({
      rootDir,
      contentDir: ".",
      config: resolveDocsCodeBlocksValidateConfig({
        missingEnv: "error",
      }),
    });

    expect(report.summary).toMatchObject({
      pass: 0,
      skip: 1,
      fail: 0,
    });
    expect(report.results[0]).toMatchObject({
      status: "SKIP",
      reason: "unsupported language: mermaid",
    });
  });

  it("keeps missing env failures when missingEnv is error", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "docs-codeblocks-env-error-"));
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
        missingEnv: "error",
      }),
    });

    expect(report.summary).toMatchObject({
      pass: 0,
      skip: 0,
      fail: 1,
    });
    expect(report.results[0]).toMatchObject({
      status: "FAIL",
      reason: "missing env: OPENAI_API_KEY",
    });
  });

  it("accepts closing fences longer than the opening fence", () => {
    const blocks = extractCodeBlocksFromMarkdown({
      filePath: "/repo/docs/page.mdx",
      relativePath: "docs/page.mdx",
      source: [
        '```js title="longer-close.js" runnable',
        'console.log("ok")',
        "````",
        "",
        '~~~json title="tilde.json" runnable',
        '{"ok":true}',
        "~~~~",
      ].join("\n"),
    });

    expect(blocks).toHaveLength(2);
    expect(blocks.map((block) => block.code)).toEqual(['console.log("ok")', '{"ok":true}']);
  });

  it("auto-discovers Vercel Sandbox project credentials from the token", async () => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "docs-codeblocks-vercel-"));
    writeFileSync(
      path.join(rootDir, "page.mdx"),
      ['```js title="sandbox.js" runnable', 'console.log("sandbox")', "```"].join("\n"),
      "utf-8",
    );

    process.env.VERCEL_TOKEN = "test-token";
    const runCommand = vi.fn(async () => ({
      exitCode: 0,
      stdout: async () => "sandbox\n",
      stderr: async () => "",
    }));
    sandboxMock.create.mockImplementation(async () => ({
      writeFiles: vi.fn(async () => {}),
      runCommand,
      stop: vi.fn(async () => {}),
    }));
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          projects: [{ id: "prj_test", accountId: "team_test" }],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await validateCodeBlocks({
      rootDir,
      contentDir: ".",
      config: resolveDocsCodeBlocksValidateConfig({
        runner: {
          provider: "vercel-sandbox",
        },
      }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.vercel.com/v9/projects?limit=1",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer test-token",
        },
      }),
    );
    expect(sandboxMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "test-token",
        projectId: "prj_test",
        teamId: "team_test",
      }),
    );
    expect(report.summary).toMatchObject({
      pass: 1,
      skip: 0,
      fail: 0,
    });
    expect(report.results[0]?.stdout).toBe("sandbox\n");
  });
});
