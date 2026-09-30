import test from 'node:test';
import assert from 'node:assert/strict';
import {config} from '../dist/config.js';
import {api} from '../dist/api.js';

test('REST adapter: login, paging, create payload, report, failed network and expiry',async()=>{
  const original=globalThis.fetch;
  config.supabaseUrl='https://example.supabase.co';
  config.publishableKey='test-public-key';
  let calls=[],fail=false,expired=false;
  globalThis.fetch=async(url,init)=>{
    calls.push({url,init});
    if(fail)throw Error('offline');
    if(expired)return Response.json({message:'expired'},{status:401});
    if(url.includes('/token?'))return Response.json({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,user:{id:'office'}});
    if(url.includes('/profiles?'))return Response.json([{id:'office',role:'office',display_name:'ออฟฟิศ'}]);
    if(url.includes('/purchase_orders?'))return Response.json([],{headers:{'content-range':'10-19/24'}});
    if(url.includes('/departments?'))return Response.json([{name:'อาหาร'},{name:'ออฟฟิศ'}]);
    if(url.includes('/rpc/create_po'))return Response.json({id:'created'});
    if(url.includes('/rpc/monthly_po_report'))return Response.json({rows:[],total_cents:0,ordered_count:0,pending_count:0,rejected_count:0});
    return Response.json({});
  };
  try{
    assert.equal((await api.login('office@example.invalid','not-a-real-password')).role,'office');
    await api.login('purchase.fai01','123456');
    assert.equal(JSON.parse(calls.findLast(call=>call.url.includes('/token?')).init.body).email,'purchase.fai01@po.thegrands.local');
    await api.saveOffice({username:'purchase.fai02',display_name:'น้องมุก',password:'654321'});
    const savedAccount=JSON.parse(calls.at(-1).init.body);
    assert.equal(savedAccount.username,'purchase.fai02');
    assert.equal(savedAccount.password,'654321');
    const result=await api.list('approved',2);
    assert.equal(result.total,24);
    assert.match(calls.at(-1).url,/offset=10/);
    assert.match(calls.at(-1).url,/status=eq.approved/);
    assert.equal(calls.at(-1).init.headers.Authorization,'Bearer test-access');
    assert.deepEqual(await api.departments(),['อาหาร','ออฟฟิศ']);
    await api.addDepartment('สาขาใหม่');
    assert.deepEqual(JSON.parse(calls.at(-1).init.body),{p_action:'add',p_name:'สาขาใหม่'});
    await api.archiveDepartment('สาขาใหม่');
    assert.deepEqual(JSON.parse(calls.at(-1).init.body),{p_action:'archive',p_name:'สาขาใหม่'});
    const key=crypto.randomUUID();
    fail=true;
    await assert.rejects(()=>api.list('',1),/เชื่อมต่อไม่ได้/);
    await assert.rejects(()=>api.create([],'2026-09-25',key),/เชื่อมต่อไม่ได้/);
    fail=false;
    await api.create([],'2026-09-25',key);
    const retry=JSON.parse(calls.at(-1).init.body);
    assert.equal(retry.p_po_date,'2026-09-25');
    assert.equal(retry.p_request_id,key);
    assert.equal((await api.report('2026-09')).total_cents,0);
    await api.deleteUser({id:'office-target'});
    const deleteCall=calls.at(-1);
    assert.match(deleteCall.url,/functions\/v1\/manage-user/);
    assert.equal(JSON.parse(deleteCall.init.body).action,'delete');
    assert.equal(JSON.parse(deleteCall.init.body).profile_id,'office-target');
    expired=true;
    await assert.rejects(()=>api.list('',1),e=>e.authExpired===true);
    expired=false;
    await api.logout();
  }finally{
    globalThis.fetch=original;
    config.supabaseUrl='';
    config.publishableKey='';
  }
});
