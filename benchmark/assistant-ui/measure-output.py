"""Deterministic output sizes. These are artifacts, not build-time claims."""
import gzip,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
result={}
for provider,dirname in [('fumadocs','docs'),('farming','docs-farming')]:
 app=ROOT/'artifacts/snapshot/apps'/dirname
 build=app/'.next'
 if not (build/'BUILD_ID').exists():raise SystemExit(f'{provider}: successful production build required')
 manifest=json.loads((build/'prerender-manifest.json').read_text())
 routes=sorted(r for r in manifest['routes'] if r=='/docs' or r.startswith('/docs/'))
 row={'docsRoutes':len(routes),'htmlBytes':0,'htmlGzipBytes':0,'rscBytes':0,'rscGzipBytes':0}
 for route in routes:
  for suffix,prefix in [('html','html'),('rsc','rsc')]:
   path=build/'server/app'/f'{route.lstrip("/")}.{suffix}'
   data=path.read_bytes()
   row[prefix+'Bytes']+=len(data);row[prefix+'GzipBytes']+=len(gzip.compress(data,mtime=0))
 result[provider]=row
out=ROOT/'artifacts/output-sizes.json'
if out.exists():raise SystemExit('Archive the previous output measurement before overwriting')
out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
