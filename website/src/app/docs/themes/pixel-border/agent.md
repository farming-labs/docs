<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:d83cd5953ab45dba
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:fb4a7dc49297d5e8
generatedAt=2026-08-20T10:20:45.770Z
-->
# Pixel Border

## Pixel Border task

Task: Pixel Border

Expected result: Inspired by better-auth.com — refined dark UI with visible borders

## Pixel Border verification



## Pixel Border agent guidance

Pixel Border's required trio is `pixelBorder` from `@farming-labs/theme/pixel-border`, `theme: pixelBorder()`, and the CSS entrypoint `@farming-labs/theme/pixel-border/css`.
Verify the `hsl(0 0% 2%)` dark background, visible borders, `0px` radius, and active sidebar indicator; a `ui.colors.primary` override must flow to sidebar text, the indicator bar, TOC state, and links.
When the primary value changes but the bordered sidebar does not, restore the `/pixel-border/css` import before targeting component selectors manually.
