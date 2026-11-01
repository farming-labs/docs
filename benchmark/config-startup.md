# Configuration startup

Run with Node 22.15+ after building the core and React theme packages:

```sh
pnpm --filter @farming-labs/docs build
pnpm --filter @farming-labs/theme build
node benchmark/config-startup.mjs > config-startup-results.json
```

The probe runs seven alternating pairs of fresh Node processes. Each imports
`defineDocs`, `createTheme`, `extendTheme`, and the shadcn preset, then constructs
the same configuration with nested overrides and a callback. It verifies equal
configuration output and callback identity before reporting a result.

The root control uses the same emitted preset with its previous core-root import.
The focused variant uses the published `@farming-labs/docs/config` entry and the
preset's updated import. Build first so both variants use the same sources and
dependencies. The timer starts inside the child process before the first import;
Node process startup is excluded. Module load hooks count the executed import
graph rather than estimating it from package sizes.

On Node 24.21.0/macOS arm64, a local run on November 1, 2026 measured these medians:

| Configuration path | Import and setup | Modules loaded |
| --- | ---: | ---: |
| Core root and previous preset import | 96.18 ms | 407 |
| Focused configuration entry and preset | 2.10 ms | 5 |

This is configuration startup evidence. It does not establish a browser payload,
page-load, or full production-build improvement. Wall time depends on the machine;
the package tests enforce the module boundary without a timing threshold.
