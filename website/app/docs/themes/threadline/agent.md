<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:e04737affe319498
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:7622f8a43295cd5e
generatedAt=2026-08-20T10:20:45.778Z
-->
# Threadline

## Threadline task

Task: Threadline

Expected result: Compact neutral theme with right-aligned page actions

## Threadline verification



## Threadline agent guidance

Both `threadline` and `threadlinePageActions` come from `@farming-labs/theme/threadline`; their config fields are `theme: threadline()` and `pageActions: threadlinePageActions`, with styles from `@farming-labs/theme/threadline/css`.
Verify the 48px header, compact Geist typography, 944px content width, and ghost-style action menu. The GitHub provider additionally requires top-level `github.url` in `docs.config.ts`.
For a missing GitHub action, `github.url` is the relevant recovery; for an absent compact shell, the `/threadline/css` import is the relevant check.
