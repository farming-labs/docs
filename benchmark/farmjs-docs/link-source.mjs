// Confine dependency alignment to the disposable CI source checkout.
import {lstatSync,mkdirSync,realpathSync,symlinkSync,unlinkSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const source=resolve(process.env.FARM_BENCH_SOURCE);
if(source!==join(root,'farm-source'))throw new Error('Only the disposable CI checkout may be linked');
for(const [name,target] of Object.entries({
  '@farming-labs/docs':join(root,'packages/docs'),
  '@farming-labs/theme':join(root,'packages/fumadocs'),
  '@farming-labs/farmjs':join(root,'packages/farmjs'),
  react:realpathSync(join(root,'packages/next/node_modules/react')),
  'react-dom':realpathSync(join(root,'packages/next/node_modules/react-dom')),
})){
  for(const base of ['node_modules','packages/farm/node_modules']){
    const file=join(source,base,name);
    let existing;try{existing=lstatSync(file);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(existing){if(!existing.isSymbolicLink())throw new Error(`Refusing to replace non-symlink ${file}`);unlinkSync(file);}
    mkdirSync(dirname(file),{recursive:true});
    symlinkSync(target,file,'dir');
  }
}
