import {cp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'web-build');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
await cp(path.join(root,'dist'),output,{recursive:true});
for(const name of ['preview-bootstrap.js','preview-app.js','preview-adapter.js','preview-controls.css','preview-export.js','preview-fixtures.js','preview-workflow.js','preview-ui.js','preview.css','mobile-check.html'])await rm(path.join(output,name),{force:true});
if(process.env.VERCEL_ENV==='preview'){
  await writeFile(path.join(output,'config.js'),"// Empty build-only configuration selects the original browser-local demo.\nexport const config = { supabaseUrl:'', publishableKey:'' };\n");
  const keys=[
    ['po-the-grands-demo-accounts-v1','po-the-grands-preview-baseline-v1-demo-accounts'],
    ['po-the-grands-demo-orders-v1','po-the-grands-preview-baseline-v1-demo-orders'],
    ['po-the-grands-demo-departments-v1','po-the-grands-preview-baseline-v1-demo-departments'],
    ['po-the-grands-notifications-v1','po-the-grands-preview-baseline-v1-notifications'],
    ['po-the-grands-demo-po-reset-20260928-v1','po-the-grands-preview-baseline-v1-demo-reset-20260928'],
    ['po-the-grands-supabase-session-v1','po-the-grands-preview-baseline-v1-supabase-session']
  ];
  for(const file of ['app.js','api.js']){
    let source=await readFile(path.join(output,file),'utf8');
    for(const [original,preview] of keys)source=source.split(original).join(preview);
    for(const [original] of keys)if(source.includes(original))throw new Error(`Preview storage key was not isolated in ${file}: ${original}`);
    await writeFile(path.join(output,file),source);
  }
  const apiPath=path.join(output,'api.js');
  const apiSource=await readFile(apiPath,'utf8');
  const accountKey='po-the-grands-preview-baseline-v1-demo-accounts';
  const seed=`\n// Build-only public demo accounts; preserve any existing baseline namespace value.\nif(localStorage.getItem('${accountKey}')===null){\n const salt=crypto.randomUUID();\n const password_hash=await hashPassword('DemoOnly123!',salt);\n saveDemoAccounts([{id:'demo-owner',username:'owner',display_name:'เจ้าของตัวอย่าง',role:'owner',salt,password_hash},{id:'baseline-office',username:'office',display_name:'ฝ่ายจัดซื้อหลักตัวอย่าง',role:'office',can_export_report:true,salt,password_hash}]);\n}\n`;
  await writeFile(apiPath,apiSource+seed);
}
console.log(process.env.VERCEL_ENV==='preview'?'PO preview: original browser-local demo with isolated storage':'PO production: configured Supabase');
