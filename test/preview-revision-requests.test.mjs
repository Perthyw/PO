import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevisionRequestStore,revisionItemFingerprint,revisionRequestStorageKey} from '../dist/preview-revision-requests.js';

class Storage{
 constructor(){this.values=new Map();this.fail=false;}
 getItem(key){return this.values.get(key)??null;}
 setItem(key,value){if(this.fail)throw Error('quota');this.values.set(key,String(value));}
}
const samplePO=(status='pending')=>({id:'po-1',po_number:'PO-1',created_by:'office-1',version:3,status,items:[{name:'กระดาษ',spec:'A4',qty:2,unit_price:'10',vat:true},{name:'ปากกา',spec:'น้ำเงิน',qty:1,unit_price:'5',vat:false}]});
const office={id:'office-1',role:'office',display_name:'ออฟฟิศ'};
test('revision request validates ownership, state, selection, reason, and current snapshots',()=>{
 const storage=new Storage(),store=createRevisionRequestStore(storage),po=samplePO();
 const selected=[{index:1,fingerprint:revisionItemFingerprint(po.items[1])}];
 assert.throws(()=>store.create({po,actor:{...office,id:'other'},expectedVersion:3,selected,reason:'แก้สเปค',requestKey:'k'}),/เฉพาะออฟฟิศ/);
 assert.throws(()=>store.create({po:{...po,status:'received'},actor:office,expectedVersion:3,selected,reason:'แก้สเปค',requestKey:'k'}),/รออนุมัติหรืออนุมัติแล้ว/);
 assert.throws(()=>store.create({po,actor:office,expectedVersion:2,selected,reason:'แก้สเปค',requestKey:'k'}),/เปลี่ยนแล้ว/);
 assert.throws(()=>store.create({po,actor:office,expectedVersion:3,selected:[],reason:'แก้สเปค',requestKey:'k'}),/อย่างน้อย 1/);
 assert.throws(()=>store.create({po,actor:office,expectedVersion:3,selected,reason:' ',requestKey:'k'}),/ระบุเหตุผล/);
 assert.throws(()=>store.create({po,actor:office,expectedVersion:3,selected:[{index:1,fingerprint:'stale'}],reason:'แก้สเปค',requestKey:'k'}),/เปลี่ยนแล้ว/);
});
test('request persists without mutating PO data, is idempotent, and returned values are isolated',()=>{
 const storage=new Storage(),store=createRevisionRequestStore(storage,()=> '2026-10-07T00:00:00.000Z',()=> 'request-1'),po=samplePO(),before=structuredClone(po),selected=[{index:0,fingerprint:revisionItemFingerprint(po.items[0])}];
 const input={po,actor:office,expectedVersion:3,selected,reason:'เปลี่ยนจำนวน',requestKey:'key-1'};
 const first=store.create(input);assert.equal(first.po_version,3);assert.deepEqual(po,before);assert.equal(store.hasActive('po-1'),true);assert.equal(store.forPO('po-1').selected_items[0].item.name,'กระดาษ');
 first.selected_items[0].item.name='ถูกแก้ภายนอก';assert.equal(store.forPO('po-1').selected_items[0].item.name,'กระดาษ');
 assert.deepEqual(store.create(input),store.forPO('po-1'));
 assert.equal(storage.values.has(revisionRequestStorageKey),true);
 assert.throws(()=>store.create({...input,requestKey:'key-2'}),/รอพิจารณา/);
});
test('storage failure and changed-payload retries do not add records',()=>{
 const storage=new Storage(),store=createRevisionRequestStore(storage),po=samplePO(),selected=[{index:0,fingerprint:revisionItemFingerprint(po.items[0])}],input={po,actor:office,expectedVersion:3,selected,reason:'แก้จำนวน',requestKey:'key'};
 storage.fail=true;assert.throws(()=>store.create(input),/บันทึกคำขอแก้ไขไม่ได้/);assert.equal(storage.values.has(revisionRequestStorageKey),false);
 storage.fail=false;store.create(input);assert.throws(()=>store.create({...input,reason:'เหตุผลอื่น'}),/ข้อมูลอื่น/);assert.equal(store.list().length,1);
});
