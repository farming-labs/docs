#!/usr/bin/env python3
"""Serial, same-runner core Markdown section A/B with a Fumadocs control."""
import argparse, hashlib, importlib.util, json, os, platform, re, shutil, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
spec = importlib.util.spec_from_file_location('runtime_benchmark', ROOT.parent/'farmjs-docs/run.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)
next_benchmark = runner.next_benchmark

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages', type=int, default=100)
    parser.add_argument('--trials', type=int, default=3)
    parser.add_argument('--run-id', required=True)
    args = parser.parse_args()
    if not 2 <= args.pages <= 1000 or not 1 <= args.trials <= 5 or not args.run_id.replace('-', '').isalnum():
        parser.error('Invalid arguments')
    node = shutil.which('node')
    artifacts = ROOT/'artifacts'/args.run_id
    artifacts.mkdir(parents=True, exist_ok=False)
    chunk = REPO/'packages/docs/dist/markdown-sections.mjs'
    candidate = chunk.read_text()
    baseline = (ROOT/'artifacts/markdown-sections-before.mjs').read_text()
    originals = {chunk: candidate}
    metadata = {'commit': next_benchmark.run_command(['git','rev-parse','HEAD']), 'node': next_benchmark.run_command([node,'--version']), 'platform': platform.platform(), 'logicalCpus': os.cpu_count(), 'method': 'Before restores the emitted Markdown section module from main 0d66fc16; after uses both linear section boundary resolution and bounded parse-result caching. All other package source and fixture settings are identical. Fumadocs is an unchanged control.', 'arguments': vars(args), 'results': [], 'failures': []}
    try:
        for trial in range(args.trials):
            variants = ['farming-before', 'farming-after', 'fumadocs']
            variants = variants[trial % 3:] + variants[:trial % 3]
            for variant in variants:
                chunk.write_text(candidate if variant == 'farming-after' else baseline)
                provider = 'fumadocs' if variant == 'fumadocs' else 'farming'
                app = artifacts/'apps'/variant
                if app.exists(): shutil.rmtree(app)
                fixture = json.loads(next_benchmark.run_command([node, str(ROOT/'prepare.mjs'), provider, str(args.pages), str(app)]))
                for mode in ['cold', 'warm', 'edit']:
                    label = f'{variant}-trial-{trial+1}-{mode}'
                    print('START', label, flush=True)
                    try:
                        if mode == 'edit':
                            page = app/('app/docs/page.mdx' if provider == 'farming' else 'content/docs/index.mdx')
                            page.write_text(page.read_text()+'\nBENCHMARK_EDIT_MARKER: one paragraph changed.\n')
                        metrics = next_benchmark.build(app, node, artifacts/(label+'.log'))
                        metrics.update(next_benchmark.outputs(app, args.pages, mode == 'edit'))
                        metrics['cssDigests'] = sorted(digest(p) for p in (app/'.next/static').rglob('*.css'))
                        metrics['sectionModuleDigest'] = digest(chunk)
                        metrics['runtime'] = runner.runtime(app, provider, args.pages, node, artifacts/(label+'-server.log'), artifacts/(label+'-runtime.json'))
                        if mode == 'edit': assert metrics['runtime']['editVisible'], 'Stale edited page'
                        metadata['results'].append({**fixture, 'variant': variant, 'trial': trial+1, 'mode': mode, **metrics})
                        print('DONE', label, round(metrics['wallSeconds'], 3), flush=True)
                    except Exception as error:
                        metadata['failures'].append({'label': label, 'error': str(error)})
                        print('FAIL', label, str(error), flush=True)
                        break
                    finally:
                        (artifacts/'results.json').write_text(json.dumps(metadata, indent=2)+'\n')
    finally:
        for p, original in originals.items(): p.write_text(original)
    if metadata['failures']: raise SystemExit(1)

if __name__ == '__main__': main()
