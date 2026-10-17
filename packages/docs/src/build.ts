/** Node-only helpers for adapter configuration, without the runtime/server barrel. */
export {
  DOCS_AI_AGENT_USER_AGENT_HEADER_PATTERN,
  DOCS_BOT_LIKE_USER_AGENT_HEADER_PATTERN,
  DOCS_TRADITIONAL_BOT_USER_AGENT_HEADER_PATTERN,
} from "./agent-detection.js";
export {
  DEFAULT_AGENT_SKILL_ARCHIVE_FORMAT,
  DEFAULT_AGENT_SKILLS_INDEX_ROUTE,
  DEFAULT_AGENT_SKILLS_ROUTE_PREFIX,
  DEFAULT_A2A_AGENT_CARD_ROUTE,
  DEFAULT_LEGACY_SKILLS_INDEX_ROUTE,
  DEFAULT_LEGACY_SKILLS_ROUTE_PREFIX,
  DEFAULT_API_CATALOG_ROUTE,
} from "./standards-discovery.js";
export { ensureDocsReviewWorkflow } from "./review.js";
export { renderDocsAgentSkillsBundle } from "./agent-skills-vite.js";
export { resolveConfiguredAgentSkillsSync } from "./agent-skills-server.js";
export { loadDocsConfigModule } from "./cli/config.js";
export type { DocsConfig } from "./types.js";
