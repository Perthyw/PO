import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewService,detailFinancialSummaries,previewStorageKey,legacyPreviewStorageKey} from '../dist/preview-workflow.js';
import {createPreviewFixtures} from '../dist/preview-fixtures.js';

class MemoryStorage{data=new Map();fail=false;getItem(k){return this.data.get(k)||null;}setItem(k,v){if(this.fail)throw Error('quota');this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
const owner={id:'preview-owner',role:'owner',display_name:'เจ้าของ'};
const office={id:'preview-office',role:'office',display_name:'พนักงาน'};
const primary={id:'preview-primary',role:'office',can_export_report:true,display_name:'ฝ่ายจัดซื้อหลัก'};
const other={id:'another-office',role:'office',display_name:'พนักงานอื่น'};
const sample=(extra={})=>({department:'ออฟฟิศ',name:'รายการทดสอบ',spec:'รุ่นมาตรฐาน',source:'ร้านตัวอย่าง',note:'บันทึก',qty:'2',unit:'กล่อง',unit_price:'107',vat:true,payment_method:'credit',...extra});
const service=(storage=new MemoryStorage(),fixtures=createPreviewFixtures())=>({storage,api:createPreviewService({storage,fixtures})});
const act=(api,po,action,{actor=owner,itemId=null,reason='',confirmed=false,fields=null,key=crypto.randomUUID()}={})=>api.mutate(po.id,action,{actor,itemId,reason,confirmed,fields,key,expectedVersion:po.version});
test('synthetic v2 fixtures cover actual-price lifecycle and never import prior preview namespace',()=>{
 const a=createPreviewFixtures(),b=createPreviewFixtures();assert.deepEqual(a.map(p=>p.id),b.map(p=>p.id));
 const {api:seeded}=service();for(const p of a){const fresh=seeded.load(p.id,office);assert.ok(fresh.items.length);assert.ok(Number.isInteger(fresh.confirmed_purchase_cents));for(const i of p.items){assert.ok(i.department&&i.unit&&i.payment_method);assert.ok(!('price_kind'in i));}}
 for(const state of ['pending','returned','revision_requested','editing','approved','received','rejected'])assert.ok(a.some(p=>p.items.some(i=>i.state===state)));
 assert.ok(a.some(p=>p.items.every(i=>i.state==='rejected')));
 const {api,storage}=service();storage.setItem(legacyPreviewStorageKey,'old synthetic rows');api.list(office);assert.notEqual(storage.getItem(previewStorageKey),'old synthetic rows');assert.equal(storage.getItem(legacyPreviewStorageKey),'old synthetic rows');
});
test('bulk approval is atomic; unresolved siblings block it, partial decisions stay independent',()=>{
 const {api}=service();let p=api.load('preview-v2-approved-mixed',owner);assert.equal(api.bulkApproveReady(p),true);const pending=p.items.find(i=>i.state==='pending');p=act(api,p,'approve_all',{key:'bulk-approve'});assert.equal(p.items.filter(i=>i.state==='approved').length,2);assert.equal(p.items.find(i=>i.id===pending.id).state,'approved');
 let mixed=api.load('preview-v2-mixed',owner);assert.equal(api.bulkApproveReady(mixed),false);assert.throws(()=>act(api,mixed,'approve_all',{key:'blocked-bulk'}),/ยังมีรายการ/);const prior=mixed.version;mixed=act(api,mixed,'approve_item',{itemId:'item-mixed-pending',key:'one-approve'});assert.equal(mixed.items.find(i=>i.id==='item-mixed-pending').state,'approved');assert.equal(mixed.items.find(i=>i.id==='item-mixed-returned').state,'returned');assert.equal(mixed.version,prior+1);
});
test('whole rejection requires every row pending and a reason',()=>{
 const {api}=service();let p=api.load('preview-v2-pending',owner);assert.throws(()=>act(api,p,'reject_all',{reason:' ',key:'no-reason'}),/เหตุผล/);const persisted=api.load(p.id,owner);assert.equal(persisted.version,p.version);assert.equal(persisted.items[0].state,'pending');p=act(api,p,'reject_all',{reason:'ไม่อยู่ในงบ',key:'reject-all'});assert.ok(p.items.every(i=>i.state==='rejected'));assert.equal(p.confirmed_purchase_cents,0);assert.throws(()=>act(api,api.load('preview-v2-approved-mixed',owner),'reject_all',{reason:'ไม่ผ่าน',key:'reject-approved'}),/ทุกรายการยังรอ/);
});
test('revision pauses pending or approved value, unlock edits preserve fields, refusal restores exact state',()=>{
 const {api}=service();let p=api.load('preview-v2-approved',office);const before=structuredClone(p.items[0]);p=act(api,p,'request_revision',{actor:office,itemId:before.id,reason:'ผู้ขายส่งใบเสนอราคาใหม่',key:'request-revision'});assert.equal(p.confirmed_purchase_cents,0);p=act(api,p,'refuse_revision',{itemId:before.id,reason:'คงการอนุมัติเดิม',key:'refuse'});assert.equal(p.items[0].state,'approved');assert.equal(p.confirmed_purchase_cents,before.total_cents);
 p=act(api,p,'request_revision',{actor:office,itemId:before.id,reason:'แก้รายละเอียด',key:'request2'});p=act(api,p,'unlock_item',{itemId:before.id,reason:'อนุญาตให้แก้',key:'unlock'});const changed=sample({name:'รายการแก้ไข',spec:'รุ่นใหม่',source:'ร้านใหม่',note:'แก้บันทึก',unit_price:'125'});p=act(api,p,'resubmit',{actor:office,itemId:before.id,reason:'แก้ตามคำขอ',fields:changed,key:'resubmit'});const item=p.items.find(i=>i.id===before.id);assert.equal(item.state,'pending');assert.equal(item.name,'รายการแก้ไข');assert.equal(item.department,before.department);assert.equal(item.payment_method,before.payment_method);const audit=p.events.find(e=>e.action==='edit');assert.equal(audit.before.total_cents,before.total_cents);assert.equal(audit.after.total_cents,item.total_cents);assert.equal(audit.delta_cents,item.total_cents-before.total_cents);assert.equal(audit.before.name,before.name);assert.equal(audit.after.spec,'รุ่นใหม่');
});
test('receipt and close require atomic eligibility and confirmation; actual totals reconcile',()=>{
 const {api}=service();let p=api.load('preview-v2-approved-mixed',primary);assert.equal(api.bulkReceiveReady(p),false);assert.throws(()=>act(api,p,'receive_all',{actor:primary,confirmed:true,key:'bad-receive'}),/ทุกรายการที่เหลือ/);const approved=p.items.find(i=>i.state==='approved');p=act(api,p,'receive_item',{actor:primary,itemId:approved.id,confirmed:true,key:'receive-one'});assert.equal(p.items.find(i=>i.id===approved.id).state,'received');assert.throws(()=>act(api,p,'close',{confirmed:true,key:'early-close'}),/ทุกรายการ/);
 let q=api.load('preview-v2-approved',office);q=act(api,q,'receive_all',{actor:office,confirmed:true,key:'receive-all'});assert.equal(q.received_cents,q.items[0].total_cents);q=act(api,q,'close',{confirmed:true,key:'close'});assert.equal(q.status,'closed');assert.throws(()=>act(api,q,'close',{confirmed:true,key:'close-again'}),/ปิดแล้ว/);
});
test('report is primary-only and mixed PO total includes eligible actual items only',()=>{
 const {api}=service();assert.throws(()=>api.report('2026-10',owner),/ฝ่ายจัดซื้อหลัก/);assert.throws(()=>api.report('2026-10',office),/ฝ่ายจัดซื้อหลัก/);const r=api.report('2026-10',primary),mixed=r.rows.find(p=>p.id==='preview-v2-mixed'),fixture=api.load('preview-v2-mixed',primary);const eligible=fixture.items.filter(i=>['approved','received'].includes(i.state)).reduce((n,i)=>n+i.total_cents,0);assert.equal(mixed.total_cents,eligible);assert.equal(r.total_cents,r.rows.reduce((n,p)=>n+p.total_cents,0));assert.equal(r.rows.find(p=>p.id==='preview-v2-all-rejected').total_cents,0);
});
test('detail retains full request totals separately from report-eligible purchase value',()=>{
 const {api}=service();const pending=api.load('preview-v2-pending',office),pendingTotals=detailFinancialSummaries(pending.items);assert.ok(pendingTotals.request.total_cents>0);assert.equal(pendingTotals.eligible.total_cents,0);
 const mixed=api.load('preview-v2-mixed',office),mixedTotals=detailFinancialSummaries(mixed.items);assert.ok(mixedTotals.request.total_cents>mixedTotals.eligible.total_cents);assert.equal(mixedTotals.eligible.total_cents,mixed.items.filter(i=>['approved','received'].includes(i.state)).reduce((sum,i)=>sum+i.total_cents,0));
});
test('durable command identity, role capabilities, immutability and stale-version checks',()=>{
 const storage=new MemoryStorage(),a=createPreviewService({storage,fixtures:createPreviewFixtures()}),b=createPreviewService({storage,fixtures:createPreviewFixtures()});const p=a.load('preview-v2-pending',owner),first=act(a,p,'approve_item',{itemId:'item-pending-a',key:'same'});assert.deepEqual(act(b,p,'approve_item',{itemId:'item-pending-a',key:'same'}),first);assert.throws(()=>act(b,p,'approve_item',{actor:{...owner,role:'office'},itemId:'item-pending-a',key:'same'}),/สิทธิ์|รหัสคำสั่ง/);const changed=a.load(p.id,owner);assert.throws(()=>act(b,p,'approve_item',{itemId:'item-pending-b',key:'stale'}),/ข้อมูลเปลี่ยน/);first.events[0].reason='caller mutation';first.items[0].name='caller mutation';assert.notEqual(a.load(p.id,owner).items[0].name,'caller mutation');assert.throws(()=>a.load(p.id,other),/ไม่มีสิทธิ์/);
});
test('failed persistence leaves stored envelope unchanged',()=>{
 const {api,storage}=service();const p=api.load('preview-v2-pending',owner),before=storage.getItem(previewStorageKey);storage.fail=true;assert.throws(()=>act(api,p,'approve_all',{key:'storage-fails'}),/quota/);storage.fail=false;assert.equal(storage.getItem(previewStorageKey),before);assert.equal(api.load(p.id,owner).version,p.version);
});
