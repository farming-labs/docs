import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
const args = process.argv.slice(2);
if (args[0] === '--worker') {
  const [, dir, corpus] = args;
  const { performDocsSearch } = await import(pathToFileURL(join(dir, 'search.mjs')));
  const files = readdirSync(corpus, { recursive: true }).filter(f=>/\.mdx?$/.test(f)).sort();
  const pages = files.map((f,i)=>{
    const rawContent=readFileSync(join(corpus,f),'utf8');
    return {title:f,url:`/docs/page-${i}`,content:rawContent,rawContent};
  });
  global.gc();
  const start = performance.now();
  const result = await performDocsSearch({pages,audience:'human',query:'configure',search:{provider:'simple'},limit:10});
  const ms = performance.now()-start;
  global.gc();
  console.log(JSON.stringify({pages:pages.length,ms,heapUsedBytes:process.memoryUsage().heapUsed,hash:createHash('sha256').update(JSON.stringify(result)).digest('hex')}));
} else {
  const [before,after,corpus] = args;
  const samples={before:[],after:[]};
  for(let trial=0;trial<3;trial++) {
    for(const variant of trial%2?['after','before']:['before','after']) {
      const run = spawnSync(process.execPath,['--expose-gc',fileURLToPath(import.meta.url),'--worker',variant==='before'?before:after,corpus],{encoding:'utf8'});
      if(run.status !== 0) throw new Error(run.stderr);
      samples[variant].push(JSON.parse(run.stdout));
    }
  }
  if(new Set(Object.values(samples).flat().map(v=>v.hash)).size!==1) throw new Error('Output mismatch');
  console.log(JSON.stringify({node:process.version,cpu:os.cpus()[0].model,trials:3,method:'First simple-search call in a fresh Node process over all assistant-ui Markdown/MDX files; imports/source reads outside timer; alternating order; retained heap after forced GC; output hashes equal',samples},null,2));
}
