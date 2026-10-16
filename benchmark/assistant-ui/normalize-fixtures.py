"""Pin network font inputs and constrain external dependency roots identically."""
import json,re,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]; ART=ROOT/'benchmark/assistant-ui/artifacts'
SNAP=ART/'snapshot'; receipts=json.loads((ART/'snapshot.json').read_text()); deps=Path(receipts['dependencies'])
fontdir=ART/'fonts';fontdir.mkdir(exist_ok=True)
url='https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100..800&family=Public+Sans:wght@100..900&display=swap'
csspath=fontdir/'google.css'
if not csspath.exists():subprocess.run(['curl','-4','-L','--fail','--max-time','30','-sS','-A','Mozilla/5.0 AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',url,'-o',str(csspath)],check=True)
css=csspath.read_text()
urls=re.findall(r'url\((https://[^)]+)\)',css)
for remote in urls:
 dest=fontdir/remote.rsplit('/',1)[1]
 if not dest.exists():subprocess.run(['curl','-4','-L','--fail','--max-time','30','-sS',remote,'-o',str(dest)],check=True)
 css=css.replace(remote,'/benchmark-fonts/'+dest.name)
css+='\n.bench-public-sans { --font-public-sans: "Public Sans", Arial, sans-serif; }\n.bench-jetbrains-mono { --font-jetbrains-mono: "JetBrains Mono", monospace; }\n'
import shutil
for name in ['docs','docs-farming']:
 app=SNAP/'apps'/name
 dst=app/'public/benchmark-fonts';dst.mkdir(exist_ok=True)
 for font in fontdir.glob('*.woff2'):shutil.copy2(font,dst/font.name)
 (app/'styles/benchmark-fonts.css').write_text(css)
 p=app/'app/layout.tsx';s=p.read_text().replace('import { JetBrains_Mono, Public_Sans } from "next/font/google";','import "@/styles/benchmark-fonts.css";')
 s=re.sub(r'const publicSans = Public_Sans\(\{.*?\}\);','const publicSans = {variable: "bench-public-sans"};',s,flags=re.S)
 s=re.sub(r'const jetbrainsMono = JetBrains_Mono\(\{.*?\}\);','const jetbrainsMono = {variable: "bench-jetbrains-mono"};',s,flags=re.S)
 p.write_text(s)
 p=app/'next.config.ts';s=p.read_text()
 s=re.sub(r'turbopack: \{ root: "[^"]+" \}', 'turbopack: { root: '+json.dumps(str(ROOT))+' }', s)
 s=re.sub(r'^\s*turbopackAdditionalRoots:.*\n','',s,flags=re.M)
 s=s.replace('  experimental: {','  experimental: {\n    turbopackAdditionalRoots: '+json.dumps({'dependencies':{'path':str(deps)}})+',')
 p.write_text(s)
(ART/'font-inputs.json').write_text(json.dumps({'cssUrl':url,'fonts':urls,'note':'Shared frozen real font files; network downloads and next/font generation excluded from both build timers. All font subsets retained.'},indent=2)+'\n')
