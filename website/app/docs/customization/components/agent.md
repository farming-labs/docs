<!-- @farming-labs/docs:generated
version=1
sourceKind=resolved-page
sourceHash=fnv1a64:4a100c67f68c2726
settingsHash=fnv1a64:063b4c9a14696a17
outputHash=fnv1a64:359366d4cee9d620
generatedAt=2026-07-30T09:43:36.454Z
-->
# Components

## Components task

Task: Register a custom MDX component or override a built-in component without breaking page rendering.

Expected result: The component is available in MDX, receives the intended props, and renders in the configured docs theme.

Exact implementation:

```tsx title="docs.config.tsx"
import { defineDocs } from "@farming-labs/docs";
import { pixelBorder } from "@farming-labs/theme/pixel-border";
import { InfoCard } from "./components/info-card";

export default defineDocs({
  // ...theme, nav, etc.
  components: {
    InfoCard,
  },
});
```
## Components prerequisites

- The project has a working docs.config file and an existing docs page for verification.
- Use docs.config.tsx when registration includes JSX.
- Confirm whether the requirement needs a config component override or a theme default-prop override.
- Applies to framework nextjs, tanstackstart, sveltekit, astro, nuxt; version >=0.2.60; package @farming-labs/docs.

## Components verification

- Build the docs app and render an MDX page that uses the component. Expected: The build succeeds, the component renders once with the documented props, and existing built-ins still work.
- Failure: MDX reports that the custom component is undefined.
- Recovery: Export the component, register the exact case-sensitive name in docs.config.tsx, and restart the dev server.
- Rollback: Remove the component registration and restore the previous built-in or theme defaults.

## Components agent guidance

For Next.js or TanStack Start, create the React component and register its exact case-sensitive name
under top-level `components` in `docs.config.ts[x]`; MDX can then use that name without an import.
Astro, SvelteKit, and Nuxt use their adapter-native component registration instead. Use
`theme.ui.components` only to change default props for a built-in; a top-level entry such as
`components.HoverLink` replaces that component across the React-rendered docs pages.

Build the docs app and render one MDX page with the documented props while confirming existing
built-ins still work. If MDX reports an undefined component, check its export and registration name
and restart the dev server. If JSX makes the config fail to parse, rename `docs.config.ts` to
`docs.config.tsx`. Remove a built-in override to restore the previous component; when removing a
custom component, remove its MDX usages too.
