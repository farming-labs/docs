import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readGitLastModifiedDates } from "./git-dates.js";

describe("build-time Git dates", () => {
  let root: string;
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const commit = (date: string) => {
    git("add", ".");
    execFileSync("git", ["commit", "-qm", "docs"], {
      cwd: root,
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    });
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), "docs-git-dates-"));
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Docs Test");
    git("config", "user.email", "docs@example.com");
    git("config", "commit.gpgsign", "false");
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("matches per-file Git queries through edits, a rename and a merge", async () => {
    const files = ["first.md", "space name.md", "日本語.md", "line\nbreak.md", "$(literal).md"];
    for (const file of files) writeFileSync(path.join(root, file), `# ${file}`);
    commit("2020-01-01T23:00:00-02:00");
    git("checkout", "-qb", "topic");
    writeFileSync(path.join(root, files[0]), "# Edited");
    commit("2021-02-03T04:05:06Z");
    git("checkout", "-q", "main");
    git("mv", files[1], "renamed.md");
    files[1] = "renamed.md";
    commit("2022-03-04T05:06:07Z");
    git("merge", "-q", "--no-edit", "topic");
    writeFileSync(path.join(root, "untracked.md"), "# Untracked");
    const inputs = [...files, "untracked.md", "missing.md", files[0], undefined, ""];
    const dates = await readGitLastModifiedDates(root, inputs);
    for (const file of inputs) {
      if (!file) continue;
      const previous = git("log", "-1", "--format=%cI", "--", file).trim();
      expect(dates.get(file)).toBe(previous ? new Date(previous).toISOString() : undefined);
    }
    expect(dates.size).toBe(files.length);

    // A second invocation must observe new commits, not a process-global date cache.
    writeFileSync(path.join(root, files[0]), "# New edit");
    commit("2023-04-05T06:07:08Z");
    expect((await readGitLastModifiedDates(root, [files[0]])).get(files[0])).toBe(
      "2023-04-05T06:07:08.000Z",
    );
  });

  it("supports an app subdirectory and absolute source paths", async () => {
    mkdirSync(path.join(root, "website"));
    writeFileSync(path.join(root, "website", "page.md"), "# Page");
    commit("2020-01-02T03:04:05Z");
    const absolute = path.join(root, "website", "page.md");
    const dates = await readGitLastModifiedDates(path.join(root, "website"), ["page.md", absolute]);
    expect([...dates.values()]).toEqual(["2020-01-02T03:04:05.000Z", "2020-01-02T03:04:05.000Z"]);
  });

  it("leaves callers' fallbacks available without usable Git history", async () => {
    expect(await readGitLastModifiedDates(root, ["page.md"])).toEqual(new Map());
    expect(await readGitLastModifiedDates(path.join(root, "missing"), ["page.md"])).toEqual(
      new Map(),
    );
    expect(await readGitLastModifiedDates(root, [undefined, ""])).toEqual(new Map());
  });
});
