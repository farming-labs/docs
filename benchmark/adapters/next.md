# Next page metadata verification

**Verify that page metadata can leave the persistent layout without changing rendering.**

Compatible production pages carry their own metadata. Custom providers, wrappers, compiler extensions, locales, roots, layouts, and routes retain the existing transport. The [adapter reference](../../packages/next/README.md#page-metadata-transport) documents eligibility and the explicit `pageMetadata: "site"` escape hatch. The shared theme API and CSS remain unchanged.

## Production comparison

Build core, theme, Next, and the Next example. Serve production output on port 43104. Capture baseline with `{ pageMetadata: "site" }` as the third `withDocs` argument, then rebuild the candidate with the default automatic mode. Keep content, theme configuration, timestamps, and dependencies fixed. Use Chrome or set `PLAYWRIGHT_CHANNEL` to an installed browser channel:

```sh
node benchmark/adapters/verify-next-metadata.mjs before /tmp/docs-metadata
node benchmark/adapters/verify-next-metadata.mjs after /tmp/docs-metadata
```

The harness compares exact text, headings, structured data, and page counts across direct rendering, client navigation, fallback changelog routes, and history. It also saves screenshots with JavaScript disabled. Compare exact pixels and visually inspect desktop and phone widths. A smaller serialized payload is not proof of lower total JavaScript or faster complete requests.

## Packed boundary

Build core, theme, and Next, then use a new output directory:

```sh
node benchmark/adapters/pack-next.mjs /tmp/docs-next-packed
```

This packs three packages, verifies explicit exports, and imports the actual packed compiler plugin. Workspace dependencies resolve from extracted tarballs; peers use the lockfile installation. Follow this with a production consumer/static-export build for rendering coverage. The smoke alone is not a deployment or browser test.

Shared theme tokens and content contracts are portable. Arbitrary React MDX components still require native equivalents in other renderers; this change adds no framework adapter. These checks do not establish superiority over Fumadocs or every other documentation framework.
