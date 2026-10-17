#!/usr/bin/env python3
"""Summarize alternating cache-disabled/enabled production builds on one runner."""
import argparse, json, re, statistics
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('root', type=Path)
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
groups = {}
failures = []
commits = set()
farm_commits = set()
samples = []
for file in sorted(args.root.glob('ci-*-cache*-trial*/results.json')):
    match = re.search(r'-cache([01])-trial(\d+)$', file.parent.name)
    if not match: continue
    enabled, trial = bool(int(match[1])), int(match[2])
    data = json.loads(file.read_text())
    commits.add(data['docsCommit'])
    farm_commits.add(data['farmCommit'])
    failures.extend(data['failures'])
    for result in data['results']:
        assert result['mdxCacheEnabled'] == enabled
        if enabled: assert result['mdxCacheEntries'] == result['pages'], result
        groups.setdefault((result['provider'], result['mode'], enabled), []).append(result)
        samples.append({**result, 'comparisonTrial': trial})
assert len(commits) == len(farm_commits) == 1, (commits, farm_commits)
assert not failures, failures
rows = []
for provider in ('farmjs', 'farmjs-vercel'):
    for mode in ('cold', 'warm', 'edit'):
        pair = {}
        for enabled in (False, True):
            selected = groups[(provider, mode, enabled)]
            times = [r['wallSeconds'] for r in selected]
            pair['enabled' if enabled else 'disabled'] = {
                'trials': len(selected), 'medianSeconds': statistics.median(times),
                'minSeconds': min(times), 'maxSeconds': max(times),
                'medianPeakTreeRssMiB': statistics.median(r['peakTreeRssMiB'] for r in selected),
                'medianBrowserJsGzipBytes': statistics.median(r['runtime']['initialJsGzipBytes'] for r in selected),
                'cacheEntries': sorted(set(r['mdxCacheEntries'] for r in selected)),
                'cacheBytes': sorted(set(r['mdxCacheBytes'] for r in selected)),
                'verifiedPagesPerRun': sorted(set(r['runtime']['verifiedPages'] for r in selected)),
            }
        reduction = (1-pair['enabled']['medianSeconds']/pair['disabled']['medianSeconds'])*100
        rows.append({'provider': provider, 'mode': mode, **pair, 'reductionPercent': reduction})
        print(f"{provider:15} {mode:5} {pair['disabled']['medianSeconds']:.3f}s -> {pair['enabled']['medianSeconds']:.3f}s ({reduction:.1f}% reduction)")
summary = {'docsCommit': next(iter(commits)), 'farmCommit': next(iter(farm_commits)), 'rows': rows, 'samples': samples, 'failures': failures}
args.out.parent.mkdir(parents=True, exist_ok=True)
args.out.write_text(json.dumps(summary, indent=2)+'\n')
