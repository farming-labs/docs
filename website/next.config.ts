import path from "node:path";
import { withDocs } from "@farming-labs/next/config";

const repoRoot = path.resolve(process.cwd(), "..");

export default withDocs({
  turbopack: {
    root: repoRoot,
    resolveAlias: {
      "@farming-labs/docs": "./packages/docs/src/index.ts",
      "@farming-labs/next": "./packages/next/src/index.ts",
      "@farming-labs/next/client-callbacks": "./packages/next/src/client-callbacks.tsx",
      "@farming-labs/next/layout": "./packages/next/src/layout.tsx",
      "@farming-labs/next/mdx-plugins/rehype-code":
        "./packages/next/src/mdx-plugins/rehype-code.ts",
      "@farming-labs/next/mdx-plugins/rehype-toc": "./packages/next/src/mdx-plugins/rehype-toc.ts",
      "@farming-labs/next/mdx-plugins/remark-heading":
        "./packages/next/src/mdx-plugins/remark-heading.ts",
      "@farming-labs/next/mdx-plugins/remark-og": "./packages/next/src/mdx-plugins/remark-og.ts",
      "@farming-labs/theme": "./packages/fumadocs/src/index.ts",
      "@farming-labs/theme/api": "./packages/fumadocs/src/docs-api.ts",
      "@farming-labs/theme/client-hooks": "./packages/fumadocs/src/docs-client-hooks.tsx",
      "@farming-labs/theme/mdx": "./packages/fumadocs/src/mdx.ts",
    },
  },
});
