<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:2fa85c7d0af1647a
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:fd28ea196ce8fcc0
generatedAt=2026-08-14T12:45:39.004Z
-->
# Command Grid

## Command Grid task

Task: Command Grid

Expected result: Mono-first paper-grid theme inspired by the better-cmdk landing page

## Command Grid verification



## Command Grid agent guidance

Choose Command Grid by importing `commandGrid` from `@farming-labs/theme/command-grid`, calling `commandGrid()` in the `theme` field, and loading `@farming-labs/theme/command-grid/css` globally.
Verify the paper-grid light background, mono-first UI, `0px` radius, 900px content area, and 304px sidebar; customize only the shown `ui.colors.accent` or `ui.layout.sidebarWidth` when answering from this page.
A plain ungridded result usually means the `/command-grid/css` entrypoint is missing or paired with a different factory.
