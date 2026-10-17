import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { transformWithEsbuild } from "vite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MdxBuildCache } from "./mdx-build-cache.js";
import { fingerprintMdxFiles } from "./mdx-compiler-fingerprint.js";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "farm-mdx-cache-"));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});
const result = {
  code: "export default 1",
  map: { version: 3, names: [], sources: ["page.mdx"], mappings: "AAAA" },
};

describe("MdxBuildCache", () => {
  it("reuses output across instances without sharing mutable maps", async () => {
    const file = path.join(root, "cache.json");
    const compile = vi.fn(async () => result);
    const first = new MdxBuildCache(file);
    const output = await first.compile("page.mdx", "content-options-compiler", compile);
    (output!.map as typeof result.map).sources.push("mutation");
    await first.flush();
    expect(
      await new MdxBuildCache(file).compile("page.mdx", "content-options-compiler", compile),
    ).toEqual(result);
    expect(compile).toHaveBeenCalledTimes(1);
  });

  it("leaves an unchanged cache file untouched across builds and repeated flushes", async () => {
    const file = path.join(root, "cache.json");
    const first = new MdxBuildCache(file);
    await first.compile("a", "key", async () => result);
    await first.compile("b", "key", async () => result);
    await first.flush();
    const before = await fs.readFile(file, "utf8");
    const date = new Date("2000-01-01T00:00:00Z");
    await fs.utimes(file, date, date);

    const compile = vi.fn(async () => result);
    const second = new MdxBuildCache(file);
    // A hit can change in-memory eviction order without changing cached output.
    await second.compile("b", "key", compile);
    await second.compile("a", "key", compile);
    await Promise.all([second.flush(), second.flush()]);
    await second.flush();
    expect(compile).not.toHaveBeenCalled();
    expect(await fs.readFile(file, "utf8")).toBe(before);
    expect((await fs.stat(file)).mtime).toEqual(date);

    await second.compile("a", "edited", async () => ({ code: "export default 2" }));
    await second.flush();
    expect(await new MdxBuildCache(file).compile("a", "edited", compile)).toEqual({
      code: "export default 2",
    });
    expect(compile).not.toHaveBeenCalled();
  });

  it("keeps newly compiled entries when another flush is already writing", async () => {
    const file = path.join(root, "cache.json");
    const cache = new MdxBuildCache(file);
    await cache.compile("a", "key", async () => result);
    const originalWrite = fs.writeFile.bind(fs);
    const writing = Promise.withResolvers<void>();
    const resume = Promise.withResolvers<void>();
    vi.spyOn(fs, "writeFile").mockImplementationOnce(async (...args) => {
      writing.resolve();
      await resume.promise;
      return originalWrite(...args);
    });
    vi.spyOn(fs, "mkdir").mockResolvedValue(undefined);
    const firstFlush = cache.flush();
    await writing.promise;
    await cache.compile("b", "key", async () => result);
    const secondFlush = cache.flush();
    // Drain the second flush's microtasks while the first write is blocked.
    await new Promise((resolve) => setImmediate(resolve));
    const writesBeforeResume = vi.mocked(fs.writeFile).mock.calls.length;
    resume.resolve();
    await Promise.all([firstFlush, secondFlush]);
    expect(writesBeforeResume).toBe(1);
    const compile = vi.fn(async () => result);
    const next = new MdxBuildCache(file);
    await next.compile("a", "key", compile);
    await next.compile("b", "key", compile);
    expect(compile).not.toHaveBeenCalled();
    expect(await fs.readdir(root)).toEqual(["cache.json"]);
  });

  it("retries a failed write without recompiling and preserves hit-based eviction", async () => {
    const file = path.join(root, "cache.json");
    const cache = new MdxBuildCache(file, 10_000, 2);
    await cache.compile("a", "key", async () => result);
    await cache.compile("b", "key", async () => result);
    await cache.compile("a", "key", async () => result);
    await cache.compile("c", "key", async () => result);
    vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("write unavailable"));
    await cache.flush();
    await expect(fs.stat(file)).rejects.toThrow();
    await cache.flush();
    expect(JSON.parse(await fs.readFile(file, "utf8")).map(([id]: [string]) => id)).toEqual([
      "a",
      "c",
    ]);
    expect(await fs.readdir(root)).toEqual(["cache.json"]);
  });

  it("invalidates changed source/options/compiler keys and separates module IDs", async () => {
    const cache = new MdxBuildCache(path.join(root, "cache.json"));
    const compile = vi.fn(async () => result);
    await cache.compile("a.mdx", "v1", compile);
    await cache.compile("a.mdx", "v2", compile);
    await cache.compile("b.mdx", "v2", compile);
    expect(compile).toHaveBeenCalledTimes(3);
  });

  it("deduplicates concurrent exact inputs", async () => {
    const cache = new MdxBuildCache(path.join(root, "cache.json"));
    const compile = vi.fn(async () => result);
    const outputs = await Promise.all([
      cache.compile("a", "key", compile),
      cache.compile("a", "key", compile),
    ]);
    expect(compile).toHaveBeenCalledTimes(1);
    expect(outputs[0]).toEqual(outputs[1]);
    expect(outputs[0]).not.toBe(outputs[1]);
  });

  it("propagates compilation failures and retries instead of saving errors", async () => {
    const cache = new MdxBuildCache(path.join(root, "cache.json"));
    const compile = vi
      .fn()
      .mockRejectedValueOnce(new Error("invalid MDX"))
      .mockResolvedValue(result);
    await expect(cache.compile("a", "key", compile)).rejects.toThrow("invalid MDX");
    await expect(cache.compile("a", "key", compile)).resolves.toEqual(result);
    expect(compile).toHaveBeenCalledTimes(2);
  });

  it("treats truncated and checksum-invalid caches as misses", async () => {
    const file = path.join(root, "cache.json");
    const compile = vi.fn(async () => result);
    await fs.writeFile(file, "[[");
    const first = new MdxBuildCache(file);
    await first.compile("a", "key", compile);
    await first.flush();
    const saved = JSON.parse(await fs.readFile(file, "utf8"));
    saved[0][1].value = JSON.stringify({ code: "stale output" });
    await fs.writeFile(file, JSON.stringify(saved));
    expect(await new MdxBuildCache(file).compile("a", "key", compile)).toEqual(result);
    expect(compile).toHaveBeenCalledTimes(2);
  });

  it("compiles successfully when its cache cannot be read or written", async () => {
    const parent = path.join(root, "not-a-directory");
    await fs.writeFile(parent, "occupied");
    const cache = new MdxBuildCache(path.join(parent, "cache.json"));
    await expect(cache.compile("a", "key", async () => result)).resolves.toEqual(result);
    await expect(cache.flush()).resolves.toBeUndefined();
  });

  it("bounds retained entries, replaces edited versions and evicts oversized output", async () => {
    const file = path.join(root, "cache.json");
    const cache = new MdxBuildCache(file, 1_000, 2);
    for (let i = 0; i < 10; i++) await cache.compile("edited", String(i), async () => result);
    await cache.compile("b", "key", async () => result);
    await cache.compile("c", "key", async () => result);
    await cache.flush();
    expect(JSON.parse(await fs.readFile(file, "utf8")).map(([id]: [string]) => id)).toEqual([
      "b",
      "c",
    ]);
    await cache.compile("huge", "key", async () => ({ code: "x".repeat(2_000) }));
    await cache.flush();
    expect((await fs.stat(file)).size).toBeLessThan(1_000);
    expect(await fs.readdir(root)).toEqual(["cache.json"]);
  });
});

