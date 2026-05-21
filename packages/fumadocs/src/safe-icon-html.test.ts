import { describe, expect, it } from "vitest";
import { sanitizeIconHtml } from "./safe-icon-html.js";

describe("sanitizeIconHtml", () => {
  it("allows simple svg and span icon markup", () => {
    expect(sanitizeIconHtml('<svg viewBox="0 0 16 16"><path d="M1 1" /></svg>')).toBe(
      '<svg viewBox="0 0 16 16"><path d="M1 1" /></svg>',
    );
    expect(sanitizeIconHtml("<span>GH</span>")).toBe("<span>GH</span>");
  });

  it("rejects event handlers, unsafe urls, and non-icon tags", () => {
    expect(sanitizeIconHtml('<svg onload="alert(1)"></svg>')).toBeUndefined();
    expect(sanitizeIconHtml('<svg><a href="javascript:alert(1)">x</a></svg>')).toBeUndefined();
    expect(sanitizeIconHtml("<script>alert(1)</script>")).toBeUndefined();
  });
});
