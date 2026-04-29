---
name: page-actions
description: Configure page actions in @farming-labs/docs — Copy Markdown and Open in LLM buttons. Use when enabling copyMarkdown, openDocs, custom providers, urlTemplate placeholders ({url}, {mdxUrl}, {githubUrl}), `{url}.md` markdown route patterns, alignment, or position (above-title, below-title).
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

### pageActions.alignment

Control whether the action row is left- or right-aligned.

| Type | Default |
| ---- | ------- |
| `"left" \| "right"` | `"left"` |

```ts
pageActions: {
  alignment: "right",
  copyMarkdown: true,
  openDocs: true,
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

When `true`, the built-in provider list is **ChatGPT** and **Claude**.

### pageActions.openDocs.providers

Custom list of providers. Overrides the default list. Each provider has:

```ts
interface OpenDocsProvider {
  name: string;      // Display name (e.g. "ChatGPT", "Claude")
  icon?: ReactNode;  // Optional icon element
  urlTemplate: string; // URL template; placeholders are replaced
  promptUrlTemplate?: string; // Optional built-in Prompt target; `{prompt}` is replaced
}
```

### URL template placeholders

| Placeholder | Replaced with |
| ----------- | -------------- |
| `{url}` | Current page URL (e.g. `https://docs.example.com/docs/installation`) |
| `{mdxUrl}` | Raw `.mdx` source URL for the page |
| `{githubUrl}` | GitHub **edit** URL for the current page. Requires `github` in config. Use `urlTemplate: "{githubUrl}"` for "Open in GitHub". |

For the built-in `Prompt` MDX component, `promptUrlTemplate` can use:

| Placeholder | Replaced with |
| ----------- | -------------- |
| `{prompt}` | Prompt text from the Prompt card |

If the project exposes machine-readable markdown routes, use `{url}.md` when you want a link to the
public page markdown instead of the raw source file. In Next.js, that route can return a sibling
`agent.md` when the page has one. HTTP clients that can send custom headers can also request the
normal page URL with `Accept: text/markdown` for the same markdown response.

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

**Cursor deeplink:** The web example uses `https://cursor.com/link/prompt?text=...`. To open the Cursor app directly instead, use `cursor://anysphere.cursor-deeplink/prompt?text=...`.

Example using the public markdown route:

```ts
pageActions: {
  openDocs: {
    enabled: true,
    providers: [
      {
        name: "ChatGPT",
        urlTemplate: "https://chatgpt.com/?q=Read+this+page:+{url}.md",
      },
    ],
  },
}
```

---

## Edge cases

1. **No github config** — `{githubUrl}` will be empty or fallback; "Open in GitHub" may not work unless `github` is set in `defineDocs()`.
2. **Custom icon** — Pass a React node (or SVG component) as `icon` for each provider if you want a custom icon.
3. **Alignment** — `pageActions.alignment` controls whether the row is left- or right-aligned.

---

## Resources

- **Full Page Actions docs:** [docs.farming-labs.dev/docs/customization/page-actions](https://docs.farming-labs.dev/docs/customization/page-actions)
- **Configuration:** use the `configuration` skill for `github` and other top-level options.
