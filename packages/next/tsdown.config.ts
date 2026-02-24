import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/config.ts",
    "src/mdx-plugins/remark-heading.ts",
    "src/mdx-plugins/rehype-toc.ts",
    "src/mdx-plugins/rehype-code.ts",
    "src/mdx-plugins/remark-og.ts",
  ],
  format: "esm",
  dts: true,
  clean: true,
  outDir: "dist",
  external: [
    "next",
    "react",
    "react-dom",
    "@next/mdx",
    "@mdx-js/loader",
    "@mdx-js/react",
    "fumadocs-core",
    "remark-gfm",
    "remark-frontmatter",
    "remark-mdx-frontmatter",
  ],
});
