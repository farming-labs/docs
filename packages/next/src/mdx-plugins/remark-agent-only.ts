interface MdxNode {
  type: string;
  value?: string;
  [key: string]: unknown;
}

// A top-level `audience: agent` key, optionally quoted, with an optional trailing comment.
// Matching the line keeps this plugin free of the core barrel and a YAML parser.
const AGENT_AUDIENCE_LINE = /^audience[ \t]*:[ \t]*(["']?)agent\1[ \t]*(?:#.*)?$/m;

/**
 * Replace the body of an `audience: agent` page with a component that calls `notFound()`.
 * Agents still read the page through `{page}.md` and markdown negotiation, which are served from
 * the source file; the human HTML route returns 404 and ships none of the page's content.
 */
export default function remarkAgentOnly() {
  return (tree: { children: MdxNode[] }) => {
    const yaml = tree.children.find((node) => node.type === "yaml");
    if (!yaml?.value || !AGENT_AUDIENCE_LINE.test(yaml.value)) return;

    const moduleText = tree.children
      .filter((node) => node.type === "mdxjsEsm")
      .map((node) => node.value ?? "")
      .join("\n");
    let name = "__FarmingDocsAgentOnlyPage";
    while (moduleText.includes(name)) name += "_";

    // Keep frontmatter and authored module exports so metadata and imports still resolve.
    tree.children = [
      ...tree.children.filter((node) => node.type === "mdxjsEsm" || node.type === "yaml"),
      {
        type: "mdxjsEsm",
        value: `import { DocsAgentOnlyPage as ${name} } from "@farming-labs/next/internal/page";`,
        data: {
          estree: {
            type: "Program",
            sourceType: "module",
            body: [
              {
                type: "ImportDeclaration",
                source: { type: "Literal", value: "@farming-labs/next/internal/page" },
                specifiers: [
                  {
                    type: "ImportSpecifier",
                    imported: { type: "Identifier", name: "DocsAgentOnlyPage" },
                    local: { type: "Identifier", name },
                  },
                ],
              },
            ],
          },
        },
      },
      { type: "mdxJsxFlowElement", name, attributes: [], children: [] },
    ];
  };
}
