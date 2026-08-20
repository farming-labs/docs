<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:eb28de07cc138d5a
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:10efb89ec97603ba
generatedAt=2026-08-20T10:20:45.758Z
-->
# DarkBold

## DarkBold task

Task: DarkBold

Expected result: Pure monochrome design with Geist typography and clean minimalism

## DarkBold verification



## DarkBold agent guidance

DarkBold uses `darkbold` from `@farming-labs/theme/darkbold`, `theme: darkbold()` in `docs.config.ts`, and `@farming-labs/theme/darkbold/css` in the global stylesheet.
Validate the monochrome `#000` primary, Geist/Geist Mono fonts, and tighter H1–H3 letter spacing; supported examples override `ui.colors.primary` and `ui.typography.font.h1`.
If the site retains another preset's colors or type scale, correct the `/darkbold/css` entrypoint before adding typography overrides.
