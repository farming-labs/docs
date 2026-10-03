/**
 * Runtime primitives used by framework request handlers.
 *
 * Keep this entrypoint intentionally narrow: importing the complete server
 * surface also pulls build-time and authoring filesystem workflows into
 * production route tracing.
 */
export {
  buildApiReferenceOpenApiDocumentAsync,
  buildApiReferenceOperationPagesAsync,
  buildApiReferenceHtmlDocumentAsync,
  buildApiReferencePageTitle,
  buildApiReferenceScalarCss,
  createApiReferenceOperationMarkdownResponse,
  resolveApiReferenceConfig,
  resolveApiReferenceOpenApiDiscovery,
  resolveApiReferenceRenderer,
  resolveApiReferenceVersion,
  resolveApiReferenceVersionFromPathname,
} from "./api-reference.js";
export {
  createDocsMcpHttpHandler,
  createFilesystemDocsMcpSource,
  resolveDocsMcpConfig,
} from "./mcp.js";
export type { DocsMcpPage } from "./mcp.js";
export { readDocsSitemapManifest } from "./sitemap-server.js";
export { resolveConfiguredAgentSkills } from "./agent-skills-server.js";
