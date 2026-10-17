import hashlib,json,statistics,sys
from pathlib import Path
root=Path(sys.argv[1]); paths=list(root.rglob('results.json'));assert len(paths)==1,paths
p=paths[0];d=json.loads(p.read_text());assert not d['failures'];assert len(d['results'])==27
summary={'run':'https://github.com/farming-labs/docs/actions/runs/39002234194','baselineMain':'0d66fc164b3cd2efeaa7edb9dbc082fe958339fb','candidates':['423e2750', '130c1dfc2c73e30aad61a0db136c2d395c91b666'],'method':d['method'],'harness':d['commit'],'node':d['node'],'platform':d['platform'],'rows':[], 'comparisons':{}, 'visualReceipts':{}}
for variant in ['farming-before','farming-after','fumadocs']:
 for mode in ['cold','warm','edit']:
  rows=[r for r in d['results'] if r['variant']==variant and r['mode']==mode];assert len(rows)==3
  assert all(r['docsPages']==100 and r['runtime']['verifiedPages']==100 for r in rows)
  metrics={}
  for key in ['wallSeconds','peakTreeRssMiB','initialJsGzipBytes','initialCssGzipBytes','serverBytes','staticBytes','htmlBytes','totalDocsHtmlBytes','nextCacheBytes']:
   values=[r[key] for r in rows];metrics[key]={'median':statistics.median(values),'min':min(values),'max':max(values),'samples':values}
  metrics['browserJsGzipBytes']={'samples':[r['runtime']['initialJsGzipBytes'] for r in rows], 'median':statistics.median(r['runtime']['initialJsGzipBytes'] for r in rows)}
  metrics['phasesSeconds']={key:statistics.median(r['phasesSeconds'][key] for r in rows) for key in rows[0]['phasesSeconds']}
  summary['rows'].append({'variant':variant,'mode':mode,'routeModules':rows[0]['routeModules'],'apiRoutes':rows[0]['apiRoutes'],'metrics':metrics})
for mode in ['cold','warm','edit']:
 m={r['variant']:r['metrics']['wallSeconds']['median'] for r in summary['rows'] if r['mode']==mode}
 summary['comparisons'][mode]={'afterVsBeforePercent':(m['farming-after']/m['farming-before']-1)*100,'afterVsFumadocsPercent':(m['farming-after']/m['fumadocs']-1)*100}
css={tuple(r['cssDigests']) for r in d['results'] if r['variant'].startswith('farming-')}
summary['farmingCssIdenticalAcrossAllBuilds']=len(css)==1
for f in sorted(p.parent.glob('*.png')):summary['visualReceipts'][f.name]=hashlib.sha256(f.read_bytes()).hexdigest()
(p.parent/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for r in summary['rows']:
 m=r['metrics'];print(r['variant'],r['mode'],m['wallSeconds'],'browser gzip',m['browserJsGzipBytes']['median'],'rss',m['peakTreeRssMiB']['median'],'phases',m['phasesSeconds'])
print(json.dumps(summary['comparisons'],indent=2));print('CSS identical:',summary['farmingCssIdenticalAcrossAllBuilds'])
