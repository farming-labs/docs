<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:f1961d315bcd1197
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:974a02e90d406493
generatedAt=2026-08-14T12:45:39.261Z
-->
# Shiny

## Shiny task

Task: Shiny

Expected result: Clerk-inspired theme with purple accents and a polished light/dark design

## Shiny verification



## Shiny agent guidance

Shiny pairs `shiny` from `@farming-labs/theme/shiny` with `theme: shiny()` and `@farming-labs/theme/shiny/css` after Tailwind in `app/global.css`.
Confirm the purple `hsl(256, 100%, 64%)` primary, polished light/dark surfaces, 280px sidebar, and 64px header; the local examples permit `ui.colors.primary` and `ui.layout.sidebarWidth` changes.
If those dimensions apply without the polished surfaces, verify the `/shiny/css` package export is present rather than copying Clerk-specific styles.
