/**
 * Next.js config wrapper for @farming-labs/docs.
 * Handles MDX compilation, frontmatter, syntax highlighting, TOC extraction,
 * and auto-generates mdx-components.tsx when missing.
 *
 * @example
 * // Minimal
 *   import { withDocs } from "@farming-labs/next/config";
 *   export default withDocs();
 *
 * @example
 * // With existing Next.js config
 *   import { withDocs } from "@farming-labs/next/config";
 *   export default withDocs({
 *     images: { remotePatterns: [{ hostname: "example.com" }] },
 *   });
 */

import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// @ts-ignore – no types needed at config time
import createMDX from "@next/mdx";
// @ts-ignore
import remarkFrontmatter from "remark-frontmatter";
// @ts-ignore
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
// @ts-ignore
import rehypePrettyCode from "rehype-pretty-code";
// @ts-ignore
import { remarkHeading, rehypeToc } from "fumadocs-core/mdx-plugins";

const DEFAULT_MDX_COMPONENTS = `\
import { getMDXComponents } from "@farming-labs/fumadocs/mdx";
import type { MDXComponents } from "mdx/types";
import docsConfig from "@/docs.config";

// Merges default fumadocs MDX components with any user-provided overrides
// from docs.config.ts \`components\` field.
//
// Example — pass a custom Callout in docs.config.ts:
//   components: { Callout: MyCallout }
export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return getMDXComponents({
    ...(docsConfig.components as MDXComponents),
    ...components,
  });
}
`;

export function withDocs(nextConfig: Record<string, unknown> = {}) {
  // -----------------------------------------------------------------------
  // Auto-generate mdx-components.tsx if missing.
  // Next.js requires this file for custom MDX component resolution in
  // App Router. We create it transparently so users don't have to.
  // -----------------------------------------------------------------------
  const root = process.cwd();
  const mdxComponentsExts = ["tsx", "ts", "jsx", "js"];
  const hasMdxComponents = mdxComponentsExts.some((ext) =>
    existsSync(join(root, `mdx-components.${ext}`)),
  );

  if (!hasMdxComponents) {
    writeFileSync(join(root, "mdx-components.tsx"), DEFAULT_MDX_COMPONENTS);
  }

  const withMDX = createMDX({
    extension: /\.mdx?$/,
    options: {
      remarkPlugins: [
        remarkFrontmatter,
        // Export frontmatter as `export const metadata = { title, description, ... }`
        // Next.js App Router automatically uses this for page <title> and <meta>.
        [remarkMdxFrontmatter, { name: "metadata" }],
        remarkHeading, // adds id attributes to headings
      ],
      rehypePlugins: [
        rehypeToc, // extracts TOC data and exports as `toc` from each MDX file
        [
          rehypePrettyCode,
          { theme: { dark: "github-dark", light: "github-light" } },
        ],
      ],
    },
  });

  // Ensure pageExtensions always includes md/mdx for MDX support,
  // while preserving any extensions the user already configured.
  const defaultExts = ["js", "jsx", "md", "mdx", "ts", "tsx"];
  const userExts = nextConfig.pageExtensions as string[] | undefined;

  if (userExts) {
    for (const ext of ["md", "mdx"]) {
      if (!userExts.includes(ext)) {
        userExts.push(ext);
      }
    }
  } else {
    nextConfig.pageExtensions = defaultExts;
  }

  return withMDX(nextConfig);
}
