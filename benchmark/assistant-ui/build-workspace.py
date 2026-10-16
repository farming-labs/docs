"""Build the docs workspace closure from the same snapshotted sources."""
import json,os,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];ART=ROOT/'benchmark/assistant-ui/artifacts';SNAP=ART/'snapshot'
DEPS=Path(json.loads((ART/'snapshot.json').read_text())['dependencies']);node=os.environ.get('BENCH_NODE','/Users/mac/.nvm/versions/node/v24.21.0/bin/node')
pkg={json.loads(p.read_text())['name']:(p.parent,json.loads(p.read_text())) for p in (SNAP/'packages').glob('*/package.json')}
# Replace only dependency links in the owned snapshot, never files in the dependency checkout.
for name,(path,manifest) in pkg.items():
 for dep in {**manifest.get('dependencies',{}),**manifest.get('devDependencies',{}),**manifest.get('peerDependencies',{})}:
  link=path/'node_modules'/dep
  if dep in pkg:
   target=pkg[dep][0]
   if link.is_symlink():link.unlink()
  else:
   if link.exists():continue
   choices=[SNAP/'apps/docs/node_modules'/dep,DEPS/'packages'/path.name/'node_modules'/dep,DEPS/'node_modules/.pnpm/node_modules'/dep]
   target=next((p.resolve() for p in choices if p.exists()),None)
   if target is None:continue
  link.parent.mkdir(parents=True,exist_ok=True)
  if not link.exists():link.symlink_to(target,target_is_directory=True)
plugin=SNAP/'node_modules/babel-plugin-react-compiler'
if not plugin.exists():plugin.symlink_to((SNAP/'packages/x-buildutils/node_modules/babel-plugin-react-compiler').resolve(),target_is_directory=True)
order=[];seen=set()
def visit(name):
 if name in seen or name not in pkg:return
 seen.add(name);path,p=pkg[name]
 for dep in {**p.get('dependencies',{}),**p.get('peerDependencies',{})}:visit(dep)
 if 'build' in p.get('scripts',{}):order.append((name,path))
for name in json.loads((SNAP/'apps/docs/package.json').read_text())['dependencies']:visit(name)
for _,path in order:
 if (path/'dist').is_symlink():(path/'dist').unlink()
logs=ART/os.environ.get('WORKSPACE_BUILD_RUN_ID','workspace-builds');logs.mkdir(exist_ok=False)
for name,path in order:
 print('BUILD',name,flush=True)
 with (logs/(path.name+'.log')).open('w') as log:
  if name=='@assistant-ui/react-devtools':subprocess.run([node,'scripts/build-styles.mjs'],cwd=path,stdout=log,stderr=subprocess.STDOUT,check=True)
  subprocess.run([node,str(SNAP/'packages/x-buildutils/bin/aui-build.js')],cwd=path,stdout=log,stderr=subprocess.STDOUT,check=True,env={**os.environ,'NODE_OPTIONS':'--max-heap-size=4096'})
print('Built',len(order),'workspace packages from the snapshot',flush=True)
