#!/usr/bin/env python3
"""Serial Next production builds. No third-party Python dependencies."""
import argparse, json, os, platform, re, shutil, signal, subprocess, sys, time, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
ANSI = re.compile(r'\x1b\[[0-9;]*m')

def run_command(args, cwd=REPO):
    return subprocess.check_output(args, cwd=cwd, text=True).strip()

def tree_rss_kib(pid):
    rows = {}
    for line in subprocess.check_output(['ps', '-axo', 'pid=,ppid=,rss='], text=True).splitlines():
        fields = line.split()
        if len(fields) == 3:
            process, parent, rss = map(int, fields)
            rows[process] = (parent, rss)
    selected = {pid}
    while True:
        children = {process for process, (parent, _) in rows.items() if parent in selected}
        if children <= selected:
            break
        selected |= children
    return sum(rows.get(process, (0, 0))[1] for process in selected)

def size(path):
    return sum(p.stat().st_size for p in path.rglob('*') if p.is_file()) if path.exists() else 0

def gzip_size(data):
    compressor = zlib.compressobj(level=9, wbits=31)
    return len(compressor.compress(data) + compressor.flush())

def outputs(app, count, edit=False):
    build = app / '.next'
    manifest = json.loads((build / 'prerender-manifest.json').read_text())
    routes = sorted(route for route in manifest['routes'] if route == '/docs' or route.startswith('/docs/'))
    if len(routes) != count:
        raise RuntimeError(f'Expected {count} prerendered docs, got {len(routes)}')
    html_path = build / 'server/app/docs.html'
    html = html_path.read_text()
    assert 'Benchmark page 0000' in html, 'Missing page content'
    assert 'Section 6' in html, 'Missing last section'
    assert 'shiki' in html, 'Missing syntax highlighting'
    assert 'Benchmark page ' + str(count - 1).zfill(4) in html, 'Missing complete sidebar'
    if edit:
        assert 'BENCHMARK_EDIT_MARKER' in html, 'Edited page was not rebuilt'
    assets = sorted(set(re.findall(r'(?:src|href)="(/_next/static/[^"?]+)', html)))
    assets = [(url, build / url.removeprefix('/_next/')) for url in assets]
    scripts = [p for url, p in assets if url.endswith('.js') and p.exists()]
    styles = [p for url, p in assets if url.endswith('.css') and p.exists()]
    app_paths = json.loads((build / 'server/app-paths-manifest.json').read_text())
    docs_html = [build / 'server/app' / (route.lstrip('/') + '.html') for route in routes]
    return {
        'docsPages': len(routes), 'routeModules': len(app_paths),
        'apiRoutes': sorted(route for route in app_paths if route.startswith('/api/')),
        'htmlBytes': len(html.encode()), 'htmlGzipBytes': gzip_size(html.encode()),
        'totalDocsHtmlBytes': sum(p.stat().st_size for p in docs_html),
        'initialJsBytes': sum(p.stat().st_size for p in scripts),
        'initialJsGzipBytes': sum(gzip_size(p.read_bytes()) for p in scripts),
        'initialJsFiles': len(scripts),
        'initialCssBytes': sum(p.stat().st_size for p in styles),
        'initialCssGzipBytes': sum(gzip_size(p.read_bytes()) for p in styles),
        'staticBytes': size(build / 'static'), 'serverBytes': size(build / 'server'),
        'nextCacheBytes': size(build / 'cache'),
    }

