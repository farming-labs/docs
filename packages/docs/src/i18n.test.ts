import { describe, it, expect } from "vitest";
import { resolveDocsI18n, resolveDocsLocale, resolveDocsPath } from "./i18n.js";

describe("resolveDocsI18n", () => {
  it("returns null for empty locales", () => {
    expect(resolveDocsI18n({ locales: [] })).toBeNull();
  });

  it("uses first locale as default when defaultLocale missing", () => {
    const i18n = resolveDocsI18n({ locales: ["en", "fr"] });
    expect(i18n?.defaultLocale).toBe("en");
  });

  it("honors defaultLocale when present", () => {
    const i18n = resolveDocsI18n({ locales: ["en", "fr"], defaultLocale: "fr" });
    expect(i18n?.defaultLocale).toBe("fr");
  });
});

describe("resolveDocsLocale", () => {
  it("returns undefined when no lang param", () => {
    const i18n = resolveDocsI18n({ locales: ["en", "fr"] });
    const params = new URLSearchParams("query=test");
    expect(resolveDocsLocale(params, i18n)).toBeUndefined();
  });

  it("returns valid locale from lang", () => {
    const i18n = resolveDocsI18n({ locales: ["en", "fr"] });
    const params = new URLSearchParams("lang=fr");
    expect(resolveDocsLocale(params, i18n)).toBe("fr");
  });

  it("falls back to default when invalid", () => {
    const i18n = resolveDocsI18n({ locales: ["en", "fr"], defaultLocale: "en" });
    const params = new URLSearchParams("lang=de");
    expect(resolveDocsLocale(params, i18n)).toBe("en");
  });
});

describe("resolveDocsPath", () => {
  it("strips the entry prefix from pathname", () => {
    const match = resolveDocsPath("/docs/getting-started", "docs");
    expect(match.slug).toBe("getting-started");
    expect(match.entryPath).toBe("docs");
  });
});
