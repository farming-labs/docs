import mdx from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { remarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";
import { rehypeToc } from "fumadocs-core/mdx-plugins/rehype-toc";
import { rehypeCode } from "fumadocs-core/mdx-plugins/rehype-code";

export function docsMdx(): ReturnType<typeof mdx> {
  return mdx({
    include: /\.(md|mdx)$/,
    remarkPlugins: [
      remarkGfm,
      remarkFrontmatter,
      [remarkMdxFrontmatter, { name: "metadata" }],
      remarkHeading,
    ],
    rehypePlugins: [
      rehypeToc,
      [rehypeCode, { themes: { dark: "github-dark", light: "github-light" } }],
    ],
  });
}
