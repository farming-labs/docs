import { compile, run } from "@mdx-js/mdx";
import { createElement, type ComponentType } from "react";
import * as runtime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import remarkFrontmatter from "remark-frontmatter";
import { describe, expect, it } from "vitest";
import { remarkDocsTitleSlot } from "./title-slot-mdx.js";

async function slotsIn(source: string, format: "md" | "mdx" = "mdx") {
  const code = String(
    await compile(source, { format, remarkPlugins: [remarkFrontmatter, remarkDocsTitleSlot] }),
  );
  const body = code.slice(code.indexOf("return"));
  return {
    code: body,
    positions: [...body.matchAll(/position: "(title|description)"/g)].map((match) => match[1]),
    order: (...needles: string[]) => needles.map((needle) => body.indexOf(needle)),
  };
}

describe("remarkDocsTitleSlot", () => {
  it("places a title slot after the h1 and a description slot after the next paragraph", async () => {
    const { positions, order } = await slotsIn(
      `---\ntitle: Install\n---\nimport X from "x"\n\n{/* note */}\n\n# Install\n\nThe description.\n\nBody text.`,
    );

    expect(positions).toEqual(["title", "description"]);
    const [title, titleSlot, description, descriptionSlot, body] = order(
      '"Install"',
      'position: "title"',
      "The description.",
      'position: "description"',
      "Body text.",
    );
    expect(title).toBeLessThan(titleSlot);
    expect(titleSlot).toBeLessThan(description);
    expect(description).toBeLessThan(descriptionSlot);
    expect(descriptionSlot).toBeLessThan(body);
  });

  it("only places the title slot when the h1 is not followed by a paragraph", async () => {
    expect((await slotsIn(`# Install\n\n- step one\n\nBody text.`, "md")).positions).toEqual([
      "title",
    ]);
  });

  it("reads the slot from the page's components, so a map without it renders nothing", async () => {
    const { code } = await slotsIn(`# Install\n\nBody text.`);

    expect(code).toContain("(props.components?.DocsTitleSlot)");
    expect(code).not.toContain("_missingMdxReference");
  });

  it("renders without the slot component, as an older theme or custom map would", async () => {
    const code = String(
      await compile(`# Install\n\nThe description.\n\nBody text.`, {
        outputFormat: "function-body",
        remarkPlugins: [remarkDocsTitleSlot],
      }),
    );
    const { default: Content } = (await run(code, { ...runtime, baseUrl: import.meta.url })) as {
      default: ComponentType<{ components?: Record<string, unknown> }>;
    };
    const plain = "<h1>Install</h1>\n<p>The description.</p>\n<p>Body text.</p>";
    const squash = (html: string) => html.replace(/\n+/g, "\n");

    expect(squash(renderToStaticMarkup(createElement(Content)))).toBe(plain);
    expect(squash(renderToStaticMarkup(createElement(Content, { components: { p: "p" } })))).toBe(
      plain,
    );
    const Slot = ({ position }: { position: string }) => createElement("i", null, position);
    expect(
      squash(renderToStaticMarkup(createElement(Content, { components: { DocsTitleSlot: Slot } }))),
    ).toBe(
      "<h1>Install</h1>\n<i>title</i>\n<p>The description.</p>\n<i>description</i>\n<p>Body text.</p>",
    );
  });

  it("leaves pages alone when their first visible block is not an h1", async () => {
    expect((await slotsIn(`> A note.\n\n# Install\n\nBody text.`)).positions).toEqual([]);
    expect((await slotsIn(`Intro paragraph.\n\n## Section`)).positions).toEqual([]);
    expect((await slotsIn(`## Install\n\nBody text.`)).positions).toEqual([]);
  });
});
