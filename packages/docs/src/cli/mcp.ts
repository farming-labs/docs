import { readFileSync } from "node:fs";
import pc from "picocolors";
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
  setup?: boolean;
  deploymentId?: string;
  apiBaseUrl?: string;
  json?: boolean;
}

export async function runMcp(options: RunMcpOptions = {}): Promise<void> {
  if (options.setup) {
    printHostedMcpSetup(options);
    return;
  }

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

function normalizeApiBaseUrl(value?: string) {
  return (value?.trim() || "https://api.farming-labs.dev").replace(/\/+$/g, "");
}

function printHostedMcpSetup(options: RunMcpOptions) {
  const deploymentId = options.deploymentId?.trim();

  if (!deploymentId) {
    console.error(pc.red("Missing MCP deployment id."));
    console.error();
    console.error(
      `Run ${pc.cyan("npx @farming-labs/docs mcp setup --deployment <deployment-id>")}.`,
    );
    process.exit(1);
  }

  const apiBaseUrl = normalizeApiBaseUrl(options.apiBaseUrl);
  const endpoint = `${apiBaseUrl}/v1/mcp/${deploymentId}`;
  const jsonConfig = {
    mcpServers: {
      "docs-cloud": {
        command: "npx",
        args: ["@farming-labs/docs", "mcp", "setup", "--deployment", deploymentId],
      },
    },
  };

  if (options.json) {
    console.log(JSON.stringify(jsonConfig, null, 2));
    return;
  }

  console.log(pc.bold("Docs Cloud MCP deployment"));
  console.log(pc.dim(`Deployment: ${deploymentId}`));
  console.log();
  console.log(pc.cyan("CLI stdio"));
  console.log(`  npx @farming-labs/docs mcp setup --deployment ${deploymentId}`);
  console.log();
  console.log(pc.cyan("Streamable HTTP"));
  console.log(`  ${endpoint}`);
  console.log();
  console.log(pc.cyan("SSE"));
  console.log(`  ${endpoint}/sse`);
  console.log();
  console.log(pc.cyan("MCP client JSON"));
  console.log(JSON.stringify(jsonConfig, null, 2));
  console.log();
  console.log(pc.dim("Set DOCS_CLOUD_API_KEY in the agent environment before connecting."));
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
      listDocs: readBooleanProperty(block, "listDocs"),
      listPages: readBooleanProperty(block, "listPages"),
      readPage: readBooleanProperty(block, "readPage"),
      searchDocs: readBooleanProperty(block, "searchDocs"),
      getNavigation: readBooleanProperty(block, "getNavigation"),
      getCodeExamples: readBooleanProperty(block, "getCodeExamples"),
      getConfigSchema: readBooleanProperty(block, "getConfigSchema"),
    },
  };
}
