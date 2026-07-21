import type { DocsPublishedAgentSkill } from "./standards-discovery.js";

/**
 * Build-time snapshot of configured Agent Skills.
 *
 * `docsAgentSkills()` replaces this module in production bundles. The undefined
 * fallback keeps direct Node usage and development setups on the filesystem
 * resolver when the build plugin is not installed.
 */
export const bundledAgentSkills: readonly DocsPublishedAgentSkill[] | undefined = undefined;
