import { rehypeCode } from "fumadocs-core/mdx-plugins/rehype-code";

const rehypeDocsCode: typeof rehypeCode = function (options) {
  return rehypeCode.call(this, { engine: "oniguruma", ...options });
};

export default rehypeDocsCode;
