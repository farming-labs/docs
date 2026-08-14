import { readFileSync } from "node:fs";
import path from "node:path";
import { runDocsAuthoringMcpStdio } from "../authoring-mcp.js";
import {
  loadDocsConfigModuleResult,
  readNavTitle,
  readStringProperty,
  resolveDocsConfigPath,
  resolveDocsContentDir,
} from "./config.js";

export interface RunAuthoringMcpOptions {
  configPath?: string;
  allowPublish?: boolean;
  branchPrefix?: string;
  baseBranch?: string;
}

export async function runAuthoringMcp(options: RunAuthoringMcpOptions = {}): Promise<void> {
  const rootDir = process.cwd();
  const configPath = resolveDocsConfigPath(rootDir, options.configPath);
  const content = readFileSync(configPath, "utf8");
  const configLoad = await loadDocsConfigModuleResult(rootDir, options.configPath);
  const config = configLoad.status === "evaluated" ? configLoad.config : undefined;
  const entry = config?.entry ?? readStringProperty(content, "entry") ?? "docs";
  const contentDir = config?.contentDir ?? resolveDocsContentDir(rootDir, content, entry);
  const navTitle =
    typeof config?.nav?.title === "string" ? config.nav.title : readNavTitle(content);
  const cliPath = process.argv[1];
  if (!cliPath) throw new Error("Could not resolve the docs CLI executable for doctor checks.");

  await runDocsAuthoringMcpStdio({
    rootDir,
    entry,
    contentDir,
    name: `${navTitle ?? "Documentation"} authoring`,
    branchPrefix: options.branchPrefix,
    baseBranch: options.baseBranch,
    allowPublish: options.allowPublish,
    doctorCommand: [
      process.execPath,
      path.resolve(cliPath),
      "doctor",
      "--agent",
      "--json",
      ...(options.configPath ? ["--config", options.configPath] : []),
    ],
  });
}
