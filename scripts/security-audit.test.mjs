import assert from "node:assert/strict";
import test from "node:test";
import { classifyFindings, collectVersions } from "./security-audit.mjs";

const advisory = {
  severity: "high",
  title: "Example advisory",
  vulnerable_versions: "<=1.0.0",
  url: "https://github.com/advisories/GHSA-test-test-test",
};

test("collectVersions ignores workspace links and deduplicates packages", () => {
  const entries = collectVersions([
    {
      name: "workspace",
      version: "workspace:*",
      dependencies: {
        example: { version: "1.0.0", path: "/example" },
        duplicate: { version: "1.0.0", path: "/example" },
      },
    },
  ]);
  assert.deepEqual(entries, [
    ["duplicate", new Set(["1.0.0"])],
    ["example", new Set(["1.0.0"])],
  ]);
});

test("classifyFindings accepts only active package-specific exceptions", () => {
  const allowlist = {
    version: 1,
    exceptions: [
      {
        advisory: "GHSA-test-test-test",
        package: "example",
        expires: "2026-09-01",
        reason: "No patched release exists.",
      },
    ],
  };
  const active = classifyFindings({ example: [advisory] }, allowlist, "2026-08-11");
  assert.equal(active.allowed.length, 1);
  assert.equal(active.blocked.length, 0);

  const expired = classifyFindings({ example: [advisory] }, allowlist, "2026-09-02");
  assert.equal(expired.allowed.length, 0);
  assert.equal(expired.blocked.length, 1);
  assert.equal(expired.blocked[0].expiredException.expires, "2026-09-01");
});
