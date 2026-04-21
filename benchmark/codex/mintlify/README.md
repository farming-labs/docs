# Mintlify-shaped Provider

Provider ID: `mintlify`

This provider simulates Mintlify-shaped docs for one benchmark subject. The current subject is
Northstar CRM, a fictional product/internal-platform docs site. The docs teach Codex how to
implement the same support-agent prompting endpoint in the artifact app.

The docs shape favors:

- `/docs.md`
- `/llms.txt`
- `.md` page URLs
- equivalent human-readable implementation pages

This directory is the concrete project. Keep it equivalent to the Farming Labs/docs project while
preserving Mintlify package metadata, so error-rate differences come from documentation shape
instead of workspace drift.

Generated Codex artifacts are written to `../artifacts/<run-id>/mintlify/`.
