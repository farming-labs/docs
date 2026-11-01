# MDX helper startup

This development benchmark requires `module.registerHooks`: use Node.js 22.15+ on the 22.x release line, or Node.js 24+. The recorded run uses Node.js 24.21.0. This benchmark prerequisite does not change the published package's Node.js 20 support.

Build the baseline and candidate core packages, then run:

```sh
node benchmark/mdx-startup.mjs \
  baseline=/absolute/path/to/baseline/dist/mdx.mjs \
  candidate=/absolute/path/to/candidate/dist/mdx.mjs
```

Keep both builds on the same dependency versions. The script runs seven alternating fresh Node processes per target, times the import, and counts modules through the load hook. Operating-system caches remain warm. Each trial requires identical exports, Unicode and duplicate heading anchors, explicit IDs, encoded TOC links and preserved literal Prompt headings.

On the same macOS machine and dependencies, 0.2.133 versus the parser-free helpers measured:

| Median | 0.2.133 | Candidate |
| --- | ---: | ---: |
| Import startup | 60.40 ms | 7.72 ms |
| Loaded modules | 246 | 18 |
| Parser-related modules | 171 | 0 |

The 87.2% startup reduction applies only to importing the MDX helper entry. It does not establish a compilation, full-build, dev-server or browser speedup. Node load-hook instrumentation is included in both timings. The test suite separately asserts the built entry's parser boundary and existing exports.
