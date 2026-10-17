import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { planPackagePreview } from "./package-preview-plan.mjs";

const context = {
  eventName: "push",
  ref: "refs/heads/codex/preview-optimization",
  sha: "a".repeat(40),
  repository: "farming-labs/docs",
  token: "test-token",
};
const matchingPull = () => ({
  number: 123,
  state: "open",
  created_at: "2026-10-17T00:00:00Z",
  base: { ref: "main", repo: { full_name: context.repository } },
  head: {
    ref: "codex/preview-optimization",
    sha: context.sha,
    repo: { full_name: context.repository },
  },
});
const matchingRun = () => ({
  event: "pull_request",
  head_sha: context.sha,
  head_branch: "codex/preview-optimization",
  head_repository: { full_name: context.repository },
  created_at: "2026-10-17T00:00:01Z",
  status: "in_progress",
  conclusion: null,
});
const responds =
  (pulls, runs = [matchingRun()]) =>
  async (url) => ({
    ok: true,
    json: async () => (url.pathname.endsWith("/pulls") ? pulls : { workflow_runs: runs }),
  });

test("skips the duplicate push while retaining the PR build of the same commit", async () => {
  const fetchImpl = responds([matchingPull()]);
  assert.equal((await planPackagePreview({ ...context, fetchImpl })).publish, false);
  assert.equal(
    (await planPackagePreview({ ...context, eventName: "pull_request", fetchImpl })).publish,
    true,
  );
});

test("keeps main, fork PRs and other events without consulting the API", async () => {
  for (const override of [
    { ref: "refs/heads/main" },
    { eventName: "pull_request", ref: "refs/pull/123/merge", token: undefined },
    { eventName: "workflow_dispatch" },
    { ref: "refs/tags/v1.0.0" },
  ]) {
    const result = await planPackagePreview({
      ...context,
      ...override,
      fetchImpl: () => assert.fail("These previews must not depend on a PR lookup"),
    });
    assert.equal(result.publish, true);
    assert.doesNotMatch(result.reason, /Could not verify/);
  }
});

test("keeps standalone branch previews", async () => {
  assert.equal((await planPackagePreview({ ...context, fetchImpl: responds([]) })).publish, true);
});

for (const [label, mutate] of [
  ["stale PR head", (pull) => (pull.head.sha = "b".repeat(40))],
  ["closed PR", (pull) => (pull.state = "closed")],
  ["different base", (pull) => (pull.base.ref = "release")],
  ["different base repository", (pull) => (pull.base.repo.full_name = "elsewhere/docs")],
  ["same-named fork branch", (pull) => (pull.head.repo.full_name = "contributor/docs")],
  ["different branch", (pull) => (pull.head.ref = "another-branch")],
  ["deleted head repository", (pull) => (pull.head.repo = null)],
]) {
  test(`keeps the push preview for a ${label}`, async () => {
    const pull = matchingPull();
    mutate(pull);
    assert.equal(
      (await planPackagePreview({ ...context, fetchImpl: responds([pull]) })).publish,
      true,
    );
  });
}

test("recognizes draft PRs and case-insensitive repository names", async () => {
  const pull = matchingPull();
  pull.draft = true;
  pull.head.repo.full_name = "Farming-Labs/Docs";
  assert.equal(
    (await planPackagePreview({ ...context, fetchImpl: responds([pull]) })).publish,
    false,
  );
});

test("keeps branch previews when a conflicted PR or event delay has no workflow run", async () => {
  assert.equal(
    (await planPackagePreview({ ...context, fetchImpl: responds([matchingPull()], []) })).publish,
    true,
  );
});

test("skips only for queued, running or successful PR preview runs", async () => {
  for (const [status, conclusion] of [
    ["queued", null],
    ["in_progress", null],
    ["completed", "success"],
  ]) {
    const run = { ...matchingRun(), status, conclusion };
    assert.equal(
      (await planPackagePreview({ ...context, fetchImpl: responds([matchingPull()], [run]) }))
        .publish,
      false,
    );
  }
});

for (const conclusion of ["failure", "cancelled", "timed_out", "skipped", "action_required"]) {
  test(`keeps the branch preview when the PR preview ended with ${conclusion}`, async () => {
    const run = { ...matchingRun(), status: "completed", conclusion };
    assert.equal(
      (await planPackagePreview({ ...context, fetchImpl: responds([matchingPull()], [run]) }))
        .publish,
      true,
    );
  });
}

test("does not use other events, commits, branches, forks or waiting runs as coverage", async () => {
  for (const override of [
    { event: "push" },
    { head_sha: "b".repeat(40) },
    { head_branch: "other-branch" },
    { head_repository: { full_name: "contributor/docs" } },
    { created_at: "2026-10-16T23:59:59Z" },
    { created_at: undefined },
    { status: "waiting" },
  ]) {
    const run = { ...matchingRun(), ...override };
    assert.equal(
      (await planPackagePreview({ ...context, fetchImpl: responds([matchingPull()], [run]) }))
        .publish,
      true,
    );
  }
});

