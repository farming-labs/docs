#!/usr/bin/env python3
"""Measure the highlighted-code cache in Farming Labs Next production builds.

Two identical farming fixtures from prepare.mjs. `base` removes `cacheDir` from the code highlighter
options, which runs the plugin without the cache. `cand` keeps the default. Each round runs, in a
rotating order:

  base-cold, base-cold-aa  remove .next and build; the A/A pair measures noise
  cand-cold                remove .next and build with an empty highlight cache
  cand-kept                remove .next but restore a primed highlight cache (Turbopack cache lost)

then edits one paragraph of the first page and rebuilds the warm apps, again in a rotating order:

  base-edit, base-edit-aa, cand-edit

The real MDX loader is wrapped by mdx-timing-loader.cjs to record MDX CPU time per build. Every build
is validated with run.py, and every docs page's highlighted `<pre>` markup must match between
variants in the same round. The first round is a warmup and is not counted.
"""
import argparse, hashlib, json, os, re, shutil, time
from pathlib import Path

import mdx_ceiling
import run as harness

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
HIGHLIGHTS = Path('.next/cache/farming-labs/code-highlight')
# Next stops a build it believes a coding agent started, to suggest an upgrade. A timed build must
# run to completion, so the fixtures opt out.
CONFIG = mdx_ceiling.CONFIG.replace('experimental: {cpus: 2}', 'experimental: {cpus: 2, agentUpgrade: false}')
STRIP = """let stripped = 0;
for (const rule of Object.values(config.turbopack?.rules ?? {}))
  for (const entry of Array.isArray(rule) ? rule : [rule])
    for (const loader of entry?.loaders ?? []) {
      const options = loader.options?.innerOptions ?? loader.options;
      for (const plugin of options?.rehypePlugins ?? [])
        if (Array.isArray(plugin) && plugin[0] === '@farming-labs/next/mdx-plugins/rehype-code' && plugin[1]?.cacheDir) {
          delete plugin[1].cacheDir;
          stripped++;
        }
    }
if (stripped !== 1) throw new Error(`Expected one cacheDir to remove, found ${stripped}.`);
export default config;
"""
COLD = ['base-cold', 'base-cold-aa', 'cand-cold', 'cand-kept']
EDIT = ['base-edit', 'base-edit-aa', 'cand-edit']


def pre_hashes(app):
    hashes = {}
    pages = app / '.next/server/app'
    for page in [pages / 'docs.html', *sorted((pages / 'docs').rglob('*.html'))]:
        blocks = re.findall(r'<pre\b.*?</pre>', page.read_text(), flags=re.S)
        hashes[str(page.relative_to(app))] = hashlib.sha256('\n'.join(blocks).encode()).hexdigest()[:16]
    return hashes


