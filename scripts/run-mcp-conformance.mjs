#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { MCP_CONFORMANCE_ADAPTERS } from "./mcp-conformance-server.mjs";

export const MCP_CONFORMANCE_PACKAGE_VERSION = "0.2.0-alpha.10";
export const MCP_CONFORMANCE_PROTOCOL_VERSIONS = ["2025-11-25", "2026-07-28"];
const EXPECTED_FAILURES_PATH = fileURLToPath(
  new URL("./mcp-conformance-expected-failures.yml", import.meta.url),
);

const SHARED_SCENARIOS = ["tools-list", "resources-list", "prompts-list"];
const SCENARIOS_BY_PROTOCOL = {
  "2025-11-25": ["server-initialize", "ping", ...SHARED_SCENARIOS],
  "2026-07-28": [
    "server-stateless",
    ...SHARED_SCENARIOS,
    "dns-rebinding-protection",
    "http-header-validation",
  ],
};

export function getMcpConformanceScenarios(protocolVersion) {
  const scenarios = SCENARIOS_BY_PROTOCOL[protocolVersion];
  if (!scenarios) {
    throw new Error(
      `Unsupported protocol version ${JSON.stringify(protocolVersion)}. Expected one of: ${MCP_CONFORMANCE_PROTOCOL_VERSIONS.join(", ")}`,
    );
  }
  return [...scenarios];
}

function readArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function run(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(
        new Error(
          signal
            ? `${command} exited after signal ${signal}`
            : `${command} exited with status ${code}`,
        ),
      );
    });
  });
}

async function main() {
  const adapter = readArgument("--adapter", process.env.DOCS_MCP_CONFORMANCE_ADAPTER);
  const protocolVersion = readArgument(
    "--protocol-version",
    process.env.DOCS_MCP_CONFORMANCE_PROTOCOL_VERSION,
  );
  const url = readArgument("--url", process.env.DOCS_MCP_CONFORMANCE_URL);
  const outputRoot = resolve(
    readArgument("--output-dir", "artifacts/mcp-conformance"),
    adapter,
    protocolVersion,
  );

  if (!MCP_CONFORMANCE_ADAPTERS.includes(adapter)) {
    throw new Error(
      `Unknown adapter ${JSON.stringify(adapter)}. Expected one of: ${MCP_CONFORMANCE_ADAPTERS.join(", ")}`,
    );
  }
  if (!url) throw new Error("Pass --url or set DOCS_MCP_CONFORMANCE_URL.");

  const scenarios = getMcpConformanceScenarios(protocolVersion);
  await mkdir(outputRoot, { recursive: true });

  for (const scenario of scenarios) {
    console.log(`\nOfficial MCP conformance: ${adapter} / ${protocolVersion} / ${scenario}`);
    const args = [
      "dlx",
      `@modelcontextprotocol/conformance@${MCP_CONFORMANCE_PACKAGE_VERSION}`,
      "server",
      "--url",
      url,
      "--scenario",
      scenario,
      "--spec-version",
      protocolVersion,
      "--output-dir",
      resolve(outputRoot, scenario),
    ];
    if (scenario === "server-stateless") {
      args.push("--expected-failures", EXPECTED_FAILURES_PATH);
    }
    await run("pnpm", args);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
