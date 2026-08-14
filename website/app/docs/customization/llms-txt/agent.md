<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:16f85bc74cf45618
settingsHash=fnv1a64:3fa80ff29bd1598e
outputHash=fnv1a64:34ab5873e4b3807d
generatedAt=2026-08-14T12:45:38.585Z
-->
# llms.txt

## llms.txt task

Task: llms.txt

Expected result: Auto-generate llms.txt and llms-full.txt for LLM-friendly documentation

## llms.txt verification



## llms.txt agent guidance

`llmsTxt` is enabled by default. Verify `/llms.txt`, `/llms-full.txt`, their `/.well-known/` aliases,
and the `format=llms` or `format=llms-full` docs API responses before adding route files.
`llmsTxt.baseUrl` corrects the generated origin, `llmsTxt.sections` divides a large corpus, and
`llmsTxt.maxChars` limits compact output.

Static deployment uses `pnpm exec docs agent export --public`; committed output is checked with
`pnpm exec docs agent export --check`. A native `public/llms.txt` (or SvelteKit `static/llms.txt`)
intentionally wins over generated fallback content, so that file is the first place to inspect or
delete when runtime configuration appears to have no effect.
