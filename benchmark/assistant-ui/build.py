"""Bounded serial build; failed/cancelled runs are not benchmark successes."""
import argparse,json,os,signal,shutil,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('provider',choices=['fumadocs','farming']);p.add_argument('--id',required=True);p.add_argument('--bundler',choices=['webpack','turbopack'],default='webpack');p.add_argument('--no-webpack-cache',action='store_true');p.add_argument('--cold',action='store_true');p.add_argument('--node',default='/Users/mac/.nvm/versions/node/v24.21.0/bin/node');a=p.parse_args()
app=ROOT/'artifacts/snapshot/apps'/('docs' if a.provider=='fumadocs' else 'docs-farming')
logfile=ROOT/'artifacts'/f'{a.id}.log';receipt=ROOT/'artifacts'/f'{a.id}.json'
if logfile.exists() or receipt.exists():raise SystemExit('Use a new run id')
env={**os.environ,'CI':'1','NODE_ENV':'production','NEXT_TELEMETRY_DISABLED':'1','NODE_OPTIONS':'--max-heap-size=4096'};env.pop('_FUMADOCS_MDX',None)
if a.cold:
 output=app/'.next'
 if output.is_symlink():raise SystemExit('Refusing to remove a symlinked build directory')
 if output.exists():shutil.rmtree(output)
def terminate():
 if process.poll() is not None:return
 os.killpg(process.pid,signal.SIGTERM)
 try:process.wait(timeout=10)
 except subprocess.TimeoutExpired:
  os.killpg(process.pid,signal.SIGKILL);process.wait()
env.pop('BENCHMARK_DISABLE_WEBPACK_CACHE',None)
if a.no_webpack_cache:env['BENCHMARK_DISABLE_WEBPACK_CACHE']='1'
start=time.perf_counter();reason=None
with logfile.open('w') as log:
 process=subprocess.Popen([a.node,str(app/'node_modules/next/dist/bin/next'),'build','--'+a.bundler],cwd=app,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
 try:
  while process.poll() is None:
   if shutil.disk_usage(app).free < 2*1024**3: reason='disk-free-below-2GiB'
   if time.perf_counter()-start>900:reason='15-minute-setup-timeout'
   if reason:
    terminate();break
   time.sleep(1)
 except BaseException:
  if process.poll() is None:
   os.killpg(process.pid,signal.SIGTERM)
   try:process.wait(timeout=10)
   except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait()
  raise
row={'provider':a.provider,'bundler':a.bundler,'cold':a.cold,'webpackCache':not a.no_webpack_cache,'seconds':time.perf_counter()-start,'returncode':process.returncode,'cancelled':reason,'log':logfile.name,'nodeOptions':env['NODE_OPTIONS'],'status':'success' if process.returncode==0 else 'failed','timingClaim':False}
receipt.write_text(json.dumps(row,indent=2)+'\n')
trace=app/'.next/trace'
if trace.exists():shutil.copy2(trace,ROOT/'artifacts'/f'{a.id}-trace.jsonl')
print(json.dumps(row))
raise SystemExit(0 if process.returncode==0 else 1)
