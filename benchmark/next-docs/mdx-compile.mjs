// Single-core MDX compile benchmark over the same corpus as the build benchmark.
// It splits the Next adapter's MDX cost into parsing, plugins and Shiki highlighting,
// and compares parsing with the Rust mdxjs-rs compiler bundled in Next's SWC binary.
//
// node --expose-gc benchmark/next-docs/mdx-compile.mjs --pages 500 --rounds 5 --out result.json
import { createRequire } from "node:module";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { parseArgs } from "node:util";
import os from "node:os";
import { corpusPage, repoRoot } from "./prepare.mjs";

const { values } = parseArgs({
  options: {
    pages: { type: "string", default: "100" },
    rounds: { type: "string", default: "5" },
    out: { type: "string" },
  },
});
const pages = Number(values.pages);
const rounds = Number(values.rounds);
if (!Number.isInteger(pages) || pages < 2)
  throw new Error("`--pages` must be an integer of at least 2, for example `--pages 100`.");
if (!Number.isInteger(rounds) || rounds < 1)
  throw new Error("`--rounds` must be a positive integer, for example `--rounds 5`.");
if (!values.out) throw new Error("Pass `--out <file.json>` to keep every sample.");

const nextPackage = join(repoRoot, "packages/next");
const requireFromNext = createRequire(join(nextPackage, "package.json"));
const importDefault = async (id) => {
  const mod = await import(requireFromNext.resolve(id));
  return mod.default ?? mod;
};
const plugin = async (name) => {
  const file = join(nextPackage, "dist/mdx-plugins", `${name}.mjs`);
  try {
    return (await import(file)).default;
  } catch (cause) {
    throw new Error(
      `Missing ${file}. Build the adapter first with \`pnpm --filter @farming-labs/next build\`.`,
      { cause },
    );
  }
};

const { createProcessor } = await import(requireFromNext.resolve("@mdx-js/mdx"));
const remarkGfm = await importDefault("remark-gfm");
const remarkFrontmatter = await importDefault("remark-frontmatter");
const remarkMdxFrontmatter = await importDefault("remark-mdx-frontmatter");
const remarkMarkdownAlternate = await plugin("remark-markdown-alternate");
const remarkCodeGroup = await plugin("remark-code-group");
const remarkHeading = await plugin("remark-heading");
const rehypeToc = await plugin("rehype-toc");
const rehypeCode = await plugin("rehype-code");
const { loadBindings } = requireFromNext("next/dist/build/swc");
const bindings = await loadBindings();

const corpus = Array.from({ length: pages }, (_, i) => {
  const { name, source } = corpusPage(i);
  return { path: `/bench/app/docs/${i ? name + "/" : ""}page.mdx`, value: source };
});

// Mirrors the plugin order configured by withDocs() in packages/next/src/config.ts.
const base = { providerImportSource: "next-mdx-import-source-file", development: false };
const remarkFull = [
  remarkGfm,
  remarkFrontmatter,
  [remarkMarkdownAlternate, { entry: "docs", appDir: "app", docsPath: "/docs", enabled: true }],
  [remarkMdxFrontmatter, { name: "metadata" }],
  remarkCodeGroup,
  remarkHeading,
];
const themes = { light: "github-light", dark: "github-dark" };

// Processors are created once, as @mdx-js/loader caches one per option set.
const variants = {
  "rust mdxjs-rs, parse only": () => {
    const options = {
      ...base,
      parse: {
        constructs: {
          gfmAutolinkLiteral: true,
          gfmFootnoteDefinition: true,
          gfmLabelStartFootnote: true,
          gfmStrikethrough: true,
          gfmTable: true,
          gfmTaskListItem: true,
          frontmatter: true,
        },
      },
    };
    return (file) => bindings.mdx.compile(file.value, { ...options, filepath: file.path });
  },
  "js @mdx-js/mdx, parse only": () => {
    const processor = createProcessor({ ...base, remarkPlugins: [remarkGfm, remarkFrontmatter] });
    return async (file) => String(await processor.process(file));
  },
  "js full chain without Shiki": () => {
    const processor = createProcessor({
      ...base,
      remarkPlugins: remarkFull,
      rehypePlugins: [rehypeToc],
    });
    return async (file) => String(await processor.process(file));
  },
  "js full chain": () => {
    const processor = createProcessor({
      ...base,
      remarkPlugins: remarkFull,
      rehypePlugins: [rehypeToc, [rehypeCode, { themes }]],
    });
    return async (file) => String(await processor.process(file));
  },
};

const compilers = {};
const firstCallMs = {};
for (const [name, create] of Object.entries(variants)) {
  compilers[name] = create();
  const t = performance.now();
  const output = await compilers[name](corpus[1]);
  firstCallMs[name] = performance.now() - t;
  if (!output.includes("Section 6")) throw new Error(`${name} output is missing page content.`);
  if (name === "js full chain" && !output.includes("shiki"))
    throw new Error("The full chain output is missing Shiki highlighting.");
}

// One warmup round, then measured rounds with the variant order rotated each round.
const names = Object.keys(variants);
const wallSamples = Object.fromEntries(names.map((n) => [n, []]));
const cpuSamples = Object.fromEntries(names.map((n) => [n, []]));
const perPage = Object.fromEntries(names.map((n) => [n, []]));
const loadAverageAtStart = os.loadavg();
for (let round = -1; round < rounds; round++) {
  const shift = (round + 1) % names.length;
  for (const name of names.slice(shift).concat(names.slice(0, shift))) {
    const compile = compilers[name];
    globalThis.gc?.();
    const cpuStart = process.cpuUsage();
    const wallStart = performance.now();
    for (const file of corpus) {
      const t = performance.now();
      await compile(file);
      if (round >= 0) perPage[name].push(performance.now() - t);
    }
    const wall = performance.now() - wallStart;
    const cpu = process.cpuUsage(cpuStart);
    if (round >= 0) {
      wallSamples[name].push(wall);
      cpuSamples[name].push((cpu.user + cpu.system) / 1000);
    }
  }
}

const quantile = (xs, p) => {
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
};
const round1 = (n) => Math.round(n * 10) / 10;
const summary = names.map((name) => ({
  variant: name,
  firstCallMs: round1(firstCallMs[name]),
  cpuMsMedian: round1(quantile(cpuSamples[name], 0.5)),
  cpuMsMin: round1(Math.min(...cpuSamples[name])),
  cpuMsMax: round1(Math.max(...cpuSamples[name])),
  cpuMsPerPage: Math.round((quantile(cpuSamples[name], 0.5) / pages) * 100) / 100,
  wallMsMedian: round1(quantile(wallSamples[name], 0.5)),
  wallMsMin: round1(Math.min(...wallSamples[name])),
  wallMsMax: round1(Math.max(...wallSamples[name])),
  perPageWallMsMedian: Math.round(quantile(perPage[name], 0.5) * 1000) / 1000,
  perPageWallMsP95: Math.round(quantile(perPage[name], 0.95) * 1000) / 1000,
}));
writeFileSync(
  values.out,
  JSON.stringify(
    {
      pages,
      rounds,
      warmupRounds: 1,
      sourceBytes: corpus.reduce((n, file) => n + Buffer.byteLength(file.value), 0),
      node: process.version,
      cpu: os.cpus()[0].model,
      cpus: os.cpus().length,
      loadAverageAtStart,
      loadAverageAtEnd: os.loadavg(),
      summary,
      wallSamples,
      cpuSamples,
    },
    null,
    2,
  ) + "\n",
);
console.table(summary);
