# Filesystem navigation in Astro, Nuxt, SvelteKit and TanStack Start

Each navigation walk discovers the indexed children of a directory once and passes their paths and frontmatter into node construction. Directory entries supply the file type for ordinary files. Symbolic links still resolve against the filesystem. Each subsequent load reads current content. The same parser reads frontmatter directly from the file buffer.

## Local results

Each cell gives median / p95 in milliseconds. An identical second installation of the baseline measures run-to-run noise. Each variant loaded the same route at each step. The benchmark checks complete output equality on all 53 routes before timing.

| Adapter | Operation | Run | Baseline | Identical baseline | Revised |
| --- | --- | ---: | ---: | ---: | ---: |
| Astro | Numeric sidebar | 1 | 8.68 / 9.95 | 8.74 / 9.92 | 2.35 / 3.02 |
| Astro | Numeric sidebar | 2 | 8.51 / 9.88 | 8.53 / 10.90 | 2.30 / 3.72 |
| Astro | Alphabetical sidebar | 1 | 4.94 / 6.45 | 4.93 / 6.65 | 2.28 / 3.19 |
| Astro | Alphabetical sidebar | 2 | 4.78 / 5.38 | 4.81 / 5.25 | 2.21 / 2.69 |
| Astro | Numeric page load | 1 | 11.43 / 95.54 | 11.41 / 101.86 | 4.96 / 88.47 |
| Astro | Numeric page load | 2 | 11.55 / 94.72 | 11.38 / 93.58 | 4.98 / 87.63 |
| Nuxt | Numeric sidebar | 1 | 8.76 / 11.36 | 8.70 / 11.30 | 2.40 / 3.96 |
| Nuxt | Numeric sidebar | 2 | 8.97 / 16.40 | 8.79 / 12.51 | 2.41 / 6.02 |
| Nuxt | Alphabetical sidebar | 1 | 4.96 / 5.68 | 4.97 / 6.28 | 2.30 / 2.80 |
| Nuxt | Alphabetical sidebar | 2 | 4.82 / 5.20 | 4.82 / 5.24 | 2.21 / 3.76 |
| Nuxt | Numeric page load | 1 | 11.08 / 94.65 | 11.30 / 99.84 | 4.91 / 87.12 |
| Nuxt | Numeric page load | 2 | 16.04 / 161.43 | 16.36 / 161.67 | 7.82 / 95.45 |
| SvelteKit | Numeric sidebar | 1 | 8.63 / 10.20 | 8.65 / 10.18 | 2.36 / 2.82 |
| SvelteKit | Numeric sidebar | 2 | 9.10 / 12.96 | 8.91 / 13.17 | 2.45 / 4.07 |
| SvelteKit | Alphabetical sidebar | 1 | 4.93 / 6.48 | 4.90 / 6.04 | 2.27 / 3.55 |
| SvelteKit | Alphabetical sidebar | 2 | 5.49 / 7.42 | 5.44 / 7.16 | 2.66 / 4.25 |
| SvelteKit | Numeric page load | 1 | 13.05 / 178.77 | 13.90 / 101.80 | 7.02 / 92.70 |
| SvelteKit | Numeric page load | 2 | 11.85 / 96.00 | 12.13 / 101.90 | 5.19 / 91.12 |
| TanStack Start | Numeric sidebar | 1 | 9.31 / 27.27 | 9.36 / 19.25 | 2.61 / 8.63 |
| TanStack Start | Numeric sidebar | 2 | 8.48 / 10.34 | 8.51 / 9.75 | 2.29 / 2.89 |
| TanStack Start | Alphabetical sidebar | 1 | 5.00 / 8.27 | 5.03 / 7.57 | 2.35 / 4.02 |
| TanStack Start | Alphabetical sidebar | 2 | 4.80 / 5.85 | 4.86 / 6.23 | 2.26 / 3.19 |
| TanStack Start | Numeric page load | 1 | 9.07 / 15.17 | 9.10 / 11.70 | 2.62 / 5.11 |
| TanStack Start | Numeric page load | 2 | 8.72 / 9.83 | 8.77 / 10.26 | 2.50 / 3.48 |

The following counts are explicit synchronous filesystem calls during a single numeric load of the site root. Each pair gives baseline → revised.

| Adapter | Source reads | Directory listings | Stat calls | Existence checks |
| --- | ---: | ---: | ---: | ---: |
| Astro | 106 → 54 | 57 → 52 | 264 → 1 | 311 → 114 |
| Nuxt | 106 → 54 | 57 → 52 | 264 → 1 | 311 → 114 |
| SvelteKit | 106 → 54 | 57 → 52 | 264 → 1 | 311 → 114 |
| TanStack Start | 106 → 54 | 57 → 52 | 264 → 1 | 307 → 112 |

## Fresh processes

Each sample starts a new Node process with a warm OS file cache and loads the root page through the public server export. The import timer starts just before the module import and ends when the first page is ready. Node bootstrap and benchmark fixture setup are outside this interval. Each response has the same digest. The table covers Nuxt.

| Operation | Run | Baseline | Identical baseline | Revised |
| --- | ---: | ---: | ---: | ---: |
| Create server and load first page | 1 | 221.40 / 537.59 | 196.39 / 781.90 | 192.68 / 590.93 |
| Import through first page | 1 | 454.07 / 1280.21 | 394.20 / 1076.03 | 420.31 / 1415.26 |
| Create server and load first page | 2 | 227.58 / 437.44 | 251.55 / 458.41 | 217.48 / 364.93 |
| Import through first page | 2 | 448.94 / 878.88 | 485.41 / 968.00 | 445.67 / 763.46 |

Both Nuxt runs improved median page time. Fresh-process p95 varied substantially between installations of the baseline, and the direction of the import-through-page p95 changed between runs. Hosted cold starts were outside this experiment.

## Reproduce

Baseline `3cf48aa990288e791be309956d314beaff218975`. Apple M1, macOS 26.2, Node v24.21.0. Corpus SHA-256 `fa4ec5e9e3f5af6e8c27cf63e92cf6dfe424f5f4614dc0e5c1f15649e0698da8`. Extract built package tarballs under each root’s `node_modules/@farming-labs` and resolve their dependencies against the same lockfile. Use independent extractions of the baseline artifact for the first two roots.

The warm benchmark rotates through all six execution orders, uses six warmup requests per variant, then records 106 individual requests per workload across two complete passes through the site. The fresh-process benchmark discards six warmups for each variant, then records 30 processes per variant by default. Each invocation emits the individual measurements.

```sh
node benchmark/adapters/folder-order.mjs --full-corpus "$baseline" "$control" "$revised"
node benchmark/adapters/first-page.mjs "$baseline" "$control" "$revised"
```
