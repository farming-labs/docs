import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createFilesystemDocsMcpSource, resolveDocsMcpConfig, runDocsMcpStdio } from "../server.js";
import type { DocsMcpConfig } from "../types.js";

const FILE_EXTS = ["tsx", "ts", "jsx", "js"];

interface RunMcpOptions {
  configPath?: string;
}

export async function runMcp(options: RunMcpOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveDocsConfigPath(rootDir, options.configPath);
  const content = readFileSync(configPath, "utf-8");

  const entry = readStringProperty(content, "entry") ?? "docs";
  const contentDir = readStringProperty(content, "contentDir") ?? entry;
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

function resolveDocsConfigPath(rootDir: string, explicitPath?: string): string {
  if (explicitPath) {
    const resolvedPath = resolve(rootDir, explicitPath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`Could not find docs config at ${explicitPath}.`);
    }
    return resolvedPath;
  }

  for (const ext of FILE_EXTS) {
    const configPath = join(rootDir, `docs.config.${ext}`);
    if (existsSync(configPath)) return configPath;
  }

  throw new Error(
    "Could not find docs.config.ts or docs.config.tsx in the current project. Use --config to point at a custom path.",
  );
}

function readStringProperty(content: string, key: string): string | undefined {
  const match = content.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`));
  return match?.[1];
}

function readNavTitle(content: string): string | undefined {
  const block = extractObjectLiteral(content, "nav");
  if (!block) return undefined;
  return readStringProperty(block, "title");
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

function readBooleanProperty(content: string, key: string): boolean | undefined {
  const match = content.match(new RegExp(`${key}\\s*:\\s*(true|false)`));
  return match ? match[1] === "true" : undefined;
}

function extractObjectLiteral(content: string, key: string): string | undefined {
  const keyIndex = content.search(new RegExp(`${key}\\s*:\\s*\\{`));
  if (keyIndex === -1) return undefined;

  const braceStart = content.indexOf("{", keyIndex);
  if (braceStart === -1) return undefined;

  let depth = 0;

  for (let index = braceStart; index < content.length; index += 1) {
    const char = content[index];

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char !== "}") continue;

    depth -= 1;
    if (depth === 0) {
      return content.slice(braceStart + 1, index);
    }
  }

  return undefined;
}
