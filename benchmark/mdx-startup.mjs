import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import * as nodeModule from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

assert(
  typeof nodeModule.registerHooks === "function",
  "The MDX startup benchmark requires module.registerHooks; use Node.js 22.15+ or Node.js 24+. See benchmark/mdx-startup.md.",
);

const targets = process.argv.slice(2).map((argument) => {
  const separator = argument.indexOf("=");
  assert(separator > 0, "Expected label=/absolute/path/to/dist/mdx.mjs");
  return {
    label: argument.slice(0, separator),
    entry: pathToFileURL(resolve(argument.slice(separator + 1))).href,
  };
});
assert(targets.length > 0, "Provide at least one built MDX entrypoint");

const child = `
import { registerHooks } from 'node:module';
import { performance } from 'node:perf_hooks';
const modules = new Set();
registerHooks({ load(url, context, next) { modules.add(url); return next(url, context); } });
const start = performance.now();
const helpers = await import(process.argv[1]);
const importMs = performance.now() - start;
const heading = (value) => ({ type: 'heading', depth: 2, children: [{ type: 'text', value }] });
const root = { type: 'root', children: [
  heading('Café 配置'), heading('Setup'), heading('Setup'), heading('Custom [#release notes]'),
  { type: 'mdxJsxFlowElement', name: 'Prompt', children: [heading('Setup')] },
] };
helpers.applyDocsMarkdownHeadingAnchors(root);
const toc = [];
helpers.withDocsMarkdownRenderableHeadings(root, () => {
  const visit = (node) => {
    if (node.type === 'heading') toc.push({ url: '#' + node.data.hProperties.id });
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
});
helpers.encodeDocsHeadingTocUrls(toc);
console.log(JSON.stringify({
  importMs, modules: modules.size,
  parserModules: [...modules].filter((url) => /remark-(parse|mdx|gfm)|micromark|mdast-util|markdown-parser/.test(url)).length,
  output: { root, toc, exports: Object.keys(helpers).sort() },
}));
`;

const samples = [];
let expected;
for (let trial = 1; trial <= 7; trial++) {
  for (const target of trial % 2 ? targets : [...targets].reverse()) {
    const { output, ...sample } = JSON.parse(
      execFileSync(process.execPath, ["--input-type=module", "-e", child, target.entry], {
        encoding: "utf8",
      }),
    );
    expected ??= output;
    assert.deepEqual(output, expected, "Heading, TOC, prompt or export behavior changed");
    assert.deepEqual(
      output.root.children.slice(0, 4).map((node) => node.data.hProperties.id),
      ["café-配置", "setup", "setup-1", "release notes"],
    );
    assert.equal(output.root.children[4].children[0].type, "heading");
    assert.equal(output.root.children[4].children[0].data, undefined);
    assert.deepEqual(output.toc, [
      { url: "#caf%C3%A9-%E9%85%8D%E7%BD%AE" },
      { url: "#setup" },
      { url: "#setup-1" },
      { url: "#release%20notes" },
    ]);
    samples.push({ label: target.label, trial, ...sample });
  }
}
const median = (values) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
const summary = Object.fromEntries(
  targets.map(({ label }) => [
    label,
    Object.fromEntries(
      ["importMs", "modules", "parserModules"].map((key) => [
        key,
        median(samples.filter((row) => row.label === label).map((row) => row[key])),
      ]),
    ),
  ]),
);
console.log(
  JSON.stringify(
    {
      node: process.version,
      platform: process.platform,
      method:
        "Seven alternating fresh-process trials of built MDX helper imports with warm OS caches. Identical headings, TOC, literal prompt content and exports required. Import startup only, not compilation, a full build or browser latency.",
      targets,
      summary,
      samples,
    },
    null,
    2,
  ),
);
