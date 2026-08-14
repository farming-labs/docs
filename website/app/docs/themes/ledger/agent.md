<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:ba0841a184b264b1
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:ce62f61e9051808e
generatedAt=2026-07-30T09:43:36.701Z
-->
# Ledger

## Ledger task

Task: Ledger

Expected result: Stripe Docs-inspired theme with tabbed navigation, blue-violet actions, and deep code panels

## Ledger verification



## Ledger agent guidance

Apply Ledger through `ledger` from `@farming-labs/theme/ledger`, `theme: ledger()`, and `@import "@farming-labs/theme/ledger/css"` in the global CSS file.
Inspect tab-like navigation, pill search controls, deep navy code blocks in dark mode, the `#5f6cf6` light-mode primary, and the 820px/292px content-sidebar layout; documented adjustments include `ui.colors.primary`, `ui.layout.sidebarWidth`, and `ui.layout.tocWidth`.
If the product-doc shell is missing, first align the `/ledger/css` entrypoint with the `ledger()` factory.
