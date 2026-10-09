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
    expect(css).toContain('@import "./bundles/shared-framework.css"');
    expect(css).not.toContain('@import "./ledger.css"');
    expect(css).toContain("#nd-docs-layout");
    expect(css).toContain(".fd-layout");
    expect(css).toContain(".fd-docs-content");
    expect(css).toContain(".fd-sidebar");
  });

  it("uses a blueprint grid, dark navigation spine, and numbered sections", () => {
    expect(css).toContain("background-size: 24px 24px");
    expect(css).toContain("border-right: 3px solid var(--fd-junction-blue)");
    expect(css).toContain("counter-increment: junction-section");
    expect(css).toContain("counter(junction-section, decimal-leading-zero)");
    expect(previewCss).toContain("JUNCTION / DOCUMENT");
    expect(previewCss).toContain("--fd-junction-sidebar");
  });

  it("uses square technical surfaces and supports reduced motion", () => {
    expect(css).toContain("border-radius: 0 !important");
    expect(css).toContain("max-width: 920px");
    expect(previewCss).toContain("max-width: 920px !important");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("outline: 2px solid var(--color-fd-ring) !important");
  });
});
