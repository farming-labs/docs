import { pathToFileURL } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { deepStrictEqual } from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
const [beforeDir, afterDir, corpus] = process.argv.slice(2);
const before = await import(pathToFileURL(join(beforeDir, 'search.mjs')));
const after = await import(pathToFileURL(join(afterDir, 'search.mjs')));
const files = readdirSync(corpus, { recursive: true }).filter(f=>/\.mdx?$/.test(f)).sort();
const rows=[];
for (const count of [100, files.length]) {
  const pages = files.slice(0,count).map((f,i)=>{
    const rawContent = readFileSync(join(corpus,f),'utf8');
    return {title:f, url:`/docs/page-${i}`, content:rawContent, rawContent};
  });
  for (const audience of ['human','agent']) {
    const run = lib=>lib.performDocsSearch({pages, audience, query:'configure',search:{provider:'simple'},limit:10});
    deepStrictEqual(await run(after),await run(before));
    const samples={before:[],after:[]};
    for(let trial=0;trial<7;trial++) {
      for(const key of trial%2?['after','before']:['before','after']) {
        global.gc?.();
        const start=performance.now();
        await run(key==='before'?before:after);
        samples[key].push(performance.now()-start);
      }
    }
    const median=v=>[...v].sort((a,b)=>a-b)[3];
    rows.push({pages:pages.length,audience,sourceCharacters:pages.reduce((n,p)=>n+p.rawContent.length,0),medianBeforeMs:median(samples.before),medianAfterMs:median(samples.after),samples});
  }
}
console.log(JSON.stringify({node:process.version,cpu:os.cpus()[0].model,trials:7,method:'Full simple-search call over sorted assistant-ui source files with identical synthetic page URLs and path titles; configure query; alternating serial warmed trials; GC outside timed interval; outputs compared before timing',rows},null,2));
