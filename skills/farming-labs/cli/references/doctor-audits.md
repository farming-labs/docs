# Doctor audits

Use this reference for local agent/site readiness scoring, structured JSON reports, or deployed
endpoint conformance.

## Contents

- [Commands](#commands)
- [Agent audit coverage](#agent-audit-coverage)
- [Hosted probes](#hosted-probes)
- [Interpreting results](#interpreting-results)
- [Verification and recovery](#verification-and-recovery)

## Commands

```bash
pnpm exec docs doctor
pnpm exec docs doctor --agent
pnpm exec docs doctor --site
pnpm exec docs doctor --agent --json
pnpm exec docs doctor --agent --ci --json-output .farming-labs/doctor.json
pnpm exec docs doctor --agent --config docs.config.tsx
pnpm exec docs doctor --agent --url https://docs.example.com
pnpm exec docs doctor --agent --url https://docs.example.com --json
```

Positional `doctor agent` and `doctor site` are also accepted.

Use `--agent` for machine-facing readiness and `--site` for reader-facing quality. Use `--url`
only after local checks when the user wants deployed verification.

## Agent audit coverage

Doctor checks:

- config loading and docs content
- framework docs API and public routes
- Farming Labs discovery schema and surface drift
- llms files, XML/Markdown sitemaps, robots, AGENTS.md, and skill.md
- MCP, search, and default-on agent feedback
- page metadata and explicit agent context
- duplicated, generic, or boilerplate Agent blocks
- task prerequisites, outcomes, recovery, and applicability
- command health and related-page coverage
- golden retrieval, citation, version, answer, example, and budget tasks
- Agent Skill frontmatter, budgets, shallow references, compatibility, and script guidance
- generated `agent.md` freshness and compaction defaults

Command health is static. It recognizes constrained package/CLI commands and safe probes but never
executes arbitrary documentation snippets or makes implicit network requests.

Golden evaluations default to local `mcp-context`. Configured search, HTTP answers, and runtime
example execution need explicit network permission. Doctor reports golden-task quality separately
from evaluation coverage. Safety, answer quality, and executable examples remain `unmeasured`
until tasks explicitly exercise them; partial task coverage is reported as
`partially-measured`. No configured tasks means both quality and coverage are `unmeasured`, not a
perfect pass.

## Hosted probes

With `--url`, doctor additionally checks:

- `/.well-known/agent.json`
- `/llms.txt` and `/llms-full.txt`
- configured sitemap routes
- `/robots.txt`
- root and well-known `AGENTS.md`
- root and well-known `skill.md`
- a representative `.md` page
- `/mcp`, `/.well-known/mcp`, and hosted MCP subdomain aliases

For MCP, doctor initializes Streamable HTTP, checks session behavior, lists tools, and expects the
core docs tools. Hosted evidence adds checks without changing the normalized 100-point scale.

Hosted JSON IDs include `hosted-agent-discovery`, `hosted-llms`, `hosted-sitemap`,
`hosted-robots`, `hosted-skill`, `hosted-markdown`, and `hosted-mcp`.

## Interpreting results

Example:

```txt
@farming-labs/docs doctor — agent

Score: 82% (Agent-ready)
Framework: nextjs • Entry: docs • Content: app/docs
Explicit agent-friendly pages: 10/41 pages (24%)
Useful Agent blocks: 8/14 • 6/12 actionable pages task-complete
Golden task quality: 3/4 passed (88/100)
Evaluation coverage: partially-measured (5/12 task-dimensions, 42%)
```

Explain:

- Doctor is a health check, not a generator, and is not required for runtime operation.
- Agent-ready claims should be backed by its measured evidence.
- Low explicit optimization does not make pages invisible; it means fewer pages contain extra
  machine-only context.
- `--json` is for CI, dashboards, scripts, and agents.
- `--ci` emits GitHub annotations on stdout; pair it with `--json-output <path>` when the same run
  must also persist a machine-readable report.
- Loader notices may appear separately from JSON stdout.
- A warning for size/compatibility is advisory; broken or unsafe skill references are blocking.

## Verification and recovery

Repository examples:

```bash
pnpm --dir examples/next exec docs doctor --agent --config docs.config.tsx
pnpm --dir website exec docs doctor --agent --config docs.config.tsx
```

For failures:

1. Fix local config loading and generated/static drift first.
2. Repair broken skill/page links before tuning scores.
3. Confirm non-Next forwarders include current discovery and MCP aliases.
4. Regenerate static files with their matching command, then rerun `--check`.
5. Probe deployed endpoints only after the preview contains the local fix.
6. Do not weaken a blocking rule merely to raise the score; document intentional opt-outs in
   config.
