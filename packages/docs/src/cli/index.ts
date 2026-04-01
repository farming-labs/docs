#!/usr/bin/env node

import pc from "picocolors";
import { init } from "./init.js";
import { upgrade } from "./upgrade.js";

const args = process.argv.slice(2);
const command = args[0];

/** Parse flags like --template next, --name my-docs, --theme concrete, --entry docs, --framework astro (exported for tests). */
export function parseFlags(argv: string[]): Record<string, string | boolean | undefined> {
  const flags: Record<string, string | boolean | undefined> = {};
  const booleanFlags = new Set(["api-reference"]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--") && arg.includes("=")) {
      const [key, value] = arg.slice(2).split("=");
      if (key.startsWith("no-")) {
        flags[key.slice(3)] = false;
      } else if (booleanFlags.has(key) && value === "true") {
        flags[key] = true;
      } else if (booleanFlags.has(key) && value === "false") {
        flags[key] = false;
      } else {
        flags[key] = value;
      }
    } else if (arg.startsWith("--") && argv[i + 1] && !argv[i + 1].startsWith("--")) {
      flags[arg.slice(2)] = argv[i + 1];
      i++;
    } else if (arg.startsWith("--no-")) {
      flags[arg.slice(5)] = false;
    } else if (arg.startsWith("--") && booleanFlags.has(arg.slice(2))) {
      flags[arg.slice(2)] = true;
    }
  }
  return flags;
}

async function main() {
  const flags = parseFlags(args);
  const initOptions = {
    template: typeof flags.template === "string" ? flags.template : undefined,
    name: typeof flags.name === "string" ? flags.name : undefined,
    theme: typeof flags.theme === "string" ? flags.theme : undefined,
    entry: typeof flags.entry === "string" ? flags.entry : undefined,
    apiReference: typeof flags["api-reference"] === "boolean" ? flags["api-reference"] : undefined,
    apiRouteRoot: typeof flags["api-route-root"] === "string" ? flags["api-route-root"] : undefined,
  };

  if (!command || command === "init") {
    await init(initOptions);
  } else if (command === "upgrade") {
    const framework =
      (typeof flags.framework === "string" ? flags.framework : undefined) ??
      (args[1] && !args[1].startsWith("--") ? args[1] : undefined);
    const tag = args.includes("--beta") ? "beta" : "latest";
    await upgrade({ framework, tag });
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
  npx @farming-labs/docs@latest ${pc.cyan("<command>")}

${pc.dim("Commands:")}
  ${pc.cyan("init")}     Scaffold docs in your project (default)
  ${pc.cyan("upgrade")}  Upgrade @farming-labs/* packages to latest (auto-detect or use --framework)

${pc.dim("Supported frameworks:")}
  Next.js, TanStack Start, SvelteKit, Astro, Nuxt

${pc.dim("Options for init:")}
  ${pc.cyan("--template <name>")}  Bootstrap a project (${pc.dim("next")}, ${pc.dim("nuxt")}, ${pc.dim("sveltekit")}, ${pc.dim("astro")}, ${pc.dim("tanstack-start")}); use with ${pc.cyan("--name")}
  ${pc.cyan("--name <project>")}  Project folder name when using ${pc.cyan("--template")}; prompt if omitted (e.g. ${pc.dim("my-docs")})
  ${pc.cyan("--theme <name>")}     Skip theme prompt (e.g. ${pc.dim("darksharp")}, ${pc.dim("concrete")})
  ${pc.cyan("--entry <path>")}     Skip entry path prompt (e.g. ${pc.dim("docs")})
  ${pc.cyan("--api-reference")}    Scaffold API reference support during ${pc.cyan("init")}
  ${pc.cyan("--no-api-reference")} Skip API reference scaffold during ${pc.cyan("init")}
  ${pc.cyan("--api-route-root <path>")}  Override the API route root scanned by ${pc.cyan("apiReference.routeRoot")} (e.g. ${pc.dim("api")}, ${pc.dim("internal-api")})

${pc.dim("Options for upgrade:")}
  ${pc.cyan("--framework <name>")}  Explicit framework (${pc.dim("next")}, ${pc.dim("tanstack-start")}, ${pc.dim("nuxt")}, ${pc.dim("sveltekit")}, ${pc.dim("astro")}); omit to auto-detect
  ${pc.cyan("--latest")}            Install latest stable (default)
  ${pc.cyan("--beta")}             Install beta versions

  ${pc.cyan("-h, --help")}         Show this help message
  ${pc.cyan("-v, --version")}     Show version
`);
}

function printVersion() {
  console.log("0.1.0");
}

main().catch((err) => {
  console.error(pc.red("An unexpected error occurred:"));
  console.error(err);
  process.exit(1);
});
