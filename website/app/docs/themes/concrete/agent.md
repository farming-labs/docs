<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:d08b0f9d5f512b0c
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:0ec98bd556d4357d
generatedAt=2026-08-14T12:45:39.039Z
-->
# Concrete

## Concrete task

Task: Concrete

Expected result: Brutalist poster-style theme with offset shadows and square corners

## Concrete verification



## Concrete agent guidance

Concrete pairs `concrete` from `@farming-labs/theme/concrete` with `theme: concrete()` and the global CSS import `@farming-labs/theme/concrete/css`.
The expected result is the `#ff5b31` primary, offset-shadow poster styling, `0px` corners, an 896px content width, and a 316px sidebar; this page documents `ui.colors.primary` and `ui.layout.sidebarWidth` overrides.
If only the config changes and the brutalist surfaces do not appear, restore the matching `/concrete/css` import rather than recreating its CSS.
