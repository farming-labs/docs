# Search query preparation

Prepare the normalized query, tokens and Unicode literal matcher once per simple-search scoring
pass. Literal matching uses the already normalized document fields, including the existing second
punctuation-trimming behavior when an authored field ends in whitespace. The explanation pass uses
the same preparation. Public results, scores, ordering, provenance and cache limits are unchanged.

## Reproduce

Install the locked workspace dependencies and build the packages, then run without competing builds
or tests. Use a new output directory for each run:

```sh
pnpm install --frozen-lockfile
pnpm build
node benchmark/adapters/search-query.mjs \
  6d442beb8cc94378a46b063fbab79c48ece769ed /tmp/docs-search-query
```

Optional final arguments select fixtures, such as `website 100 1000`. `website` loads the real docs
through the built Farm.js content loader. The synthetic corpus has six sections and code fences per
page. Its content differs from the website, so their timings are not a page-count scaling comparison.

The harness bundles baseline and candidate search modules against identical helper sources and locked
dependencies. It runs three warmups and twenty samples per arm, reversing the order of baseline,
candidate and two identical-baseline controls each round. Each sample averages four queries, including
a no-result query. It records wall time, process CPU time, source bytes, environment, median, nearest-rank
p95 and every sample. Complete outputs must equal baseline outside the timer; edited pages, Unicode,
punctuation, stop words, empty queries and explanations get additional equality checks.

This measures warm `performDocsSearch` with the simple provider: preparation, ranking and source
provenance. It excludes filesystem loading, HTTP, browser rendering and hosted providers. These are
shared-desktop observations, not production latency guarantees. Timing is informational; the regression
test checks one literal matcher for 64 documents and fails on baseline with 192 constructions.

## Local measurements

November 17, 2026, Apple M1, macOS Darwin 25.2.0, Node 24.21.0. Each cell is milliseconds per query,
averaged over the four-query batch. All twenty samples per arm are retained; no samples were discarded.

| Corpus | Documents | Baseline median / p95 | Candidate median / p95 | A/A control medians |
| --- | ---: | ---: | ---: | ---: |
| Website, 53 pages | 797 | 16.55 / 19.31 | 14.30 / 15.43 | 16.50 / 16.55 |
| Synthetic, 100 pages | 800 | 7.36 / 11.95 | 5.25 / 7.90 | 7.40 / 7.30 |
| Synthetic, 1,000 pages | 8,000 | 298.82 / 331.71 | 230.78 / 281.04 | 295.87 / 297.51 |

The observed median reductions are 13.6%, 28.6% and 22.8%, respectively. Each exceeds the corresponding
A/A median spread. This does not remove the large-corpus cache cost: the candidate still takes about
231 ms per query on the 1,000-page fixture. Before/after outputs matched for every sample and all
additional semantic checks. Raw JSON is written to the supplied output directory, outside Git.

## Remaining work

The 1,000-page corpus exceeds both the normalized-field cache's entry limit and the prepared-document
cache's character budget. Repeated cache misses remain a separate target. Do not increase limits
without measuring retained memory and preserving source-edit, audience, locale and ownership behavior.
