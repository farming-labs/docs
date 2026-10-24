import fs from "node:fs";
import path from "node:path";
import {
  loadDocsConfigModule,
  readDocsAppVersion,
  renderDocsAgentSkillsBundle,
  resolveConfiguredAgentSkillsSync,
} from "@farming-labs/docs/build";
import type { Plugin, ResolvedConfig } from "vite";

const AGENT_SKILLS_BUNDLE_MODULE = "@farming-labs/docs/agent-skills-bundle";
const RESOLVED_AGENT_SKILLS_BUNDLE_MODULE = "\0farming-labs-farmjs:agent-skills-bundle";
const ROOT_DOCUMENT_FILES = ["skill.md", "AGENTS.md", "AGENT.md"] as const;

export interface FarmDocsAgentSkillsOptions {
  /** Path to docs.config, relative to the Farm application root. */
  configPath?: string;
}

function readRootDocuments(root: string): Record<string, string> | undefined {
  const documents: Record<string, string> = {};
  for (const fileName of ROOT_DOCUMENT_FILES) {
    const filePath = path.join(root, fileName);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      documents[fileName] = fs.readFileSync(filePath, "utf8");
    }
  }
  return Object.keys(documents).length > 0 ? documents : undefined;
}

/**
 * Snapshot configured Agent Skills, the project-root agent documents (`skill.md`, `AGENTS.md`),
 * and the app's `package.json` version (the default MCP server version) into production builds.
 * A deployed function such as a Vercel function contains the server bundle but not the
 * project's files, so the request-time filesystem fallback finds nothing there. Development
 * keeps reading the files, so edits show up without a rebuild.
 */
export function docsAgentSkillsBundle(options: FarmDocsAgentSkillsOptions = {}): Plugin {
  let root = process.cwd();
  let source: Promise<string> | undefined;

  async function renderBundle(): Promise<string> {
    const appVersion = readDocsAppVersion(root);
    let loaded: Awaited<ReturnType<typeof loadDocsConfigModule>>;
    try {
      loaded = await loadDocsConfigModule(root, options.configPath);
    } catch {
      loaded = null;
    }
    // Without the evaluated config, leave the skills and documents undefined so the server
    // still reads them from the filesystem, as it did before this snapshot existed.
    if (!loaded) {
      return [
        "export const bundledAgentSkills = undefined;",
        "export const bundledRootDocuments = undefined;",
        `export const bundledAppVersion = ${appVersion ? JSON.stringify(appVersion) : "undefined"};`,
        "",
      ].join("\n");
    }

    const skills = resolveConfiguredAgentSkillsSync(loaded.config.agent?.skills, {
      rootDir: root,
    });
    return renderDocsAgentSkillsBundle(skills, readRootDocuments(root), appVersion);
  }

  return {
    name: "farming-labs-farmjs-agent-skills",
    enforce: "pre",
    apply: "build",
    configResolved(config: ResolvedConfig) {
      root = config.root;
    },
    resolveId(id) {
      return id === AGENT_SKILLS_BUNDLE_MODULE ? RESOLVED_AGENT_SKILLS_BUNDLE_MODULE : undefined;
    },
    async load(id) {
      if (id !== RESOLVED_AGENT_SKILLS_BUNDLE_MODULE) return undefined;
      source ??= renderBundle();
      return source;
    },
  };
}
