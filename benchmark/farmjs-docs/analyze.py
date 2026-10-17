#!/usr/bin/env python3
"""Summarize successful, runtime-verified rows; retain failures separately."""
import argparse, json, statistics
from pathlib import Path

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('results',type=Path)
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args()
data=json.loads(args.results.read_text())
rows=[]
for provider in data['arguments']['providers']:
    for mode in data['arguments']['modes']:
        selected=[x for x in data['results'] if x['provider']==provider and x['mode']==mode]
        if not selected:continue
        wall=[x['wallSeconds'] for x in selected]
        baseline=[x['wallSeconds'] for x in data['results'] if x['provider']=='fumadocs' and x['mode']==mode]
        rows.append({
            'provider':provider,'mode':mode,'trials':len(selected),
            'medianSeconds':statistics.median(wall),'minSeconds':min(wall),'maxSeconds':max(wall),
            'differenceFromFumadocsPercent':(statistics.median(wall)/statistics.median(baseline)-1)*100 if baseline else None,
            'medianPeakTreeRssMiB':statistics.median(x['peakTreeRssMiB'] for x in selected),
            'medianFirstPageMs':statistics.median(x['runtime']['firstPageMs'] for x in selected),
            'medianBrowserJsGzipBytes':statistics.median(x['runtime']['initialJsGzipBytes'] for x in selected),
            'prerenderedDocsPages':sorted(set(x['prerenderedDocsPages'] for x in selected)),
            'verifiedPagesPerRun':sorted(set(x['runtime']['verifiedPages'] for x in selected)),
        })
summary={
    'docsCommit':data['docsCommit'],'farmCommit':data['farmCommit'],
    'node':data['node'],'pages':data['arguments']['pages'],'rows':rows,'failures':data['failures'],
    'method':[
        'One runner, serial production builds, provider order rotated per trial.',
        'Cold means fresh generated app/output/cache; OS and CLI default compilation caches are not reset.',
        'Unchanged and one-MDX-paragraph-edit builds follow each cold build.',
        'Install and framework package compilation excluded; application TypeScript checking included.',
        'Every accepted row passed production content, code, table, clipboard, navigation, search and mobile checks.',
        'Farm defaults to request-time HTML rendering. Next fixtures prerender all pages. Static Farm control is reported separately.',
        'Vercel provider builds real Vercel output and executes its Node handler locally; no Vercel cloud/CDN/region timing is claimed.',
        'First-page duration is a local fresh-server full response after TCP readiness, not browser LCP or Vercel cold-start latency.',
        'Sampled process-tree RSS can double-count shared memory.',
    ],
}
args.out.parent.mkdir(parents=True,exist_ok=True)
args.out.write_text(json.dumps(summary,indent=2)+'\n')
for row in rows:
    print(f"{row['provider']:15} {row['mode']:5} {row['medianSeconds']:7.3f}s [{row['minSeconds']:.3f}, {row['maxSeconds']:.3f}] n={row['trials']} prerendered={row['prerenderedDocsPages']}")
if summary['failures']:print('Failures:',json.dumps(summary['failures']))
