import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const core = new URL("../packages/docs/dist/", import.meta.url);
const preset = new URL("../packages/fumadocs/dist/shadcn/index.mjs", import.meta.url);
const temp = mkdtempSync(join(tmpdir(), "docs-config-benchmark-"));
const rootPreset = join(temp, "shadcn.mjs");

const child = `
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { performance } from 'node:perf_hooks';
const loaded = new Set();
registerHooks({ load(url, context, next) { loaded.add(url); return next(url, context); } });
const start = performance.now();
const { defineDocs, createTheme, extendTheme } = await import(process.argv[1]);
const { shadcn } = await import(process.argv[2]);
const onCopyClick = () => {};
const theme = createTheme({ ...shadcn(), name: 'custom' })({ ui: { layout: { sidebarWidth: 260 } } });
const config = defineDocs({ theme: extendTheme(theme, { ui: { layout: { contentWidth: 848 } } }), onCopyClick });
const milliseconds = performance.now() - start;
assert.equal(config.onCopyClick, onCopyClick);
console.log(JSON.stringify({ milliseconds, modules: loaded.size, config }));
`;

try {
  const source = readFileSync(preset, "utf8");
  const control = source.replace(
    '"@farming-labs/docs/config"',
    JSON.stringify(new URL("index.mjs", core).href),
  );
  assert.notEqual(control, source, "The root control must replace the focused preset import");
  writeFileSync(rootPreset, control);
  const rows = [];
  for (let trial = 1; trial <= 7; trial++) {
    for (const variant of trial % 2 ? ["root", "focused"] : ["focused", "root"]) {
      const entry = new URL(variant === "root" ? "index.mjs" : "config.mjs", core).href;
      const theme = variant === "root" ? pathToFileURL(rootPreset).href : preset.href;
      rows.push({
        trial,
        variant,
        ...JSON.parse(
          execFileSync(process.execPath, ["--input-type=module", "-e", child, entry, theme], {
            encoding: "utf8",
          }),
        ),
      });
    }
  }
  for (const row of rows) assert.deepEqual(row.config, rows[0].config);
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  console.log(
    JSON.stringify(
      {
        node: process.version,
        core: fileURLToPath(core),
        method:
          "Seven alternating fresh-process trials of configuration and shadcn preset setup. Root control uses the same emitted preset with its previous root import. This does not measure page loads or full builds.",
        summary: Object.fromEntries(
          ["root", "focused"].map((variant) => {
            const selected = rows.filter((row) => row.variant === variant);
            return [
              variant,
              {
                milliseconds: median(selected.map((row) => row.milliseconds)),
                modules: median(selected.map((row) => row.modules)),
              },
            ];
          }),
        ),
        rows,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(temp, { recursive: true, force: true });
}
