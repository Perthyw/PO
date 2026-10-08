import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile,writeFile,access} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const web=path.join(root,'web-build'),dist=path.join(root,'dist');
const keys=[
 ['po-the-grands-demo-accounts-v1','po-the-grands-preview-baseline-v1-demo-accounts'],
 ['po-the-grands-demo-orders-v1','po-the-grands-preview-baseline-v1-demo-orders'],
 ['po-the-grands-demo-departments-v1','po-the-grands-preview-baseline-v1-demo-departments'],
 ['po-the-grands-notifications-v1','po-the-grands-preview-baseline-v1-notifications'],
 ['po-the-grands-demo-po-reset-20260928-v1','po-the-grands-preview-baseline-v1-demo-reset-20260928'],
 ['po-the-grands-supabase-session-v1','po-the-grands-preview-baseline-v1-supabase-session']
];
function build(environment){const result=spawnSync(process.execPath,['scripts/prepare-deploy.mjs'],{cwd:root,env:{...process.env,VERCEL_ENV:environment},encoding:'utf8'});assert.equal(result.status,0,result.stderr||result.stdout);}
function namespace(source){for(const [oldKey,newKey] of keys)source=source.split(oldKey).join(newKey);return source;}
class Storage{map=new Map();reads=[];writes=[];removes=[];getItem(k){this.reads.push(k);return this.map.get(k)??null;}setItem(k,v){this.writes.push(k);this.map.set(k,String(v));}removeItem(k){this.removes.push(k);this.map.delete(k);}}
test('preview build keeps the original app assets and transforms only browser storage namespaces',async()=>{
 build('preview');
 const previewConfig=await readFile(path.join(web,'config.js'),'utf8');assert.match(previewConfig,/supabaseUrl:\s*''/);assert.match(previewConfig,/publishableKey:\s*''/);assert.doesNotMatch(previewConfig,/previewWorkflow/);
 for(const file of ['index.html','style.css','domain.js'])assert.deepEqual(await readFile(path.join(web,file)),await readFile(path.join(dist,file)),`${file} must remain original in preview`);
 const originalApp=await readFile(path.join(dist,'app.js'),'utf8'),originalApi=await readFile(path.join(dist,'api.js'),'utf8'),previewApp=await readFile(path.join(web,'app.js'),'utf8'),previewApi=await readFile(path.join(web,'api.js'),'utf8');
 assert.ok(previewApp.startsWith(namespace(originalApp)));assert.match(previewApp,/__renderRevisionRequestControls/);assert.ok(previewApi.startsWith(namespace(originalApi)));assert.match(previewApi,/DemoOnly123!/);assert.match(previewApi,/__previewRevisionRequests\.hasActive/);await access(path.join(web,'preview-revision-requests.js'));
 for(const [oldKey,newKey] of keys){assert.ok(originalApp.includes(oldKey)||originalApi.includes(oldKey),`${oldKey} exists in original source`);assert.ok(previewApp.includes(newKey)||previewApi.includes(newKey),`${newKey} exists in preview`);assert.doesNotMatch(previewApp+previewApi,new RegExp(oldKey));}
 assert.match(previewApi,/getItem\('po-the-grands-preview-baseline-v1-demo-accounts'\)===null/);
 for(const file of ['preview-bootstrap.js','preview-app.js','preview-adapter.js','preview-controls.css','preview-export.js','preview-fixtures.js','preview-workflow.js','preview-ui.js','preview.css','mobile-check.html'])await assert.rejects(access(path.join(web,file)));
 await writeFile(path.join(web,'stale-preview-output.txt'),'remove me');
});
test('generated baseline API seeds only missing accounts and completes original whole-PO lifecycle without network',async()=>{
 build('preview');
 const previousStorage=globalThis.localStorage,previousFetch=globalThis.fetch,storage=new Storage();globalThis.localStorage=storage;globalThis.fetch=()=>{throw Error('baseline demo attempted network access');};
 const oldSentinels=new Map(keys.map(([oldKey])=>[oldKey,`legacy:${oldKey}`]));for(const [key,value] of oldSentinels)storage.map.set(key,value);
 try{
  const moduleURL=pathToFileURL(path.join(web,'api.js')).href+`?baseline-flow=${Date.now()}`;const {configured,demoAuth,makeDemo}=await import(moduleURL);assert.equal(configured,false);
  const owner=await demoAuth.login('owner','DemoOnly123!'),office=await demoAuth.login('office','DemoOnly123!');assert.equal(owner.role,'owner');assert.equal(office.id,'baseline-office');assert.equal(office.role,'office');assert.equal(office.can_export_report,true);
  const existingAccounts=storage.getItem('po-the-grands-preview-baseline-v1-demo-accounts');assert.equal(JSON.parse(existingAccounts).length,2);
  const service=makeDemo(),before=await service.report('2026-10');let po=await service.create([{department:'ออฟฟิศ',name:'ตัวอย่างจริง',spec:'รุ่นทดสอบ',source:'ร้านตัวอย่าง',note:'ทดสอบครบวงจร',qty:'2',unit:'ชิ้น',unit_price:'100',vat:false,payment_method:'cash'}],'2026-10-07','baseline-create-key',office,'ออฟฟิศ');assert.equal(po.status,'pending');assert.equal(po.total_cents,20000);
  po=await service.action(po,'approve','',false,'baseline-approve-key',owner);assert.equal(po.status,'approved');po=await service.action(po,'receive','',true,'baseline-receive-key',office);assert.equal(po.status,'received');po=await service.action(po,'close','',true,'baseline-close-key',owner);assert.equal(po.status,'closed');
  const after=await service.report('2026-10');assert.equal(after.total_cents-before.total_cents,po.total_cents);const savedOrders=JSON.parse(storage.getItem('po-the-grands-preview-baseline-v1-demo-orders'));assert.ok(savedOrders.some(row=>row.id===po.id&&row.status==='closed'));
  const pending=await service.create([{department:'ออฟฟิศ',name:'รายการรอแก้ไข',spec:'ก่อนแก้',source:'ร้านตัวอย่าง',note:'',qty:'1',unit:'ชิ้น',unit_price:'50',vat:false,payment_method:'cash'}],'2026-10-07','revision-create-key',office,'ออฟฟิศ');
  const {createRevisionRequestStore,revisionItemFingerprint}=await import(pathToFileURL(path.join(web,'preview-revision-requests.js')).href+`?revision-store=${Date.now()}`),requests=createRevisionRequestStore();requests.create({po:pending,actor:office,expectedVersion:pending.version,selected:[{index:0,fingerprint:revisionItemFingerprint(pending.items[0])}],reason:'เปลี่ยนสเปค',requestKey:'revision-request-key'});
  const beforeBlocked=JSON.stringify(await service.detail(pending.id));await assert.rejects(service.action(pending,'approve','',false,'blocked-approve-key',owner),/คำขอแก้ไขที่รอพิจารณา/);assert.equal(JSON.stringify(await service.detail(pending.id)),beforeBlocked,'active revision request must leave original PO unchanged');
  assert.ok(storage.reads.every(key=>key.startsWith('po-the-grands-preview-baseline-v1-')));assert.ok(storage.writes.every(key=>key.startsWith('po-the-grands-preview-baseline-v1-')));assert.deepEqual(storage.removes,[]);for(const [key,value] of oldSentinels)assert.equal(storage.map.get(key),value);
  storage.map.set('po-the-grands-preview-baseline-v1-demo-accounts','[]');const preserveURL=pathToFileURL(path.join(web,'api.js')).href+`?baseline-preserve=${Date.now()}`;await import(preserveURL);assert.equal(storage.map.get('po-the-grands-preview-baseline-v1-demo-accounts'),'[]','existing baseline accounts, even an empty list, are not overwritten');
 }finally{if(previousStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=previousStorage;if(previousFetch===undefined)delete globalThis.fetch;else globalThis.fetch=previousFetch;}
});
test('production build is canonical and removes preview output and stale artifacts',async()=>{
 build('production');
 for(const file of ['config.js','index.html','app.js','api.js','style.css','domain.js'])assert.deepEqual(await readFile(path.join(web,file)),await readFile(path.join(dist,file)),`${file} must be copied unchanged for production`);
 for(const file of ['preview-bootstrap.js','preview-app.js','preview-adapter.js','preview-controls.css','preview-export.js','preview-fixtures.js','preview-workflow.js','preview-ui.js','preview.css','preview-revision-requests.js','mobile-check.html','stale-preview-output.txt'])await assert.rejects(access(path.join(web,file)));
});
