import type { DocsAgentSkillsInput } from "./types.js";
import type {
  DocsPublishedAgentSkill,
  DocsPublishedAgentSkillFile,
} from "./standards-discovery.js";
import {
  resolveConfiguredAgentSkills,
  type ResolveConfiguredAgentSkillsOptions,
} from "./agent-skills-server.js";

export const DOCS_AGENT_SKILLS_BUNDLE_MODULE = "@farming-labs/docs/agent-skills-bundle";
const RESOLVED_BUNDLE_MODULE = "\0farming-labs:agent-skills-bundle";

function isBundleModuleId(id: string): boolean {
  if (id === RESOLVED_BUNDLE_MODULE) return true;
  const cleanId = id.split("?", 1)[0]!.replaceAll("\\", "/");
  return /(?:^|\/)agent-skills-bundle\.(?:[cm]?js|ts)$/.test(cleanId);
}

interface DocsAgentSkillsBuildConfig {
  agent?: { skills?: DocsAgentSkillsInput };
  rootDir?: string;
}

export interface DocsAgentSkillsBuildPluginOptions extends ResolveConfiguredAgentSkillsOptions {}

/** Minimal Rollup/Vite plugin surface, kept dependency-free for framework configs. */
export interface DocsAgentSkillsBuildPlugin {
  name: string;
  enforce: "pre";
  resolveId(source: string): string | undefined;
  load(id: string): Promise<string | undefined>;
}

interface SerializedContent {
  text?: string;
  base64?: string;
}

interface SerializedSkillFile extends Omit<DocsPublishedAgentSkillFile, "content"> {
  content: SerializedContent;
}

interface SerializedSkill extends Omit<DocsPublishedAgentSkill, "content" | "files"> {
  content: SerializedContent;
  files: SerializedSkillFile[];
}

function serializeContent(content: string | Uint8Array): SerializedContent {
  return typeof content === "string"
    ? { text: content }
    : { base64: Buffer.from(content).toString("base64") };
}

function serializeSkill(skill: DocsPublishedAgentSkill): SerializedSkill {
  return {
    ...skill,
    content: serializeContent(skill.content),
    files: skill.files.map((file) => ({
      ...file,
      content: serializeContent(file.content),
    })),
  };
}

/** Render a self-contained virtual module without relying on Node at runtime. */
export function renderDocsAgentSkillsBundle(skills: readonly DocsPublishedAgentSkill[]): string {
  const snapshot = JSON.stringify(skills.map(serializeSkill))
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");

  return `const snapshot = ${snapshot};
function decodeBase64(value) {
  const binary = globalThis.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
function hydrateContent(content) {
  return typeof content.text === "string" ? content.text : decodeBase64(content.base64);
}
export const bundledAgentSkills = snapshot.map((skill) => ({
  ...skill,
  content: hydrateContent(skill.content),
  files: skill.files.map((file) => ({ ...file, content: hydrateContent(file.content) })),
}));
`;
}

/**
 * Snapshot configured Agent Skills into the server bundle.
 *
 * The same plugin object works in Vite, Astro/Svelte/TanStack, and Nitro's
 * Rollup build. Paths remain relative to the project root unless overridden.
 */
export function docsAgentSkills(
  config: DocsAgentSkillsBuildConfig,
  options: DocsAgentSkillsBuildPluginOptions = {},
): DocsAgentSkillsBuildPlugin {
  let source: Promise<string> | undefined;

  return {
    name: "farming-labs-agent-skills",
    enforce: "pre",
    resolveId(id) {
      return id === DOCS_AGENT_SKILLS_BUNDLE_MODULE ? RESOLVED_BUNDLE_MODULE : undefined;
    },
    async load(id) {
      // Also recognize the package's physical fallback module in case a Rollup
      // resolver (notably Nitro's) runs before this user-supplied plugin.
      if (!isBundleModuleId(id)) return undefined;
      source ??= resolveConfiguredAgentSkills(config.agent?.skills, {
        rootDir: options.rootDir ?? config.rootDir ?? process.cwd(),
        workspaceRoot: options.workspaceRoot,
      }).then(renderDocsAgentSkillsBundle);
      return source;
    },
  };
}
