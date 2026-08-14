# Agent freshness exceptions

Reviewed on 2026-08-14 while refreshing the generated agent corpus. `docs agent compact --stale`
preserves modified and provenance-unknown files so authored machine guidance is never overwritten
silently.

## Generated corpus decision

The 49 provenance-generated files were first run through Docs Cloud compression in stale-only mode.
That candidate corpus reduced the configured golden evaluation result from 21/21 to 8/21, so the
generated text was rejected. The previously passing compact bodies were then revalidated against
the current resolved sources and compaction settings; their source, settings, output, and generation
provenance was refreshed without accepting the lower-quality text. The final corpus returns to
21/21 golden tasks with 49 fresh and zero stale generated files.

## Preserved authored exceptions

| Route | State | Decision | Rationale |
| --- | --- | --- | --- |
| `/docs/customization/mcp` | Modified generated output | Preserve | The file contains reviewed operator-only authoring MCP and publishing safety guidance. Its provenance hash intentionally prevents an automatic overwrite. |
| `/docs/configuration` | Unknown / hand-authored | Preserve | This is the detailed machine-oriented configuration contract, including discovery, evaluation, reading-time, and content-change guidance. |
| `/docs/customization/agent-primitive` | Unknown / hand-authored | Preserve | This is the canonical audience-projection, discovery, feedback, and Agent Skills operating guide. |
| `/docs/customization/sidebar` | Unknown / hand-authored | Preserve | This is a concise, intentionally scoped sidebar answer guide rather than generated page compression. |

These decisions are now recorded in the machine-readable
`website/.farming-labs/agent-compaction-reviews.json` manifest. Each entry binds the decision to
the resolved page source, compaction settings, and preserved `agent.md` body hashes, plus the
reviewer, timestamp, and rationale.

The CI freshness check accepts matching reviewed entries, but fails when any reviewed hash drifts,
a manifest entry becomes orphaned, a provenance-generated file is stale, or a token-budget page is
missing its required `agent.md`. Re-review requires an explicit route, reviewer, and rationale; it
never rewrites the preserved `agent.md`.
