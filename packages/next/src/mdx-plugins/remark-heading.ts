import {
  applyDocsMarkdownHeadingAnchors,
  encodeDocsHeadingTocUrls,
  isolateDocsMarkdownPromptReferences,
  withDocsMarkdownRenderableHeadings,
} from "@farming-labs/docs";
import { remarkHeading as createFumadocsRemarkHeading } from "fumadocs-core/mdx-plugins/remark-heading";

export default function remarkHeading(
  options: Parameters<typeof createFumadocsRemarkHeading>[0] = {},
): ReturnType<typeof createFumadocsRemarkHeading> {
  if (options.slug) {
    const customRemarkHeading = createFumadocsRemarkHeading(options);
    return (root, file) => {
      isolateDocsMarkdownPromptReferences(root, file.value);
      const result = withDocsMarkdownRenderableHeadings(root, () =>
        customRemarkHeading(root, file, () => undefined),
      );
      encodeDocsHeadingTocUrls(file.data.toc);
      return result;
    };
  }

  return (root, file) => {
    isolateDocsMarkdownPromptReferences(root, file.value);
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
