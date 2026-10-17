import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(resolve('packages/next/package.json'));
const sharp=require(require.resolve('sharp',{paths:[require.resolve('next/package.json')]}));
const dir=process.argv[2], results=[];
for(let trial=1;trial<=3;trial++) for(const mode of ['cold','warm','edit']) for(const viewport of ['desktop','mobile']) {
 const suffix=`trial-${trial}-${mode}-runtime-${viewport}.png`;
 const a=await sharp(`${dir}/farming-before-${suffix}`).raw().toBuffer({resolveWithObject:true});
 const b=await sharp(`${dir}/farming-after-${suffix}`).raw().toBuffer({resolveWithObject:true});
 if(JSON.stringify(a.info)!==JSON.stringify(b.info)) throw Error('Image sizes differ');
 let changedPixels=0,maxChannelDelta=0,minX=Infinity,minY=Infinity,maxX=-1,maxY=-1;
 for(let i=0;i<a.data.length;i+=a.info.channels) {
   let changed=false;
   for(let c=0;c<a.info.channels;c++) {const delta=Math.abs(a.data[i+c]-b.data[i+c]);maxChannelDelta=Math.max(maxChannelDelta,delta);changed ||= delta>0;}
   if(changed) {changedPixels++;const x=(i/a.info.channels)%a.info.width,y=Math.floor(i/a.info.channels/a.info.width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 }
 results.push({trial,mode,viewport,changedPixels,maxChannelDelta,bounds:changedPixels?{minX,minY,maxX,maxY}:null});
}
writeFileSync(`${dir}/pixel-comparison.json`,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
