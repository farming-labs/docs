<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:e51c1292ad1939d7
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:436ed7d4465ca450
generatedAt=2026-08-20T10:20:45.423Z
-->
# Guides

## Guides task

Task: Guides

Expected result: Long-form playbooks for building docs that work well for humans, IDEs, and agents

## Guides verification



## Guides agent guidance

Route the task to one playbook before proposing an implementation. Choose
`/docs/guides/agent-friendly-docs` for page contracts, audience projections, discovery, validation,
and compaction; choose `/docs/guides/docs-json` for `docs.mode`, `docs.runtime`, repo roots, and the
JSON-safe `cloud` layer. Adapter maintainers should use
`/docs/guides/adapter-agent-conformance` and require its versioned report to contain no failed
cases.

These guides explain end-to-end decisions, not every option type. When the selected workflow needs
an exact `defineDocs()` field, verify it against `/docs/reference`; when it needs CLI flags, use
`/docs/cli`. If the requested outcome cannot be verified by the chosen guide, switch to the linked
specialized page instead of combining unrelated configuration shapes.
