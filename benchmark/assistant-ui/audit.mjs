import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const root = dirname(fileURLToPath(import.meta.url));
const repo = resolve(root, "../..");
const app = resolve(root, "artifacts/snapshot/apps/docs");
const require = createRequire(resolve(repo, "packages/next/package.json"));
const { createProcessor } = await import(pathToFileURL(require.resolve("@mdx-js/mdx")));
const frontmatter = (await import(pathToFileURL(require.resolve("remark-frontmatter")))).default;
const processor = createProcessor({ remarkPlugins: [frontmatter] });
const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((x) =>
    x.isDirectory() ? walk(resolve(dir, x.name)) : [resolve(dir, x.name)],
  );
const rows = [];
for (const file of walk(resolve(app, "content"))
  .filter((x) => /\.mdx?$/.test(x))
  .sort()) {
  const source = readFileSync(file, "utf8");
  const tree = processor.parse(source);
  const row = {
    path: relative(app, file),
    bytes: Buffer.byteLength(source),
    sha256: createHash("sha256").update(source).digest("hex"),
    imports: [],
    components: [],
    codeBlocks: 0,
    mermaidBlocks: 0,
  };
  const visit = (node) => {
    if (node.type === "code") {
      row.codeBlocks++;
      if (node.lang === "mermaid") row.mermaidBlocks++;
    }
    if (node.type === "mdxjsEsm")
      for (const statement of node.data?.estree?.body ?? [])
        if (statement.type === "ImportDeclaration") row.imports.push(statement.source.value);
    if (node.type?.startsWith("mdxJsx") && node.name && /^[A-Z]/.test(node.name))
      row.components.push(node.name);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  row.components = [...new Set(row.components)].sort();
  rows.push(row);
}
const docs = rows.filter((x) => x.path.startsWith("content/docs/"));
const report = {
  docs: {
    pages: docs.length,
    bytes: docs.reduce((n, x) => n + x.bytes, 0),
    pagesWithImports: docs.filter((x) => x.imports.length).length,
    codeBlocks: docs.reduce((n, x) => n + x.codeBlocks, 0),
    mermaidBlocks: docs.reduce((n, x) => n + x.mermaidBlocks, 0),
    components: [...new Set(docs.flatMap((x) => x.components))].sort(),
  },
  collections: rows.length,
  rows,
};
writeFileSync(
  resolve(root, "artifacts/content-audit.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify({ ...report, rows: undefined }, null, 2));
