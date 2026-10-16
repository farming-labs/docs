"""Summarize completed trials and retain compact, source-free result receipts."""
import hashlib,json,re,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parent;ART=ROOT/'artifacts'
batch=json.loads((ART/'local-webpack-2026-10-16.json').read_text())
assert len(batch['trials'])==6 and all(x['status']=='success' for x in batch['trials'])
metrics={}
for provider in ['fumadocs','farming']:
 rows=[x for x in batch['trials'] if x['provider']==provider]
 times=[x['seconds'] for x in rows];phases={key:[] for key in ['config','webpack','typescript','prerender']}
 patterns={'config':r'next.config.ts took ([\d.]+)(ms|s)','webpack':r'Compiled successfully in ([\d.]+)(ms|s)','typescript':r'Finished TypeScript in ([\d.]+)(ms|s)','prerender':r'✓ Generating static pages.* in ([\d.]+)(ms|s)'}
 for row in rows:
  log=(ART/row['log']).read_text()
  for key,pattern in patterns.items():
   m=re.search(pattern,log);assert m,(row['run'],key)
   phases[key].append(float(m[1])/(1000 if m[2]=='ms' else 1))
 metrics[provider]={'samplesSeconds':times,'medianSeconds':statistics.median(times),'minSeconds':min(times),'maxSeconds':max(times),'phaseMediansSeconds':{k:statistics.median(v) for k,v in phases.items()}}
validation={}
vr=ART/'verification-final-3'
for provider in metrics:
 row=json.loads((vr/f'{provider}.json').read_text())
 validation[provider]={k:row[k] for k in ['checks','failures','pageErrors','docsRoutes','searchRecords','initialJsGzipBytes']}
 validation[provider]['docsRoutes']=len(validation[provider]['docsRoutes'])
 validation[provider]['httpErrorCount']=len(row['httpErrors'])
search=[]
for provider in metrics:
 values=json.loads((vr/f'{provider}-search.json').read_text());values.sort(key=lambda x:x['url']);search.append(values)
assert search[0]==search[1]
markdown=[(vr/f'{p}-installation.md').read_bytes() for p in metrics]
assert markdown[0]==markdown[1]
html=json.loads((ART/'html-comparison.json').read_text());assert html['identicalRoutes']==337
inputs=json.loads((ART/'fixture-inputs.json').read_text());changed=[]
for app,info in inputs['apps'].items():
 for relative,digest in info['files'].items():
  path=ART/'snapshot/apps'/app/relative
  if hashlib.sha256(path.read_bytes()).hexdigest()!=digest:changed.append(f'{app}/{relative}')
assert not changed,changed
result={'method':batch['scope'],'defaultDeploymentBenchmark':False,'machine':'Apple M1, arm64, 16 GiB RAM, shared local machine','node':batch['node'],'frameworkHead':inputs['frameworkHead'],'assistantUiSourceHead':inputs['sourceHead'],'assistantUiSourceDirty':inputs['sourceDirty'],'installedVersions':inputs['apps']['docs']['versions'],'excludedRouteModules':inputs['excludedRouteModules'],'inputFilesUnchanged':True,'build':metrics,'farmingBuildDeltaPercent':(metrics['farming']['medianSeconds']/metrics['fumadocs']['medianSeconds']-1)*100,'output':json.loads((ART/'output-sizes.json').read_text()),'validation':validation,'all337PagesMatch':True,'all502SearchRecordsMatch':True,'installationMarkdownMatches':True,'traces':json.loads((ART/'module-comparison.json').read_text()),'rawTrials':batch['trials']}
out=ROOT/'results/2026-10-16';out.mkdir(parents=True,exist_ok=True)
(out/'measurements.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'build':metrics,'farmingBuildDeltaPercent':result['farmingBuildDeltaPercent'],'inputsUnchanged':True},indent=2))
