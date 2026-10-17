import { expect, it, vi } from "vitest";

const lookup = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", async () => {
  const { promisify } = await import("node:util");
  return { execFile: Object.assign(() => undefined, { [promisify.custom]: lookup }) };
});

import { readGitLastModifiedDates } from "./git-dates.js";

it("bounds subprocesses, deduplicates inputs, and drains the queue after a failed lookup", async () => {
  const pending: Array<() => void> = [];
  let active = 0;
  let peak = 0;
  lookup.mockImplementation((_command, args) => {
    active++;
    peak = Math.max(peak, active);
    return new Promise((resolve, reject) => {
      pending.push(() => {
        active--;
        if (args.at(-1) === "failed.md") reject(new Error("Git unavailable"));
        else resolve({ stdout: "2020-01-02T03:04:05Z\n" });
      });
    });
  });

  const paths = ["failed.md", ...Array.from({ length: 10 }, (_, i) => `${i}.md`)];
  const result = readGitLastModifiedDates("/app", [...paths, paths[0], paths[1], undefined, ""]);
  expect(lookup).toHaveBeenCalledTimes(4);
  for (let i = 0; i < paths.length; i++) {
    expect(pending.length).toBeGreaterThan(0);
    pending.shift()!();
    await Promise.resolve();
  }
  const dates = await result;
  expect(peak).toBe(4);
  expect(active).toBe(0);
  expect(lookup).toHaveBeenCalledTimes(paths.length);
  expect(dates.size).toBe(paths.length - 1);
  expect(dates.has("failed.md")).toBe(false);
  expect(dates.get("9.md")).toBe("2020-01-02T03:04:05.000Z");
});
