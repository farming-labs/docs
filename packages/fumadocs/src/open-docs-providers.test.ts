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
    expect(resolveOpenDocsProvider("perplexity")).toEqual({
      name: "Perplexity",
      urlTemplate: "https://www.perplexity.ai/search/?q={prompt}",
      promptUrlTemplate: "https://www.perplexity.ai/search/?q={prompt}",
      target: undefined,
      prompt: undefined,
    });
  });
});
