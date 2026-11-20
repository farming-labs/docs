# Farm.js filesystem navigation

Farm.js reads file types from directory entries when walking a docs tree. Symbolic links still resolve against the filesystem. The frontmatter reader passes the file buffer to the same parser, avoiding a UTF-8 round trip. The numeric sidebar on this 53-page site made 160 explicit stat calls before the change and zero afterward. Per-request content reads still see edits and deletions.

## Local results

Each cell gives median / p95 in milliseconds. An identical second installation of the baseline measures run-to-run noise. Each variant loaded the same route at each step. The benchmark checks complete output equality on all 53 routes before timing.

| Adapter | Operation | Run | Baseline | Identical baseline | Revised |
| --- | --- | ---: | ---: | ---: | ---: |
| Farm.js | Numeric sidebar | 1 | 13.80 / 55.22 | 14.89 / 98.44 | 9.71 / 40.22 |
| Farm.js | Numeric sidebar | 2 | 7.16 / 9.51 | 7.01 / 10.19 | 4.44 / 6.36 |
| Farm.js | Alphabetical sidebar | 1 | 8.87 / 17.94 | 8.40 / 21.98 | 4.03 / 10.23 |
| Farm.js | Alphabetical sidebar | 2 | 6.42 / 11.09 | 6.24 / 11.32 | 3.65 / 7.39 |
| Farm.js | Numeric page load | 1 | 10.72 / 29.79 | 11.36 / 22.56 | 6.60 / 22.62 |
| Farm.js | Numeric page load | 2 | 9.89 / 16.61 | 9.41 / 18.74 | 5.73 / 11.47 |

The following counts are explicit synchronous filesystem calls during a single numeric load of the site root. Each pair gives baseline → revised.

| Adapter | Source reads | Directory listings | Stat calls | Existence checks |
| --- | ---: | ---: | ---: | ---: |
| Farm.js | 107 → 107 | 53 → 53 | 161 → 1 | 274 → 274 |

## Fresh processes

Each sample starts a new Node process with a warm OS file cache and loads the root page through the public server export. The import timer starts just before the module import and ends when the first page is ready. Node bootstrap and benchmark fixture setup are outside this interval. Each response has the same digest. The table covers Farm.js filesystem-backed pages.

| Operation | Run | Baseline | Identical baseline | Revised |
| --- | ---: | ---: | ---: | ---: |
| Create server and load first page | 1 | 104.28 / 139.17 | 96.65 / 153.95 | 89.54 / 128.53 |
| Import through first page | 1 | 353.34 / 463.68 | 363.04 / 552.32 | 344.34 / 518.14 |
| Create server and load first page | 2 | 105.78 / 200.43 | 99.18 / 216.22 | 91.65 / 210.25 |
| Import through first page | 2 | 347.88 / 693.37 | 362.80 / 614.67 | 346.54 / 827.21 |
| Create server and load first page | 3 (90 samples) | 70.15 / 125.85 | 69.79 / 110.00 | 68.65 / 109.09 |
| Import through first page | 3 (90 samples) | 255.06 / 451.34 | 251.36 / 381.68 | 249.58 / 375.70 |

In the first two 30-sample runs, the import-through-page p95 rose against the primary baseline. The first revised result fell within the two baselines, while the second exceeded both. In the separate 90-sample run the revised import-through-page p95 was 375.7 ms, against 451.3 ms and 381.7 ms for the baselines. These observations support the filesystem change. Hosted startup latency remains unmeasured.

## Bundled navigation decision

The selected package keeps the original bundled server implementation. A separate prototype retained a per-server index. It reduced warm navigation latency, but its new-server first-page p95 in a warm process moved from 8.87 to 6.23 ms in one run and from 9.84 to 18.04 ms in another. Across six fresh-process heap measurements, the prototype also retained about 14.6 KiB more per active server on this site. Each measurement loaded 32 servers sharing the same source strings and compared heap usage after explicit garbage collection before and after their first loads.

## Reproduce

Baseline `3cf48aa990288e791be309956d314beaff218975`. Apple M1, macOS 26.2, Node v24.21.0. Corpus SHA-256 `fa4ec5e9e3f5af6e8c27cf63e92cf6dfe424f5f4614dc0e5c1f15649e0698da8`. Extract built package tarballs under each root’s `node_modules/@farming-labs` and resolve their dependencies against the same lockfile. Use independent extractions of the baseline artifact for the first two roots.

The warm benchmark rotates through all six execution orders, uses six warmup requests per variant, then records 106 individual requests per workload across two complete passes through the site. The fresh-process benchmark discards six warmups for each variant, then records 30 processes per variant by default. Each invocation emits the individual measurements.

```sh
node benchmark/adapters/folder-order.mjs --full-corpus --farm-filesystem "$baseline" "$control" "$revised"
node benchmark/adapters/first-page.mjs --farm-filesystem "$baseline" "$control" "$revised"
node benchmark/adapters/first-page.mjs --farm-filesystem --extended "$baseline" "$control" "$revised"
```
