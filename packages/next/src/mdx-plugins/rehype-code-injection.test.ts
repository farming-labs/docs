import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile } from "@mdx-js/mdx";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import rehypeCode from "./rehype-code.js";

// These grammars change the highlighter that every later test in the same file shares, so they
// stay out of rehype-code.test.ts, whose cache tests expect TypeScript to be stored.
const themes = { light: "github-light", dark: "github-dark" };

describe("code highlight cache with grammars that change other languages", () => {
  let cacheDir: string;
  const entries = () =>
    readdirSync(cacheDir, { recursive: true, encoding: "utf8" }).filter((file) =>
      file.endsWith(".json"),
    );
  const highlight = (source: string, options: object = { themes, cacheDir }) =>
    compile(source, { rehypePlugins: [[rehypeCode, options]] }).then(String);

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "docs-code-cache-"));
  });
  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("does not store TypeScript after another processor in the worker loads ts-tags", async () => {
    // `.md` and `.mdx` files compile through separate processors that share one highlighter.
    await highlight("```ts-tags\nconst s = css`a{}`;\n```");
    const source = "```ts\nconst s = css`a{}`;\n```";
    expect(await highlight(source)).toBe(await highlight(source, { themes }));
    expect(entries()).toHaveLength(0);
  });

  it("does not store output that depends on other languages loaded by the worker", async () => {
    // Markdown embeds fenced languages only when they are already loaded, and `ts-tags`
    // injects into TypeScript. Neither result is a function of the block alone.
    await highlight(
      "````md\n```ts\nconst a = 1;\n```\n````\n\n```ts-tags\nconst s = css`a{}`;\n```",
    );
    expect(entries()).toHaveLength(0);
    // Once `ts-tags` is loaded, TypeScript in the same worker is no longer stored either.
    const source = "```ts-tags\nconst s = css`a{}`;\n```\n\n```ts\nconst s = css`a{}`;\n```";
    expect(await highlight(source)).toBe(await highlight(source, { themes }));
    expect(entries()).toHaveLength(0);
  });
});
