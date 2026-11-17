#!/usr/bin/env python3
"""Measure how much of a Farming Labs Next production build is MDX compilation.

timing  Cold builds with the real MDX loader wrapped by a timing shim. Records when
        each page compiled, in which Turbopack worker, and for how long.
replay  One record build stores the real loader's output, then cold builds alternate
        the real loader with a replay of that byte-identical output (no MDX work).
        The difference bounds what any content engine, JavaScript or Rust, could save.

Both modes use the farming fixture from prepare.mjs and validate every build with run.py.
"""
import argparse, hashlib, html, json, os, re, shutil, signal, subprocess, threading, time
from pathlib import Path

import run as harness

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
CONFIG = """import {withDocs} from '@farming-labs/next/config';
const config = withDocs({experimental: {cpus: 2}, turbopack: {root: %(root)s}});
const shim = process.env.MDX_SHIM_LOADER;
if (shim) {
  const shimOptions = JSON.parse(process.env.MDX_SHIM_OPTIONS);
  let patched = 0;
  for (const rule of Object.values(config.turbopack?.rules ?? {})) {
    for (const entry of Array.isArray(rule) ? rule : [rule]) {
      if (!entry?.loaders) continue;
      entry.loaders = entry.loaders.map((loader) => {
        if (typeof loader !== 'object' || !/mdx-js-loader\\.js$/.test(loader.loader)) return loader;
        patched++;
        return {loader: shim, options: {...shimOptions, inner: loader.loader, innerOptions: loader.options}};
      });
    }
  }
  if (patched !== 1) throw new Error(`Expected one MDX loader to wrap, found ${patched}.`);
}
export default config;
"""
MARKS = {
    'configDone': r'Running next\.config\.mjs took',
    'compileDone': r'Compiled successfully in',
    'typecheckDone': r'Finished TypeScript in',
    'pageDataStart': r'Collecting page data',
    'staticStart': r'Generating static pages using \d+ workers \(0/',
    'staticDone': r'✓ Generating static pages using',
    'finalizeStart': r'Finalizing page optimization',
}


def timed_build(node, app, log_path, shim=None):
    """Run `next build`, stamping each output line with seconds since spawn."""
    env = {**os.environ, 'NEXT_TELEMETRY_DISABLED': '1', 'NODE_ENV': 'production', 'CI': '1'}
    env.pop('_FUMADOCS_MDX', None)
    for key in ('MDX_SHIM_LOADER', 'MDX_SHIM_OPTIONS'):
        env.pop(key, None)
    if shim:
        env['MDX_SHIM_LOADER'] = str(shim[0])
        env['MDX_SHIM_OPTIONS'] = json.dumps(shim[1])
    marks, peak = {}, 0
    spawn_epoch_ms = time.time() * 1000
    start = time.perf_counter()
    proc = subprocess.Popen([node, str(app / 'node_modules/next/dist/bin/next'), 'build'], cwd=app, env=env,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)

    def reader():
        with log_path.open('w') as log:
            for line in proc.stdout:
                t = time.perf_counter() - start
                clean = harness.ANSI.sub('', line.rstrip('\n'))
                log.write(f'[{t:8.3f}] {clean}\n')
                for key, pattern in MARKS.items():
                    if key not in marks and re.search(pattern, clean):
                        marks[key] = round(t, 3)

    thread = threading.Thread(target=reader)
    thread.start()
    try:
        while proc.poll() is None:
            peak = max(peak, harness.tree_rss_kib(proc.pid))
            time.sleep(0.2)
    except BaseException:
        os.killpg(proc.pid, signal.SIGKILL)
        raise
    thread.join()
    wall = time.perf_counter() - start
    if proc.returncode:
        raise RuntimeError(f'Build failed ({proc.returncode}); see {log_path}')
    text = log_path.read_text()
    phases = {}
    for key, pattern in {'compile': r'Compiled successfully in ([\d.]+)(ms|s)',
                         'typecheck': r'Finished TypeScript in ([\d.]+)(ms|s)',
                         'staticGeneration': r'Generating static pages.*?in ([\d.]+)(ms|s)'}.items():
        match = re.search(pattern, text)
        if match:
            phases[key] = float(match[1]) * (0.001 if match[2] == 'ms' else 1)
    marks['exit'] = round(wall, 3)
    return {'wallSeconds': wall, 'peakTreeRssMiB': peak / 1024, 'phasesSeconds': phases,
            'marksSeconds': marks, 'spawnEpochMs': spawn_epoch_ms}


