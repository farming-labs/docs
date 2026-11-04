import fs from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheets = [
  "../styles/base.css",
  "../styles/bundles/shared-framework.css",
  "../styles/bundles/browser-framework.css",
];

function desktopRules(css: string): string {
  const start = css.indexOf("@media (min-width: 768px) {\n  .fd-top-header {");
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n}\n", start));
}

describe("top header styles", () => {
  it.each(stylesheets)("hide the header below 768px in %s", (file) => {
    const css = fs.readFileSync(new URL(file, import.meta.url), "utf8");
    expect(css).toMatch(/\n\.fd-top-header \{\s*display: none;\s*\}/);
  });

  it.each(stylesheets)(
    "move search, the theme toggle, title and links out of the desktop sidebar in %s",
    (file) => {
      const rules = desktopRules(fs.readFileSync(new URL(file, import.meta.url), "utf8"));
      expect(rules).toContain("padding-top: var(--fd-top-header-height, 56px);");
      expect(rules).toMatch(
        /#nd-docs-layout\[data-fd-header="top"\]\s+#nd-sidebar\s+:is\(\s*\[data-search-full\],\s*\.fd-sidebar-search-ai-row,\s*\[data-theme-toggle\],\s*a:has\(> \.fd-nav-title\),\s*a:has\(\.fd-nav-link\)\s*\)/,
      );
    },
  );
});
