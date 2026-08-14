<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:4a8ce4febf960206
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:db2d07bbd99ba64e
generatedAt=2026-08-14T12:45:39.117Z
-->
# Darksharp

## Darksharp task

Task: Darksharp

Expected result: All-black theme with sharp corners

## Darksharp verification



## Darksharp agent guidance

Activate Darksharp with `darksharp` from `@farming-labs/theme/darksharp`, `theme: darksharp()`, and `@import "@farming-labs/theme/darksharp/css"` in `app/global.css`.
Confirm the neutral light palette, pure-black dark-mode background, near-white dark-mode primary, sharp low-radius chrome, and the factory's 768px/280px content-sidebar defaults; the page demonstrates a `ui.colors.primary` override.
If the preset styling is absent in both color modes, verify that `darksharp()` is paired with the `/darksharp/css` entrypoint before adding overrides.
