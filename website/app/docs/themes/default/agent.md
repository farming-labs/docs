<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:9705d5bc86aaee85
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:96e8ebfae0f20da1
generatedAt=2026-08-14T12:45:39.137Z
-->
# Default

## Default task

Task: Default

Expected result: Clean, neutral palette with standard border radius

## Default verification



## Default agent guidance

`fumadocs`, available from either `@farming-labs/theme` or `@farming-labs/theme/default`, pairs `theme: fumadocs()` with the separate `@farming-labs/theme/default/css` entrypoint.
The factory declares indigo/white config defaults, standard radii, a 768px content width, and a 280px sidebar; the stylesheet and color mode determine the final computed palette. `ui.colors.primary` and `ui.layout.contentWidth` are documented overrides.
If the factory resolves but styling is absent, verify the `/default/css` import and inspect the computed `--color-fd-*` variables before adding more overrides.
