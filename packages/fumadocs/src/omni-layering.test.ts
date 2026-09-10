import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adapterStyles = ["fumadocs", "astro-theme", "nuxt-theme", "svelte-theme"].map((adapter) => ({
  adapter,
  css: readFileSync(
    fileURLToPath(new URL(`../../${adapter}/styles/omni.css`, import.meta.url)),
    "utf8",
  ),
}));

describe("command palette layering", () => {
  it.each(adapterStyles)(
    "keeps the $adapter search dialog above elevated page chrome",
    ({ css }) => {
      expect(css).toMatch(/\.omni-overlay\s*\{[^}]*z-index:\s*9998;/s);
      expect(css).toMatch(/\.omni-content\s*\{[^}]*z-index:\s*9999;/s);
    },
  );
});
