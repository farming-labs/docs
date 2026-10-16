#!/usr/bin/env python3
"""Same-corpus Farm.js/Next production builds, with runtime correctness gates."""
import argparse, importlib.util, json, os, platform, re, shutil, signal, socket, subprocess, time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
spec = importlib.util.spec_from_file_location('next_benchmark', ROOT.parent / 'next-docs/run.py')
next_benchmark = importlib.util.module_from_spec(spec)
spec.loader.exec_module(next_benchmark)

def measured(command, app, logfile):
    env = {**os.environ, 'NODE_ENV': 'production', 'CI': '1', 'NEXT_TELEMETRY_DISABLED': '1', 'FARM_TELEMETRY_DISABLED': '1'}
    env.pop('_FUMADOCS_MDX', None)
    start, peak = time.perf_counter(), 0
    with logfile.open('w') as log:
        process = subprocess.Popen(command, cwd=app, env=env, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            while process.poll() is None:
                peak = max(peak, next_benchmark.tree_rss_kib(process.pid))
                if time.perf_counter() - start > 600:
                    raise TimeoutError(f'Build exceeded 10 minutes: {logfile}')
                time.sleep(.2)
        finally:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGTERM)
                try: process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(process.pid, signal.SIGKILL)
                    process.wait()
    result = {'wallSeconds': time.perf_counter()-start, 'peakTreeRssMiB': peak/1024, 'exitCode': process.returncode}
    if process.returncode:
        raise RuntimeError(f'{command} failed: {logfile}\n{logfile.read_text()[-2500:]}')
    return result

def runtime(app, provider, pages, node, log, result):
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    command = [node, str(app/'node_modules/next/dist/bin/next'), 'start', '-p', str(port)]
    if provider == 'farmjs': command = [node, str(app/'.output/server/index.mjs')]
    env = {**os.environ, 'NODE_ENV': 'production', 'PORT': str(port), 'HOST': '127.0.0.1', 'NITRO_PORT': str(port), 'NEXT_TELEMETRY_DISABLED': '1', 'FARM_TELEMETRY_DISABLED': '1'}
    with log.open('w') as output:
        server = subprocess.Popen(command, cwd=app, env=env, stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            deadline = time.perf_counter()+60
            while True:
                if server.poll() is not None: raise RuntimeError(log.read_text()[-4000:])
                try:
                    with socket.create_connection(('127.0.0.1',port),timeout=.2): break
                except OSError:
                    if time.perf_counter()>deadline: raise TimeoutError('Server did not listen')
                    time.sleep(.1)
            subprocess.run([node, str(ROOT/'verify.mjs'), f'http://127.0.0.1:{port}', provider, str(pages), str(result)], check=True, cwd=REPO)
            return json.loads(result.read_text())
        finally:
            if server.poll() is None:
                os.killpg(server.pid, signal.SIGTERM)
                try: server.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    os.killpg(server.pid,signal.SIGKILL)
                    server.wait()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pages',type=int,default=100)
    parser.add_argument('--trials',type=int,default=3)
    parser.add_argument('--providers',nargs='+',choices=['farmjs','farming','fumadocs'],default=['fumadocs','farming','farmjs'])
    parser.add_argument('--run-id',required=True)
    parser.add_argument('--node',default=shutil.which('node'))
    parser.add_argument('--modes',nargs='+',choices=['cold','warm','edit'],default=['cold','warm','edit'])
    args=parser.parse_args()
    if not 1<=args.pages<=1000 or not 1<=args.trials<=5 or not re.fullmatch(r'[a-zA-Z0-9._-]+',args.run_id): parser.error('Invalid benchmark arguments')
    if args.modes[0]!='cold' or len(set(args.modes))!=len(args.modes): parser.error('Start with cold; modes must be unique')
    source=Path(os.environ['FARM_BENCH_SOURCE']).resolve()
    artifacts=ROOT/'artifacts'/args.run_id
    artifacts.mkdir(parents=True,exist_ok=False)
    metadata={'docsCommit':next_benchmark.run_command(['git','rev-parse','HEAD']), 'farmCommit':next_benchmark.run_command(['git','rev-parse','HEAD'],source), 'node':next_benchmark.run_command([args.node,'--version']), 'platform':platform.platform(), 'arguments':vars(args), 'results':[], 'failures':[]}
    for trial in range(args.trials):
        providers=args.providers[trial%len(args.providers):]+args.providers[:trial%len(args.providers)]
        for provider in providers:
            app=artifacts/'apps'/provider
            if app.exists(): shutil.rmtree(app)
            fixture=json.loads(next_benchmark.run_command([args.node,str(ROOT/'prepare.mjs'),provider,str(args.pages),str(app)]))
            for mode in args.modes:
                label=f'{provider}-trial-{trial+1}-{mode}'
                print('START',label,flush=True)
                try:
                    if mode=='edit':
                        page=app/({'farmjs':'src/app/docs/page.mdx','farming':'app/docs/page.mdx','fumadocs':'content/docs/index.mdx'}[provider])
                        page.write_text(page.read_text()+'\nBENCHMARK_EDIT_MARKER: one paragraph changed.\n')
                    if provider=='farmjs':
                        check=measured([args.node,str(app/'node_modules/typescript/bin/tsc'),'--noEmit'],app,artifacts/(label+'-typecheck.log'))
                        build=measured([args.node,str(source/'packages/farm-cli/bin/farm.js'),'build'],app,artifacts/(label+'.log'))
                        metrics={'wallSeconds':check['wallSeconds']+build['wallSeconds'],'buildSeconds':build['wallSeconds'],'typecheckSeconds':check['wallSeconds'],'peakTreeRssMiB':max(check['peakTreeRssMiB'],build['peakTreeRssMiB'])}
                        html=list((app/'.output/public/docs').rglob('*.html'))
                        if (app/'.output/public/docs.html').exists():html.append(app/'.output/public/docs.html')
                        metrics.update({'prerenderedDocsPages':len(html),'totalDocsHtmlBytes':sum(p.stat().st_size for p in html),'outputBytes':next_benchmark.size(app/'.output')})
                    else:
                        metrics=next_benchmark.build(app,args.node,artifacts/(label+'.log'))
                        metrics.update(next_benchmark.outputs(app,args.pages,mode=='edit'))
                        metrics['prerenderedDocsPages']=metrics['docsPages']
                    # Fresh server for every row: do not hide a deferred first-page penalty.
                    metrics['runtime']=runtime(app,provider,args.pages,args.node,artifacts/(label+'-server.log'),artifacts/(label+'-runtime.json'))
                    if mode=='edit' and not metrics['runtime']['editVisible']:raise AssertionError('Edited content was stale')
                    metadata['results'].append({**fixture,'trial':trial+1,'mode':mode,**metrics})
                    print('DONE',label,round(metrics['wallSeconds'],3), 'seconds; prerendered',metrics['prerenderedDocsPages'],flush=True)
                except Exception as error:
                    metadata['failures'].append({'label':label,'error':str(error)})
                    print('FAIL',label,str(error),flush=True)
                    break
                finally:
                    (artifacts/'results.json').write_text(json.dumps(metadata,indent=2)+'\n')
    if metadata['failures']:raise SystemExit(1)

if __name__=='__main__':main()
