import { describe, expect, it } from "vitest";
import { resolveOpenDocsProvider, resolveOpenDocsProviderIcon } from "./open-docs-providers.js";

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

  it("resolves Codex as a built-in provider that opens the app with the prompt", () => {
    expect(resolveOpenDocsProvider("codex")).toMatchObject({
      name: "Codex",
      urlTemplate: "codex://new?prompt={prompt}",
      promptUrlTemplate: "codex://new?prompt={prompt}",
    });
  });

  it.each(["chatgpt", "claude", "cursor", "gemini", "copilot", "perplexity", "codex", "github"])(
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

  it.each([
    ["claude", "Ask Claude about this page"],
    ["chatgpt", "Ask ChatGPT about this page"],
    ["codex", "Ask Codex about this page"],
    ["github", "Edit this page on GitHub"],
  ] as const)("gives the built-in %s provider a description", (provider, description) => {
    expect(resolveOpenDocsProvider(provider)?.description).toBe(description);
    expect(resolveOpenDocsProvider({ id: provider })?.description).toBe(description);
  });

  it("keeps a configured description ahead of the preset's", () => {
    expect(
      resolveOpenDocsProvider({ id: "codex", description: "Open Codex in ChatGPT" })?.description,
    ).toBe("Open Codex in ChatGPT");
    expect(
      resolveOpenDocsProvider({
        name: "Internal",
        urlTemplate: "https://internal.example/?q={url}",
      })?.description,
    ).toBeUndefined();
  });

  it("recovers preset icons from serialized provider labels", () => {
    expect(resolveOpenDocsProviderIcon("ChatGPT")).toContain("<svg");
    expect(resolveOpenDocsProviderIcon("GitHub Copilot")).toContain("<svg");
    expect(resolveOpenDocsProviderIcon("Internal")).toBeUndefined();
  });
});
