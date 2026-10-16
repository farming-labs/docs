import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
const root = dirname(fileURLToPath(import.meta.url));
const provider = process.argv[2];
if (!["fumadocs", "farming"].includes(provider)) throw Error("Specify fumadocs or farming");
const app = resolve(
  root,
  "artifacts/snapshot/apps",
  provider === "farming" ? "docs-farming" : "docs",
);
const require = createRequire(app + "/package.json");
const importDep = async (name) => import(pathToFileURL(require.resolve(name)));
const mdxRequire = createRequire(require.resolve("fumadocs-mdx/package.json"));
const { compile } = await import(pathToFileURL(mdxRequire.resolve("@mdx-js/mdx")));
process.chdir(app);
let options;
if (provider === "fumadocs") {
  const { applyMdxPreset } = await importDep("fumadocs-mdx/config");
  const { default: config } = await import(pathToFileURL(resolve(app, "source.config.ts")));
  options = await applyMdxPreset(config.mdxOptions)("bundler");
} else {
  process.env.TURBOPACK = "1";
  const { default: config } = await import(pathToFileURL(resolve(app, "next.config.ts")));
  const rules = Object.values(config.turbopack.rules).flat();
  const rule = rules.find((x) =>
    x?.loaders?.some((l) => typeof l === "object" && l.options?.remarkPlugins),
  );
  options = rule.loaders.find((l) => typeof l === "object" && l.options?.remarkPlugins).options;
  for (const key of ["remarkPlugins", "rehypePlugins"])
    options[key] = await Promise.all(
      options[key].map(async (p) => {
        const [name, ...args] = Array.isArray(p) ? p : [p];
        const module = await importDep(name);
        const fn = module.default;
        return args.length ? [fn, ...args] : fn;
      }),
    );
}
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((x) =>
    x.isDirectory() ? walk(resolve(dir, x.name)) : [resolve(dir, x.name)],
  );
const files = walk(resolve(app, "content/docs"))
  .filter((x) => /\.mdx?$/.test(x))
  .sort();
const matterRequire = createRequire(resolve(root, "../../packages/next/package.json"));
const matter = matterRequire("gray-matter");
const rows = [];
const start = performance.now();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  const begin = performance.now();
  try {
    const result = await compile(
      { path: file, value: provider === "fumadocs" ? matter(source).content : source },
      { ...options, jsx: true, development: false },
    );
    rows.push({
      path: relative(resolve(app, "content/docs"), file),
      milliseconds: performance.now() - begin,
      compiledBytes: Buffer.byteLength(String(result)),
      structuredData: result.data.structuredData,
      messages: result.messages.map((m) => m.message),
    });
  } catch (error) {
    rows.push({
      path: relative(resolve(app, "content/docs"), file),
      error: String(error),
      milliseconds: performance.now() - begin,
    });
  }
}
const report = { provider, pages: files.length, seconds: (performance.now() - start) / 1000, rows };
const destination = resolve(root, "artifacts", process.env.COMPILER_RUN_ID ?? "compiler-preflight");
mkdirSync(destination, { recursive: true });
writeFileSync(resolve(destination, provider + ".json"), JSON.stringify(report, null, 2) + "\n");
console.log(
  JSON.stringify(
    {
      provider,
      pages: files.length,
      seconds: report.seconds,
      errors: rows.filter((x) => x.error).map((x) => ({ path: x.path, error: x.error })),
    },
    null,
    2,
  ),
);
if (rows.some((x) => x.error)) process.exitCode = 1;
