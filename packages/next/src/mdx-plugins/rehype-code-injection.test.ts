import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compile } from "@mdx-js/mdx";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import rehypeCode from "./rehype-code.js";

// These grammars would change the highlighter that every later test in the same file shares, so
// they stay out of rehype-code.test.ts.
const themes = { light: "github-light", dark: "github-dark" };

describe("code highlighting that depends only on the block", () => {
  let cacheDir: string;
  const entries = () =>
    readdirSync(cacheDir, { recursive: true, encoding: "utf8" }).filter((file) =>
      file.endsWith(".json"),
    );
  // Every call compiles through a new processor, as `.md` and `.mdx` files do in one worker.
  const highlight = (source: string, options: object = { themes }) =>
    compile(source, { rehypePlugins: [[rehypeCode, options]] }).then(String);

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "docs-code-cache-"));
  });
  afterEach(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });

  // This test runs first: Shiki fixes a grammar's injections when the grammar is first used, so
  // ts-tags only changes TypeScript that a worker highlights after loading it.
  it("highlights TypeScript as plain TypeScript after a worker loads ts-tags", async () => {
    const tags = await highlight("```ts-tags\nconst style = css`a { color: red; }`;\n```");
    // ts-tags highlights the template as CSS. TypeScript keeps it one string.
    expect(tags).toContain('children: "color"');
    const typescript = await highlight("```ts\nconst style = css`a { color: red; }`;\n```");
    expect(typescript).not.toContain('children: "color"');
  });

  it("highlights fenced code in Markdown the same whatever the worker loaded before", async () => {
    const source = "````md\n```ts\nconst a = 1;\n```\n\n```python\ndef f(): pass\n```\n````";
    const before = await highlight(source);
    await highlight("```python\ndef f(): pass\n```");
    expect(await highlight(source)).toBe(before);
    // Nested TypeScript is always highlighted, and Python, which is not embedded, never is.
    expect(before).toContain('children: "const"');
    expect(before).not.toContain('children: "def"');
  });

  it("highlights Markdown the same after a worker loads Vue", async () => {
    const source = '```md\n# Title {{ value }}\n\n<div v-if="shown">text</div>\n```';
    const before = await highlight(source);
    await highlight('```vue\n<template><div v-if="shown">{{ value }}</div></template>\n```');
    expect(await highlight(source)).toBe(before);
  });

  it("stores and reuses blocks in languages that embed or inject", async () => {
    const source =
      "````md\n```ts\nconst a = 1;\n```\n````\n\n```ts-tags\nconst s = css`a{}`;\n```\n\n" +
      '```vue\n<script setup lang="ts">const count = 1;</script>\n```';
    const uncached = await highlight(source);
    expect(await highlight(source, { themes, cacheDir })).toBe(uncached);
    expect(entries()).toHaveLength(3);
    expect(await highlight(source, { themes, cacheDir })).toBe(uncached);
  });
});
