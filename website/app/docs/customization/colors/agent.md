<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:c961ad4ca8c68060
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:3ef315ed2e252ae5
generatedAt=2026-08-14T12:45:38.549Z
-->
# Colors

## Colors task

Task: Colors

Expected result: Override any color token from config

## Colors verification



## Colors agent guidance

Theme color overrides live under `theme(...).ui.colors` in `docs.config.ts` or `docs.config.tsx`;
only the required keys belong there, without replacing the preset CSS for one token. Each value must
be a valid CSS color and maps to its documented `--color-fd-*` variable, such as `primary` to
`--color-fd-primary`.

Verify that the target variable changes while omitted tokens still come from the preset in light and
dark mode. If an override produces the wrong theme behavior, omitting that key restores the preset
default; the replacement value can be valid hex, rgb, hsl, or oklch.
