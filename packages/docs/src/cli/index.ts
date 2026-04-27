#!/usr/bin/env node

import pc from "picocolors";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];
const UPGRADE_TAGS = ["latest", "beta"] as const;
type UpgradeTag = (typeof UPGRADE_TAGS)[number];

/** Normalize command aliases like `upgrade@beta` into the base command + dist-tag. */
export function parseCommandAlias(rawCommand?: string): {
  command?: string;
  tag?: UpgradeTag;
} {
  if (!rawCommand) return {};
  const [baseCommand, rawTag] = rawCommand.split("@");
  if (baseCommand === "upgrade" && rawTag && UPGRADE_TAGS.includes(rawTag as UpgradeTag)) {
    return {
      command: "upgrade",
      tag: rawTag as UpgradeTag,
    };
  }

  return { command: rawCommand };
}

/** Parse flags like --template next, --name my-docs, --theme concrete, --entry docs, --framework astro (exported for tests). */
export function parseFlags(argv: string[]): Record<string, string | boolean | undefined> {
  const flags: Record<string, string | boolean | undefined> = {};
  const booleanFlags = new Set(["api-reference", "typesense", "algolia"]);
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
  const parsedCommand = parseCommandAlias(command);
  const initOptions = {
    template: typeof flags.template === "string" ? flags.template : undefined,
    name: typeof flags.name === "string" ? flags.name : undefined,
    theme: typeof flags.theme === "string" ? flags.theme : undefined,
    entry: typeof flags.entry === "string" ? flags.entry : undefined,
    apiReference: typeof flags["api-reference"] === "boolean" ? flags["api-reference"] : undefined,
    apiRouteRoot: typeof flags["api-route-root"] === "string" ? flags["api-route-root"] : undefined,
  };
  const mcpOptions = {
    configPath: typeof flags.config === "string" ? flags.config : undefined,
  };
  const searchSyncOptions = {
    configPath: typeof flags.config === "string" ? flags.config : undefined,
    provider: typeof flags.provider === "string" ? flags.provider : undefined,
    typesense: typeof flags.typesense === "boolean" ? flags.typesense : undefined,
    algolia: typeof flags.algolia === "boolean" ? flags.algolia : undefined,
    baseUrl: typeof flags["base-url"] === "string" ? flags["base-url"] : undefined,
    collection: typeof flags.collection === "string" ? flags.collection : undefined,
    apiKey: typeof flags["api-key"] === "string" ? flags["api-key"] : undefined,
    adminApiKey: typeof flags["admin-api-key"] === "string" ? flags["admin-api-key"] : undefined,
    mode: typeof flags.mode === "string" ? flags.mode : undefined,
    ollamaModel: typeof flags["ollama-model"] === "string" ? flags["ollama-model"] : undefined,
    ollamaBaseUrl:
      typeof flags["ollama-base-url"] === "string" ? flags["ollama-base-url"] : undefined,
    appId: typeof flags["app-id"] === "string" ? flags["app-id"] : undefined,
    indexName: typeof flags["index-name"] === "string" ? flags["index-name"] : undefined,
    searchApiKey: typeof flags["search-api-key"] === "string" ? flags["search-api-key"] : undefined,
  };

  if (!parsedCommand.command || parsedCommand.command === "init") {
    const { init } = await import("./init.js");
    await init(initOptions);
  } else if (parsedCommand.command === "mcp") {
    const { runMcp } = await import("./mcp.js");
    await runMcp(mcpOptions);
  } else if (parsedCommand.command === "agent" && subcommand === "compact") {
    const { compactAgentDocs, parseAgentCompactArgs, printAgentCompactHelp } =
      await import("./agent.js");
    const agentCompactOptions = parseAgentCompactArgs(args.slice(2));
    if (agentCompactOptions.help) {
      printAgentCompactHelp();
      return;
    }
    await compactAgentDocs(agentCompactOptions);
  } else if (parsedCommand.command === "agent") {
    console.error(pc.red(`Unknown agent subcommand: ${subcommand ?? "(missing)"}`));
    console.error();
    const { printAgentCompactHelp } = await import("./agent.js");
    printAgentCompactHelp();
    process.exit(1);
  } else if (parsedCommand.command === "doctor") {
    const { parseDoctorArgs, printDoctorHelp, runDoctor } = await import("./doctor.js");
    const doctorOptions = parseDoctorArgs(args.slice(1));
    if (doctorOptions.help) {
      printDoctorHelp();
      return;
    }
    await runDoctor(doctorOptions);
  } else if (parsedCommand.command === "search" && subcommand === "sync") {
    const { syncSearch } = await import("./search.js");
    await syncSearch(searchSyncOptions);
  } else if (parsedCommand.command === "search") {
    console.error(pc.red(`Unknown search subcommand: ${subcommand ?? "(missing)"}`));
    console.error();
    printHelp();
    process.exit(1);
  } else if (parsedCommand.command === "upgrade") {
    const { upgrade } = await import("./upgrade.js");
    const framework =
      (typeof flags.framework === "string" ? flags.framework : undefined) ??
      (args[1] && !args[1].startsWith("--") ? args[1] : undefined);
    const tag = args.includes("--beta")
      ? "beta"
      : args.includes("--latest")
        ? "latest"
        : (parsedCommand.tag ?? "latest");
    await upgrade({ framework, tag });
  } else if (parsedCommand.command === "--help" || parsedCommand.command === "-h") {
    printHelp();
  } else if (parsedCommand.command === "--version" || parsedCommand.command === "-v") {
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
  ${pc.cyan("agent")}    Agent utilities (${pc.dim("compact")} to generate sibling agent.md files)
  ${pc.cyan("doctor")}   Inspect and score agent or reader-facing docs quality
  ${pc.cyan("mcp")}      Run the built-in docs MCP server over stdio
  ${pc.cyan("search")}   Search utilities (${pc.dim("sync")} for external indexes)
  ${pc.cyan("upgrade")}  Upgrade @farming-labs/* packages to latest (auto-detect or use --framework)

${pc.dim("Supported frameworks:")}
  Next.js, TanStack Start, SvelteKit, Astro, Nuxt

${pc.dim("Options for init:")}
  ${pc.cyan("--template <name>")}  Bootstrap a project (${pc.dim("next")}, ${pc.dim("nuxt")}, ${pc.dim("sveltekit")}, ${pc.dim("astro")}, ${pc.dim("tanstack-start")}); use with ${pc.cyan("--name")}
  ${pc.cyan("--name <project>")}  Project folder name when using ${pc.cyan("--template")}; prompt if omitted (e.g. ${pc.dim("my-docs")})
  ${pc.cyan("--theme <name>")}     Skip theme prompt (e.g. ${pc.dim("darksharp")}, ${pc.dim("command-grid")})
  ${pc.cyan("--entry <path>")}     Skip entry path prompt (e.g. ${pc.dim("docs")})
  ${pc.cyan("--api-reference")}    Scaffold API reference support during ${pc.cyan("init")}
  ${pc.cyan("--no-api-reference")} Skip API reference scaffold during ${pc.cyan("init")}
  ${pc.cyan("--api-route-root <path>")}  Override the API route root scanned by ${pc.cyan("apiReference.routeRoot")} (e.g. ${pc.dim("api")}, ${pc.dim("internal-api")})

${pc.dim("Options for mcp:")}
  ${pc.cyan("--config <path>")}     Use a custom docs config path instead of ${pc.dim("docs.config.ts[x]")}

${pc.dim("Options for agent compact:")}
  ${pc.cyan("agent compact <page...>")}             Compact pages and write sibling ${pc.dim("agent.md")} files
  ${pc.cyan("agent compact --all")}                 Compact every folder-based docs page
  ${pc.cyan("agent compact --stale")}               Refresh only stale generated ${pc.dim("agent.md")} files
  ${pc.cyan("--page <slug|path>")}                  Repeatable explicit page flag; positional page args work too
  ${pc.cyan("--include-missing")}                   With ${pc.cyan("--stale")}, also create explicit or token-budget pages missing ${pc.dim("agent.md")}
  ${pc.cyan("--api-key <key>")}                     Token Company API key (or use ${pc.dim("TOKEN_COMPANY_API_KEY")})
  ${pc.cyan("--api-key-env <name>")}                Custom env var name for the Token Company API key
  ${pc.cyan("--base-url <url>")}                    Override the Token Company API base URL
  ${pc.cyan("--aggressiveness <0-1>")}              Compression intensity for compacted output
  ${pc.cyan("--dry-run")}                           Resolve and compress pages without writing files

${pc.dim("Options for doctor:")}
  ${pc.cyan("doctor")}                              Score the current docs app for agent-readiness
  ${pc.cyan("doctor --agent")}                      Same as ${pc.cyan("doctor")}; explicit agent scoring mode
  ${pc.cyan("doctor --site")}                       Score the current docs app for reader-facing docs quality
  ${pc.cyan("doctor --human")}                      Alias for ${pc.cyan("doctor --site")}
  ${pc.cyan("doctor agent")}                        Subcommand alias for agent scoring
  ${pc.cyan("doctor site")}                         Subcommand alias for reader-facing scoring
  ${pc.cyan("doctor human")}                        Legacy alias for reader-facing scoring
  ${pc.cyan("--config <path>")}                     Use a custom docs config path instead of ${pc.dim("docs.config.ts[x]")}

${pc.dim("Options for search sync:")}
  ${pc.cyan("search sync --typesense")}             Sync docs content to Typesense using env/flags
  ${pc.cyan("search sync --algolia")}              Sync docs content to Algolia using env/flags
  ${pc.cyan("--config <path>")}                    Use a custom docs config path instead of ${pc.dim("docs.config.ts[x]")}
  ${pc.cyan("--provider <name>")}                  Explicit provider (${pc.dim("typesense")}, ${pc.dim("algolia")})
  ${pc.cyan("--typesense")}                        Shortcut for ${pc.cyan("--provider typesense")}
  ${pc.cyan("--algolia")}                          Shortcut for ${pc.cyan("--provider algolia")}
  ${pc.cyan("--base-url <url>")}                   Typesense base URL (or use ${pc.dim("TYPESENSE_URL")})
  ${pc.cyan("--collection <name>")}                Typesense collection name (default ${pc.dim("docs")})
  ${pc.cyan("--api-key <key>")}                    Typesense search/api key (or use ${pc.dim("TYPESENSE_API_KEY")})
  ${pc.cyan("--admin-api-key <key>")}              Admin-capable sync key for Typesense/Algolia
  ${pc.cyan("--mode <keyword|hybrid>")}            Typesense mode (default ${pc.dim("keyword")})
  ${pc.cyan("--ollama-model <name>")}              Embeddings model for Typesense hybrid sync
  ${pc.cyan("--ollama-base-url <url>")}            Ollama base URL for hybrid embeddings
  ${pc.cyan("--app-id <id>")}                      Algolia app id (or use ${pc.dim("ALGOLIA_APP_ID")})
  ${pc.cyan("--index-name <name>")}                Algolia index name (default ${pc.dim("docs")})
  ${pc.cyan("--search-api-key <key>")}             Algolia search key (or use ${pc.dim("ALGOLIA_SEARCH_API_KEY")})

${pc.dim("Options for upgrade:")}
  ${pc.cyan("--framework <name>")}  Explicit framework (${pc.dim("next")}, ${pc.dim("tanstack-start")}, ${pc.dim("nuxt")}, ${pc.dim("sveltekit")}, ${pc.dim("astro")}); omit to auto-detect
  ${pc.cyan("--latest")}            Install latest stable (default)
  ${pc.cyan("--beta")}             Install beta versions
  ${pc.cyan("upgrade@beta")}       Shortcut for ${pc.cyan("upgrade --beta")}
  ${pc.cyan("upgrade@latest")}     Shortcut for ${pc.cyan("upgrade --latest")}

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
