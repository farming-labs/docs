# Agent Documentation Benchmarks

This folder measures how easy documentation frameworks are for implementation agents.

The benchmark does not ask the agent to compare marketing pages. It gives the agent a docs site for
some subject, asks it to implement something from those docs in an artifact workspace, and records how
quickly it found the relevant docs, what it fetched, how many errors it hit, and whether the final
artifact passed acceptance checks.

The docs subject can be anything: a framework, SDK, API, internal platform, startup product, or CLI.
The key rule is that both providers must expose equivalent content for the same implementation task.

For implementation benchmarks, each coding-agent runner should own provider-specific projects under
`benchmark/<agent>/<provider>/`. Keep those projects equivalent across providers so the
implementation task stays a control variable, but do not rely on a hidden shared fixture plus
package overlays. That makes error-rate debugging much easier because every provider/agent pair has
a concrete project to inspect.

Provider-specific package/setup comparisons should still live in their own setup-friction scenario,
because those measure install commands, generated files, and framework wiring rather than docs
retrieval quality.

Current agent runner:

- [codex](./codex/README.md)

Benchmark methodology:

- [METHODOLOGY.md](./METHODOLOGY.md)
- [Codex results](./codex/results/README.md)

Planned runner shape:

```txt
benchmark/
  codex/
    farming-labs/
    mintlify/
  claude/
    farming-labs/
    mintlify/
```

`farming-labs` is the provider ID for the product/docs provider `@farming-labs/docs`.
