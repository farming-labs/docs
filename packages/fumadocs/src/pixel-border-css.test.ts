import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("pixel-border CSS", () => {
  it("does not hide a framework adapter's sidebar navigation tree", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../styles/pixel-border.css", import.meta.url)),
      "utf8",
    );

    expect(css).toContain(
      "#nd-docs-layout:not([data-fd-framework]) aside#nd-sidebar > div:last-child",
    );
    expect(css).not.toMatch(/^\s*aside#nd-sidebar > div:last-child\s*\{\s*display:\s*none/m);
  });
});
