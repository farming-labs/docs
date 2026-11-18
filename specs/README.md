# Maintainer specs

This repository uses its own Copy Markdown behavior to exercise Specify. The [pilot page](pages/customization/page-actions.mdx) holds two proposed rules, links to the implementation and names the test command. The public docs content tree is separate.

## Integration decision

The docs CLI delegates spec operations to the operator's local Specify package. The private authoring MCP can mount Specify's resources, subscriptions and proposal tools on request. The public docs MCP continues to serve published documentation. The project owns the worker command and the choice of approval source.

Verify the integration against the installed CLI, a real MCP client, a private spec directory and a disposable worker. Both pilot rules stay proposed until an owner approves their wording.

## Set up the pilot

From the docs repository root, use Node 22.13 or later and an account with access to the Specify repository:

```sh
pnpm install --frozen-lockfile
gh repo clone assistant-ui/specify specs/.tools/specify
git -C specs/.tools/specify fetch origin 173d49c6a7cd7ff5a3c298d2e6aeb61b3e95ed64
git -C specs/.tools/specify checkout --detach 173d49c6a7cd7ff5a3c298d2e6aeb61b3e95ed64
(cd specs/.tools/specify && pnpm --filter @assistant-ui/specify install --frozen-lockfile --ignore-scripts && pnpm --filter @assistant-ui/specify build)
pnpm --filter @farming-labs/docs build
pnpm --silent run specs show 'customization/page-actions#copy-markdown' --json
```

The ignored checkout pins the merged upstream [runner](https://github.com/assistant-ui/specify/pull/6), [GitHub receiver](https://github.com/assistant-ui/specify/pull/7), [MCP transport](https://github.com/assistant-ui/specify/pull/8) and [browser adapter](https://github.com/assistant-ui/specify/pull/9).

## From writing to assignment

1. A contributor edits the two rules in the pilot MDX. The verification section points to the implementation and tests. A proposal on its own starts no work.
2. Start `pnpm --silent run specs:run` and wait for `ready`. The pilot worker runs the existing Copy Markdown tests on assignment. For an implementation agent, use `pnpm --silent run specs run -- <program> [args...]` and choose a worker that accepts a JSON task on stdin.
3. For local approval, run `pnpm specs:approve` in another terminal and accept the exact wording. Specify writes the local approval file. The runner sends the change to the chosen worker automatically.
4. The implementation worker reads the approved rules, runs the linked test, and reports the result or opens an implementation PR under the repository's normal review process. Restarting the same runner catches up on current wording and preserves completed assignments.

## Using a contributor PR as approval

On a persistent machine, set the receiver's `SPECIFY_WEBHOOK_SECRET` and a read-only `GITHUB_TOKEN`. Resolve the designated owner's numeric ID with `gh api users/Kinfe123 --jq .id`. Use the returned number in place of `OWNER_ID`:

```sh
pnpm --silent run specs github --repo farming-labs/docs --owner-id OWNER_ID --state-dir ~/.local/state/docs-reviews
pnpm --silent run specs run --approved ~/.local/state/docs-reviews/specs.approved.json -- node specs/verify-copy-markdown.mjs
```

Run these in separate terminals. After both report `ready`, configure a GitHub **Pull requests** webhook with the shared secret and the externally reachable HTTPS `/github` URL of the receiver. The default local bind is `127.0.0.1:3891`.

A contributor opens a PR containing only MDX changes under `specs/pages`. The owner reviews the final commit and approves it on GitHub. After merge, Specify checks that the owner reviewed that head and that the changed wording matches both the merge and current default branch. The worker receives the reviewed rules and source PR. A subsequent push needs a new approval. Redeliveries are deduplicated. The receiver keeps this approval source in its own state directory.

## Subscribing from an agent

Start `pnpm --silent run specs:mcp` as a local MCP command from the repository root. Call
`specify_read` with `customization/page-actions#copy-markdown`. To suggest an edit, send its
returned revision and new lines to `specify_propose`. Subscribe to `specify://approved/snapshot`,
then read it on connection and on each update. For GitHub approvals, append
`--spec-approved <receiver-state-dir>/specs.approved.json`.

For JSON lines in a terminal, use `pnpm --silent run specs:watch`. Ctrl-C stops each local
process. To turn off GitHub delivery, remove its webhook. Projects using Specify's Vite editor can opt in to browser tools there. The maintainer specs in this repository use the CLI, private MCP or a contributor PR.
