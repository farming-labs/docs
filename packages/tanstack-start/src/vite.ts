import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mdx from "@mdx-js/rollup";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { remarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";
import { rehypeToc } from "fumadocs-core/mdx-plugins/rehype-toc";
import { rehypeCode } from "fumadocs-core/mdx-plugins/rehype-code";
import { normalizePath, type PluginOption } from "vite";

function findWorkspaceRoot(startDir: string): string | null {
  let current = startDir;

  while (true) {
    const workspace = path.join(current, "pnpm-workspace.yaml");
    const docsSrc = path.join(current, "packages", "docs", "src", "index.ts");
    const tanstackSrc = path.join(current, "packages", "tanstack-start", "src", "index.ts");

    if (fs.existsSync(workspace) && fs.existsSync(docsSrc) && fs.existsSync(tanstackSrc)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function resolveWorkspaceAliases() {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const workspaceRoot = findWorkspaceRoot(moduleDir);

  if (!workspaceRoot) return [];

  const docsSrc = normalizePath(path.join(workspaceRoot, "packages", "docs", "src"));
  const tanstackSrc = normalizePath(path.join(workspaceRoot, "packages", "tanstack-start", "src"));
  const themeSrc = normalizePath(path.join(workspaceRoot, "packages", "fumadocs", "src"));

  return [
    {
      find: /^@farming-labs\/docs$/,
      replacement: `${docsSrc}/index.ts`,
    },
    {
      find: /^@farming-labs\/docs\/(.+)$/,
      replacement: `${docsSrc}/$1`,
    },
    {
      find: /^@farming-labs\/tanstack-start$/,
      replacement: `${tanstackSrc}/index.ts`,
    },
    {
      find: /^@farming-labs\/tanstack-start\/(.+)$/,
      replacement: `${tanstackSrc}/$1`,
    },
    {
      find: /^@farming-labs\/theme$/,
      replacement: `${themeSrc}/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/mdx$/,
      replacement: `${themeSrc}/mdx.ts`,
    },
    {
      find: /^@farming-labs\/theme\/default$/,
      replacement: `${themeSrc}/default/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/darksharp$/,
      replacement: `${themeSrc}/darksharp/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/pixel-border$/,
      replacement: `${themeSrc}/pixel-border/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/colorful$/,
      replacement: `${themeSrc}/colorful/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/shiny$/,
      replacement: `${themeSrc}/shiny/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/darkbold$/,
      replacement: `${themeSrc}/darkbold/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/greentree$/,
      replacement: `${themeSrc}/greentree/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/brutalist$/,
      replacement: `${themeSrc}/brutalist/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/search$/,
      replacement: `${themeSrc}/search.ts`,
    },
    {
      find: /^@farming-labs\/theme\/api$/,
      replacement: `${themeSrc}/docs-api.ts`,
    },
    {
      find: /^@farming-labs\/theme\/tanstack$/,
      replacement: `${themeSrc}/tanstack.ts`,
    },
    {
      find: /^@farming-labs\/theme\/ai$/,
      replacement: `${themeSrc}/ai-search-dialog.tsx`,
    },
  ];
}

export function docsMdx(): PluginOption {
  const aliases = resolveWorkspaceAliases();

  return [
    {
      name: "farming-labs-tanstack-workspace-alias",
      enforce: "pre",
      config() {
        if (aliases.length === 0) return;

        return {
          resolve: {
            alias: aliases,
          },
        };
      },
    },
    mdx({
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
    }),
  ];
}
