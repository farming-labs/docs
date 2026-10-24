import fs from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getMDXComponents } from "./mdx.js";

const require = createRequire(import.meta.url);

describe("docs tabs", () => {
  it("render the class names the docs themes style", () => {
    const components = getMDXComponents() as Record<string, React.ComponentType<any>>;
    const tabs = renderToStaticMarkup(
      React.createElement(
        components.Tabs,
        { items: ["npm", "pnpm"] },
        React.createElement(components.Tab, null, "npm i"),
        React.createElement(components.Tab, null, "pnpm add"),
      ),
    );
    expect(tabs).toMatch(/^<div[^>]*class="[^"]*\bfd-tabs\b/);
    expect(tabs).toContain('role="tablist"');

    const codeGroup = renderToStaticMarkup(
      React.createElement(
        components.CodeGroup,
        null,
        React.createElement("pre", { "data-title": "npm" }, "npm i"),
        React.createElement("pre", { "data-title": "pnpm" }, "pnpm add"),
      ),
    );
    expect(codeGroup).toMatch(
      /role="tablist"[^>]*class="[^"]*\bfd-tabs-list\b|class="[^"]*\bfd-tabs-list\b[^"]*"[^>]*role="tablist"/,
    );
    expect(codeGroup.match(/\bfd-tabs-trigger\b/g)).toHaveLength(2);

    const list = renderToStaticMarkup(
      React.createElement(
        components.CodeBlockTabs,
        { defaultValue: "a" },
        React.createElement(
          components.CodeBlockTabsList,
          null,
          React.createElement(components.CodeBlockTabsTrigger, { value: "a" }, "A"),
        ),
      ),
    );
    expect(list).toContain("fd-tabs-list");
    expect(list).toContain("fd-tabs-trigger");
  });

  it("are the only tabs the shadcn theme styles", () => {
    const css = fs.readFileSync(
      require.resolve("@farming-labs/docs/styles/themes/shadcn.css"),
      "utf8",
    );
    // A bare [role="tab"] rule restyles every tab on a page that loads the docs CSS.
    const selectors = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("{")
      .map((chunk) => chunk.split("}").pop()!.trim())
      .flatMap((selector) => selector.split(",").map((part) => part.trim()))
      .filter((part) => /\[role="tab(list)?"\]/.test(part));
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) {
      expect(selector).toMatch(/^(\.fd-tabs\b|:is\(|\.fd-docs-content|\.fd-page-body|#nd-page)/);
    }
  });
});
