import { describe, expect, it } from "vitest";
import { encodeDocsHeadingTocUrls } from "./heading-toc.js";

describe("renderer heading TOC URLs", () => {
  it("encodes nested fragments while preserving URL prefixes", () => {
    const toc = [
      {
        url: "#café-配置",
        children: [
          { url: "/docs/guide#foo#bar" },
          { url: "#foo%23bar" },
          { url: "/docs/without-fragment" },
        ],
      },
    ];

    encodeDocsHeadingTocUrls(toc);

    expect(toc).toEqual([
      {
        url: "#caf%C3%A9-%E9%85%8D%E7%BD%AE",
        children: [
          { url: "/docs/guide#foo%23bar" },
          { url: "#foo%2523bar" },
          { url: "/docs/without-fragment" },
        ],
      },
    ]);
  });
});
