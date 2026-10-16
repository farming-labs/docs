#!/usr/bin/env python3
"""Aggregate measured runs; never infer missing samples or stages."""
import argparse, collections, json, statistics
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--out', type=Path)
    args = parser.parse_args()
    raw = json.loads(args.input.read_text())
    groups = collections.defaultdict(list)
    for row in raw['results']:
        groups[(row['pages'], row['provider'], row['mode'])].append(row)
    metrics = ['wallSeconds', 'peakTreeRssMiB', 'htmlBytes', 'htmlGzipBytes', 'totalDocsHtmlBytes', 'initialJsBytes', 'initialJsGzipBytes', 'initialCssBytes', 'initialCssGzipBytes', 'staticBytes', 'serverBytes', 'nextCacheBytes']
    aggregates = []
    for (pages, provider, mode), rows in sorted(groups.items()):
        values = {}
        for metric in metrics:
            samples = [row[metric] for row in rows]
            values[metric] = {'median': statistics.median(samples), 'min': min(samples), 'max': max(samples)}
        phases = {}
        for name in sorted(set().union(*(row['phasesSeconds'].keys() for row in rows))):
            samples = [row['phasesSeconds'][name] for row in rows if name in row['phasesSeconds']]
            phases[name] = {'median': statistics.median(samples), 'samples': len(samples)}
        aggregates.append({'pages': pages, 'provider': provider, 'mode': mode, 'trials': len(rows), 'metrics': values, 'phasesSeconds': phases, 'routeModules': rows[0]['routeModules'], 'apiRoutes': rows[0]['apiRoutes']})
    summary = {key: value for key, value in raw.items() if key != 'results'}
    summary['aggregates'] = aggregates
    lines = ['| Pages | Provider | Build | Trials | Median seconds | Range | Peak tree RSS (MiB) |', '| ---: | --- | --- | ---: | ---: | --- | ---: |']
    for row in aggregates:
        wall = row['metrics']['wallSeconds']
        rss = row['metrics']['peakTreeRssMiB']['median']
        lines.append(f'| {row["pages"]} | {row["provider"]} | {row["mode"]} | {row["trials"]} | {wall["median"]:.2f} | {wall["min"]:.2f}–{wall["max"]:.2f} | {rss:.0f} |')
    print('\n'.join(lines))
    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)
        (args.out / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
        (args.out / 'timings.md').write_text('\n'.join(lines) + '\n')
        # Keep all measurements, including outliers, rather than only medians.
        (args.out / 'raw-results.json').write_text(json.dumps(raw, indent=2) + '\n')

if __name__ == '__main__':
    main()
