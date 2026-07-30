<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:aed0a86292aa62e3
settingsHash=fnv1a64:b2106dff2d4f1f98
outputHash=fnv1a64:65b300952ebb86ca
generatedAt=2026-07-30T09:43:36.479Z
-->
# Typography

## Typography task

Task: Typography

Expected result: Fonts, heading sizes, weights, and spacing

## Typography verification



## Typography agent guidance

Font families live at `theme.ui.typography.font.style.sans` and `.mono`; `h1` through `h4`, `body`,
and `small` accept the documented `size`, `weight`, `lineHeight`, and `letterSpacing` fields in
`docs.config.ts` or `docs.config.tsx`.

For Next.js Google Fonts, CSS variables originate in `app/layout.tsx`; their generated variable
classes belong on `<body>`, and the typography config references those exact names. Verify the
computed sans and mono families on the rendered page. If the fallback font remains, check that the
body class includes both font variables and that the config spelling matches before changing type
sizes or weights.
