import { compile } from "@mdx-js/mdx";
import { defaultShikiFactory, wasmShikiFactory } from "fumadocs-core/highlight/shiki/full";
import { afterEach, describe, expect, it, vi } from "vitest";
import rehypeCode from "./rehype-code.js";

describe("build-time code highlighting", () => {
  afterEach(() => vi.restoreAllMocks());

  it("highlights both themes without initializing the JavaScript regex engine", async () => {
    const javascript = vi.spyOn(defaultShikiFactory, "getOrInit");
    const oniguruma = vi.spyOn(wasmShikiFactory, "getOrInit");
    const output = String(
      await compile('```ts title="example.ts"\nconst answer = 42; // [!code highlight]\n```', {
        rehypePlugins: [[rehypeCode, { themes: { light: "github-light", dark: "github-dark" } }]],
      }),
    );

    expect(output).toContain("--shiki-light");
    expect(output).toContain("--shiki-dark");
    expect(output).toContain("highlighted");
    expect(output).toContain("example.ts");
    expect(oniguruma).toHaveBeenCalledOnce();
    expect(javascript).not.toHaveBeenCalled();
  });

  it("preserves an explicitly selected JavaScript engine", async () => {
    const javascript = vi.spyOn(defaultShikiFactory, "getOrInit");
    const oniguruma = vi.spyOn(wasmShikiFactory, "getOrInit");
    const output = String(
      await compile("```js\nconst answer = 42;\n```", {
        rehypePlugins: [[rehypeCode, { engine: "js" }]],
      }),
    );

    expect(output).toContain("shiki");
    expect(javascript).toHaveBeenCalledOnce();
    expect(oniguruma).not.toHaveBeenCalled();
  });
});
