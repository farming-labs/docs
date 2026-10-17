#!/usr/bin/env node

import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Skip only push previews already covered by the PR trigger in pkg-pr-new.yml. */
export async function planPackagePreview({
  eventName,
  ref,
  sha,
  repository,
  token,
  apiUrl = "https://api.github.com",
  fetchImpl = fetch,
}) {
  const publish = (reason) => ({ publish: true, reason });
  if (eventName !== "push" || ref === "refs/heads/main") {
    return publish("Keep PR and main-branch previews.");
  }
  if (!ref?.startsWith("refs/heads/") || !repository || !sha || !token) {
    return publish("Insufficient context to prove this push preview is redundant.");
  }

  const branch = ref.slice("refs/heads/".length);
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) return publish("Missing repository identity; keep the preview.");

  try {
    const signal = AbortSignal.timeout(5000);
    const readApi = async (endpoint, params) => {
      const url = new URL(
        `repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${endpoint}`,
        `${apiUrl.replace(/\/$/, "")}/`,
      );
      url.search = new URLSearchParams(params).toString();
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        redirect: "error",
        signal,
      });
      if (!response.ok) throw new Error("GitHub preview lookup failed");
      return response.json();
    };
    const pulls = await readApi("pulls", {
      state: "open",
      head: `${owner}:${branch}`,
      base: "main",
      per_page: "100",
    });
    if (!Array.isArray(pulls)) throw new Error("Invalid GitHub PR response");
    const sameRepository = (name) => name?.toLowerCase() === repository.toLowerCase();
    const matching = pulls.find(
      (pull) =>
        pull?.state === "open" &&
        pull.base?.ref === "main" &&
        sameRepository(pull.base?.repo?.full_name) &&
        sameRepository(pull.head?.repo?.full_name) &&
        pull.head?.ref === branch &&
        pull.head?.sha === sha,
    );
    if (!matching) return publish("No matching open PR to main; keep the branch preview.");

    // GitHub does not start pull_request workflows for merge conflicts. Also
    // keep the push preview if the PR run is absent, cancelled or already failed.
    const { workflow_runs: runs } = await readApi("actions/workflows/pkg-pr-new.yml/runs", {
      event: "pull_request",
      head_sha: sha,
      per_page: "100",
    });
    if (!Array.isArray(runs)) throw new Error("Invalid GitHub workflow response");
    const covered = runs.some(
      (run) =>
        run?.event === "pull_request" &&
        run.head_sha === sha &&
        run.head_branch === branch &&
        sameRepository(run.head_repository?.full_name) &&
        Date.parse(run.created_at) >= Date.parse(matching.created_at) &&
        (["queued", "in_progress"].includes(run.status) ||
          (run.status === "completed" && run.conclusion === "success")),
    );
    if (covered) {
      return {
        publish: false,
        reason: "A PR preview run covers this same repository, branch and commit.",
      };
    }
    return publish("No active or successful PR preview run; keep the branch preview.");
  } catch {
    // A lookup outage, stale API response or missing permissions must not lose a preview.
    return publish("Could not verify PR coverage; keep the branch preview.");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const plan = await planPackagePreview({
    eventName: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    sha: process.env.GITHUB_SHA,
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN,
    apiUrl: process.env.GITHUB_API_URL,
  });
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `publish=${plan.publish}\n`);
  }
  console.log(`${plan.publish ? "Build preview" : "Skip duplicate preview"}: ${plan.reason}`);
}
