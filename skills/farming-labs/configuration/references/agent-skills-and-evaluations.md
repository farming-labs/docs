# Agent Skills and evaluations

Use this reference for publishing reusable Agent Skills, configuring an A2A v1 card, measuring
golden tasks, or setting agent compaction defaults.

## Contents

- [Reusable Agent Skills](#reusable-agent-skills)
- [Progressive-disclosure diagnostics](#progressive-disclosure-diagnostics)
- [A2A agent cards](#a2a-agent-cards)
- [Golden evaluations](#golden-evaluations)
- [Agent compaction](#agent-compaction)
- [OKF trust metadata](#okf-trust-metadata)

## OKF trust metadata

Enable OKF v0.2 projection with `agent.okf: true`, or configure corpus defaults:

```ts
agent: {
  okf: {
    generatedBy: "software:docs-build",
    staleAfterDays: 90,
    verified: [{ by: "human:docs-team", at: "2026-08-01" }],
  },
}
```

Page `okf` frontmatter may set `sources`, `generated`, `verified`, `status`, and `stale_after`.
Resolved metadata adds `trust_tier` (`unverified`, `machine-confirmed`, or `human-reviewed`) and a
boolean `stale`. It appears in Markdown, local search, MCP `get_trust_metadata`, doctor output, and
the `/.well-known/okf.json` Static Agent Bundle export. Use `human:` verifier prefixes only for
actual human review.

## Reusable Agent Skills

Use a path, array, or explicit object:

```ts
agent: {
  skills: {
    paths: [
      "./skills/getting-started/SKILL.md",
      "./skills/product",
      "./skills/team-skills",
    ],
  },
}
```

A path may name a `SKILL.md`, its directory, or a collection. Collection discovery walks
descendants for skill directories. Paths resolve from the project root and may cross project
directories only within the same workspace. Documents, directories, and companion files must be
regular non-symlink entries.

Published companions are limited to safe files under `references/`, `scripts/`, and `assets/`.
A standalone document is indexed directly. A skill with companions receives a deterministic
`.tar.gz`; the index digest covers the exact artifact and direct file responses have individual
hashes.

Modern routes:

- `/.well-known/agent-skills/index.json`
- `/.well-known/agent-skills/<name>/SKILL.md`
- `/.well-known/agent-skills/<name>/{references|scripts|assets}/...`
- `/.well-known/agent-skills/<name>.tar.gz`
- MCP resources at `docs://skills/<name>/<path>`

Legacy `/.well-known/skills/...` aliases remain. Project-root `skill.md` remains the
backwards-compatible site skill. Static Agent Bundles publish the same indexes, direct files,
artifacts, and hashes.

## Progressive-disclosure diagnostics

```ts
agent: {
  skills: {
    paths: "./skills",
    progressiveDisclosure: {
      maxSkillLines: 500,
      instructionTokenBudget: 5_000,
      maxReferenceDepth: 1,
      compatibility: "when-needed",
      checkScripts: true,
    },
  },
}
```

Doctor and review detect:

- oversized or over-budget `SKILL.md`
- broken, escaping, unpublished, or deeply chained references
- required but missing compatibility metadata
- bundled scripts without a reachable instruction, dependency statement, or validation step

Keep detailed references directly linked from `SKILL.md`. Use `compatibility: "always"` to require
metadata on every configured skill, or `"off"` to disable that diagnostic.

## A2A agent cards

`agent.a2a` is a separate opt-in and must describe a real A2A service—not a docs, Ask AI, or MCP
endpoint.

```ts
agent: {
  a2a: {
    name: "Product docs agent",
    description: "Answers implementation questions from product documentation.",
    supportedInterfaces: [{
      url: "https://agent.example.com/a2a",
      protocolBinding: "HTTP+JSON",
      protocolVersion: "1.0",
    }],
    documentationUrl: "https://docs.example.com/docs",
    provider: {
      organization: "Example, Inc.",
      url: "https://example.com",
    },
    version: "1.0.0",
    capabilities: {
      streaming: true,
      pushNotifications: false,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
    skills: [{
      id: "answer-docs",
      name: "Answer documentation questions",
      description: "Answers implementation questions.",
      tags: ["documentation", "implementation"],
      examples: ["How do I configure the Next.js adapter?"],
    }],
  },
}
```

Prefer ordered `supportedInterfaces`; the first is preferred. Core bindings are `JSONRPC`, `GRPC`,
and `HTTP+JSON`. A custom binding must be an absolute URI. Use HTTPS outside loopback development.

The strict v1 card keeps protocol metadata inside `supportedInterfaces`. An A2A `AgentSkill`
contains `id`, `name`, `description`, and `tags`, not a URL. Optional `securitySchemes` and
`securityRequirements` describe real service auth. When configured, the runtime and static export
publish `/.well-known/agent-card.json`; when omitted, it is neither generated nor advertised.

The deprecated `interfaceUrl` shorthand remains for compatibility and retains its historical
protocol `0.3` default unless `protocolVersion` is explicit.

## Golden evaluations

Use golden tasks to measure retrieval, citations, scope selection, examples, answers, and context
usage.

```ts
agent: {
  evaluations: {
    tokenBudget: 4_000,
    topK: 3,
    searchTimeoutMs: 30_000,
    surface: "mcp-context",
    tasks: [{
      id: "next-16-install",
      query: "Install the docs framework in Next.js 16",
      filters: { framework: "nextjs", version: "16" },
      expect: {
        scope: { framework: "nextjs", version: "16" },
        relevantSources: ["/docs/installation"],
        forbiddenSources: ["/docs/legacy-installation"],
        maxFirstRelevantRank: 1,
        examples: [{
          source: "/docs/installation",
          language: "bash",
          packageManager: "pnpm",
          runnable: true,
          verification: "present",
          includes: ["pnpm add @farming-labs/docs"],
        }],
        minUsefulByteRatio: 0.7,
      },
    }],
  },
}
```

Surfaces:

- `mcp-context`: deterministic local MCP context; default and network-free
- `configured-search`: actual configured provider and ranking
- `ask-ai-context`: production Ask AI retrieval/context assembly

Global `tokenBudget` and `topK` can be overridden per task. `requiredCitations` defaults to
`relevantSources`; `allowedSources`, recall, and first-rank expectations tighten retrieval.
Filters narrow retrieval; `expect.scope` asserts returned scope.

Non-simple providers require `allowNetwork: true`. Provider failures and timeouts fail instead of
falling back. Answer scoring needs an explicit callback or HTTP answer provider. Example
verification accepts `"present"`, `"syntax"`, or `"execute"`; execution also needs network
permission and enabled code-block validation. No tasks means `unmeasured`.

## Agent compaction

```ts
agent: {
  compact: {
    apiKeyEnv: "DOCS_CLOUD_API_KEY",
    model: "docs-cloud-compress-v1",
    aggressiveness: 0.3,
    protectJson: true,
    reviewManifestPath: ".farming-labs/agent-compaction-reviews.json",
  },
}
```

Supported defaults include `apiKeyEnv`, `baseUrl`, `model`, `aggressiveness`,
`maxOutputTokens`, `minOutputTokens`, and `protectJson`.

- `.env` and `.env.local` are loaded before key resolution.
- Generated sibling `agent.md` becomes the machine-readable source for Markdown, the docs API,
  and MCP, while the human UI keeps the page.
- Page frontmatter `agent.tokenBudget` overrides the global output target.
- When the page budget is below `minOutputTokens`, the CLI clamps the minimum down.
- `--changed` uses staged, unstaged, and untracked docs changes.
- `--stale` refreshes generated files whose source or compaction settings changed.
- `--review` records an auditable, hash-bound checkpoint for an intentional modified or
  hand-authored `agent.md`; the default manifest is
  `.farming-labs/agent-compaction-reviews.json`. A reviewed entry is invalidated by source,
  settings, or output changes and then fails `--check` until a person inspects and reviews it
  again.

```bash
pnpm exec docs agent compact installation --dry-run
pnpm exec docs agent compact --stale --include-missing
pnpm exec docs agent compact --review --reviewed-by "docs-team" --reason "Preserve reviewed guidance" /docs/configuration
```
