// Local execution of the generated Node function and static files. This is
// deliberately not a Vercel CDN/region/cold-start simulation.
import {createServer} from 'node:http';
import {readFileSync,statSync,createReadStream} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Readable} from 'node:stream';
const app=resolve(process.argv[2]);
const output=join(app,'.vercel/output');
const dir=join(output,'functions/__nitro.func');
const config=JSON.parse(readFileSync(join(dir,'.vc-config.json'),'utf8'));
const {default:handler}=await import(pathToFileURL(join(dir,config.handler)));
const staticDir=join(output,'static');
const mime={'.js':'application/javascript','.mjs':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'};
createServer(async(req,res)=>{
  // Nitro's Vercel adapter decorates the invocation socket. Do not reuse that
  // socket across locally emulated function invocations.
  res.setHeader('Connection','close');
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(staticDir,'.'+pathname);
    if(file.startsWith(staticDir+sep)){
      for(const candidate of [file,join(file,'index.html')]){
        let stat;try{stat=statSync(candidate);}catch{}
        if(stat?.isFile()){
          res.setHeader('Content-Type',mime[extname(candidate)]||'application/octet-stream');
          createReadStream(candidate).pipe(res);return;
        }
      }
    }
    if(typeof handler==='function') await handler(req,res);
    else if(typeof handler?.fetch==='function'){
      const init={method:req.method,headers:req.headers};
      if(req.method!=='GET' && req.method!=='HEAD'){
        init.body=Readable.toWeb(req);init.duplex='half';
      }
      const request=new Request(`http://${req.headers.host}${req.url}`,init);
      const response=await handler.fetch(request,{waitUntil:promise=>promise.catch(console.error)});
      res.statusCode=response.status;
      for(const [name,value] of response.headers) if(name!=='set-cookie')res.setHeader(name,value);
      const cookies=response.headers.getSetCookie();
      if(cookies.length)res.setHeader('Set-Cookie',cookies);
      if(response.body)Readable.fromWeb(response.body).pipe(res);else res.end();
    }else throw new Error('Unsupported Vercel handler: '+Object.keys(handler??{}).join(','));
  }catch(error){console.error(error);res.statusCode=500;res.end('Fixture server failed');}
}).listen(Number(process.env.PORT),'127.0.0.1');
