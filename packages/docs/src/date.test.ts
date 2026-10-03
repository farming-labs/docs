import { describe, expect, it } from "vitest";
import { formatDocsLastModifiedDate } from "./date.js";

describe("formatDocsLastModifiedDate", () => {
  it("keeps date-only values stable across process timezones", () => {
    expect(formatDocsLastModifiedDate("2026-08-09")).toBe("August 9, 2026");
  });

  it("formats timestamp instants in UTC", () => {
    expect(formatDocsLastModifiedDate("2026-08-09T04:25:45+03:00")).toBe("August 9, 2026");
    expect(formatDocsLastModifiedDate(new Date("2026-08-09T23:30:00.000Z"))).toBe("August 9, 2026");
  });

  it("rejects invalid values", () => {
    expect(formatDocsLastModifiedDate("not-a-date")).toBeUndefined();
  });
});
