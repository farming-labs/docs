import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mdx from "@mdx-js/rollup";
import {
  applyDocsMarkdownHeadingAnchors,
  encodeDocsHeadingTocUrls,
  isolateDocsMarkdownPromptReferences,
  withDocsMarkdownRenderableHeadings,
} from "@farming-labs/docs";
import { remarkCodeGroup } from "@farming-labs/docs/server";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import { remarkHeading as createFumadocsRemarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";
import { rehypeToc } from "fumadocs-core/mdx-plugins/rehype-toc";
import { rehypeCode } from "fumadocs-core/mdx-plugins/rehype-code";
import { normalizePath, type PluginOption } from "vite";

export function createCanonicalDocsRemarkHeading(): ReturnType<typeof createFumadocsRemarkHeading> {
  return (root, file) => {
    isolateDocsMarkdownPromptReferences(root, file.value);
    applyDocsMarkdownHeadingAnchors(root);
    withDocsMarkdownRenderableHeadings(root, () =>
      createFumadocsRemarkHeading({ customId: false })(root, file, () => undefined),
    );
    encodeDocsHeadingTocUrls(file.data.toc);
    return root;
  };
}

interface MarkdownNode {
  type: string;
  value?: string;
  meta?: string | null;
  children?: MarkdownNode[];
}

/**
 * Preserve Farm's conventional standalone bold code labels without requiring
 * framework-owned HTML. File labels become code-block titles; generic terminal
 * labels are omitted because the language and copy affordance already identify
 * those blocks.
 */
export function remarkStandaloneCodeLabels() {
  return (tree: MarkdownNode) => {
    const children = tree.children;
    if (!children) return tree;

    for (let index = 0; index < children.length - 1; index += 1) {
      const label = children[index];
      const code = children[index + 1];
      const strong = label?.type === "paragraph" ? label.children?.[0] : undefined;
      const text = strong?.type === "strong" ? strong.children?.[0] : undefined;

      if (
        label?.children?.length !== 1 ||
        strong?.children?.length !== 1 ||
        text?.type !== "text" ||
        code?.type !== "code" ||
        !text.value?.trim()
      ) {
        continue;
      }

      const value = text.value.trim();
      if (!/^(terminal|shell|console)$/i.test(value)) {
        const title = `title=${JSON.stringify(value)}`;
        code.meta = [code.meta?.trim(), title].filter(Boolean).join(" ");
      }

      children.splice(index, 1);
      index -= 1;
    }

    return tree;
  };
}

function findWorkspaceRoot(startDir: string): string | null {
  let current = startDir;

  while (true) {
    const workspace = path.join(current, "pnpm-workspace.yaml");
    const docsSrc = path.join(current, "packages", "docs", "src", "index.ts");
    const farmjsSrc = path.join(current, "packages", "farmjs", "src", "index.ts");

    if (fs.existsSync(workspace) && fs.existsSync(docsSrc) && fs.existsSync(farmjsSrc)) {
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
  const farmjsSrc = normalizePath(path.join(workspaceRoot, "packages", "farmjs", "src"));
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
      find: /^@farming-labs\/farmjs$/,
      replacement: `${farmjsSrc}/index.ts`,
    },
    {
      find: /^@farming-labs\/farmjs\/(.+)$/,
      replacement: `${farmjsSrc}/$1`,
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
      find: /^@farming-labs\/theme\/concrete$/,
      replacement: `${themeSrc}/concrete/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/hardline$/,
      replacement: `${themeSrc}/hardline/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/shadcn$/,
      replacement: `${themeSrc}/shadcn/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/threadline$/,
      replacement: `${themeSrc}/threadline/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/command-grid$/,
      replacement: `${themeSrc}/command-grid/index.ts`,
    },
    {
      find: /^@farming-labs\/theme\/ledger$/,
      replacement: `${themeSrc}/ledger/index.ts`,
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
      name: "farming-labs-farmjs-workspace-alias",
      enforce: "pre",
      config() {
        return {
          ...(aliases.length > 0 ? { resolve: { alias: aliases } } : {}),
          ssr: {
            noExternal: ["@farming-labs/docs", "@farming-labs/theme"],
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
        remarkStandaloneCodeLabels,
        remarkCodeGroup,
        createCanonicalDocsRemarkHeading,
      ],
      rehypePlugins: [
        rehypeToc,
        [rehypeCode, { themes: { dark: "github-dark", light: "github-light" } }],
      ],
    }),
  ];
}
