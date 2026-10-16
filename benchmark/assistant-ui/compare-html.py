"""Compare visible text and heading IDs across every prerendered docs page."""
import hashlib,json,re
from html.parser import HTMLParser
from pathlib import Path
ROOT=Path(__file__).resolve().parent
class Page(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True);self.skip=0;self.text=[];self.headings=[];self.heading=None;self.pre=0;self.images=0
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style'):self.skip+=1
  if tag in ('h1','h2','h3','h4','h5','h6'):
   self.heading={'tag':tag,'id':dict(attrs).get('id'),'text':''}
  if tag=='pre':self.pre+=1
  if tag=='img':self.images+=1
 def handle_endtag(self,tag):
  if tag in ('script','style'):self.skip-=1
  if self.heading and tag==self.heading['tag']:
   self.heading['text']=re.sub(r'\s+',' ',self.heading['text']).strip();self.headings.append(self.heading);self.heading=None
 def handle_data(self,data):
  if not self.skip:self.text.append(data)
  if self.heading:self.heading['text']+=data
 def summary(self):
  text=re.sub(r'\s+',' ',''.join(self.text)).strip()
  return {'textHash':hashlib.sha256(text.encode()).hexdigest(),'textLength':len(text),'headings':self.headings,'codeBlocks':self.pre,'images':self.images}
providers={}
for provider,dirname in [('fumadocs','docs'),('farming','docs-farming')]:
 build=ROOT/'artifacts/snapshot/apps'/dirname/'.next'
 manifest=json.loads((build/'prerender-manifest.json').read_text())
 pages={}
 for route in sorted(r for r in manifest['routes'] if r=='/docs' or r.startswith('/docs/')):
  p=Page();p.feed((build/'server/app'/f'{route.lstrip("/")}.html').read_text());pages[route]=p.summary()
 providers[provider]=pages
native=providers['fumadocs'];farming=providers['farming']
diffs=[]
for route in sorted(set(native)|set(farming)):
 if route not in native or route not in farming:diffs.append({'route':route,'missingProvider': 'fumadocs' if route not in native else 'farming'});continue
 fields=[k for k in native[route] if native[route][k]!=farming[route][k]]
 if fields:diffs.append({'route':route,'fields':fields,'fumadocs':native[route],'farming':farming[route]})
result={'routes':len(native),'identicalRoutes':len(native)-len(diffs),'differences':diffs}
out=ROOT/'artifacts/html-comparison.json';out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'routes':result['routes'],'identicalRoutes':result['identicalRoutes'],'differences':[{'route':d['route'],'fields':d.get('fields')} for d in diffs[:20]]}))
