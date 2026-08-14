<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:c0aa0c8f647006f7
settingsHash=fnv1a64:72be2461542d7a95
outputHash=fnv1a64:5a926dd8952106a9
generatedAt=2026-07-30T09:43:36.467Z
-->
# Observability

## Observability task

Task: Observability

Expected result: Trace Ask AI and MCP runs with span IDs, timing, status, previews, errors, and callbacks

## Observability verification



## Observability agent guidance

Top-level `observability` covers steps inside Ask AI and MCP runs. `observability: true` writes the
`[@farming-labs/docs:observability]` stream; its console mode shows local traces, while
`observability.onEvent` forwards `DocsObservabilityEvent` objects.

Verify one trace contains a shared `traceId`, child `spanId` values, status, and `durationMs`, with
Ask AI lifecycle events or `tool.call`/`tool.result` for MCP. Built-in previews exclude raw user
text; separate raw `input` fields are omitted unless `includeInputs` is enabled. If only `page_view`,
`search_query`, `api_ai_request`, or `mcp_tool` appears, inspect `analytics.onEvent`; those are usage
events rather than runtime spans.
