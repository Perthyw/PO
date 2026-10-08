import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreviewAdapter} from '../dist/preview-adapter.js';
class Storage{map=new Map();getItem(k){return this.map.get(k)||null;}setItem(k,v){this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
test('preview notifications stay in isolated storage and notify the correct synthetic actors idempotently',async()=>{
 const prior=globalThis.localStorage,storage=new Storage();globalThis.localStorage=storage;
 try{
  const api=createPreviewAdapter({storage}),owner={id:'preview-owner',role:'owner',display_name:'เจ้าของ'},office={id:'preview-office',role:'office',display_name:'พนักงาน'};
  api.setActor(owner);let po=await api.detail('preview-v2-pending');const result=await api.action(po,'approve','ตรวจแล้ว',false,'notice-approve',owner,'item-pending-a');
  await api.action(po,'approve','ตรวจแล้ว',false,'notice-approve',owner,'item-pending-a');
  api.setActor(office);const notices=await api.notifications();assert.equal(notices.length,1);assert.equal(notices[0].action,'approve');assert.equal(notices[0].po_id,result.id);assert.match(notices[0].message,/ได้รับอนุมัติ/);
  assert.ok(storage.getItem('po-the-grands-preview-notifications-v2'));assert.equal(storage.getItem('po-the-grands-demo-notifications-v1'),null);
 }finally{if(prior===undefined)delete globalThis.localStorage;else globalThis.localStorage=prior;}
});
