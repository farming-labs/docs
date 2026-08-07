import { describe, expect, it } from "vitest";
import { resolveOpenDocsProvider } from "./open-docs-providers.js";

describe("resolveOpenDocsProvider", () => {
  it("keeps preset targets ahead of global targets for provider objects", () => {
    expect(
      resolveOpenDocsProvider(
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

  it("keeps custom urlTemplate providers on the legacy page target by default", () => {
    expect(
      resolveOpenDocsProvider({
        name: "Internal",
        urlTemplate: "https://internal.example/?url={url}.md",
      }),
    ).toMatchObject({
      name: "Internal",
      target: "page",
    });
  });

  it("resolves Perplexity as a built-in open docs provider", () => {
    expect(resolveOpenDocsProvider("perplexity")).toMatchObject({
      name: "Perplexity",
      urlTemplate: "https://www.perplexity.ai/search/?q={prompt}",
      promptUrlTemplate: "https://www.perplexity.ai/search/?q={prompt}",
      target: undefined,
      prompt: undefined,
    });
  });

  it.each(["chatgpt", "claude", "cursor", "gemini", "copilot", "perplexity", "github"])(
    "adds the built-in %s provider icon",
    (provider) => {
      const resolved = resolveOpenDocsProvider(
        provider as Parameters<typeof resolveOpenDocsProvider>[0],
      );

      expect(resolved?.iconHtml).toContain("<svg");
      expect(resolved?.iconHtml).toContain('fill="currentColor"');
      expect(resolved?.iconHtml).toContain('aria-hidden="true"');
    },
  );

  it("keeps a configured icon ahead of the built-in provider icon", () => {
    expect(
      resolveOpenDocsProvider({
        id: "chatgpt",
        icon: '<svg viewBox="0 0 1 1"><path d="M0 0" /></svg>',
      })?.iconHtml,
    ).toContain('viewBox="0 0 1 1"');
  });
});
