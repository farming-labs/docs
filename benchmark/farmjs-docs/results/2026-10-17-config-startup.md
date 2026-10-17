# Farm docs config startup

The Farm adapter previously loaded the core and server barrels for five MDX
helpers. It now resolves the focused `@farming-labs/docs/mdx` entry, with a fallback
for older cores that do not export that path. Synchronous ESM loading preserves
native CommonJS consumers on Farm's supported Node versions (>=22.13).

## Measurement

Baseline: `ff0eac981d7b8326239530b4a7f11d7ac2e6c423`. Apple M1, macOS 26.2,
Node 24.21.0. Seven alternating pairs of fresh Node processes, with a warm OS file
cache. The baseline restores the previous broad imports in a temporary copy of
the same emitted adapter. Both call `withDocs({})` after importing the config.

| Median | Broad imports | Focused imports | Reduction |
| --- | ---: | ---: | ---: |
| Config import and setup | 285.11 ms | 207.70 ms | 27.1% |
| Modules loaded | 817 | 559 | 31.6% |

These measurements cover config startup only, not MDX compilation, a complete
Farm/Vercel build, dependency installation, or a comparison with Fumadocs.
Wall times vary with machine load; the raw samples are retained in
[the JSON result](./2026-10-17-config-startup.json).

Run from the repository root with Node 24 or newer:

```sh
pnpm --filter @farming-labs/docs build
pnpm --filter @farming-labs/theme build
pnpm --filter @farming-labs/farmjs build
node packages/farmjs/scripts/benchmark-config-startup.mjs
```

## Correctness checks

- Core, theme, and Farm adapter builds pass.
- All 94 Farm adapter tests pass, including real Vite builds, persistent MDX cache
  reuse and invalidation, highlighting, and missing/broken core entry behavior.
- The focused and legacy helper paths work through both native ESM imports and
  CommonJS require. Broken focused modules still surface their errors.
- Farm 0.1.21 loads `.ts`, `.mts`, `.js`, and `.mjs` configs with this adapter.
- A 10-page Farm 0.1.21 production fixture builds and passes browser checks for
  every page, highlighted code, tables, client navigation, clipboard copying,
  search and search navigation, mobile sidebar, and mobile overflow. No browser
  exceptions were observed. This is functional coverage, not a screenshot
  equivalence claim or an exhaustive guarantee for every application.