test("keeps the branch preview when the Actions API is unavailable or malformed", async () => {
  for (const response of [
    { ok: false, status: 403 },
    { ok: true, json: async () => ({ message: "Invalid workflow response" }) },
  ]) {
    const result = await planPackagePreview({
      ...context,
      fetchImpl: async (url) =>
        url.pathname.endsWith("/pulls")
          ? { ok: true, json: async () => [matchingPull()] }
          : response,
    });
    assert.equal(result.publish, true);
    assert.match(result.reason, /Could not verify/);
  }
});

test("checks the same workflow and head SHA with a shared timeout", async () => {
  const requests = [];
  const result = await planPackagePreview({
    ...context,
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return responds([matchingPull()])(url);
    },
  });
  assert.equal(result.publish, false);
  assert.equal(requests.length, 2);
  assert.equal(
    requests[1].url.pathname,
    "/repos/farming-labs/docs/actions/workflows/pkg-pr-new.yml/runs",
  );
  assert.deepEqual(Object.fromEntries(requests[1].url.searchParams), {
    event: "pull_request",
    head_sha: context.sha,
    per_page: "100",
  });
  assert.equal(requests[0].options.signal, requests[1].options.signal);
});

for (const status of [401, 403, 429, 500]) {
  test(`keeps the preview when GitHub responds with HTTP ${status}`, async () => {
    const plan = await planPackagePreview({
      ...context,
      fetchImpl: async () => ({ ok: false, status }),
    });
    assert.equal(plan.publish, true);
    assert.match(plan.reason, /Could not verify/);
  });
}

test("keeps previews on lookup timeouts, malformed JSON and unexpected payloads", async () => {
  for (const fetchImpl of [
    async () => {
      throw new Error("Timeout");
    },
    async () => ({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    }),
    responds({ message: "Unexpected response" }),
    responds([null, {}]),
  ]) {
    assert.equal((await planPackagePreview({ ...context, fetchImpl })).publish, true);
  }
});

test("keeps previews when the token or commit context is missing", async () => {
  for (const key of ["token", "repository", "sha", "ref"]) {
    const result = await planPackagePreview({
      ...context,
      [key]: undefined,
      fetchImpl: () => assert.fail("Missing context must not query GitHub"),
    });
    assert.equal(result.publish, true);
    assert.doesNotMatch(result.reason, /Could not verify/);
  }
});

test("encodes branch names and preserves an enterprise API base path", async () => {
  let request;
  await planPackagePreview({
    ...context,
    ref: "refs/heads/feature/docs&search",
    apiUrl: "https://github.example.com/api/v3",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => [] };
    },
  });
  assert.equal(request.url.origin, "https://github.example.com");
  assert.equal(request.url.pathname, "/api/v3/repos/farming-labs/docs/pulls");
  assert.deepEqual(Object.fromEntries(request.url.searchParams), {
    state: "open",
    head: "farming-labs:feature/docs&search",
    base: "main",
    per_page: "100",
  });
  assert.equal(request.options.headers.Authorization, "Bearer test-token");
  assert.equal(request.options.redirect, "error");
  assert.ok(request.options.signal instanceof AbortSignal);
});

test("CLI writes the Actions output for both decisions without logging its token", () => {
  const dir = mkdtempSync(join(tmpdir(), "docs-preview-plan-"));
  try {
    for (const [event, publish] of [
      ["push", false],
      ["pull_request", true],
    ]) {
      const output = join(dir, `${event}.txt`);
      const preload = `globalThis.fetch = async (url) => new Response(JSON.stringify(url.pathname.endsWith('/pulls') ? ${JSON.stringify([matchingPull()])} : ${JSON.stringify({ workflow_runs: [matchingRun()] })}));`;
      const stdout = execFileSync(
        process.execPath,
        [
          "--import",
          `data:text/javascript,${encodeURIComponent(preload)}`,
          fileURLToPath(new URL("./package-preview-plan.mjs", import.meta.url)),
        ],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            GITHUB_EVENT_NAME: event,
            GITHUB_REF: context.ref,
            GITHUB_SHA: context.sha,
            GITHUB_REPOSITORY: context.repository,
            GITHUB_TOKEN: context.token,
            GITHUB_API_URL: "https://api.github.com",
            GITHUB_OUTPUT: output,
          },
        },
      );
      assert.equal(readFileSync(output, "utf8"), `publish=${publish}\n`);
      assert.match(stdout, publish ? /Build preview/ : /Skip duplicate preview/);
      assert.ok(!stdout.includes(context.token));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
