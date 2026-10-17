import importlib.util, json, subprocess, shutil, os, re, hashlib, platform
from pathlib import Path

repo = Path(__file__).resolve().parents[4]
spec = importlib.util.spec_from_file_location('bench', repo/'benchmark/next-docs/run.py')
bench = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bench)
node = os.environ.get('BENCH_NODE', shutil.which('node'))
assert bench.run_command([node,'--version']) == 'v24.21.0'
original_ref = bench.run_command(['git','symbolic-ref','--short','HEAD'])
out = repo/'benchmark/next-docs/artifacts'/os.environ.get('BENCH_RUN_ID','compact-schema-repeat')
out.mkdir(exist_ok=False)
refs = {'before':'70bf160db02ba2ed9bb46de3c830bd0222382f04','after':'89cd4bc4'}
refs = {key:bench.run_command(['git','rev-parse',value]) for key,value in refs.items()}
assert not bench.run_command(['git','status','--porcelain'])
data = {'revisions':refs,'node':bench.run_command([node,'--version']),'platform':platform.platform(),'workers':2,'fixedContentMtime':1767225600,'results':[]}
def save(): (out/'results.json').write_text(json.dumps(data,indent=2)+'\n')
try:
 for trial, order in enumerate([['before','after','fumadocs'],['after','fumadocs','before'],['fumadocs','before','after']],1):
  for label in order:
   provider = 'fumadocs' if label=='fumadocs' else 'farming'
   if label in refs:
    subprocess.run(['git','switch','--detach',refs[label]],cwd=repo,check=True,stdout=subprocess.DEVNULL)
    with (out/f'{trial}-{label}-packages.log').open('w') as log:
     for package in ['docs','theme','next']:
      subprocess.run(['pnpm','--filter',f'@farming-labs/{package}','build'],cwd=repo,check=True,stdout=log,stderr=subprocess.STDOUT)
   for count in [100,500]:
    app=out/'apps'/f'{label}-{count}'
    if app.exists(): shutil.rmtree(app)
    fixture=json.loads(bench.run_command([node,str(repo/'benchmark/next-docs/prepare.mjs'),provider,str(count),str(app)]))
    for source in app.rglob('*.mdx'):
     os.utime(source,(1767225600,1767225600))
    for mode in (['cold','warm','edit'] if count==100 else ['cold']):
     if shutil.disk_usage(out).free < 1024**3: raise RuntimeError('Less than 1 GiB free; stopping before build')
     if mode=='edit':
      page=app/('app/docs/page.mdx' if provider=='farming' else 'content/docs/index.mdx')
      page.write_text(page.read_text()+'\nBENCHMARK_EDIT_MARKER: one paragraph changed.\n')
      os.utime(page,(1767225660,1767225660))
     print(f'START {trial} {label} {count} {mode}',flush=True)
     log=out/f'{trial}-{label}-{count}-{mode}.log'
     metrics=bench.build(app,node,log)
     row={**fixture,'variant':label,'trial':trial,'mode':mode,**metrics,**bench.outputs(app,count,mode=='edit'),'log':log.name,'freeDiskBytesAfter':shutil.disk_usage(out).free}
     if mode=='cold':
      schemas={}
      for page in (app/'.next/server/app').rglob('*.html'):
       if page.name=='docs.html' or 'docs' in page.relative_to(app/'.next/server/app').parts:
        values=[json.loads(x) for x in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',page.read_text())]
        if provider=='farming': assert len(values)==1,(page,len(values))
        schemas[str(page.relative_to(app/'.next/server/app'))]=values
      schema_file=out/f'{trial}-{label}-{count}-schemas.json'
      schema_file.write_text(json.dumps(schemas,sort_keys=True,indent=2)+'\n')
      row['schemaHash']=hashlib.sha256(json.dumps(schemas,sort_keys=True).encode()).hexdigest()
     data['results'].append(row);save()
     print(f'DONE {trial} {label} {count} {mode}: {metrics["wallSeconds"]:.2f}s {metrics["phasesSeconds"]}',flush=True)
finally:
 save()
 subprocess.run(['git','switch',original_ref],cwd=repo,check=True)
