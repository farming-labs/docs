<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:7bbdd54dbf142528
settingsHash=fnv1a64:72be2461542d7a95
outputHash=fnv1a64:8dfc9629f7835ae0
generatedAt=2026-08-14T12:45:38.531Z
-->
# Analytics

## Analytics task

Task: Analytics

Expected result: Track product and usage events from docs, search, AI, feedback, agent, and MCP routes

## Analytics verification



## Analytics agent guidance

Top-level `analytics` records product usage, not step-level agent traces. `analytics: true` writes
events with the `[@farming-labs/docs:analytics]` prefix; `analytics.onEvent` forwards normalized
`DocsAnalyticsEvent` objects to a custom destination.

Leave `analytics.includeInputs` false unless the project has consent and a retention policy; paths,
counts, status, durations, and model IDs remain available without raw queries or questions. Verify
the integration by triggering a page, search, Ask AI, Markdown, or MCP action and checking its exact
event type and `source`. Retrieval, model, or tool spans inside one request belong to
`observability` instead.
