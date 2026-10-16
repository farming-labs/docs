"""Repair declared dependency views and use explicit generated collection imports."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; ART=ROOT/'benchmark/assistant-ui/artifacts'; SNAP=ART/'snapshot'
deps=Path(json.loads((ART/'snapshot.json').read_text())['dependencies'])
name='@radix-ui/react-use-callback-ref'
target=deps/'node_modules/.pnpm/node_modules'/name
if not target.exists():raise SystemExit(f'Missing declared dependency: {target}')
link=SNAP/'packages/react-markdown/node_modules'/name;link.parent.mkdir(parents=True,exist_ok=True)
if not link.exists():link.symlink_to(target.resolve(),target_is_directory=True)
for name in ['docs','docs-farming']:
 p=SNAP/'apps'/name/'lib/source.tsx';s=p.read_text().replace('"fumadocs-mdx:collections/server"','"../'+('.source-farming' if name=='docs-farming' else '.source')+'/server"');p.write_text(s)
 # withAui's automatic client/server facade is Turbopack-only. This client
 # component can use the documented explicit environment import in either bundler.
 app=SNAP/'apps'/name
 # Symlinked framework declarations otherwise find the framework checkout's
 # development Next version instead of the application's installed peer.
 p=app/'tsconfig.json';ts=json.loads(p.read_text())
 ts['compilerOptions']['paths']['next']=['./node_modules/next']
 if ts['compilerOptions']['paths'].get('next/*')==['./node_modules/next/*']:ts['compilerOptions']['paths'].pop('next/*')
 p.write_text(json.dumps(ts,indent=2)+'\n')
 p=app/'runtimes/docs.tsx';s=p.read_text()
 for toolkit in ['docs-toolkit','usage-toolkit']:
  s=s.replace(f'"@/lib/{toolkit}"',f'"@/lib/{toolkit}?generative-env=client"')
 p.write_text(s)
 (app/'benchmark-generative.d.ts').write_text(''.join(
  f'declare module "@/lib/{toolkit}?generative-env=client" {{\n'
  f'  import toolkit from "@/lib/{toolkit}";\n  export default toolkit;\n}}\n'
  for toolkit in ['docs-toolkit','usage-toolkit']))

 # Optional bounded correctness preflight; never label this a default-cache trial.
 p=app/'next.config.ts';s=p.read_text()
 expression='withAui(docsConfig)' if name=='docs-farming' else 'withAui(withMDX(config))'
 old='export default '+expression+';'
 if old in s:
  s=s.replace(old,'const benchmarkConfig = EXPRESSION;\nconst benchmarkWebpack = benchmarkConfig.webpack;\nbenchmarkConfig.webpack = (config, context) => {\n  const result = benchmarkWebpack?.(config, context) ?? config;\n  if (process.env.BENCHMARK_DISABLE_WEBPACK_CACHE === "1") result.cache = false;\n  return result;\n};\nexport default benchmarkConfig;'.replace('EXPRESSION',expression))
  p.write_text(s)
