import { readFileSync } from "node:fs";
import { createFilesystemDocsMcpSource, resolveDocsMcpConfig, runDocsMcpStdio } from "../server.js";
import type { DocsMcpConfig } from "../types.js";
import {
  extractObjectLiteral,
  readBooleanProperty,
  readNavTitle,
  readStringProperty,
  resolveDocsConfigPath,
  resolveDocsContentDir,
} from "./config.js";

interface RunMcpOptions {
  configPath?: string;
}

export async function runMcp(options: RunMcpOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveDocsConfigPath(rootDir, options.configPath);
  const content = readFileSync(configPath, "utf-8");

  const entry = readStringProperty(content, "entry") ?? "docs";
  const contentDir = resolveDocsContentDir(rootDir, content, entry);
  const navTitle = readNavTitle(content);
  const mcp = readMcpConfig(content);

  const source = createFilesystemDocsMcpSource({
    rootDir,
    entry,
    contentDir,
    siteTitle: navTitle ?? "Documentation",
  });

  const resolvedMcp = resolveDocsMcpConfig(mcp ?? true, {
    defaultName: navTitle ?? "@farming-labs/docs",
  });

  await runDocsMcpStdio({
    source,
    mcp: resolvedMcp,
    defaultName: navTitle ?? "@farming-labs/docs",
  });
}

function readMcpConfig(content: string): boolean | DocsMcpConfig | undefined {
  if (content.match(/mcp\s*:\s*false/)) return false;
  if (content.match(/mcp\s*:\s*true/)) return true;

  const block = extractObjectLiteral(content, "mcp");
  if (!block) return undefined;

  return {
    enabled: readBooleanProperty(block, "enabled"),
    route: readStringProperty(block, "route"),
    name: readStringProperty(block, "name"),
    version: readStringProperty(block, "version"),
    tools: {
      listPages: readBooleanProperty(block, "listPages"),
      readPage: readBooleanProperty(block, "readPage"),
      searchDocs: readBooleanProperty(block, "searchDocs"),
      getNavigation: readBooleanProperty(block, "getNavigation"),
    },
  };
}
