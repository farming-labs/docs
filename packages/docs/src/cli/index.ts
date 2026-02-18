#!/usr/bin/env node

import pc from "picocolors";
import { init } from "./init.js";

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (!command || command === "init") {
    await init();
  } else if (command === "--help" || command === "-h") {
    printHelp();
  } else if (command === "--version" || command === "-v") {
    printVersion();
  } else {
    console.error(pc.red(`Unknown command: ${command}`));
    console.error();
    printHelp();
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
${pc.bold("@farming-labs/docs")} — Documentation framework CLI

${pc.dim("Usage:")}
  npx @farming-labs/docs ${pc.cyan("<command>")}

${pc.dim("Commands:")}
  ${pc.cyan("init")}    Scaffold docs in your project (default)

${pc.dim("Supported frameworks:")}
  Next.js, SvelteKit

${pc.dim("Options:")}
  ${pc.cyan("-h, --help")}       Show this help message
  ${pc.cyan("-v, --version")}    Show version
`);
}

function printVersion() {
  // Read version from package.json at build time is tricky with ESM,
  // so we just hardcode or use a simple approach
  console.log("0.1.0");
}

main().catch((err) => {
  console.error(pc.red("An unexpected error occurred:"));
  console.error(err);
  process.exit(1);
});
