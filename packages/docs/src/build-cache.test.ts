import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DocsBuildCache, docsBuildCacheDigest } from "./build-cache.js";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "docs-build-cache-"));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

it("reuses unchanged content records across builds and invalidates edited inputs", async () => {
  const file = path.join(root, "pages.json");
  const compile = vi.fn((source: string) => ({ metadata: { title: source }, search: [source] }));
  const build = async (version: string, pages: Record<string, string>) => {
    const cache = new DocsBuildCache<ReturnType<typeof compile>>(file);
    const results: Record<string, ReturnType<typeof compile>> = {};
    for (const [id, source] of Object.entries(pages)) {
      results[id] = await cache.compile(
        id,
        docsBuildCacheDigest(JSON.stringify([version, source])),
        () => compile(source),
      );
    }
    await cache.flush();
    return results;
  };

  const first = await build("compiler-v1", { welcome: "Welcome", usage: "Usage" });
  expect(compile).toHaveBeenCalledTimes(2);
  first.usage.search.push("caller mutation");
  expect(await build("compiler-v1", { welcome: "Updated", usage: "Usage" })).toEqual({
    welcome: { metadata: { title: "Updated" }, search: ["Updated"] },
    usage: { metadata: { title: "Usage" }, search: ["Usage"] },
  });
  expect(compile).toHaveBeenCalledTimes(3);
  expect(await build("compiler-v1", { usage: "Usage" })).toEqual({
    usage: { metadata: { title: "Usage" }, search: ["Usage"] },
  });
  expect(compile).toHaveBeenCalledTimes(3);
  await build("compiler-v2", { usage: "Usage" });
  expect(compile).toHaveBeenCalledTimes(4);
});

it("rejects persisted output that no longer matches the caller's schema", async () => {
  const file = path.join(root, "pages.json");
  const old = new DocsBuildCache<unknown>(file);
  await old.compile("page", "key", () => ({ obsolete: true }));
  await old.flush();

  const cache = new DocsBuildCache<{ title: string }>(file, {
    validate: (value) =>
      value !== null &&
      typeof value === "object" &&
      "title" in value &&
      typeof value.title === "string",
  });
  const compile = vi.fn(() => ({ title: "Welcome" }));
  expect(await cache.compile("page", "key", compile)).toEqual({ title: "Welcome" });
  expect(compile).toHaveBeenCalledTimes(1);
  await cache.flush();
  expect(await new DocsBuildCache(file).compile("page", "key", compile)).toEqual({
    title: "Welcome",
  });
  expect(compile).toHaveBeenCalledTimes(1);
});
