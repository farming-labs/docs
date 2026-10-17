import pathlib, shutil, subprocess, os, time, json, statistics, hashlib, argparse, tempfile
parser=argparse.ArgumentParser()
parser.add_argument("--baseline-cli", required=True)
parser.add_argument("--candidate-cli", required=True)
parser.add_argument("--content", required=True)
parser.add_argument("--node", default="node")
parser.add_argument("--output", required=True)
args=parser.parse_args()
output=pathlib.Path(args.output).resolve()
output.mkdir(parents=True, exist_ok=True)
root=pathlib.Path(tempfile.mkdtemp(prefix='docs-git-dates-benchmark-'))
root.mkdir(exist_ok=True)
source=pathlib.Path(args.content).resolve()
if not (root/'docs').exists(): shutil.copytree(source,root/'docs')
(root/'docs.config.ts').write_text('export default { entry: "docs", contentDir: "docs", nav: { title: "Benchmark" }, sitemap: { baseUrl: "https://example.com" }, llmsTxt: { baseUrl: "https://example.com" } };\n')
env=dict(os.environ,GIT_AUTHOR_DATE='2020-01-02T03:04:05Z',GIT_COMMITTER_DATE='2020-01-02T03:04:05Z')
if not (root/'.git').exists():
 for args in [['init','-q'],['config','user.name','Benchmark'],['config','user.email','benchmark@example.com'],['config','commit.gpgsign','false'],['add','docs','docs.config.ts'],['commit','-qm','Corpus']]: subprocess.run(['git',*args],cwd=root,env=env,check=True)
node=args.node
variants={'before':str(pathlib.Path(args.baseline_cli).resolve()),'after':str(pathlib.Path(args.candidate_cli).resolve())}
records=[]
# Seed generated files before timing unchanged builds, preserving generatedAt.
for args in [["sitemap","generate","--manifest-only"],["agent","export","--public"]]:
 subprocess.run([node,variants["before"],*args],cwd=root,check=True,capture_output=True)
def outputs():
 files=[]
 for folder in ['.farming-labs','public']:
  if (root/folder).exists():
   for p in sorted((root/folder).rglob('*')):
    if p.is_file(): files.append((str(p.relative_to(root)),hashlib.sha256(p.read_bytes()).hexdigest()))
 return hashlib.sha256(json.dumps(files).encode()).hexdigest(),len(files)
for trial in range(3):
 for label in (['before','after'] if trial%2==0 else ['after','before']):
  for command,args in [('sitemap',['sitemap','generate','--manifest-only']),('agent-export',['agent','export','--public'])]:
   start=time.perf_counter()
   result=subprocess.run([node,variants[label],*args],cwd=root,capture_output=True,text=True)
   elapsed=time.perf_counter()-start
   (output/f'{trial}-{label}-{command}.log').write_text(result.stdout+result.stderr)
   if result.returncode: raise RuntimeError(result.stderr)
   digest,count=outputs()
   if command=='sitemap':
    manifest=json.loads((root/'.farming-labs/sitemap-manifest.json').read_text())
    pages=len(manifest['pages'])
    digest=hashlib.sha256((root/'.farming-labs/sitemap-manifest.json').read_bytes()).hexdigest()
   else: pages=None
   row=dict(trial=trial,variant=label,command=command,seconds=elapsed,sha256=digest,files=count,pages=pages)
   records.append(row);print(json.dumps(row),flush=True)
(output/'results.json').write_text(json.dumps(records,indent=2)+'\n')
for command in ['sitemap','agent-export']:
 print(command,{v:statistics.median(r['seconds'] for r in records if r['command']==command and r['variant']==v) for v in variants})

print("Fixture retained at", root)
