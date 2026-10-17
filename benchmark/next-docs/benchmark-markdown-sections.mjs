import { pathToFileURL } from 'node:url';
import { deepStrictEqual } from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
const [beforePath, afterPath] = process.argv.slice(2);
const before = (await import(pathToFileURL(beforePath))).parseDocsMarkdownSections;
const after = (await import(pathToFileURL(afterPath))).parseDocsMarkdownSections;
const rows = [];
for (const headings of [100, 1000, 5000]) {
  for (const fallback of [false, true]) {
    const source = Array.from({length: headings}, (_, i) => `${'#'.repeat(i % 6 + 1)} Section ${i}\n\nConfiguration detail ${i}.`).join('\n\n') + (fallback ? '\n\n{' : '');
    deepStrictEqual(after(source), before(source));
    const samples = { before: [], after: [] };
    for (let trial = 0; trial < 7; trial++) {
      for (const key of trial % 2 ? ['after', 'before'] : ['before', 'after']) {
        global.gc?.();
        const start = performance.now();
        const sections = (key === 'before' ? before : after)(source);
        samples[key].push(performance.now() - start);
        if (sections.length !== headings) throw new Error('Missing sections');
      }
    }
    const median = values => [...values].sort((a,b)=>a-b)[3];
    rows.push({ headings, fallback, bytes: Buffer.byteLength(source), medianBeforeMs: median(samples.before), medianAfterMs: median(samples.after), samples });
  }
}
console.log(JSON.stringify({ node: process.version, platform: process.platform, cpu: os.cpus()[0].model, trials: 7, method: 'Alternating serial trials after one untimed output-parity check; GC outside timed interval; full Markdown section parse', rows }, null, 2));
