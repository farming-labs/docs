import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("pixel-border CSS", () => {
  it("keeps the built-in preset free of browser-adapter shell overrides", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../styles/pixel-border.css", import.meta.url)),
      "utf8",
    );

    expect(css).not.toContain("Farm's");
    expect(css).not.toContain("data-fd-tablet-sidebar-state");
    expect(css).not.toContain("data-visible-in-header");
    expect(css).not.toContain(".sidebar-brand");
  });
});
