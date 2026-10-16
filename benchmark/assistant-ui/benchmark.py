"""Serial repeated cold builds under the explicitly cache-disabled fixture mode."""
import argparse,hashlib,json,os,shutil,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parent
p=argparse.ArgumentParser();p.add_argument('--id',required=True);p.add_argument('--pairs',type=int,default=3);p.add_argument('--node',default='/Users/mac/.nvm/versions/node/v24.21.0/bin/node');a=p.parse_args()
if a.pairs<2:raise SystemExit('At least two pairs are required')
out=ROOT/'artifacts'/f'{a.id}.json'
if out.exists():raise SystemExit('Choose a new benchmark id')
def resources():
 return {'freeDiskBytes':shutil.disk_usage(ROOT).free,'swap':subprocess.check_output(['sysctl','-n','vm.swapusage'],text=True).strip()}
files={}
for app in ['docs','docs-farming']:
 for relative in ['next.config.ts','tsconfig.json','mdx-components.tsx']:
  f=ROOT/'artifacts/snapshot/apps'/app/relative
  files[f'{app}/{relative}']=hashlib.sha256(f.read_bytes()).hexdigest()
result={'scope':'337-page assistant-ui custom-shell docs fixture, cold .next, Webpack filesystem cache disabled on both sides','defaultDeploymentBenchmark':False,'node':subprocess.check_output([a.node,'--version'],text=True).strip(),'inputHashes':files,'trials':[],'order':[]}
for pair in range(a.pairs):
 # Alternate which provider starts each pair to reduce simple order bias.
 order=['fumadocs','farming'] if pair%2==0 else ['farming','fumadocs']
 for provider in order:
  run=f'{a.id}-{len(result["trials"])+1}-{provider}'
  before=resources()
  print(json.dumps({'starting':run,'resources':before}),flush=True)
  done=subprocess.run(['python3',str(ROOT/'build.py'),provider,'--id',run,'--cold','--no-webpack-cache','--node',a.node],check=False)
  receipt=ROOT/'artifacts'/f'{run}.json'
  row=json.loads(receipt.read_text()) if receipt.exists() else {'status':'failed','reason':'build runner did not produce a receipt'}
  row.update({'run':run,'resourcesBefore':before,'resourcesAfter':resources()})
  result['trials'].append(row);result['order'].append(provider)
  out.write_text(json.dumps(result,indent=2)+'\n')
  if done.returncode:raise SystemExit('Stopped on failed trial; no successful comparison claim')
print(json.dumps({'completed':str(out),'trials':len(result['trials'])}),flush=True)
