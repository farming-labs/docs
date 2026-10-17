import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Preserve per-path Git history semantics while bounding build-time subprocesses. */
export async function readGitLastModifiedDates(
  rootDir: string,
  sourcePaths: Iterable<string | undefined>,
): Promise<Map<string, string>> {
  const paths = [...new Set([...sourcePaths].filter((value): value is string => Boolean(value)))];
  const dates = new Map<string, string>();
  let next = 0;

  const worker = async () => {
    while (next < paths.length) {
      const sourcePath = paths[next++];
      try {
        const { stdout } = await execFileAsync(
          "git",
          ["log", "-1", "--format=%cI", "--", sourcePath],
          { cwd: rootDir, encoding: "utf-8" },
        );
        const parsed = new Date(stdout.trim());
        if (!Number.isNaN(parsed.getTime())) dates.set(sourcePath, parsed.toISOString());
      } catch {
        // Missing Git, untracked files and unavailable history retain the caller's fallback.
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(4, paths.length) }, worker));
  return dates;
}
