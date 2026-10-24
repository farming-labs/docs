import fs from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheets = [
  "../styles/base.css",
  "../styles/bundles/shared-framework.css",
  "../styles/bundles/browser-framework.css",
];

/** Selectors of every rule whose declarations mention `property`. */
function selectorsSetting(css: string, property: string): string[] {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g);
  return [...rules]
    .filter(([, , body]) => body.includes(property))
    .flatMap(([, selector]) => selector.split(",").map((part) => part.trim()));
}

describe("docs base styles", () => {
  // Some frameworks ship one stylesheet for every route, so a bare utility selector in the docs
  // typography retunes the same Tailwind class on the app's own pages.
  it.each(stylesheets)("scope the small-text typography to the docs layout in %s", (file) => {
    const selectors = selectorsSetting(
      fs.readFileSync(new URL(file, import.meta.url), "utf8"),
      "--fd-small-line-height",
    );
    expect(selectors).toContain(":where(#nd-docs-layout) .text-sm");
    expect(selectors).not.toContain(".text-sm");
  });
});