def build(app, node, log_path):
    env = {**os.environ, 'NEXT_TELEMETRY_DISABLED': '1', 'NODE_ENV': 'production', 'CI': '1'}
    # Each build must initialize the content loader; never inherit another app's sentinel.
    env.pop('_FUMADOCS_MDX', None)
    start = time.perf_counter()
    peak = 0
    samples = 0
    with log_path.open('w') as log:
        process = subprocess.Popen([node, str(app / 'node_modules/next/dist/bin/next'), 'build'], cwd=app, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            while process.poll() is None:
                peak = max(peak, tree_rss_kib(process.pid))
                samples += 1
                time.sleep(0.2)
        except BaseException:
            # The build owns this process group, including compiler workers.
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            raise
    elapsed = time.perf_counter() - start
    raw_log = ANSI.sub('', log_path.read_text())
    if process.returncode:
        raise RuntimeError(f'Build failed ({process.returncode}): {log_path}\n{raw_log[-6000:]}')
    phases = {}
    for key, pattern in {
        'compile': r'Compiled successfully in ([\d.]+)(ms|s)',
        'typecheck': r'Finished TypeScript in ([\d.]+)(ms|s)',
        'pageData': r'Collecting page data.*?in ([\d.]+)(ms|s)',
        'staticGeneration': r'Generating static pages.*?in ([\d.]+)(ms|s)',
    }.items():
        match = re.search(pattern, raw_log)
        if match:
            phases[key] = float(match[1]) * (0.001 if match[2] == 'ms' else 1)
    return {'wallSeconds': elapsed, 'peakTreeRssMiB': peak / 1024, 'rssSamples': samples, 'phasesSeconds': phases}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--node', default=shutil.which('node'))
    parser.add_argument('--pages', type=int, nargs='+', default=[100, 500])
    parser.add_argument('--trials', type=int, default=3)
    parser.add_argument('--providers', nargs='+', choices=['fumadocs', 'farming', 'fumadocs-file-routes'], default=['fumadocs', 'farming'])
    parser.add_argument('--modes', nargs='+', choices=['cold', 'warm', 'edit'], default=['cold', 'warm', 'edit'])
    parser.add_argument('--cold-only-above', type=int, default=100)
    parser.add_argument('--run-id', default=time.strftime('%Y-%m-%dT%H-%M-%S'))
    args = parser.parse_args()
    if args.trials < 1 or any(n < 1 for n in args.pages):
        parser.error('Pages and trials must be positive.')
    if args.modes[0] != 'cold':
        parser.error('Modes must begin with cold to establish a controlled cache.')
    if args.modes != [mode for mode in ['cold', 'warm', 'edit'] if mode in args.modes]:
        parser.error('Modes must be unique and ordered cold, warm, edit.')
    if len(set(args.pages)) != len(args.pages) or len(set(args.providers)) != len(args.providers):
        parser.error('Pages and providers must not contain duplicates.')
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', args.run_id):
        parser.error('Run ID must be a simple name, not a path.')
    if not args.node:
        parser.error('Node was not found; supply --node /path/to/node.')
    artifacts = ROOT / 'artifacts' / args.run_id
    if artifacts.exists():
        parser.error('Use a new run-id; existing measurements are never overwritten.')
    artifacts.mkdir(parents=True)
    metadata = {
        'runId': args.run_id, 'commit': run_command(['git', 'rev-parse', 'HEAD']),
        'node': run_command([args.node, '--version']), 'platform': platform.platform(),
        'processor': run_command(['sysctl', '-n', 'machdep.cpu.brand_string']) if sys.platform == 'darwin' else platform.processor(),
        'logicalCpus': os.cpu_count(), 'staticWorkers': 2, 'rssSamplingSeconds': 0.2,
        'arguments': {**vars(args), 'node': args.node}, 'results': [],
    }
    destination = artifacts / 'results.json'
    for count in args.pages:
        for trial in range(args.trials):
            offset = trial % len(args.providers)
            providers = args.providers[offset:] + args.providers[:offset]
            for provider in providers:
                app = artifacts / 'apps' / f'{provider}-{count}'
                if app.exists():
                    shutil.rmtree(app)
                fixture = json.loads(run_command([args.node, str(ROOT / 'prepare.mjs'), provider, str(count), str(app)]))
                modes = ['cold'] if count > args.cold_only_above else args.modes
                for mode in modes:
                    if mode == 'edit':
                        page = app / ('app/docs/page.mdx' if provider == 'farming' else 'content/docs/index.mdx')
                        page.write_text(page.read_text() + '\nBENCHMARK_EDIT_MARKER: one paragraph changed.\n')
                    log = artifacts / f'{provider}-{count}-trial-{trial+1}-{mode}.log'
                    print(f'START {provider} {count} pages trial {trial+1}/{args.trials} {mode}', flush=True)
                    metrics = build(app, args.node, log)
                    row = {**fixture, 'trial': trial + 1, 'mode': mode, **metrics, **outputs(app, count, mode == 'edit'), 'log': log.name}
                    metadata['results'].append(row)
                    destination.write_text(json.dumps(metadata, indent=2) + '\n')
                    print(f'DONE {provider} {count} {mode}: {metrics["wallSeconds"]:.2f}s, {metrics["peakTreeRssMiB"]:.0f} MiB sampled peak tree RSS', flush=True)
    print(f'Results: {destination}', flush=True)

if __name__ == '__main__':
    main()
