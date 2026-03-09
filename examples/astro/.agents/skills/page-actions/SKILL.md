---
name: page-actions
description: Configure page actions in @farming-labs/docs — Copy Markdown and Open in LLM buttons. Use when enabling copyMarkdown, openDocs, custom providers, urlTemplate placeholders ({url}, {mdxUrl}, {githubUrl}), or position (above-title, below-title).
---

# @farming-labs/docs — Page Actions

Page actions are buttons rendered above or below the page title. They let users **copy the page as Markdown** or **open the page in an LLM** (ChatGPT, Claude, Cursor, etc.). Use this skill when configuring these buttons.

**Full docs:** [Page Actions](https://docs.farming-labs.dev/docs/customization/page-actions).

---

## Quick start

```ts title="docs.config.ts"
pageActions: {
  copyMarkdown: { enabled: true },
  openDocs: { enabled: true },
}
```

This adds **Copy Markdown** and an **Open in...** dropdown with default providers.

---

## Configuration reference

All options go inside the `pageActions` object in `docs.config.ts`.

### pageActions.position

Where the buttons appear relative to the page title.

| Type | Default |
| ---- | ------- |
| `"above-title" \| "below-title"` | `"below-title"` |

```ts
pageActions: {
  position: "above-title",
  copyMarkdown: { enabled: true },
  openDocs: { enabled: true },
}
```

---

## Copy Markdown

### pageActions.copyMarkdown

Show the "Copy Markdown" button. Copies the current page content as Markdown to the clipboard.

| Type | Default |
| ---- | ------- |
| `boolean \| { enabled: boolean }` | `false` |

```ts
pageActions: {
  copyMarkdown: true,
  // or
  copyMarkdown: { enabled: true },
}
```

---

## Open in LLM (Open in...)

The **Open in...** dropdown lets users send the current page to an LLM or tool. Each provider has a link that can include the page URL (and optionally GitHub edit URL) as context.

### pageActions.openDocs

Enable the "Open in..." dropdown. Can be a boolean or an object.

| Type | Default |
| ---- | ------- |
| `boolean \| OpenDocsConfig` | `false` |

```ts
pageActions: {
  openDocs: true,
}
```

When `true`, a default list of providers (e.g. GitHub, ChatGPT, Claude, Cursor) is used.

### pageActions.openDocs.providers

Custom list of providers. Overrides the default list. Each provider has:

```ts
interface OpenDocsProvider {
  name: string;      // Display name (e.g. "ChatGPT", "Claude")
  icon?: ReactNode;  // Optional icon element
  urlTemplate: string; // URL template; placeholders are replaced
}
```

### URL template placeholders

| Placeholder | Replaced with |
| ----------- | -------------- |
| `{url}` | Current page URL (e.g. `https://docs.example.com/docs/installation`) |
| `{mdxUrl}` | `.mdx` variant of the page URL (for raw source) |
| `{githubUrl}` | GitHub **edit** URL for the current page. Requires `github` in config. Use `urlTemplate: "{githubUrl}"` for "Open in GitHub". |

### Custom providers example

```ts
pageActions: {
  openDocs: {
    enabled: true,
    providers: [
      {
        name: "ChatGPT",
        urlTemplate: "https://chatgpt.com/?q=Read+this+documentation:+{url}",
      },
      {
        name: "Claude",
        urlTemplate: "https://claude.ai/new?q=Read+this+documentation:+{url}",
      },
      {
        name: "Cursor",
        urlTemplate: "https://cursor.com/link/prompt?text=Read+this+documentation:+{url}",
      },
      {
        name: "GitHub",
        urlTemplate: "{githubUrl}",
      },
    ],
  },
}
```

For `{githubUrl}` to work, the top-level `github` config must be set (e.g. `github: { url: "https://github.com/owner/repo", directory: "website" }`).

---

## Edge cases

1. **No github config** — `{githubUrl}` will be empty or fallback; "Open in GitHub" may not work unless `github` is set in `defineDocs()`.
2. **Custom icon** — Pass a React node (or SVG component) as `icon` for each provider if you want a custom icon.
3. **Alignment** — Page actions alignment (left/right) is controlled by `pageActions.alignment` in config (e.g. `"left"` or `"right"`); see API reference if available.

---

## Resources

- **Full Page Actions docs:** [docs.farming-labs.dev/docs/customization/page-actions](https://docs.farming-labs.dev/docs/customization/page-actions)
- **Configuration:** use the `configuration` skill for `github` and other top-level options.
