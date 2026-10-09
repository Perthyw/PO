import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDemo} from '../dist/api.js';

test('demo receive and close follow the latest owner overlay across reloads',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}});
  try{
    const service=makeDemo(),owner={id:'demo-owner',role:'owner',display_name:'เจ้าของ'},office={id:'demo-office-primary',role:'office',display_name:'ออฟฟิศหลัก',can_export_report:true};
    service.setActor(owner);
    const pending=(await service.list('pending')).rows[0];
    const approved=await service.decidePO({poId:pending.id,expectedVersion:pending.version,rejectedLineNos:[],key:'decision-key'});
    assert.equal(approved.status,'approved');
    service.setActor(office);
    const receiveKey='receive-key',received=await service.action(approved,'receive','',true,receiveKey,office);
    assert.equal(received.status,'received');assert.equal(received.version,approved.version+1);
    assert.equal((await service.action(approved,'receive','',true,receiveKey,office)).version,received.version,'retry returns the committed lifecycle result');
    service.setActor(owner);
    const reloaded=makeDemo(),fromStorage=await reloaded.detail(pending.id);
    assert.equal(fromStorage.status,'received');assert.equal(fromStorage.version,received.version);
    const closed=await reloaded.action(fromStorage,'close','รับใบกำกับภาษี',true,'close-key',owner);
    assert.equal(closed.status,'closed');
    assert.equal((await makeDemo().detail(pending.id)).status,'closed');
  }finally{
    if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;
  }
});

test('demo keeps pre-stable-ID overlays actionable by their original ID',async()=>{
  const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)}});
  try{
    const seeded=makeDemo(),sample=(await seeded.list('pending')).rows[0],legacyId='legacy-random-id';
    values.set('po-the-grands-demo-owner-workflow-v1',JSON.stringify({schema:1,overlays:{[legacyId]:{...sample,id:legacyId,version:7}},audit:[],commands:{}}));
    const service=makeDemo(),owner={id:'demo-owner',role:'owner',display_name:'เจ้าของ'};service.setActor(owner);
    const listed=(await service.list('pending')).rows.find(row=>row.po_number===sample.po_number);
    assert.equal(listed.id,legacyId);
    const detail=await service.detail(listed.id);assert.equal(detail.version,7);
    const {department,name,spec,source,note,qty,unit,unit_price,vat,payment_method}=detail.items[0];
    const unlocked=await service.unlockPO(detail.id,detail.version,'legacy-unlock');
    const edited=await service.editPO({poId:detail.id,expectedVersion:detail.version,token:unlocked.token,key:'legacy-edit',items:[{line_no:1,department,name:'Edited legacy item',spec,source,note,qty,unit,unit_price,vat,payment_method}]});
    assert.equal(edited.version,8);
    const reloaded=makeDemo(),afterReload=await reloaded.detail(legacyId);
    assert.equal(afterReload.po_number,sample.po_number);assert.equal(afterReload.items[0].name,'Edited legacy item');
  }finally{
    if(previous)Object.defineProperty(globalThis,'localStorage',previous);else delete globalThis.localStorage;
  }
});
