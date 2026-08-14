# Agent and static outputs

Use this reference for sitemaps, Static Agent Bundles, compact `agent.md`, generated AGENTS.md, and
robots.txt.

## Contents

- [Sitemap generation](#sitemap-generation)
- [Static Agent Bundles](#static-agent-bundles)
- [Agent compaction](#agent-compaction)
- [Agent Skill scaffolding](#agent-skill-scaffolding)
- [AGENTS.md generation](#agentsmd-generation)
- [robots.txt generation](#robotstxt-generation)
- [Verification](#verification)

## Sitemap generation

```bash
pnpm exec docs sitemap generate
pnpm exec docs sitemap generate --config src/lib/docs.config.ts
pnpm exec docs sitemap generate --manifest-only
pnpm exec docs sitemap generate --check
```

Behavior:

- reads root config unless `--config` is supplied
- scans `entry` and `contentDir`
- writes `.farming-labs/sitemap-manifest.json`
- writes `sitemap.xml`, `sitemap.md`, `docs/sitemap.md`, and `.well-known/sitemap.md` by default
- uses `static/` for SvelteKit and `public/` otherwise
- gets `lastmod` from the last git commit, then filesystem mtime
- preserves `generatedAt` when comparable content is unchanged

Flags:

| Flag | Effect |
| --- | --- |
| `--config <path>` | Select config |
| `--manifest-only` | Write only the internal manifest |
| `--public` | Explicitly request public files; already the default |
| `--check` | Fail when outputs are stale |

For server-rendered builds, `--manifest-only` may be enough. For static builds, generate public
files before the framework build.

## Static Agent Bundles

Use for a host without the runtime handler:

```bash
pnpm exec docs agent export --public
pnpm exec docs agent export --check
pnpm exec docs agent export --public --config src/lib/docs.config.ts
```

- `--public` is required for writes.
- `--check` resolves the same outputs without writing.
- Pages use sibling `agent.md`, then the agent audience projection.
- Exports include page Markdown, llms files, discovery JSON, hashed skills/direct companions,
  skills and AGENTS aliases, sitemaps, robots, and `/.well-known/okf.json` when `agent.okf` is
  enabled.
- Manifests include deterministic SHA-256 hashes.
- Static discovery disables search, MCP, feedback, API reference, and OpenAPI.
- RFC 9727 API catalog output is intentionally omitted because generic static hosting cannot
  guarantee the profiled media type.
- Tracked git dates keep output reproducible across clones.
- Native public overrides are preserved.
- Root repository `AGENTS.md` is never copied implicitly; use `agents generate`.
- Writes use atomic same-directory renames.
- Obsolete managed outputs are deleted only when their contents still match the prior hash.
- Symlink escapes from public/internal roots are rejected.

Build integration:

```json
{
  "scripts": {
    "build": "docs agent export --public && next build",
    "check:agents": "docs agent export --check"
  }
}
```

## Agent compaction

Use for smaller page-specific machine docs:

```bash
pnpm exec docs agent compact installation configuration
pnpm exec docs agent compact /docs/installation
pnpm exec docs agent compact https://docs.example.com/docs/installation
pnpm exec docs agent compact . --dry-run
pnpm exec docs agent compact --all
pnpm exec docs agent compact --changed
pnpm exec docs agent compact --stale
pnpm exec docs agent compact --stale --include-missing
```

Behavior:

- positional pages are preferred; `--page` is a repeatable alias
- identifiers may be slugs, docs routes, `.md` paths, URLs, or `.` for root
- loads `.env` and `.env.local`
- resolves cloud key from root `cloud.apiKey.env`; one-off overrides exist
- uses `agent.compact` config defaults
- `--changed` includes staged, unstaged, untracked, and handwritten agent sources
- `--stale` refreshes only outputs whose source/settings changed
- `--include-missing` works with `--stale`
- writes sibling `agent.md` only for folder-based pages
- generated Markdown/API/MCP page reads use that file
- page `agent.tokenBudget` overrides the output target
- too-large inherited `minOutputTokens` is clamped down
- hidden provenance lets doctor distinguish fresh, stale, modified, unknown, and missing-budget
  states

Recommended config:

```ts
cloud: {
  apiKey: { env: "DOCS_CLOUD_API_KEY" },
},
agent: {
  compact: {
    model: "docs-cloud-compress-v1",
    aggressiveness: 0.3,
    protectJson: true,
  },
}
```

## Agent Skill scaffolding

Compile structured page `agent` contracts into an installable, progressively disclosed skill:

```bash
pnpm exec docs skills scaffold --dry-run
pnpm exec docs skills scaffold
pnpm exec docs skills scaffold --check
```

The command works offline and deterministically. It writes one compact `SKILL.md` routing file and
one direct `references/*.md` file per selected actionable page. References contain the authored
task, expected result, applicability, prerequisites, files, commands, side effects, verification,
recovery, rollback, and canonical source—but not the complete page prose.

Defaults and controls:

- derives the skill name from `nav.title` and writes `skills/<name>/`
- accepts a positional name or `--name <name>`
- accepts `--output <skill-directory>` when the directory basename matches the skill name
- accepts repeatable `--include <route-prefix>` values for a smaller topic-specific skill
- honors configured Agent Skill line and instruction-token budgets
- preserves user-owned files unless `--force` is explicit
- removes obsolete references only when they retain the generated marker

Use `--check` in CI after committing the generated skill. Add the resulting skill directory to
`agent.skills.paths` when it should be published through discovery, static exports, and MCP.

## AGENTS.md generation

```bash
pnpm exec docs agents generate
pnpm exec docs agents generate --check
pnpm exec docs agents generate --force
pnpm exec docs agents generate --path AGENTS.md
```

It writes a managed root file and public aliases at `/AGENTS.md`, the well-known path, `/AGENT.md`,
and its well-known path. SvelteKit uses `static/`; others use `public/`.

Handwritten root files are preserved unless `--force` is explicit. A handwritten root file is
copied to missing public aliases for static hosting.

## robots.txt generation

```bash
pnpm exec docs robots generate
pnpm exec docs robots generate --append
pnpm exec docs robots generate --force
pnpm exec docs robots generate --path public/robots.txt --append
pnpm exec docs robots generate --check
pnpm exec docs robots generate --config src/lib/docs.config.ts
```

- defaults to `public/robots.txt`, or `static/robots.txt` for SvelteKit
- `robots.path` changes the default
- positional `--path` wins
- preserves unknown existing files
- `--append` updates a managed block inside an existing policy
- `--force` replaces the complete file
- `--check` reports stale output

Run `docs doctor --agent` after writing it to catch blocked agent routes or common AI crawlers.

## Verification

Inspect the diff, then run every relevant check:

```bash
pnpm exec docs sitemap generate --check
pnpm exec docs agent export --check
pnpm exec docs agents generate --check
pnpm exec docs robots generate --check
```

If `--check` fails after a deliberate source/config change, run the matching write command once
and inspect all generated changes before committing. Never use `--force` without inspecting the
existing file and confirming replacement is intended.
