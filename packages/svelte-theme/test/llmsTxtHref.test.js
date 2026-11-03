import { describe, expect, it } from "vitest";
import { llmsTxtHref } from "../src/lib/llmsTxtHref.js";

describe("llmsTxtHref", () => {
  it("names the page's docs root so the link answers for that root without a Referer", () => {
    const href = new URL(llmsTxtHref("llms", "statewire/docs", null), "https://site.test");
    expect(href.pathname).toBe("/api/docs");
    expect(Object.fromEntries(href.searchParams)).toEqual({
      format: "llms",
      root: "statewire/docs",
    });
  });

  it("keeps the locale", () => {
    const href = new URL(llmsTxtHref("llms-full", "docs", "fr"), "https://site.test");
    expect(Object.fromEntries(href.searchParams)).toEqual({
      format: "llms-full",
      root: "docs",
      lang: "fr",
    });
  });
});
