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

  it("counts code blocks and inline code when includeCode is enabled", () => {
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
        "Run `docs dev` to preview locally.",
      ].join("\n"),
      3,
      { includeCode: true },
    );

    expect(minutes).toBe(6);
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
    expect(resolveReadingTimeOptions(null)).toEqual({
      enabled: false,
      format: "long",
      includeCode: false,
    });
  });

  it("resolves short reading-time labels from config", () => {
    expect(resolveReadingTimeOptions({ enabled: true, format: "short" })).toMatchObject({
      enabled: true,
      format: "short",
      includeCode: false,
    });
    expect(resolveReadingTimeOptions({ enabled: true, format: "verbose" as never })).toMatchObject({
      enabled: true,
      format: "long",
      includeCode: false,
    });
  });

  it("resolves includeCode from reading-time config", () => {
    expect(resolveReadingTimeOptions({ enabled: true, includeCode: true })).toMatchObject({
      enabled: true,
      includeCode: true,
    });
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

  it("passes includeCode through page-level reading time resolution", () => {
    const minutes = resolvePageReadingTime(
      { title: "Code Guide" },
      [
        "# Code Guide",
        "",
        "Short intro.",
        "",
        "```ts",
        "const readingTime = { includeCode: true };",
        "export default readingTime;",
        "```",
      ].join("\n"),
      {
        enabledByDefault: true,
        wordsPerMinute: 3,
        includeCode: true,
      },
    );

    expect(minutes).toBe(4);
  });

  it("allows per-page overrides to opt into reading time even when disabled globally", () => {
    expect(
      resolvePageReadingTime({ readingTime: 8, title: "Guide" }, "Short page.", {
        enabledByDefault: false,
        wordsPerMinute: 220,
      }),
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