def mdx_timings(log_path, spawn_epoch_ms):
    rows = [json.loads(line) for line in log_path.read_text().splitlines()]
    busy = {}
    for row in rows:
        busy[row['pid']] = busy.get(row['pid'], 0) + row['wallMs']
    walls = sorted(row['wallMs'] for row in rows)
    return {
        'files': len(rows),
        'failed': sum(not row['ok'] for row in rows),
        'workers': len(busy),
        'sumWallMs': round(sum(walls)),
        'sumCpuMs': round(sum(row['cpuMs'] for row in rows)),
        'maxWorkerBusyMs': round(max(busy.values())),
        'firstStartS': round((min(row['start'] for row in rows) - spawn_epoch_ms) / 1000, 3),
        'lastEndS': round((max(row['end'] for row in rows) - spawn_epoch_ms) / 1000, 3),
        'medianFileWallMs': round(walls[len(walls) // 2], 1),
        'p95FileWallMs': round(walls[int(0.95 * (len(walls) - 1))], 1),
    }


def fingerprint(app, count):
    """Visible text hash and Shiki line count of three prerendered pages."""
    prints = {}
    for route in ['docs', 'docs/page-0001', f'docs/page-{count - 1:04d}']:
        text = (app / '.next/server/app' / f'{route}.html').read_text()
        body = re.sub(r'<(script|style)\b.*?</\1>', '', text, flags=re.S)
        visible = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', body))).strip()
        prints[route] = {'shikiLines': text.count('class="line"'),
                         'visibleSha256': hashlib.sha256(visible.encode()).hexdigest()[:16],
                         'visibleChars': len(visible)}
    return prints


def summarize(results):
    if results['mode'] == 'timing':
        for r in results['rows']:
            m, mdx = r['marksSeconds'], r['mdx']
            print(f"{r['pages']:>4} pages, trial {r['trial']}: wall {r['wallSeconds']:.1f}s, compile "
                  f"{r['phasesSeconds'].get('compile', 0):.1f}s, MDX done at {mdx['lastEndS']:.1f}s, busiest "
                  f"worker {mdx['maxWorkerBusyMs'] / 1000:.1f}s of {mdx['workers']}, MDX CPU "
                  f"{mdx['sumCpuMs'] / 1000:.1f}s, load {r['loadAvg1mAtStart']:.1f}")
        return
    for pages in sorted({r['pages'] for r in results['rows']}):
        for label in ('real', 'replay'):
            rows = [r for r in results['rows'] if r['pages'] == pages and r['label'] == label]
            if not rows:
                continue
            walls = sorted(r['wallSeconds'] for r in rows)
            compiles = sorted(r['phasesSeconds'].get('compile', 0) for r in rows)
            print(f"{pages:>4} pages, {label:<6} n={len(rows)}: wall median {walls[len(walls) // 2]:.1f}s "
                  f"({walls[0]:.1f}-{walls[-1]:.1f}), compile median {compiles[len(compiles) // 2]:.1f}s "
                  f"({compiles[0]:.1f}-{compiles[-1]:.1f})")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('mode', choices=['timing', 'replay'])
    parser.add_argument('--node', default=shutil.which('node'))
    parser.add_argument('--pages', type=int, nargs='+', default=[100, 500])
    parser.add_argument('--trials', type=int, default=2, help='timing: builds per page count')
    parser.add_argument('--order', default='real,replay,replay,real,real,replay',
                        help='replay: builds after the record build, as a comma list of real/replay')
    parser.add_argument('--run-id', default=time.strftime('mdx-%Y-%m-%dT%H-%M-%S'))
    parser.add_argument('--min-free-gib', type=float, default=3.0,
                        help='stop before a build when the disk has less free space than this')
    args = parser.parse_args()
    order = args.order.split(',')
    if any(item not in ('real', 'replay') for item in order):
        parser.error('--order accepts only "real" and "replay", for example real,replay,replay,real.')
    if args.trials < 1 or any(n < 2 for n in args.pages):
        parser.error('--trials must be positive and every --pages value at least 2.')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', args.run_id):
        parser.error('--run-id must be a simple name, not a path.')
    if not args.node:
        parser.error('Node was not found; pass --node /path/to/node.')
    artifacts = ROOT / 'artifacts' / args.run_id
    if artifacts.exists():
        parser.error('Use a new --run-id; existing measurements are never overwritten.')
    artifacts.mkdir(parents=True)

    results = {'runId': args.run_id, 'mode': args.mode, 'commit': harness.run_command(['git', 'rev-parse', 'HEAD']),
               'node': harness.run_command([args.node, '--version']),
               'processor': harness.run_command(['sysctl', '-n', 'machdep.cpu.brand_string'])
               if os.uname().sysname == 'Darwin' else os.uname().machine,
               'logicalCpus': os.cpu_count(), 'arguments': vars(args), 'rows': []}
    destination = artifacts / 'results.json'

    def build(count, label, shim=None):
        app = artifacts / 'apps' / f'farming-{count}'
        if app.exists():
            shutil.rmtree(app)
        free = shutil.disk_usage(ROOT).free / 2**30
        if free < args.min_free_gib:
            raise SystemExit(f'Only {free:.1f} GiB free; stopping before the build. Free space or lower '
                             f'--min-free-gib.')
        fixture = json.loads(harness.run_command([args.node, str(ROOT / 'prepare.mjs'), 'farming', str(count), str(app)]))
        (app / 'next.config.mjs').write_text(CONFIG % {'root': json.dumps(str(REPO))})
        load = os.getloadavg()[0]
        print(f'START {count} pages {label}', flush=True)
        metrics = timed_build(args.node, app, artifacts / f'{label}-{count}-{len(results["rows"]) + 1}.log', shim)
        output = harness.outputs(app, count)
        row = {'pages': count, 'label': label, 'loadAvg1mAtStart': load, **metrics,
               'routeModules': output['routeModules'], 'docsPages': output['docsPages'],
               'fingerprint': fingerprint(app, count), 'sourceBytes': fixture['sourceBytes']}
        shutil.rmtree(app)
        return row

    for count in args.pages:
        if args.mode == 'timing':
            for trial in range(1, args.trials + 1):
                log = artifacts / f'mdx-timing-{count}-{trial}.jsonl'
                row = build(count, 'timing', (ROOT / 'mdx-timing-loader.cjs', {'log': str(log)}))
                row['trial'] = trial
                row['mdx'] = mdx_timings(log, row['spawnEpochMs'])
                if row['mdx']['files'] != count or row['mdx']['failed']:
                    raise SystemExit(f'Expected {count} successful MDX compilations, got {row["mdx"]}.')
                results['rows'].append(row)
                destination.write_text(json.dumps(results, indent=2) + '\n')
        else:
            cache = artifacts / f'mdx-cache-{count}'
            row = build(count, 'record', (ROOT / 'mdx-replay-loader.cjs', {'mode': 'record', 'dir': str(cache)}))
            row['cachedModules'] = len(list(cache.glob('*.js')))
            if row['cachedModules'] != count:
                raise SystemExit(f'Recorded {row["cachedModules"]} MDX modules, expected {count}.')
            results['rows'].append(row)
            for label in order:
                shim = (ROOT / 'mdx-replay-loader.cjs', {'mode': 'replay', 'dir': str(cache)}) if label == 'replay' else None
                results['rows'].append(build(count, label, shim))
                destination.write_text(json.dumps(results, indent=2) + '\n')
            prints = {json.dumps(r['fingerprint'], sort_keys=True) for r in results['rows'] if r['pages'] == count}
            if len(prints) != 1:
                raise SystemExit(f'Rendered output differs between builds at {count} pages.')
            shutil.rmtree(cache)
    destination.write_text(json.dumps(results, indent=2) + '\n')
    summarize(results)
    print(f'Results: {destination}', flush=True)


if __name__ == '__main__':
    main()
