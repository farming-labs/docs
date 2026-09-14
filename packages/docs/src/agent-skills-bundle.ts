import type { DocsPublishedAgentSkill } from "./standards-discovery.js";

/**
 * Build-time snapshot of configured Agent Skills.
 *
 * `docsAgentSkills()` replaces this module in production bundles. The undefined
 * fallback keeps direct Node usage and development setups on the filesystem
 * resolver when the build plugin is not installed.
 */
export const bundledAgentSkills: readonly DocsPublishedAgentSkill[] | undefined = undefined;

/**
 * Build-time snapshot of the project-root agent documents (`skill.md`,
 * `AGENTS.md`, `AGENT.md`), keyed by filename. Replaced together with
 * `bundledAgentSkills`; consumers fall back to the filesystem when undefined.
 */
export const bundledRootDocuments: Readonly<Record<string, string>> | undefined = undefined;
