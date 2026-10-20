import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFilesystemDocsMcpSource } from "./mcp.js";

let rootDir: string;
const hidden = "---\nsidebar:\n  folderIndexBehavior: hidden\n---\n# Hidden index";

beforeEach(() => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "docs-mcp-filesystem-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(rootDir, { recursive: true, force: true });
});

function write(name: string, content: string) {
  const file = path.join(rootDir, "docs", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

function source() {
  return createFilesystemDocsMcpSource({ rootDir });
}

describe("filesystem MCP scans", () => {
  it.each([false, true])("reads nested hidden indexes once (visible leaf: %s)", async (visible) => {
    const depth = 50;
    for (let level = 0; level <= depth; level++) {
      write(`${"child/".repeat(level)}page.md`, level === depth && visible ? "# Leaf" : hidden);
    }
    const read = vi.spyOn(fs, "readFileSync");
    const list = vi.spyOn(fs, "readdirSync");
    const stat = vi.spyOn(fs, "statSync");
    const docs = source();
    const pages = await docs.getPages();
    expect(pages).toHaveLength(visible ? 1 : depth + 1);
    expect(pages.some((page) => page.slug === Array(depth).fill("child").join("/"))).toBe(true);
    for (const spy of [read, list, stat]) {
      const files = spy.mock.calls
        .map(([file]) => String(file))
        .filter((file) => file.startsWith(rootDir));
      expect(new Set(files).size).toBe(files.length);
    }
    expect(read).toHaveBeenCalledTimes(depth + 1);
    expect(list).toHaveBeenCalledTimes(depth + 1);
    expect(stat).toHaveBeenCalledTimes(depth * 2 + 1);
    expect(await docs.getPages()).toBe(pages);
    expect(read).toHaveBeenCalledTimes(depth + 1);
  });

  it("retains page.mdx precedence and hidden leaf indexes, including alternate index names", async () => {
    write("page.md", hidden);
    write("child/page.mdx", hidden);
    write("child/page.md", "# Visible alternate");
    write("child/index.md", "# Alternate index");
    write("svelte/+page.svx", hidden);
    write("svelte/leaf/page.svx", "# Svelte leaf");
    write("hidden/page.md", "---\nhidden: true\n---\n# Hidden page");
    // The Svelte leaf makes the root hidden; the hidden child has no visible descendants.
    const pages = await source().getPages();
    expect(pages.map((page) => page.slug)).toEqual([
      "child",
      "child",
      "child",
      "hidden",
      "svelte/leaf",
    ]);
    fs.rmSync(path.join(rootDir, "docs", "svelte"), { recursive: true });
    // Neither the hidden page nor the lower-priority child/page.md hides the root.
    expect((await source().getPages()).map((page) => page.slug)).toEqual([
      "child",
      "child",
      "child",
      "hidden",
      "",
    ]);
  });

  it("preserves agent content, related metadata, and symbolic files and directories", async () => {
    write("page.md", hidden);
    const file = write(
      "child/page.md",
      "---\ntitle: Child\nrelated:\n  - /docs/other\n---\n# Human",
    );
    write("child/agent.md", "# Agent instructions");
    fs.symlinkSync(file, path.join(rootDir, "docs", "linked.md"));
    fs.symlinkSync(
      path.join(rootDir, "docs", "child"),
      path.join(rootDir, "docs", "linked-folder"),
      "dir",
    );
    const pages = await source().getPages();
    expect(pages.map((page) => page.slug)).toEqual(["child", "linked-folder", "linked"]);
    expect(pages[0]).toMatchObject({
      title: "Child",
      content: "Human",
      agentContent: "Agent instructions",
    });
    expect(pages[1]).toMatchObject({ title: "Child", agentContent: "Agent instructions" });
    expect(pages[0].related).toEqual(pages[1].related);
  });

  it("does not retain reads across new sources or failed scans", async () => {
    write("page.md", hidden);
    const file = write("a-child/page.md", "---\ntitle: [unfinished\n---\n# Broken");
    const docs = source();
    expect(() => docs.getPages()).toThrow();
    write("a-child/page.md", "---\ntitle: Repaired\n---\n# Repaired");
    expect((await docs.getPages()).map((page) => page.title)).toEqual(["Repaired"]);
    fs.unlinkSync(file);
    write("new/page.md", "---\ntitle: New\n---\n# New");
    expect((await source().getPages()).map((page) => page.title)).toEqual(["New"]);
  });

  it.each(["readFileSync", "readdirSync", "statSync"] as const)(
    "still surfaces %s failures after a visibility probe catches them",
    (operation) => {
      write("page.md", hidden);
      const file = write("z-child/page.md", "# Child");
      const original = fs[operation];
      vi.spyOn(fs, operation).mockImplementation(((target: unknown, ...args: unknown[]) => {
        if (String(target) === (operation === "readFileSync" ? file : path.dirname(file))) {
          throw new Error("unreadable fixture");
        }
        return Reflect.apply(original, fs, [target, ...args]);
      }) as typeof original);
      expect(() => source().getPages()).toThrow("unreadable fixture");
    },
  );
});
