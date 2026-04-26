import { describe, expect, it } from "vitest";
import {
  estimateReadingTimeMinutes,
  resolveReadingTimeFromContent,
  resolvePageReadingTime,
  resolveReadingTimeFromSource,
  resolveReadingTimeOptions,
} from "./reading-time.js";

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

  it("treats null config as disabled", () => {
    expect(resolveReadingTimeOptions(null)).toEqual({ enabled: false });
  });

  it("ignores four-backtick fenced code blocks", () => {
    const minutes = resolveReadingTimeFromContent(
      {},
      [
        "# Guide",
        "",
        "This prose should count.",
        "",
        "````md",
        "```ts",
        "const hidden = true;",
        "```",
        "````",
        "",
        "This prose should count too.",
      ].join("\n"),
      4,
    );

    expect(minutes).toBe(3);
  });

  it("allows per-page overrides to opt into reading time even when disabled globally", () => {
    expect(
      resolvePageReadingTime(
        { readingTime: 8, title: "Guide" },
        "Short page.",
        { enabledByDefault: false, wordsPerMinute: 220 },
      ),
    ).toBe(8);
  });

  it("keeps pages without overrides hidden when reading time is disabled globally", () => {
    expect(
      resolvePageReadingTime({ title: "Guide" }, "Short page.", {
        enabledByDefault: false,
        wordsPerMinute: 220,
      }),
    ).toBeUndefined();
  });
});
