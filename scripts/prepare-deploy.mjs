import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'web-build');
await mkdir(output,{recursive:true});
await cp(path.join(root,'dist'),output,{recursive:true});
if(process.env.VERCEL_ENV==='preview'){
  await writeFile(path.join(output,'config.js'),"// Preview uses browser-local demo data; never production.\nexport const config = {supabaseUrl:'', publishableKey:''};\n");
  const index=await readFile(path.join(output,'index.html'),'utf8');
  await writeFile(path.join(output,'index.html'),index.replace('<title>PO The Grands', '<title>ทดลอง — PO The Grands'));
}
console.log(process.env.VERCEL_ENV==='preview'?'PO preview: isolated browser-local demo':'PO production: configured Supabase');
