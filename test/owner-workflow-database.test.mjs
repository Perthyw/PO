import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';

const office='11111111-1111-4111-8111-111111111111';
const owner='22222222-2222-4222-8222-222222222222';
const stranger='33333333-3333-4333-8333-333333333333';
const item=(name,unitPrice='3000',vat=true)=>({department:'อาหาร',name,spec:'รายละเอียดเดิม',source:'ร้านเดิม',note:'หมายเหตุพนักงาน',qty:'1',unit:'กล่อง',unit_price:unitPrice,vat,payment_method:'credit'});

test('owner item edit, partial rejection, projections, report and retries',async t=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
    for(const file of ['20260929000000_initial_po_schema.sql','20261003142936_item_payment_method.sql','20261009083925_owner_edit_and_partial_rejection.sql'])
      await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),'utf8'));
    await db.query('insert into auth.users values ($1),($2),($3)',[office,owner,stranger]);
    await db.query("insert into public.profiles(id,login_email,display_name,role,can_export_report) values ($1,'office@example.test','ออฟฟิศ','office',true),($2,'owner@example.test','เจ้าของ','owner',false),($3,'stranger@example.test','บุคคลอื่น','office',false)",[office,owner,stranger]);
    let activeActor=null;
    async function as(id,fn){const previous=activeActor;await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);activeActor=id;try{return await fn();}finally{if(previous){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[previous]);activeActor=previous;}else{await db.exec('reset role');activeActor=null;}}}
    async function asAdmin(fn){const previous=activeActor;await db.exec('reset role');try{return await fn();}finally{if(previous){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[previous]);}}}
    const create=async(lines,key=crypto.randomUUID())=>(await db.query('select public.create_po($1::jsonb,$2::date,$3::uuid) as po',[JSON.stringify(lines),'2026-10-09',key])).rows[0].po;
    const unlock=(id,version,key)=>db.query('select public.unlock_po_edit($1::uuid,$2::integer,$3::uuid) as value',[id,version,key]).then(r=>r.rows[0].value);
    const lock=(id,token)=>db.query('select public.lock_po_edit($1::uuid,$2::uuid) as value',[id,token]).then(r=>r.rows[0].value);
    const edit=(id,version,token,lines,key)=>db.query('select public.edit_po_items($1::uuid,$2::integer,$3::uuid,$4::jsonb,$5::uuid) as value',[id,version,token,JSON.stringify(lines),key]).then(r=>r.rows[0].value);
    const decide=(id,version,rejected,reason,note,key)=>db.query('select public.decide_po_items($1::uuid,$2::integer,$3::smallint[],$4::text,$5::text,$6::uuid) as value',[id,version,rejected,reason,note,key]).then(r=>r.rows[0].value);
    const act=(id,action,version,reason,confirmed,key)=>db.query('select public.act_on_po($1::uuid,$2::text,$3::integer,$4::text,$5::boolean,$6::uuid) as value',[id,action,version,reason,confirmed,key]).then(r=>r.rows[0].value);
    const list=(status,page,scope)=>db.query('select public.list_po($1::text,$2::integer,$3::text) as value',[status,page,scope]).then(r=>r.rows[0].value);
    const report=month=>db.query('select public.monthly_po_report($1::date) as value',[month]).then(r=>r.rows[0].value);
    let po;
    await t.test('edit requires active owner unlock, preserves PO number and logs only actual edits',async()=>{
      await as(office,async()=>{po=await create([item('สินค้าหลัก')]);await assert.rejects(()=>unlock(po.id,po.version,crypto.randomUUID()));await assert.rejects(()=>decide(po.id,po.version,[],'','',crypto.randomUUID()));});
      await asAdmin(()=>db.query("update public.departments set archived_at=now() where name in ('อาหาร','ออฟฟิศ')"));
      await as(owner,async()=>{
        const originalNumber=po.po_number, beforeVersion=po.version, unlockKey=crypto.randomUUID();
        const unlocked=await unlock(po.id,po.version,unlockKey);
        assert.equal(unlocked.version,po.version);assert.ok(unlocked.token);
        const storedUnlock=await asAdmin(async()=>(await db.query('select payload::text||result::text as saved from public.po_commands where actor_id=$1 and request_id=$2',[owner,unlockKey])).rows[0].saved);
        assert.equal(storedUnlock.includes(unlocked.token),false,'persistent command cache does not retain bearer unlock tokens');
        const clean=(line)=>{const {line_no,department,name,spec,source,note,qty,unit,unit_price,vat,payment_method}=line;return {line_no,department,name,spec,source,note,qty,unit,unit_price,vat,payment_method};};
        const originalLine=clean({...po.items[0],line_no:1});
        await assert.rejects(()=>edit(po.id,po.version,unlocked.token,[{...originalLine,department:'ออฟฟิศ'}],crypto.randomUUID()),/เปิดใช้งาน/);
        await assert.rejects(()=>edit(po.id,po.version,unlocked.token,[{...originalLine,line_no:null}],crypto.randomUUID()));
        await assert.rejects(()=>edit(po.id,po.version,unlocked.token,[],crypto.randomUUID()));
        await assert.rejects(()=>edit(po.id,po.version,unlocked.token,[{...originalLine,line_no:2}],crypto.randomUUID()));
        const line={...po.items[0],line_no:1,name:'ชื่อที่แก้',department:'อาหาร',unit:'แพ็ก',spec:'รายละเอียดใหม่',qty:'2',unit_price:'2000',source:'ร้านใหม่',vat:false,payment_method:'cash',note:'หมายเหตุรายการ'};
        const editKey=crypto.randomUUID(),args=[po.id,po.version,unlocked.token,[line],editKey];
        po=await edit(...args);
        assert.equal(po.po_number,originalNumber);assert.equal(po.status,'pending');assert.equal(po.version,beforeVersion+1);
        await assert.rejects(()=>unlock(po.id,beforeVersion,crypto.randomUUID()),/เปลี่ยนแล้ว/);
        assert.deepEqual([po.items[0].name,po.items[0].department,po.items[0].unit,po.items[0].spec,po.items[0].source,po.items[0].note,po.items[0].payment_method],['ชื่อที่แก้','อาหาร','แพ็ก','รายละเอียดใหม่','ร้านใหม่','หมายเหตุรายการ','cash']);
        assert.deepEqual([po.base_cents,po.tax_cents,po.total_cents],[400000,0,400000]);
        const replaced=await unlock(po.id,po.version,crypto.randomUUID());
        const expiryKey=crypto.randomUUID(),renewed=await unlock(po.id,po.version,expiryKey);
        assert.equal((await unlock(po.id,po.version,expiryKey)).token,renewed.token);
        assert.equal(await lock(po.id,replaced.token),false,'replaced lease cannot be released by its old token');
        await asAdmin(()=>db.query('update private.po_owner_edit_locks set expires_at=now()-interval \'1 second\' where po_id=$1',[po.id]));
        await assert.rejects(()=>unlock(po.id,po.version,expiryKey));
        const afterExpiry=await unlock(po.id,po.version,crypto.randomUUID());
        assert.notEqual(afterExpiry.token,renewed.token);
        await lock(po.id,afterExpiry.token);
        const retry=await edit(...args);assert.equal(retry.version,po.version);
        const storedEdit=await asAdmin(async()=>(await db.query('select payload::text||result::text as saved from public.po_commands where actor_id=$1 and request_id=$2',[owner,editKey])).rows[0].saved);
        assert.equal(storedEdit.includes(unlocked.token),false,'edit idempotency metadata stores only a token fingerprint');
        assert.equal((await db.query("select count(*) from public.po_events where po_id=$1 and action='owner_edit'",[po.id])).rows[0].count,1);
        await as(office,async()=>assert.equal((await db.query("select count(*) from public.notifications where po_id=$1 and action='owner_edit'",[po.id])).rows[0].count,1));
        const nextUnlock=await unlock(po.id,po.version,crypto.randomUUID());
        const {decision,decision_reason,decision_at,decision_by,...editableNoOp}=po.items[0];
        const noOp={...editableNoOp,line_no:1};const beforeNoOpVersion=po.version;
        const result=await edit(po.id,po.version,nextUnlock.token,[noOp],crypto.randomUUID());
        assert.equal(result.version,beforeNoOpVersion);
        assert.equal((await db.query("select count(*) from public.po_events where po_id=$1 and action='owner_edit'",[po.id])).rows[0].count,1);
        await as(office,async()=>assert.equal((await db.query("select count(*) from public.notifications where po_id=$1 and action='owner_edit'",[po.id])).rows[0].count,1));
        assert.equal(await lock(po.id,unlocked.token),false,'old lock token must not release a newer lock');
      });
      await asAdmin(()=>db.query("update public.departments set archived_at=null where name in ('อาหาร','ออฟฟิศ')"));
    });
    let partial;
    await t.test('partial rejection keeps approved lifecycle, reason, notes and independent totals',async()=>{
      await as(office,async()=>{partial=await create([item('รับไว้','3000',true),item('ปฏิเสธ','100',false)]);});
      await as(owner,async()=>{
        await assert.rejects(()=>decide(partial.id,partial.version,[0],'เหตุผล','',crypto.randomUUID()),/รายการสินค้าที่เลือกไม่ถูกต้อง/);
        await assert.rejects(()=>decide(partial.id,partial.version,[null],'เหตุผล','',crypto.randomUUID()),/รายการสินค้าที่เลือกไม่ถูกต้อง/);
        const decisionKey=crypto.randomUUID(),decisionVersion=partial.version;
        partial=await decide(partial.id,decisionVersion,[2],'ไม่ตรงสเปค','อนุมัติรายการที่เหลือ',decisionKey);
        assert.equal((await decide(partial.id,decisionVersion,[2],'ไม่ตรงสเปค','อนุมัติรายการที่เหลือ',decisionKey)).version,partial.version,'decision retry returns its committed result');
        await assert.rejects(()=>decide(partial.id,decisionVersion,[1],'different payload','',decisionKey));
        assert.equal(partial.po_number,(await db.query('select po_number from public.purchase_orders where id=$1',[partial.id])).rows[0].po_number);
        assert.equal(partial.status,'approved');assert.equal(partial.approval_note,'อนุมัติรายการที่เหลือ');
        assert.deepEqual(partial.items.map(i=>[i.line_no,i.decision]),[[1,'approved'],[2,'rejected']]);
        assert.equal(partial.items[1].decision_reason,'ไม่ตรงสเปค');
        assert.deepEqual([partial.base_cents,partial.tax_cents,partial.total_cents],[280374,19626,300000]);
        assert.equal((await db.query("select reason from public.po_events where po_id=$1 and action='approve' order by at desc limit 1",[partial.id])).rows[0].reason,'');
        const rejected=await list('rejected',1,'all');
        const projection=rejected.rows.find(row=>row.id===partial.id);
        assert.equal(projection.status,'rejected');assert.equal(projection.real_status,'approved');
        assert.equal(projection.items.length,1);assert.equal(projection.items[0].name,'ปฏิเสธ');assert.equal(projection.total_cents,10000);
        const counts=(await db.query('select public.po_counts(false) as value')).rows[0].value;
        assert.equal(counts.approved,1);assert.equal(counts.rejected,1);
      });
      await as(office,async()=>{
        const reportData=await report('2026-10-01');
        const row=reportData.rows.find(item=>item.id===partial.id);
        assert.equal(reportData.total_cents,300000);assert.equal(reportData.rejected_count,1);
        assert.equal(row.items.length,1);assert.equal(row.items[0].name,'รับไว้');assert.equal(row.approval_note,'อนุมัติรายการที่เหลือ');
        assert.equal(row.edit_history.length,0);
      });
      await as(owner,async()=>{
        const unlocked=await unlock(partial.id,partial.version,crypto.randomUUID());
        const {decision,decision_reason,decision_at,decision_by,base_cents,tax_cents,total_cents,...acceptedBase}=partial.items[0];
        const accepted={...acceptedBase,line_no:1,name:'แก้รายการที่อนุมัติ'};
        partial=await edit(partial.id,partial.version,unlocked.token,[accepted],crypto.randomUUID());
        assert.equal(partial.items[0].name,'แก้รายการที่อนุมัติ');assert.equal(partial.items[1].name,'ปฏิเสธ');
        await as(office,async()=>{const editedReport=await report('2026-10-01');const row=editedReport.rows.find(item=>item.id===partial.id);assert.equal(row.edit_history.length,1);assert.equal(row.edit_history[0].before_items[0].line_no,1);});
        const rejectedLine={...partial.items[1],line_no:2,name:'ห้ามแก้'};
        const second=await unlock(partial.id,partial.version,crypto.randomUUID());
        await assert.rejects(()=>edit(partial.id,partial.version,second.token,[rejectedLine],crypto.randomUUID()));
      });
    });
    await t.test('all rejected is a real rejected PO; terminal states cannot unlock',async()=>{
      let all;
      await as(office,async()=>{all=await create([item('ทั้งหมด','100',false)]);});
      await as(owner,async()=>{
        all=await decide(all.id,all.version,[1],'ยกเลิกทั้งหมด','',crypto.randomUUID());
        assert.equal(all.status,'rejected');assert.equal(all.total_cents,0);assert.equal(all.approval_note,null);
        await assert.rejects(()=>unlock(all.id,all.version,crypto.randomUUID()));
      });
      await as(owner,async()=>{await assert.rejects(()=>unlock(all.id,all.version,crypto.randomUUID()));});
    });
    await t.test('disabled owners cannot unlock; closed lifecycle and notifications remain supported',async()=>{
      let closed;
      await as(office,async()=>{closed=await create([item('เส้นทางเดิม')]);});
      await as(owner,async()=>{closed=await act(closed.id,'approve',closed.version,'',false,crypto.randomUUID());});
      await as(office,async()=>{closed=await act(closed.id,'receive',closed.version,'',false,crypto.randomUUID());});
      await as(owner,async()=>{closed=await act(closed.id,'close',closed.version,'ได้รับใบกำกับภาษี',true,crypto.randomUUID());assert.equal(closed.status,'closed');await assert.rejects(()=>unlock(closed.id,closed.version,crypto.randomUUID()));await assert.rejects(()=>edit(closed.id,closed.version,crypto.randomUUID(),[closed.items[0]],crypto.randomUUID()));});
      await as(office,async()=>{const actions=(await db.query('select action from public.notifications where po_id=$1 order by action',[closed.id])).rows.map(row=>row.action);for(const action of ['approve','close'])assert.ok(actions.includes(action),`legacy ${action} notification remains available`);});
      await as(owner,async()=>assert.ok((await db.query("select count(*) from public.notifications where po_id=$1 and action='receive'",[closed.id])).rows[0].count>0,'legacy receive notification remains available to owner'));
      await asAdmin(()=>db.query('update public.profiles set deleted_at=now() where id=$1',[owner]));
      await as(owner,async()=>await assert.rejects(()=>unlock(closed.id,closed.version,crypto.randomUUID()),/เปิดใช้งาน/));
      await asAdmin(()=>db.query('update public.profiles set deleted_at=null where id=$1',[owner]));
    });
    await as(owner,async()=>{const page=await list('rejected',999,'all');assert.equal(page.rows.length,0);assert.ok(page.total>=2);});
  }finally{await db.close();}
});

