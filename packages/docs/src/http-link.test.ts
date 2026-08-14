import { describe, expect, it } from "vitest";
import {
  httpLinkHeaderHasTargetRelation,
  httpLinkMatchesExpectation,
  parseHttpLinkHeader,
  splitHttpList,
  unquoteHttpValue,
} from "./http-link.js";

describe("HTTP Link header parsing", () => {
  it("keeps quoted commas and URI commas inside their link-value", () => {
    const header =
      '</.well-known/api-catalog>; title="Docs, API"; rel="api-catalog", </search?q=one,two>; rel="item"';

    expect(splitHttpList(header, ",")).toHaveLength(2);
    expect(parseHttpLinkHeader(header)).toEqual([
      { href: "/.well-known/api-catalog", relations: ["api-catalog"] },
      { href: "/search?q=one,two", relations: ["item"] },
    ]);
  });

  it("unquotes escaped parameter values", () => {
    expect(unquoteHttpValue('"Docs \\"API\\""')).toBe('Docs "API"');
  });

  it("requires the expected URL and relation in the same link-value", () => {
    const responseUrl = "https://docs.example.com/.well-known/api-catalog";
    const header =
      '</.well-known/api-catalog>; rel="service-meta", </unrelated>; rel="api-catalog"';
    const links = parseHttpLinkHeader(header);

    expect(
      httpLinkMatchesExpectation(
        links,
        { href: "/.well-known/api-catalog", rel: "api-catalog" },
        responseUrl,
      ),
    ).toBe(false);
    expect(
      httpLinkHeaderHasTargetRelation(
        '</.well-known/api-catalog>; title="Docs, API"; rel="api-catalog"',
        "/.well-known/api-catalog",
        "api-catalog",
        responseUrl,
      ),
    ).toBe(true);
  });
});
