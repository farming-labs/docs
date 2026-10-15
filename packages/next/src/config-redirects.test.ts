import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { withDocs } from "./config.js";

vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  return {
    ...fs,
    readFileSync: vi.fn(fs.readFileSync),
    readdirSync: vi.fn(fs.readdirSync),
  };
});

const hidden = "sidebar:\n  folderIndexBehavior: hidden\n";

describe("hidden folder redirect preparation", () => {
  let root: string;
  let originalCwd: string;
  let docsDir: string;

  function page(slug: string, frontmatter = "", extension = "mdx") {
    const file = join(docsDir, slug, `page.${extension}`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `---\ntitle: Page\n${frontmatter}---\nBody.\n`);
  }

  async function redirects() {
    const config = withDocs({});
    return config.redirects ? config.redirects() : [];
  }

  beforeEach(() => {
    originalCwd = process.cwd();
    process.chdir(mkdtempSync(join(tmpdir(), "docs-redirects-")));
    root = process.cwd();
    docsDir = join(root, "content");
    writeFileSync(
      join(root, "docs.config.ts"),
      'export default { entry: "docs", contentDir: "content", docsPath: "/guide", review: false };',
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  });

  it.each([1, 32, 128])("reads each page once while sorting %i children", async (count) => {
    page("", hidden);
    page("section", hidden);
    for (let i = 0; i < count; i++) {
      page(`section/page-${i}`, `order: ${(i * 17) % count}\n`);
    }
    vi.mocked(readFileSync).mockClear();
    vi.mocked(readdirSync).mockClear();

    expect(await redirects()).toEqual([
      { source: "/guide", destination: "/guide/section/page-0", permanent: false },
      { source: "/guide/section", destination: "/guide/section/page-0", permanent: false },
    ]);
    const contentCalls = (calls: unknown[][]) =>
      calls.filter(([file]) => String(file).startsWith(docsDir));
    expect(contentCalls(vi.mocked(readFileSync).mock.calls)).toHaveLength(count + 2);
    expect(contentCalls(vi.mocked(readdirSync).mock.calls)).toHaveLength(count + 2);
  });

  it("preserves nested visibility, numeric ordering, alphabetical ties and MDX precedence", async () => {
    page("", hidden);
    page("empty", `${hidden}order: -2\n`);
    page("section", `${hidden}order: -1\n`);
    page("section/hidden", "hidden: true\norder: -3\n");
    page("section/hidden/deep", hidden);
    page("section/hidden/deep/zeta", "order: 1\n");
    page("section/hidden/deep/alpha", "order: 1\n", "md");
    page("section/hidden/deep/alpha", "order: 2\n");
    page("section/hidden/deep/beta", "order: 1\n", "md");
    page("section/fallback", "order: 0\n");

    const result = await redirects();
    expect(result).toEqual([
      { source: "/guide", destination: "/guide/section/hidden/deep/beta", permanent: false },
      {
        source: "/guide/section",
        destination: "/guide/section/hidden/deep/beta",
        permanent: false,
      },
      {
        source: "/guide/section/hidden/deep",
        destination: "/guide/section/hidden/deep/beta",
        permanent: false,
      },
    ]);
  });

  it("sees edits, additions and deletions on the next config evaluation", async () => {
    page("", hidden);
    page("alpha", "order: 1\n");
    page("beta", "order: 2\n");
    expect(await redirects()).toEqual([
      { source: "/guide", destination: "/guide/alpha", permanent: false },
    ]);

    page("beta", "order: 0\n");
    expect(await redirects()).toEqual([
      { source: "/guide", destination: "/guide/beta", permanent: false },
    ]);
    page("new", "order: -1\n", "md");
    expect(await redirects()).toEqual([
      { source: "/guide", destination: "/guide/new", permanent: false },
    ]);
    rmSync(join(docsDir, "new"), { recursive: true });
    rmSync(join(docsDir, "beta"), { recursive: true });
    expect(await redirects()).toEqual([
      { source: "/guide", destination: "/guide/alpha", permanent: false },
    ]);
  });

  it("follows directory symlinks and skips broken links and ordinary files", async () => {
    page("", hidden);
    const target = join(root, "linked-content");
    mkdirSync(target);
    writeFileSync(join(target, "page.md"), "# Linked page\n");
    symlinkSync(target, join(docsDir, "linked"), "dir");
    symlinkSync(join(root, "missing"), join(docsDir, "broken"), "dir");
    writeFileSync(join(docsDir, "notes.txt"), "Notes");
    expect(await redirects()).toEqual([
      { source: "/guide", destination: "/guide/linked", permanent: false },
    ]);
  });
});
