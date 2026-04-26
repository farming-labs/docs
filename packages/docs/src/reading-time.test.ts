import { describe, expect, it } from "vitest";
import { estimateReadingTimeMinutes, resolveReadingTimeFromSource } from "./reading-time.js";

describe("reading time helpers", () => {
  it("ignores code blocks and links when estimating", () => {
    const minutes = estimateReadingTimeMinutes(
      [
        "# Install",
        "",
        "Read these words carefully before setup.",
        "",
        "```bash",
        "pnpm install",
        "pnpm dev",
        "```",
        "",
        "Visit [Configuration](/docs/configuration) for more details.",
      ].join("\n"),
      3,
    );

    expect(minutes).toBe(4);
  });

  it("respects per-page numeric overrides", () => {
    expect(
      resolveReadingTimeFromSource(
        ["---", "readingTime: 8", "---", "", "# Hello", "", "Short page."].join("\n"),
      ),
    ).toBe(8);
  });

  it("respects per-page disabled overrides", () => {
    expect(
      resolveReadingTimeFromSource(
        ["---", "readingTime: false", "---", "", "# Hello", "", "Short page."].join("\n"),
      ),
    ).toBeNull();
  });
});
