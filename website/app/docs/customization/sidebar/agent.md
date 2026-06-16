# Sidebar

You are reading the machine-oriented override for `/docs/customization/sidebar`.

Use this page when the user asks about sidebar titles, icons, collapsible groups, ordering, or styling.

Keep answers grounded in the documented `sidebar`, `nav`, `icons`, `order`, and folder structure options. If the request moves beyond sidebar behavior, point to the closest related configuration or customization docs instead of inventing config.

## Key options

| Option | Where | What it controls |
| ------ | ----- | ----------------- |
| `nav.title` | `docs.config.tsx` | Sidebar title — string or React component |
| `icons` | `docs.config.tsx` | Map of icon names to React elements |
| `sidebar.folderIndexBehavior` | `docs.config.tsx` | How the parent folder row behaves: `"link"`, `"toggle"`, or `"hidden"` |
| `icon` | page frontmatter | Icon key for a single sidebar item |
| `order` | page frontmatter | Numeric sort order within a folder |
| `sidebar.folderIndexBehavior` (per-page) | page frontmatter | Override behavior for a specific folder index page |

## folderIndexBehavior

Controls what happens when a user clicks a collapsible folder row that has its own `page.mdx`.

- `"link"` (default) — clicking the row navigates to the folder index page
- `"toggle"` — the folder landing page moves inside the group as the first child; clicking the row only expands or collapses, does not navigate
- `"hidden"` — the folder landing page is omitted from the sidebar and machine-readable surfaces; the first click on the parent row redirects to the first visible child

Set globally in `docs.config.tsx`:

```ts
sidebar: {
  folderIndexBehavior: "toggle",
},
```

Or override per page in frontmatter:

```md
---
title: "Sending Messages"
sidebar:
  folderIndexBehavior: "hidden"
---
```

## Ordering

Pages sort alphabetically by default. Override with `order` in frontmatter:

```md
---
title: "Getting Started"
order: 1
---
```

Lower numbers sort first. Pages without `order` sort after numbered pages.

## Icons

Register icons in `docs.config.tsx` by mapping a string key to a React element:

```tsx
icons: {
  rocket: <Rocket size={16} />,
  book: <BookOpen size={16} />,
},
```

Then reference the key in page frontmatter:

```md
---
title: "Getting Started"
icon: "rocket"
---
```

## Validation

- Human page: `/docs/customization/sidebar`
- Markdown route: `/docs/customization/sidebar.md`
- API route: `/api/docs?format=markdown&path=customization/sidebar`
- MCP read target: `/docs/customization/sidebar`

## Follow-up pages

- [/docs/configuration](/docs/configuration) — `sidebar`, `nav`, and `icons` live in `defineDocs()`
- [/docs/customization/components](/docs/customization/components) — custom MDX components including nav title with React nodes
- [/docs/customization/typography](/docs/customization/typography) — font and heading settings that affect sidebar text
