# Validation and review

Use this reference for executable documentation examples and changed-docs scoring.

## Contents

- [Code-block validation](#code-block-validation)
- [Fence metadata](#fence-metadata)
- [Docs Review](#docs-review)
- [Review CI](#review-ci)
- [Safety and recovery](#safety-and-recovery)

## Code-block validation

`docs codeblocks validate` scans MD/MDX fences, builds plans from metadata, and optionally runs
executable snippets when `codeBlocks.validate` is enabled.

```bash
pnpm exec docs codeblocks validate --plan
pnpm exec docs codeblocks validate
pnpm exec docs codeblocks validate --json
```

Plan before execution. Supported runners are `local`, `vercel-sandbox`, `e2b`, `daytona`, and
reserved `cloud`. E2B requires `e2b`; Daytona requires `@daytona/sdk`.

Config:

```ts
codeBlocks: {
  validate: {
    planner: {
      provider: "openai",
      model: "gpt-4.1-mini",
      apiKeyEnv: "OPENAI_API_KEY",
    },
    runner: {
      provider: "vercel-sandbox",
      tokenEnv: "VERCEL_TOKEN",
    },
    envFile: [".env.local", ".env.test", ".env"],
    env: {
      OPENAI_API_KEY: "OPENAI_TEST_API_KEY",
    },
  },
}
```

The `env` map maps runtime names to local test variables. Do not put actual secrets in config.

## Fence metadata

````md
```ts title="app/api/chat/route.ts" framework="nextjs" packageManager="pnpm" env="OPENAI_API_KEY" runnable
const apiKey = process.env.OPENAI_API_KEY;
```
````

Add metadata when a snippet has a target file, framework, package manager, required environment,
or is safe to execute as a complete example. The same metadata supports docs review, MCP code
example filters, and golden tasks.

## Docs Review

Review changed documentation and configured Agent Skill files:

```bash
pnpm exec docs review
pnpm exec docs review --ci
pnpm exec docs review setup
```

It checks:

- broken internal links and required frontmatter
- code-fence and runnable metadata
- duplicated, generic, or boilerplate Agent blocks
- prerequisites, outcomes, verification, and recovery
- framework/version ambiguity
- command confidence and related-route coverage
- config loading confidence and public-surface drift
- golden retrieval/citation/example/budget tasks
- configured skill budgets, references, compatibility, and script documentation

## Review CI

`withDocs()` creates `.github/workflows/docs-review.yml` during Next dev/build when review CI is
enabled and no workflow exists. The generated wrapper calls the reusable Farming Labs workflow.
Configured skill paths are added to path filters, including monorepo skills outside a nested docs
app.

Config:

```ts
review: {
  ci: {
    name: "docs-review",
    mode: "warn",
  },
  score: { threshold: 80 },
  rules: {
    agentContext: "warn",
    agentSkills: "warn",
  },
}
```

Use `mode: "block"` only when a below-threshold score should fail CI. `review: false` opts out.

## Safety and recovery

- Review and doctor command-health checks are static; they do not execute arbitrary documented
  commands or make implicit network requests.
- Example execution needs explicit validation configuration and permissions.
- If `--plan` reports missing environment variables, add only the expected local mapping and
  rerun the plan.
- If review misses a changed skill in a monorepo, confirm `agent.skills` points to that collection
  and regenerate the workflow path filters.
- If config cannot be evaluated, fix its imports/environment access instead of accepting static
  fallback as high-confidence validation.
