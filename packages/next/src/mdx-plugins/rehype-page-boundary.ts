import type { DocsPageRoute } from "../page-routes.js";

/** The wrapper adds no markup; its client boundary reuses the existing page component. */
export default function rehypePageBoundary({ pages = [] }: { pages?: DocsPageRoute[] } = {}) {
  const routes = new Map(pages.map((page) => [page.source, page.route]));
  return (tree: { children: any[] }, file: { path?: string; history?: string[] }) => {
    const source = (file.path ?? file.history?.[0] ?? "").replaceAll("\\", "/");
    const route = routes.get(source);
    if (route === undefined) return;
    let name = "__FarmingDocsPageBoundary";
    const moduleText = tree.children
      .filter((node) => node.type === "mdxjsEsm")
      .map((node) => node.value ?? "")
      .join("\n");
    while (moduleText.includes(name)) name += "_";
    // Preserve authored module bindings, frontmatter exports, and the TOC export.
    const moduleNodes = tree.children.filter(
      (node) => node.type === "mdxjsEsm" || node.type === "yaml",
    );
    const content = tree.children.filter(
      (node) => node.type !== "mdxjsEsm" && node.type !== "yaml",
    );
    // Match hast-util-to-estree's root handling before moving content into JSX.
    // Frontmatter/module nodes otherwise leave a new leading whitespace child.
    const isRootWhitespace = (node: any) => {
      const expression =
        node.type === "mdxFlowExpression" ? node.data?.estree?.body?.[0]?.expression : undefined;
      const value =
        node.type === "text"
          ? node.value
          : expression?.type === "Literal"
            ? String(expression.value)
            : undefined;
      return typeof value === "string" && /^[ \t\n\f\r]*$/.test(value);
    };
    let start = 0;
    let end = content.length;
    while (start < end && isRootWhitespace(content[start])) start += 1;
    while (end > start && isRootWhitespace(content[end - 1])) end -= 1;
    tree.children = [
      ...moduleNodes,
      {
        type: "mdxjsEsm",
        value: `import { DocsPageBoundary as ${name} } from "@farming-labs/next/internal/page";`,
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
                    imported: { type: "Identifier", name: "DocsPageBoundary" },
                    local: { type: "Identifier", name },
                  },
                ],
              },
            ],
          },
        },
      },
      {
        type: "mdxJsxFlowElement",
        name,
        attributes: [{ type: "mdxJsxAttribute", name: "route", value: route }],
        children: content.slice(start, end),
      },
    ];
  };
}
