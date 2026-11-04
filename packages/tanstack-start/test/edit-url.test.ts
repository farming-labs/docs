import { describe, expect, it } from "vitest";
import { createDocsServer } from "../src/server.js";

function load(github: unknown) {
  return createDocsServer({
    entry: "docs",
    contentDir: "docs",
    github,
    _preloadedContent: {
      "/docs/guides/install.mdx": "---\ntitle: Install\n---\n\nBody.",
    },
  } as any).load({ pathname: "/docs/guides/install" });
}

describe("createDocsServer edit links", () => {
  it("keeps the derived blob link without a template", async () => {
    const page = await load({ url: "https://github.com/acme/docs", directory: "apps/site/docs" });

    expect(page.editOnGithub).toBe(
      "https://github.com/acme/docs/blob/main/apps/site/docs/guides/install.mdx",
    );
  });

  it("fills github.editUrl with the same repo-relative source path", async () => {
    const page = await load({
      url: "https://github.com/acme/docs",
      directory: "apps/site/docs",
      editUrl: "https://github.com/acme/docs/edit/main/{path}",
    });

    expect(page.editOnGithub).toBe(
      "https://github.com/acme/docs/edit/main/apps/site/docs/guides/install.mdx",
    );
  });

  it("uses the content source path for a template without a directory", async () => {
    const page = await load({
      url: "https://github.com/acme/docs",
      editUrl: "https://github.com/acme/docs/edit/main/{path}",
    });

    expect(page.editOnGithub).toBe(
      "https://github.com/acme/docs/edit/main/docs/guides/install.mdx",
    );
  });
});
