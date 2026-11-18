# Maintainer specs

The [Copy Markdown pilot](pages/customization/page-actions.mdx) records the behavior we want from
our own docs website. Its MDX stays outside the published content tree. Anyone can propose wording
in a `<Rule>`. The owner approves exact wording in an interactive terminal.

## Set up Specify

From the repository root, with Node 22.6 or later and access to the Specify repository, run:

```sh
gh repo clone assistant-ui/specify specs/.tools/specify
git -C specs/.tools/specify fetch origin bf916cdabf4c1c0f44b0f2afa3e521e148868252
git -C specs/.tools/specify checkout --detach bf916cdabf4c1c0f44b0f2afa3e521e148868252
```

The pilot pins the [Specify approval stream change](https://github.com/assistant-ui/specify/pull/5)
and runs its dependency-free CLI source from this ignored checkout.
Reading the spec, the approval file and the test requires only the docs checkout.

## Approve and assign a rule

1. Review the proposed MDX. Run `pnpm specs:approve` and review the exact diff. Answer
   `y` to approve that spec or `q` to quit. On approval, Specify writes `specs/specs.approved.json`.
2. Give the coding agent an explicit task, for example: “Verify the approved Copy Markdown
   title rules. Fix any mismatch and report the test result.” For an agent in another checkout,
   make the owner's approval available there through the normal Git workflow first.
3. The agent reads the current approved wording, follows the implementation link and runs the
   command in the spec. An audit belongs to that wording and the tested commit.

## Listen for changes

An assigned local agent can keep `pnpm --silent run specs:watch` open. On startup and reconnect,
the first JSON line contains the current approved wording. Before the first approval it reads
`{"event":"snapshot","pages":{}}`. After that, each `approved` record includes the changed spec's
key, diff and latest rules. Replace the key's wording with `rules`. An empty array removes it.
Rapid saves may arrive together. For a one-off check, read `specs/specs.approved.json` directly.
Stop the listener with Ctrl-C.
