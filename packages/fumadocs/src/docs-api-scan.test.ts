import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDocsAPI } from "./docs-api.js";

let rootDir: string;
const hidden = "---\nsidebar:\n  folderIndexBehavior: hidden\n---\n# Hidden";

beforeEach(() => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "theme-search-scan-"));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(rootDir, { recursive: true, force: true });
});

function write(name: string, source: string) {
  const file = path.join(rootDir, "app/docs", name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
  return file;
}

function api() {
  return createDocsAPI({ rootDir, entry: "docs", telemetry: false });
}

function request(query: string) {
  return new Request(`http://localhost/api/docs?query=${encodeURIComponent(query)}`);
}

async function urls(response: Promise<Response>) {
  const items: Array<{ url: string }> = await (await response).json();
  return [...new Set(items.map((item) => item.url.split("#")[0]))].sort();
}

describe("theme search filesystem scans", () => {
  it.each([false, true])("reads hidden chains once (visible leaf: %s)", async (visible) => {
    const depth = 50;
    for (let i = 0; i <= depth; i++) {
      write(
        `${"child/".repeat(i)}page.mdx`,
        i === depth ? `${visible ? "" : hidden}\nLeafneedle` : hidden,
      );
    }
    const handlers = api();
    const reads = vi.spyOn(fs, "readFileSync");
    const listings = vi.spyOn(fs, "readdirSync");
    const stats = vi.spyOn(fs, "statSync");
    const response = await handlers.GET(request("Leafneedle"));
    expect(response.status).toBe(200);
    expect(await urls(Promise.resolve(response))).toEqual([
      `/docs/${Array(depth).fill("child").join("/")}`,
    ]);
    const contentDir = path.join(rootDir, "app/docs");
    for (const [spy, expected] of [
      [reads, depth + 1],
      [listings, depth + 1],
      [stats, depth * 2 + 1],
    ] as const) {
      const files = spy.mock.calls
        .map(([file]) => String(file))
        .filter((file) => file.startsWith(contentDir));
      expect(new Set(files).size).toBe(files.length);
      expect(files).toHaveLength(expected);
    }
    const previousReads = reads.mock.calls.length;
    expect((await handlers.GET(request("Leafneedle"))).status).toBe(200);
    expect(reads.mock.calls.length).toBe(previousReads);
  });

  it("keeps page.mdx precedence, hidden leaf indexes and symlink directories", async () => {
    write("page.mdx", `${hidden}\nRootneedle`);
    write("child/page.mdx", `${hidden}\nChildneedle`);
    write("child/page.md", "# Lowerpriorityneedle");
    fs.symlinkSync(
      path.join(rootDir, "app/docs/child"),
      path.join(rootDir, "app/docs/linked"),
      "dir",
    );
    const handlers = api();
    expect(await urls(handlers.GET(request("Rootneedle")))).toEqual(["/docs"]);
    expect(await urls(handlers.GET(request("Childneedle")))).toEqual([
      "/docs/child",
      "/docs/linked",
    ]);
    expect(await urls(handlers.GET(request("Lowerpriorityneedle")))).toEqual([]);
    const markdown = await handlers.GET(
      new Request("http://localhost/api/docs?format=markdown&path=child"),
    );
    expect(markdown.status).toBe(200);
  });

  it("keeps hidden parent markdown unavailable while serving its visible child", async () => {
    write("page.mdx", hidden);
    write("child/page.mdx", "# Childneedle");
    const handlers = api();
    const parent = await handlers.GET(
      new Request("http://localhost/api/docs?format=markdown&path="),
    );
    const child = await handlers.GET(
      new Request("http://localhost/api/docs?format=markdown&path=child"),
    );
    expect(parent.status).toBe(404);
    expect(child.status).toBe(200);
    expect(await child.text()).toContain("Childneedle");
  });

  it.each(["readFileSync", "readdirSync", "statSync"] as const)(
    "continues past %s failures and sees repairs in a fresh handler",
    async (operation) => {
      write("page.mdx", hidden);
      const broken = write("broken/page.mdx", "# Brokenneedle");
      write("good/page.mdx", "# Goodneedle");
      const original = fs[operation];
      const failed = operation === "readFileSync" ? broken : path.dirname(broken);
      const spy = vi.spyOn(fs, operation).mockImplementation(((
        target: unknown,
        ...args: unknown[]
      ) => {
        if (String(target) === failed) throw new Error("unreadable fixture");
        return Reflect.apply(original, fs, [target, ...args]);
      }) as typeof original);
      const handlers = api();
      expect(await urls(handlers.GET(request("Goodneedle")))).toEqual(["/docs/good"]);
      expect(await urls(handlers.GET(request("Brokenneedle")))).toEqual(
        operation === "readdirSync" ? ["/docs/broken"] : [],
      );
      spy.mockRestore();
      expect(await urls(api().GET(request("Brokenneedle")))).toEqual(["/docs/broken"]);
    },
  );

  it("observes edits, additions, and deletions in a fresh handler", async () => {
    const old = write("old/page.mdx", "# Oldneedle");
    write("page.mdx", hidden);
    expect(await urls(api().GET(request("Oldneedle")))).toEqual(["/docs/old"]);
    fs.unlinkSync(old);
    write("new/page.mdx", "# Newneedle");
    const next = api();
    expect(await urls(next.GET(request("Oldneedle")))).toEqual([]);
    expect(await urls(next.GET(request("Newneedle")))).toEqual(["/docs/new"]);
  });
});
