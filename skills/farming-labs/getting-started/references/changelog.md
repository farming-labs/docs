# Changelog setup

Use this reference when adding the generated release feed. The turn-key route flow is currently
available in Next.js through `@farming-labs/next/config`.

```ts
export default defineDocs({
  entry: "docs",
  changelog: {
    enabled: true,
    path: "changelogs",
    contentDir: "changelog",
    title: "Changelog",
    description: "Latest product updates and release notes.",
    search: true,
  },
  theme: fumadocs(),
});
```

Default content structure:

```text
app/docs/changelog/
  2026-04-15/page.mdx
  2026-04-03/page.mdx
```

This publishes `/docs/changelogs` and `/docs/changelogs/2026-04-15`.

Use entry frontmatter such as:

```mdx
---
title: "OpenAPI mode is now the default"
description: "The docs example now ships with the faster API reference experience."
version: "v0.1.13"
tags: ["api-reference", "next"]
---
```

`withDocs()` generates the route files. Do not maintain a separate
`__changelog.generated.tsx` file.
