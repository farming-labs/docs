---
name: cli
description: Use the @farming-labs/docs CLI to scaffold, upgrade, downgrade, deploy, audit, review, export or compact agent docs, validate code blocks, generate discovery files, sync search indexes, and run MCP. Use for init, deploy, upgrade, downgrade, doctor, review, agent export, agent compact, codeblocks validate, agents generate, sitemap generate, robots generate, search sync, mcp, and their flags.
compatibility: Requires Node.js and npm, pnpm, Yarn, or Bun. Package installation, hosted deployment, and external search commands require network access and provider credentials.
---

# Use the @farming-labs/docs CLI

Choose the smallest command that satisfies the request, preview its effects when possible, and
verify the resulting project or generated output.

## Workflow

1. Confirm the app/package root, framework, package manager, config path, and whether the request
   allows writes, network access, or deployment.
2. Inspect `package.json`, the lockfile, and `docs.config.ts[x]`. In a monorepo, work from the app
   containing the framework dependency.
3. Select the command and read only its focused reference below.
4. Prefer `--dry-run`, `--check`, or `--plan` before a material write when the command supports it.
5. Run the command with the project's package manager. Never place raw credentials in config,
   generated JSON, logs, or the command line when an environment-variable mechanism exists.
6. Verify changed files, package versions, generated manifests, or the affected route.
7. Report what changed, the verification result, and any manual follow-up.

## Invocation

For one-off commands, use the matching package-manager runner:

| Package manager | Latest CLI |
| --- | --- |
| npm | `npx @farming-labs/docs@latest <command>` |
| pnpm | `pnpm dlx @farming-labs/docs@latest <command>` |
| Yarn | `yarn dlx @farming-labs/docs@latest <command>` |
| Bun | `bunx @farming-labs/docs@latest <command>` |

Inside an installed project, `pnpm exec docs <command>` (or its package-manager equivalent) uses
the local version. Prefer the local binary for config-sensitive validation and generation.

## Command routing

All references are one hop from this file.

| Request | Read |
| --- | --- |
| Scaffold, framework templates, init flags, upgrade, downgrade, generated files | [Init and package versions](references/init-and-package-versions.md) |
| stdio/hosted MCP setup, Docs Cloud deploy, Typesense or Algolia sync | [MCP, cloud, and search](references/mcp-cloud-and-search.md) |
| Code-fence execution planning and docs PR review | [Validation and review](references/validation-and-review.md) |
| Sitemap, Agent Bundle, compaction, AGENTS.md, or robots.txt generation | [Agent and static outputs](references/agent-and-static-outputs.md) |
| Agent/site readiness audits, hosted probes, JSON reports | [Doctor audits](references/doctor-audits.md) |

## Common commands

```bash
pnpm dlx @farming-labs/docs@latest init
pnpm dlx @farming-labs/docs@latest upgrade --dry-run
pnpm exec docs review --ci
pnpm exec docs doctor --agent
pnpm exec docs agent export --check
pnpm exec docs sitemap generate --check
```

## Selection rules

- Use `init` for a new docs app or to add docs to an existing supported app.
- Use `upgrade --dry-run` before changing Farming Labs packages in a monorepo.
- Use `downgrade --version` only for a lower version; use `upgrade --version` for a newer one.
- Use `docs review` for changed documentation and `docs doctor --agent` for whole-site readiness.
- Use `agent export --check`, `sitemap generate --check`, `robots generate --check`, or
  `agents generate --check` to validate committed static outputs.
- Use `codeblocks validate --plan` before executing runnable documentation examples.
- Use local `docs mcp` for stdio. Use `mcp setup --deployment` to generate a hosted HTTP client
  entry; do not generate a recursive setup command.

## Safety

- Do not run `init` in the wrong directory or over an unrelated app.
- Do not execute deploy, sync, install, upgrade, downgrade, or generated-file writes when the user
  requested only an explanation or audit.
- Keep `DOCS_CLOUD_API_KEY`, search admin keys, and runner tokens in the environment.
- Treat `--force` as destructive: inspect the existing managed file before using it.
- Do not use arbitrary documented shell snippets as validation. `docs doctor` command health is
  static; executable examples require explicit code-block validation configuration.

## Verification and recovery

- Inspect `git diff` after any write.
- Run the app's typecheck/build after scaffolding or package changes.
- Run the corresponding `--check` command after generation.
- If framework detection is wrong, pass `--framework` from the app package root.
- If the binary is unavailable in this repository while dogfooding, build
  `@farming-labs/docs` and call its built CLI; installed consumer projects can call `docs`.
- If a cloud or search command fails, verify the named environment variable and endpoint without
  printing its value.

Full human documentation: [CLI](https://docs.farming-labs.dev/docs/cli) and
[Token efficiency](https://docs.farming-labs.dev/docs/token-efficiency).
