"""Snapshot current local docs sources into disposable benchmark fixtures."""
import hashlib,json,os,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path(os.environ.get('ASSISTANT_UI_SOURCE','/Users/mac/oss/assistant-ui')).resolve()
DEPS=Path(os.environ.get('ASSISTANT_UI_DEPS',str(SOURCE/'.worktrees/runtime-bug-scan'))).resolve()
OUT=ROOT/'benchmark/assistant-ui/artifacts/snapshot'
if OUT.exists(): raise SystemExit(f'Refusing to overwrite {OUT}')
files=subprocess.check_output(['git','ls-files','-z'],cwd=SOURCE).decode().split('\0')
records=[]
for name in files:
 p=SOURCE/name
 if not p.is_file() or not (name.startswith(('apps/docs/','packages/','.github/assets/')) or '/' not in name): continue
 if name.startswith('.env') or '/.env' in name: continue
 dest=OUT/name; dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
 records.append({'path':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
# Dependencies are read-only views. Local workspace links point into the snapshot.
for src in [DEPS/'node_modules',DEPS/'apps/docs/node_modules',*sorted((DEPS/'packages').glob('*/node_modules'))]:
 if not src.exists(): continue
 dst=OUT/src.relative_to(DEPS);dst.mkdir(parents=True,exist_ok=True)
 for item in src.iterdir():
  if item.name in ('.bin','.pnpm'): continue
  entries=list(item.iterdir()) if item.name.startswith('@') else [item]
  for dep in entries:
   target=dep.resolve()
   try:
    rel=target.relative_to(DEPS)
    if not str(rel).startswith('node_modules/') and (OUT/rel).exists(): target=OUT/rel
   except ValueError: pass
   if not target.exists(): continue
   link=dst/dep.relative_to(src);link.parent.mkdir(parents=True,exist_ok=True)
   if not link.exists(): link.symlink_to(target,target_is_directory=True)
# Build utility config exports reference its built output.
for src in (DEPS/'packages').glob('*/dist'):
 dst=OUT/src.relative_to(DEPS)
 if not dst.exists(): dst.symlink_to(src.resolve(),target_is_directory=True)
app=OUT/'apps/docs'
# This experiment builds /docs and its search endpoint; original modules stay importable.
keep={'app/layout.tsx','app/provider.tsx','app/(docs)/docs/layout.tsx','app/(docs)/docs/[[...slug]]/page.tsx','app/api/search/route.ts','app/api/auth/session/route.ts','app/api/demo/usage/route.ts'}
keep.update({'app/(home)/llms.mdx/[[...slug]]/route.ts','app/(home)/platform-llms.mdx/[platform]/[flavor]/[[...slug]]/route.ts'})
removed=[]
for p in (app/'app').rglob('*'):
 if not p.is_file(): continue
 rel=p.relative_to(app).as_posix()
 if p.stem in {'page','layout','route','not-found','error','global-error','loading','template','default','sitemap','robots','manifest','opengraph-image','twitter-image','icon','apple-icon'} and rel not in keep:
  p.unlink();removed.append(rel)
# Config is retained except for deterministic workspace rooting and tracing.
p=app/'next.config.ts';s=p.read_text();s=s.replace('const config: NextConfig = {','const config: NextConfig = {\n  turbopack: { root: '+json.dumps(os.path.commonpath([ROOT,SOURCE,DEPS]))+ ' },');p.write_text(s)
p=app/'styles/globals.css'
s=p.read_text().replace('@import \"tailwindcss\";', '@import \"tailwindcss\" source(none);\n'+''.join('@source \"../'+d+'\";\n' for d in ['app','components','lib','hooks','runtimes','content','mdx-components.tsx']))
p.write_text(s)
report={'sourceHead':subprocess.check_output(['git','rev-parse','HEAD'],cwd=SOURCE,text=True).strip(),'sourceDirty':bool(subprocess.check_output(['git','status','--porcelain'],cwd=SOURCE)),'files':records,'excludedRoutes':removed,'source':str(SOURCE),'dependencies':str(DEPS),'scope':'Original /docs UI and content, docs search. Other site routes excluded equally.'}
(OUT.parent/'snapshot.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'snapshot':str(OUT),'files':len(records),'excludedRouteModules':len(removed)}))
