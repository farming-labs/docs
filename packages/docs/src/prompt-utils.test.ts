import { describe, expect, it } from "vitest";
import {
  parsePromptStringArray,
  resolvePromptProviderChoices,
  serializeDocsIconRegistry,
} from "./prompt-utils.js";

describe("parsePromptStringArray", () => {
  it("parses bracketed string arrays from JSX-style attributes", () => {
    expect(parsePromptStringArray('["copy", "open"]')).toEqual(["copy", "open"]);
  });

  it("accepts existing arrays", () => {
    expect(parsePromptStringArray(["ChatGPT", "Cursor"])).toEqual(["ChatGPT", "Cursor"]);
  });
});

describe("resolvePromptProviderChoices", () => {
  it("uses explicit prompt templates when provided", () => {
    expect(
      resolvePromptProviderChoices(
        [
          {
            name: "Cursor",
            promptUrlTemplate: "https://cursor.com/link/prompt?text={prompt}",
            iconHtml: "<svg />",
          },
        ],
        ["Cursor"],
      ),
    ).toEqual([
      {
        name: "Cursor",
        urlTemplate: "https://cursor.com/link/prompt?text={prompt}",
        iconHtml: "<svg />",
      },
    ]);
  });

  it("falls back to known provider templates by name", () => {
    expect(
      resolvePromptProviderChoices(
        [
          {
            name: "ChatGPT",
            iconHtml: "<svg />",
          },
        ],
        ["ChatGPT"],
      ),
    ).toEqual([
      {
        name: "ChatGPT",
        urlTemplate: "https://chatgpt.com/?q={prompt}",
        iconHtml: "<svg />",
      },
    ]);
  });
});

describe("serializeDocsIconRegistry", () => {
  it("preserves string-backed icon entries", () => {
    expect(serializeDocsIconRegistry({ sparkles: "<svg />" })).toEqual({ sparkles: "<svg />" });
  });
});
