#!/usr/bin/env node

import pc from "picocolors";
import { init } from "./init.js";

const args = process.argv.slice(2);
const command = args[0];

/** Parse flags like --template next, --name my-docs, --theme darksharp, --entry docs */
function parseFlags(argv: string[]): Record<string, string | undefined> {
  const flags: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--") && arg.includes("=")) {
      const [key, value] = arg.slice(2).split("=");
      flags[key] = value;
    } else if (arg.startsWith("--") && argv[i + 1] && !argv[i + 1].startsWith("--")) {
      flags[arg.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return flags;
}

async function main() {
  const flags = parseFlags(args);
  const initOptions = {
    template: flags.template,
    name: flags.name,
    theme: flags.theme,
    entry: flags.entry,
  };

  if (!command || command === "init") {
    await init(initOptions);
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
  Next.js, SvelteKit, Astro, Nuxt

${pc.dim("Options for init:")}
  ${pc.cyan("--template <name>")}  Bootstrap a project (${pc.dim("next")}, ${pc.dim("nuxt")}, ${pc.dim("sveltekit")}, ${pc.dim("astro")}); use with ${pc.cyan("--name")}
  ${pc.cyan("--name <project>")}  Project folder name when using ${pc.cyan("--template")}; prompt if omitted (e.g. ${pc.dim("my-docs")})
  ${pc.cyan("--theme <name>")}     Skip theme prompt (e.g. ${pc.dim("darksharp")}, ${pc.dim("greentree")})
  ${pc.cyan("--entry <path>")}     Skip entry path prompt (e.g. ${pc.dim("docs")})
  ${pc.cyan("-h, --help")}         Show this help message
  ${pc.cyan("-v, --version")}     Show version
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
