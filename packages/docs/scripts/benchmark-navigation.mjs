import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

// Node 22+; build core first. Optional arguments: baseline=/absolute/dist/mcp.mjs candidate=/absolute/dist/mcp.mjs
const targets = await Promise.all(
  (process.argv.length > 2
    ? process.argv.slice(2)
    : [`candidate=${resolve(import.meta.dirname, "../dist/mcp.mjs")}`]
  ).map(async (argument) => {
    const separator = argument.indexOf("=");
    assert(separator > 0, "Expected label=/absolute/path/to/mcp.mjs");
    return {
      label: argument.slice(0, separator),
      module: await import(pathToFileURL(resolve(argument.slice(separator + 1))).href),
    };
  }),
);
const samples = [];
for (const shape of ["flat", "nested", "explicit", "nested-explicit"]) {
  for (const count of [100, 1_000, 5_000]) {
    const rootDir = mkdtempSync(join(tmpdir(), "docs-navigation-bench-"));
    const slugs = Array.from(
      { length: count },
      (_, index) => `page-${String(index).padStart(5, "0")}`,
    );
    try {
      for (const slug of slugs) {
        const file = join(
          rootDir,
          "docs",
          shape.startsWith("nested") ? `${slug}/guide/page.md` : `${slug}.md`,
        );
        mkdirSync(dirname(file), { recursive: true });
        writeFileSync(file, `---\ntitle: ${slug}\ndescription: Example page\n---\n# ${slug}`);
      }
      let expectedHash;
      const scanCounts = new Map();
      const options = {
        rootDir,
        ordering: shape.includes("explicit")
          ? [...slugs].reverse().map((slug) => ({ slug }))
          : undefined,
      };
      for (let trial = 0; trial < 5; trial++) {
        for (const target of trial % 2 ? [...targets].reverse() : targets) {
          const source = target.module.createFilesystemDocsMcpSource(options);
          await source.getPages();
          const started = performance.now();
          const tree = await source.getNavigation();
          const milliseconds = performance.now() - started;
          const hash = createHash("sha256").update(JSON.stringify(tree)).digest("hex");
          expectedHash ??= hash;
          assert.equal(
            hash,
            expectedHash,
            `Navigation output differs: ${shape}/${count}/${target.label}`,
          );
          if (trial === 0) {
            const countedSource = target.module.createFilesystemDocsMcpSource(options);
            let slugReads = 0;
            for (const page of await countedSource.getPages()) {
              const slug = page.slug;
              Object.defineProperty(page, "slug", {
                get() {
                  slugReads++;
                  return slug;
                },
              });
            }
            assert.deepEqual(await countedSource.getNavigation(), tree);
            scanCounts.set(target.label, slugReads);
          }
          samples.push({
            label: target.label,
            shape,
            pages: count,
            trial,
            milliseconds,
            slugReads: scanCounts.get(target.label),
            hash,
          });
        }
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  }
}
const median = (values) =>
  values.toSorted((left, right) => left - right)[Math.floor(values.length / 2)];
const groups = Map.groupBy(samples, (sample) => `${sample.label}/${sample.shape}/${sample.pages}`);
const summary = [...groups.values()].map((rows) => ({
  label: rows[0].label,
  shape: rows[0].shape,
  pages: rows[0].pages,
  milliseconds: median(rows.map((row) => row.milliseconds)),
  slugReads: rows[0].slugReads,
}));
console.log(
  JSON.stringify(
    {
      node: process.version,
      method:
        "Five alternating trials per target; filesystem loading and import excluded. Slug reads counted in separate untimed runs. Identical navigation JSON hashes required. Navigation preparation only, not a full build benchmark.",
      summary,
      samples,
    },
    null,
    2,
  ),
);
