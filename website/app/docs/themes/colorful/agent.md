<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:606c53b9fb2a32e2
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:0d7370d212e309e5
generatedAt=2026-08-14T12:45:38.974Z
-->
# Colorful

## Colorful task

Task: Colorful

Expected result: Warm amber accent with Inter typography and a clean layout

## Colorful verification



## Colorful agent guidance

Apply this preset with `colorful` from `@farming-labs/theme/colorful`, `theme: colorful()` in `docs.config.ts`, and `@import "@farming-labs/theme/colorful/css"` in `app/global.css`.
Check for the amber `hsl(40, 96%, 40%)` primary, 768px content width, and directional TOC; the documented overrides are `ui.colors.primary` and `ui.layout.contentWidth`.
If the config compiles but those defaults are absent, make the CSS subpath match the `colorful` factory before changing theme tokens.
