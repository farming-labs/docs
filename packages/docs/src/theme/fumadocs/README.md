# Fumadocs Theme

Theme preset for @farming-labs/docs using real fumadocs-ui components.

## Install

```bash
pnpm add fumadocs-ui fumadocs-core
```

## Usage

### Theme preset (docs.config.ts)

```ts
import { defineDocs } from "@farming-labs/docs";
import { fumadocs } from "@farming-labs/docs/theme/fumadocs";

export default defineDocs({
  entry: "docs",
  theme: fumadocs({
    ui: {
      colors: { primary: "#22c55e" },
      components: { Callout: { variant: "outline" } },
    },
  }),
});
```

### MDX components (mdx-components.tsx)

```ts
import { getMDXComponents } from "@farming-labs/docs/theme/fumadocs/mdx";
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components?: MDXComponents): MDXComponents {
  return getMDXComponents(components);
}
```
