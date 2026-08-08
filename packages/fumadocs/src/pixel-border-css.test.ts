import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("pixel-border CSS", () => {
  const css = readFileSync(
    fileURLToPath(new URL("../styles/pixel-border.css", import.meta.url)),
    "utf8",
  );
  const previewCss = readFileSync(
    fileURLToPath(new URL("../../../website/public/themes/pixel-border.css", import.meta.url)),
    "utf8",
  );
  const websiteConfig = readFileSync(
    fileURLToPath(new URL("../../../website/docs.config.tsx", import.meta.url)),
    "utf8",
  );
  const websiteGlobalCss = readFileSync(
    fileURLToPath(new URL("../../../website/app/global.css", import.meta.url)),
    "utf8",
  );

  it("keeps the built-in preset free of browser-adapter shell overrides", () => {
    expect(css).not.toContain("Farm's");
    expect(css).not.toContain("data-fd-tablet-sidebar-state");
    expect(css).not.toContain("data-visible-in-header");
    expect(css).not.toContain(".sidebar-brand");
  });

  it("keeps the desktop grid out of tablet layouts", () => {
    expect(css).not.toContain(
      "@media (min-width: 768px) {\n  #nd-docs-layout:not([data-fd-framework]),",
    );
    expect(css).toContain(
      "@media (min-width: 1024px) {\n  #nd-docs-layout:not([data-fd-framework]),",
    );
  });

  it("gives the default docs article comfortable responsive gutters", () => {
    expect(css).toMatch(
      /#nd-docs-layout:not\(\[data-fd-framework\]\) article#nd-page \{[^}]*padding-inline: 2rem;/,
    );
  });

  it("removes all table-of-contents chrome below desktop widths", () => {
    expect(css).toContain("@media (max-width: 1279px)");
    expect(css).toContain("--fd-toc-popover-height: 0px !important");
    expect(css).toMatch(
      /#nd-docs-layout:not\(\[data-fd-framework\]\) #nd-toc,[^}]*\[data-toc-popover\] \{[^}]*display: none !important;/,
    );
  });

  it("uses the native directional TOC without theme-level rail overrides", () => {
    expect(css).not.toContain('nav[class*="toc"]');
    expect(css).not.toContain('[class*="fd-toc"]');
    expect(previewCss).not.toContain('nav[class*="toc"]');
    expect(previewCss).not.toContain('[class*="fd-toc"]');
    expect(websiteConfig).toContain('style: "directional"');
    expect(websiteGlobalCss).not.toContain('#nd-toc [style*="--track-top"]');
  });

  it("keeps the website theme preview on the same responsive boundary", () => {
    expect(previewCss).not.toContain(
      "@media (min-width: 768px) {\n  #nd-docs-layout:not([data-fd-framework]),",
    );
    expect(previewCss).toContain(
      "@media (min-width: 1024px) {\n  #nd-docs-layout:not([data-fd-framework]),",
    );
    expect(previewCss).toContain("padding-inline: 2rem !important");
    expect(previewCss).toContain("@media (max-width: 1279px)");
    expect(previewCss).toContain("--fd-toc-popover-height: 0px !important");
  });
});