describe("compiler fingerprint", { timeout: 20_000 }, () => {
  it("does not persist loaded compiler code under a changed on-disk fingerprint", async () => {
    const source = await fs.readFile(
      new URL("./mdx-compiler-fingerprint.ts", import.meta.url),
      "utf8",
    );
    const transformed = await transformWithEsbuild(source, "fingerprint.ts", {
      target: "es2022",
      format: "esm",
    });
    await fs.writeFile(path.join(root, "fingerprint.mjs"), transformed.code);
    await fs.writeFile(path.join(root, "helper.js"), "export const value = 1");
    await fs.symlink(
      fileURLToPath(new URL("../node_modules", import.meta.url)),
      path.join(root, "node_modules"),
      "junction",
    );
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "--eval",
        `
      import { fingerprintMdxCompiler } from './fingerprint.mjs';
      import { writeFile } from 'node:fs/promises';
      const first = await fingerprintMdxCompiler();
      await writeFile('helper.js', 'export const value = 2');
      const changed = await fingerprintMdxCompiler();
      await writeFile('helper.js', 'export const value = 1');
      const restored = await fingerprintMdxCompiler();
      console.log(JSON.stringify([Boolean(first), changed, restored === first]));
    `,
      ],
      { cwd: root, encoding: "utf8" },
    );
    expect(JSON.parse(output)).toEqual([true, null, true]);
  });

  it("detects edits with unchanged mtimes, additions, and deletions", async () => {
    const dependency = path.join(root, "compiler.js");
    await fs.writeFile(dependency, "export const version = 1");
    const stat = await fs.stat(dependency);
    const before = await fingerprintMdxFiles([root]);
    await fs.writeFile(dependency, "export const version = 2");
    await fs.utimes(dependency, stat.atime, stat.mtime);
    const edited = await fingerprintMdxFiles([root]);
    expect(edited).not.toBe(before);
    await fs.writeFile(path.join(root, "grammar.json"), "{}");
    expect(await fingerprintMdxFiles([root])).not.toBe(edited);
    await fs.unlink(path.join(root, "grammar.json"));
    expect(await fingerprintMdxFiles([root])).toBe(edited);
  });

  it("rejects hidden linked inputs so callers can fall back to compiling", async () => {
    await fs.symlink(root, path.join(root, "linked"), "dir");
    await expect(fingerprintMdxFiles([root])).rejects.toThrow("Linked compiler input");
  });
});
