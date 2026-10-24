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

/**
 * Build-time snapshot of the app's `package.json` version, reported as the MCP
 * server version when `mcp.version` is not set. A deployed function usually has
 * no `package.json` beside it; consumers read the file when this is undefined.
 */
export const bundledAppVersion: string | undefined = undefined;
