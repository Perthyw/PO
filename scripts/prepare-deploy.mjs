import {cp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'web-build');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(path.join(root,'dist'),output,{recursive:true});
if(process.env.VERCEL_ENV==='preview'){
  await writeFile(path.join(output,'config.js'),"// Preview uses browser-local demo data; never production.\nexport const config = {supabaseUrl:'', publishableKey:'', previewWorkflow:true};\n");
  const index=await readFile(path.join(output,'index.html'),'utf8');
  await writeFile(path.join(output,'index.html'),index.replace('<title>PO The Grands', '<title>ทดลอง — PO The Grands').replace(/<script type="module" src="app\.js[^\"]*"><\/script>/, '<script type="module" src="preview-bootstrap.js"></script>'));
  await writeFile(path.join(output,'mobile-check.html'),'<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview mobile viewport check</title><style>html,body{margin:0;min-height:100%;background:#dfe7ee;font-family:Arial,sans-serif}main{display:grid;justify-items:center;gap:12px;padding:18px}iframe{display:block;width:390px;height:844px;border:1px solid #64748b;background:white}p{margin:0}</style></head><body><main><p>390 × 844 CSS-pixel preview viewport</p><iframe title="PO preview at 390 pixels wide" src="index.html"></iframe></main></body></html>');
}
console.log(process.env.VERCEL_ENV==='preview'?'PO preview: isolated browser-local demo':'PO production: configured Supabase');