def stats(values):
    values = sorted(values)
    return {'median': values[len(values) // 2], 'min': values[0], 'max': values[-1]}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--node', default=shutil.which('node'))
    parser.add_argument('--pages', type=int, default=100)
    parser.add_argument('--rounds', type=int, default=9, help='measured rounds after one warmup round')
    parser.add_argument('--run-id', default=time.strftime('code-highlight-%Y-%m-%dT%H-%M-%S'))
    parser.add_argument('--min-free-gib', type=float, default=3.0,
                        help='stop before a build when the disk has less free space than this')
    args = parser.parse_args()
    if args.rounds < 1 or args.pages < 2:
        parser.error('--rounds must be positive and --pages at least 2.')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', args.run_id):
        parser.error('--run-id must be a simple name, not a path.')
    if not args.node:
        parser.error('Node was not found; pass --node /path/to/node.')
    artifacts = ROOT / 'artifacts' / args.run_id
    if artifacts.exists():
        parser.error('Use a new --run-id; existing measurements are never overwritten.')
    artifacts.mkdir(parents=True)

    results = {'runId': args.run_id, 'commit': harness.run_command(['git', 'rev-parse', 'HEAD']),
               'node': harness.run_command([args.node, '--version']),
               'processor': harness.run_command(['sysctl', '-n', 'machdep.cpu.brand_string'])
               if os.uname().sysname == 'Darwin' else os.uname().machine,
               'logicalCpus': os.cpu_count(), 'arguments': vars(args), 'rows': []}
    destination = artifacts / 'results.json'
    apps, edits = {}, {}
    for variant in ('base', 'cand'):
        app = artifacts / 'apps' / variant
        harness.run_command([args.node, str(ROOT / 'prepare.mjs'), 'farming', str(args.pages), str(app)])
        config = CONFIG % {'root': json.dumps(str(REPO))}
        if variant == 'base':
            config = config.replace('export default config;\n', STRIP)
        (app / 'next.config.mjs').write_text(config)
        apps[variant], edits[variant] = app, 0

    def build(variant, label):
        app = apps[variant]
        free = shutil.disk_usage(ROOT).free / 2**30
        if free < args.min_free_gib:
            raise SystemExit(f'Only {free:.1f} GiB free; stopping before the build. Free space or lower '
                             f'--min-free-gib.')
        # The loader options are part of Turbopack's cache key, so each app keeps one log path.
        log = artifacts / f'mdx-{variant}.jsonl'
        log.write_text('')
        load = os.getloadavg()[0]
        print(f'START {label}', flush=True)
        metrics = mdx_ceiling.timed_build(args.node, app, artifacts / f'{label}-{len(results["rows"]) + 1}.log',
                                          (ROOT / 'mdx-timing-loader.cjs', {'log': str(log)}))
        harness.outputs(app, args.pages, edit=edits[variant] > 0)
        if edits[variant] and f'edit {edits[variant]}.' not in (app / '.next/server/app/docs.html').read_text():
            raise SystemExit(f'{label} did not rebuild the edited page.')
        mdx = [json.loads(line) for line in log.read_text().splitlines()]
        if any(not row['ok'] for row in mdx):
            raise SystemExit(f'An MDX compilation failed in {label}.')
        return {'label': label, 'loadAvg1mAtStart': round(load, 2), 'wallSeconds': round(metrics['wallSeconds'], 3),
                'compileSeconds': metrics['phasesSeconds'].get('compile'),
                'peakTreeRssMiB': round(metrics['peakTreeRssMiB']), 'mdxFiles': len(mdx),
                'mdxCpuMs': round(sum(row['cpuMs'] for row in mdx)),
                'highlightEntries': len(list((app / HIGHLIGHTS).rglob('*.json'))), 'pre': pre_hashes(app)}

    def cold(variant, label, primed=None):
        shutil.rmtree(apps[variant] / '.next', ignore_errors=True)
        if primed:
            shutil.copytree(primed, apps[variant] / HIGHLIGHTS)
        return build(variant, label)

    def edit(variant, label):
        edits[variant] += 1
        page = apps[variant] / 'app/docs/page.mdx'
        text = re.sub(r'\nBENCHMARK_EDIT_MARKER: edit \d+\.\n', '', page.read_text())
        page.write_text(f'{text}\nBENCHMARK_EDIT_MARKER: edit {edits[variant]}.\n')
        return build(variant, label)

    primed = artifacts / 'primed-highlights'
    prime = cold('cand', 'prime')
    shutil.copytree(apps['cand'] / HIGHLIGHTS, primed)
    results['primed'] = {'entries': prime['highlightEntries'],
                         'bytes': sum(file.stat().st_size for file in primed.rglob('*.json'))}
    print(json.dumps(results['primed']), flush=True)

    scenarios = {
        'base-cold': lambda: cold('base', 'base-cold'),
        'base-cold-aa': lambda: cold('base', 'base-cold-aa'),
        'cand-cold': lambda: cold('cand', 'cand-cold'),
        'cand-kept': lambda: cold('cand', 'cand-kept', primed),
        'base-edit': lambda: edit('base', 'base-edit'),
        'base-edit-aa': lambda: edit('base', 'base-edit-aa'),
        'cand-edit': lambda: edit('cand', 'cand-edit'),
    }
    for round_index in range(args.rounds + 1):
        rows = {}
        for names in (COLD, EDIT):
            shift = round_index % len(names)
            order = names[shift:] + names[:shift]
            for name in reversed(order) if round_index % 2 else order:
                rows[name] = scenarios[name]()
        for group in (COLD, EDIT):
            for name in group[1:]:
                if rows[name]['pre'] != rows[group[0]]['pre']:
                    raise SystemExit(f'Highlighted markup of {name} differs from {group[0]} in round {round_index}.')
        for name, row in rows.items():
            row = {key: value for key, value in row.items() if key != 'pre'}
            row['round'] = round_index
            row['warmup'] = round_index == 0
            print(json.dumps(row), flush=True)
            results['rows'].append(row)
        destination.write_text(json.dumps(results, indent=2) + '\n')

    measured = [row for row in results['rows'] if not row['warmup']]
    results['summary'] = {}
    for label in COLD + EDIT:
        rows = [row for row in measured if row['label'] == label]
        results['summary'][label] = {'n': len(rows), **{key: stats([row[key] for row in rows]) for key in
                                                         ('wallSeconds', 'compileSeconds', 'mdxCpuMs', 'mdxFiles')}}
    destination.write_text(json.dumps(results, indent=2) + '\n')
    shutil.rmtree(artifacts / 'apps')
    for label, summary in results['summary'].items():
        wall, compile_, mdx = summary['wallSeconds'], summary['compileSeconds'], summary['mdxCpuMs']
        print(f"{label:<13} n={summary['n']}: wall {wall['median']:.2f}s ({wall['min']:.2f}-{wall['max']:.2f}), "
              f"compile {compile_['median']:.2f}s ({compile_['min']:.2f}-{compile_['max']:.2f}), "
              f"MDX CPU {mdx['median']} ms ({mdx['min']}-{mdx['max']}), {summary['mdxFiles']['median']} files")
    print(f'Results: {destination}', flush=True)


if __name__ == '__main__':
    main()
