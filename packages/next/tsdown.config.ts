import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/api.ts",
    "src/api-reference.tsx",
    "src/changelog.tsx",
    "src/changelog-rail-search.tsx",
    "src/client-callbacks.tsx",
    "src/config.ts",
    "src/fumadocs-api-page.tsx",
    "src/fumadocs-renderer.ts",
    "src/layout.tsx",
    "src/mdx-plugins/remark-heading.ts",
    "src/mdx-plugins/remark-code-group.ts",
    "src/mdx-plugins/rehype-toc.ts",
    "src/mdx-plugins/rehype-code.ts",
    "src/mdx-plugins/remark-og.ts",
    "src/mdx-plugins/remark-markdown-alternate.ts",
  ],
  format: "esm",
  dts: true,
  clean: true,
  outDir: "dist",
  external: [
    "next",
    "react",
    "react-dom",
    "@/docs.config",
    "@farming-labs/docs",
    "@farming-labs/docs/agent-skills-bundle",
    "@farming-labs/docs/client/react",
    "@farming-labs/docs/cloud/server",
    "@farming-labs/docs/runtime",
    "@farming-labs/docs/server",
    "@farming-labs/theme/api",
    "@farming-labs/theme/client-hooks",
    "@next/mdx",
    "@babel/parser",
    "@mdx-js/loader",
    "@mdx-js/react",
    "fumadocs-core",
    "fumadocs-openapi",
    "fumadocs-openapi/*",
    "fumadocs-ui",
    "fumadocs-ui/*",
    "remark-gfm",
    "remark-frontmatter",
    "remark-mdx-frontmatter",
  ],
  outputOptions: {
    // Keep the marker through Rolldown, then emit the exact directive consumed
    // by Next's production tracer.
    legalComments: "inline",
    plugins: [
      {
        name: "preserve-turbopack-ignore-directives",
        renderChunk(code) {
          if (!code.includes("/*! turbopackIgnore: true */")) return null;
          return {
            code: code.replaceAll("/*! turbopackIgnore: true */", "/* turbopackIgnore: true */"),
            map: null,
          };
        },
      },
    ],
  },
});
