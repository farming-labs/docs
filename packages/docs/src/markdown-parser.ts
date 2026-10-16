import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";

/** Parse content without loading the MDX compiler's HTML/JavaScript transforms. */
export function createDocsMarkdownParser(format: "md" | "mdx" = "mdx") {
  const parser = unified().use(remarkParse);
  if (format === "mdx") parser.use(remarkMdx);
  return parser;
}
