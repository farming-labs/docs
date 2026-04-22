# Skyvern Farming Labs/docs Provider

This provider mirrors the same Skyvern docs content into a Farming Labs/docs-shaped Next.js project
and adds agent-first affordances:

- root `<Agent>` guidance,
- `/docs/agent-runbook.md`,
- `/.well-known/agent.json`,
- `/api/docs/agent/spec`,
- targeted `/api/docs?query=...` search,
- markdown routes for every page.

The human-readable docs facts are the same as the Mintlify provider. The benchmark advantage comes
from packaging those facts into a machine-first runbook, not from hiding information.
