import {
  applyDocsMarkdownHeadingAnchors,
  withDocsMarkdownRenderableHeadings,
} from "@farming-labs/docs";
import { remarkHeading as createFumadocsRemarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";

function encodeDocsHeadingTocUrls(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) encodeDocsHeadingTocUrls(item);
    return;
  }
  if (!value || typeof value !== "object") return;

  const item = value as { url?: unknown; children?: unknown };
  if (typeof item.url === "string") {
    const hashIndex = item.url.indexOf("#");
    if (hashIndex >= 0) {
      item.url = `${item.url.slice(0, hashIndex)}#${encodeURIComponent(
        item.url.slice(hashIndex + 1),
      )}`;
    }
  }
  encodeDocsHeadingTocUrls(item.children);
}

export default function remarkHeading(
  options: Parameters<typeof createFumadocsRemarkHeading>[0] = {},
): ReturnType<typeof createFumadocsRemarkHeading> {
  if (options.slug) {
    const customRemarkHeading = createFumadocsRemarkHeading(options);
    return (root, file) =>
      withDocsMarkdownRenderableHeadings(root, () =>
        customRemarkHeading(root, file, () => undefined),
      );
  }

  return (root, file) => {
    applyDocsMarkdownHeadingAnchors(root, { customId: options.customId });
    withDocsMarkdownRenderableHeadings(root, () =>
      createFumadocsRemarkHeading({
        ...options,
        customId: false,
      })(root, file, () => undefined),
    );
    encodeDocsHeadingTocUrls(file.data.toc);
    return root;
  };
}
