# Farming Labs Docs Provider

Provider ID: `farming-labs`

This provider simulates a `farming-labs/docs` site for one benchmark subject. The current subject is
Northstar CRM, a fictional product/internal-platform docs site. The docs teach Codex how to
implement a support-agent prompting endpoint in the artifact app.

The docs shape favors agent-specific discovery:

- `/docs.md`
- `/api/docs/agent/spec`
- `/api/docs?query=...`
- `/api/docs?format=markdown&path=...`
- Page-level or root `<Agent>` guidance

The important optimization is the built-in `<Agent>` primitive: Farming Labs/docs can place
implementation-only instructions directly in `/docs.md` or page markdown without adding visual noise
to the human docs page.

This directory is the concrete project. Keep it equivalent to the Mintlify project while preserving
Farming Labs/docs package metadata, so error-rate differences come from documentation shape and
agent primitives instead of workspace drift.

Generated Codex artifacts are written to `../artifacts/<run-id>/farming-labs/`.
