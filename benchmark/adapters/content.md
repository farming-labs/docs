# Content preparation verification

**Measure repeated content work while preserving navigation and search results.**

Astro, SvelteKit, Nuxt, and TanStack Start index navigation children and reuse prepared bundled content. Source changes, key additions/removals, and insertion-order changes invalidate cached variants. Returned values belong to the caller. SvelteKit and TanStack retain their existing copy-on-construction ownership; Astro and Nuxt retain supplied maps.

Shared search caches pure document projections with bounded retention: at most 1,024 entries and eight million key/value characters. This is a character budget, not a heap-memory bound. Audience, locale, source, contract, scope, and chunking affect the key. Access filtering and query results are not cached. Each content map retains at most eight variants. Filesystem reads remain fresh in development; existing production snapshots are retained.

## Benchmarks

Install the lockfile dependencies. Run without competing builds or tests:

```sh
node benchmark/adapters/navigation.mjs origin/main /tmp/docs-navigation.json
node benchmark/adapters/prepared-search.mjs origin/main /tmp/docs-prepared-search
```

Use the baseline commit once main contains the change. Both commands record all samples, correctness controls, environment, medians, and nearest-rank p95. Keep raw output outside the checkout.

Navigation includes frontmatter parsing with a warm gray-matter cache, sorting, and tree construction. It uses three warmups, ten alternating A/B trials, and ten A/A controls per fixture. Every timed output is checked against baseline outside the timer. Flat, numeric, explicit ordering, nested, duplicate, orphan, locale, and prototype-like paths are covered.

Search bundles baseline and working modules using the installed dependency versions. It uses three warmups, twenty alternating A/B trials, and twenty A/A controls at 100 and 1,000 pages. Complete document equality and changed content are checked. This measures document preparation, not full request latency, browser speed, or hosted search. It does not establish superiority over Fumadocs or every other documentation framework.

## Packed boundaries

Build core and the four adapters, then use a new output directory:

```sh
node benchmark/adapters/pack-content.mjs /tmp/docs-content-packed
```

This packs five packages, verifies explicit exports, and exercises four native content servers, including caller isolation and duplicate-index ordering. Workspace dependencies resolve from extracted tarballs; other dependencies use the lockfile installation. This is not a fresh registry install or a hosted deployment test.
