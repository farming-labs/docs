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
