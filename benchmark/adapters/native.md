# Deferred native runtime verification

**Keep optional chat and syntax highlighting out of the initial native page work.**

Astro, SvelteKit, and Nuxt initialize Shiki only for renderable code blocks. Prose, literal Prompt content, and hidden agent code do not initialize it. Failed initialization remains an error, and the next call can retry. Svelte and Vue floating chat load on activation, cancel pending opens with Escape, retry failed chunk downloads, retain conversation state after closing, and clean up scrolling on unmount. Trigger markup and theme CSS stay unchanged.

## Production behavior

Build the packages and production SvelteKit/Nuxt examples. Serve them on ports 43101/43102. Install Chrome or set `PLAYWRIGHT_CHANNEL` to an installed browser channel. Capture baseline first with the original chat implementation, then build and serve the candidate with the same content, theme, timestamps, and dependency versions:

```sh
node benchmark/adapters/verify-ui.mjs before /tmp/docs-native-ui svelte
node benchmark/adapters/verify-ui.mjs before /tmp/docs-native-ui nuxt
node benchmark/adapters/verify-ui.mjs after /tmp/docs-native-ui svelte
node benchmark/adapters/verify-ui.mjs after /tmp/docs-native-ui nuxt
```

The harness checks desktop/phone layouts, initial and activated chat chunks, a deterministic local HTTP/SSE streaming fixture, conversation retention, real search, clipboard copy, and navigation. It does not call a paid LLM. Compare exact screenshot pixels and inspect both widths manually. Script response sizes are decoded bytes, not compressed network transfer sizes. A lazy chunk shifts work to first activation and can increase total code after chat opens.

To cover the four chat styles, temporarily copy `fixtures/chat.svelte` to `examples/sveltekit/src/routes/performance-chat/+page.svelte` and `fixtures/chat.vue` to `examples/nuxt/pages/performance-chat.vue` before both builds, then run:

```sh
node benchmark/adapters/verify-chat-styles.mjs before /tmp/docs-chat-styles
node benchmark/adapters/verify-chat-styles.mjs after /tmp/docs-chat-styles
```

The candidate checks focus, Escape, pending-open cancellation, unmount cleanup, and an actual failed chunk download followed by a successful retry. Remove the temporary example routes when finished.

## Packed artifacts

Build core and the three native adapters first, then use a new output directory:

```sh
node benchmark/adapters/pack-native.mjs /tmp/docs-native-packed
```

This packs six packages, verifies explicit exports, exercises three real highlighters, and checks both deferred chat files. Changed workspace dependencies resolve from extracted tarballs; other dependencies use the lockfile installation. This is not a fresh registry install or a hosted deployment test. It does not establish superiority over Fumadocs or other documentation frameworks.
