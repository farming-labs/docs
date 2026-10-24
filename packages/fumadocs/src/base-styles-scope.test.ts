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
  return (
    [...rules]
      .filter(([, , body]) => body.includes(property))
      // Drop statements such as @import that precede the rule.
      .flatMap(([, selector]) => splitSelectorList(selector.split(";").pop()!))
  );
}

/** Split a selector list on its top-level commas, keeping `:has(a, b)` and `:is(a, b)` whole. */
function splitSelectorList(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selector.length; index++) {
    const char = selector[index];
    if (char === "(") depth++;
    else if (char === ")") depth--;
    else if (char === "," && depth === 0) {
      parts.push(selector.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(selector.slice(start).trim());
  return parts;
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

  it.each(stylesheets)("set the body font only on docs pages in %s", (file) => {
    const selectors = selectorsSetting(
      fs.readFileSync(new URL(file, import.meta.url), "utf8"),
      "var(--fd-font-sans, var(--font-geist-sans",
    );
    expect(selectors).toContain(
      "body:where(:has(#nd-docs-layout, #nd-notebook-layout, #nd-flux-layout, #nd-home-layout))",
    );
    expect(selectors).not.toContain("body");
  });
});
