import { describe, expect, it } from "vitest";
import {
  parsePromptStringArray,
  resolvePromptProviderChoices,
  serializeDocsIconRegistry,
  serializeOpenDocsProvider,
  serializeOpenDocsProviders,
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

  it("resolves Perplexity as a built-in prompt provider", () => {
    expect(resolvePromptProviderChoices(undefined, ["Perplexity"])).toEqual([
      {
        name: "Perplexity",
        urlTemplate: "https://www.perplexity.ai/search/?q={prompt}",
        iconHtml: undefined,
      },
    ]);
  });

  it("falls back to a provider urlTemplate when no prompt template is configured", () => {
    expect(
      resolvePromptProviderChoices(
        [
          {
            name: "Internal",
            urlTemplate: "https://internal.example/?prompt={prompt}",
            iconHtml: "<svg />",
          },
        ],
        ["Internal"],
      ),
    ).toEqual([
      {
        name: "Internal",
        urlTemplate: "https://internal.example/?prompt={prompt}",
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

describe("serializeOpenDocsProviders", () => {
  it("resolves built-in provider strings with global target and prompt options", () => {
    expect(
      serializeOpenDocsProviders(["chatgpt", "cursor"], {
        target: "markdown",
        prompt: "Read this docs page: {url}",
      }),
    ).toEqual([
      {
        name: "ChatGPT",
        urlTemplate: "https://chatgpt.com/?q={prompt}",
        promptUrlTemplate: "https://chatgpt.com/?q={prompt}",
        target: "markdown",
        prompt: "Read this docs page: {url}",
      },
      {
        name: "Cursor",
        urlTemplate: "https://cursor.com/link/prompt?text={prompt}",
        promptUrlTemplate: "https://cursor.com/link/prompt?text={prompt}",
        target: "markdown",
        prompt: "Read this docs page: {url}",
      },
    ]);
  });

  it("supports per-provider target and prompt overrides", () => {
    expect(
      serializeOpenDocsProvider(
        {
          id: "claude",
          target: "source",
          prompt: "Read the source: {url}",
        },
        { target: "markdown", prompt: "Read docs: {url}" },
      ),
    ).toEqual({
      name: "Claude",
      urlTemplate: "https://claude.ai/new?q={prompt}",
      promptUrlTemplate: "https://claude.ai/new?q={prompt}",
      iconHtml: undefined,
      target: "source",
      prompt: "Read the source: {url}",
    });
  });

  it("keeps preset targets ahead of global targets for provider objects", () => {
    expect(
      serializeOpenDocsProvider(
        {
          id: "github",
        },
        { target: "markdown" },
      ),
    ).toMatchObject({
      name: "GitHub",
      urlTemplate: "{githubUrl}",
      target: "github",
    });
  });

  it("uses label as a preset alias for provider objects", () => {
    expect(serializeOpenDocsProvider({ label: "Gemini" })).toEqual({
      name: "Gemini",
      urlTemplate: "https://gemini.google.com/app?q={prompt}",
      promptUrlTemplate: "https://gemini.google.com/app?q={prompt}",
      iconHtml: undefined,
      target: undefined,
      prompt: undefined,
    });
  });

  it("keeps custom urlTemplate providers on the legacy page target by default", () => {
    expect(
      serializeOpenDocsProvider({
        name: "Internal",
        urlTemplate: "https://internal.example/?url={url}.md",
      }),
    ).toEqual({
      name: "Internal",
      urlTemplate: "https://internal.example/?url={url}.md",
      promptUrlTemplate: undefined,
      iconHtml: undefined,
      target: "page",
      prompt: undefined,
    });
  });

  it("uses the Cursor app deeplink for page and prompt actions when mode is app", () => {
    expect(serializeOpenDocsProvider({ id: "cursor", mode: "app" })).toEqual({
      name: "Cursor",
      urlTemplate: "cursor://anysphere.cursor-deeplink/prompt?text={prompt}",
      promptUrlTemplate: "cursor://anysphere.cursor-deeplink/prompt?text={prompt}",
      iconHtml: undefined,
      target: undefined,
      prompt: undefined,
    });
  });

  it("serializes Perplexity as a built-in open docs provider", () => {
    expect(serializeOpenDocsProvider("perplexity")).toEqual({
      name: "Perplexity",
      urlTemplate: "https://www.perplexity.ai/search/?q={prompt}",
      promptUrlTemplate: "https://www.perplexity.ai/search/?q={prompt}",
      target: undefined,
      prompt: undefined,
    });
  });
});
