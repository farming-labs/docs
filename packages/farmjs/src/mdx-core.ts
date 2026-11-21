// Every supported core (the peer range is >=0.2.137) exports the focused compiler entry, so this
// imports it statically instead of with a synchronous require(). On Node 22.13, requiring an ES
// module that another import is still loading crashes the loader, and Farm can load the Vite
// config while another module, such as the docs theme, is still importing this entry.
export {
  applyDocsMarkdownHeadingAnchors,
  encodeDocsHeadingTocUrls,
  isolateDocsMarkdownPromptReferences,
  remarkCodeGroup,
  withDocsMarkdownRenderableHeadings,
} from "@farming-labs/docs/mdx";
