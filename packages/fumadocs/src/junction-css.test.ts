import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("junction CSS", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../styles/junction.css", import.meta.url)),
    "utf8",
  );
  const previewCss = readFileSync(
    fileURLToPath(new URL("../../../website/public/themes/junction.css", import.meta.url)),
    "utf8",
  );

  it("covers both Fumadocs and framework-neutral layout contracts", () => {
    expect(css).toContain("#nd-docs-layout");
    expect(css).toContain(".fd-layout");
    expect(css).toContain(".fd-docs-content");
    expect(css).toContain(".fd-sidebar");
  });

  it("uses dashed rails and two diagonal junction marks", () => {
    expect(css).toContain("border-bottom: 1px dashed var(--fd-junction-rail)");
    expect(css).toContain("border-right: 1px dashed var(--fd-junction-rail)");
    expect(css).toContain("top: -4px");
    expect(css).toContain("right: -4px");
    expect(css).toContain("bottom: -4px");
    expect(css).toContain("left: -4px");
    expect(previewCss).toContain("border-top: 1px dashed var(--fd-junction-rail)");
  });

  it("keeps technical surfaces square and supports reduced motion", () => {
    expect(css).toContain("border-radius: 2px !important");
    expect(css).toContain("max-width: 840px");
    expect(previewCss).toContain("max-width: 840px !important");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("outline: 2px solid var(--color-fd-ring) !important");
  });
});
