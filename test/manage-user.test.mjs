import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const source=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/manage-user/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/,''));
const ownerId='11111111-1111-4111-8111-111111111111';
const officeId='22222222-2222-4222-8222-222222222222';
async function invoke(body,{target=null,conflict=null,lookupError=null,caller='owner',authenticated=true}={}){
  let handler,reads=0;const writes=[];
  const admin={auth:{admin:{updateUserById:async(...v)=>{writes.push(['auth-update',...v]);return {error:null};},createUser:async v=>{writes.push(['auth-create',v]);return {data:{user:{id:officeId}},error:null};}}},from(){
    let mutation=false;const q={select(){return q;},eq(){return q;},is(){return q;},order(){return q;},update(v){writes.push(['profile-update',v]);mutation=true;return q;},insert(v){writes.push(['profile-insert',v]);mutation=true;return q;},async single(){return {data:{id:officeId},error:null};},async maybeSingle(){if(mutation)return {data:{id:officeId},error:null};reads++;return reads===1?{data:{role:caller},error:null}:reads===2?{data:target,error:lookupError}:{data:conflict,error:null};},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}};return q;}};
  const userClient={auth:{getUser:async()=>({data:{user:authenticated?{id:ownerId}:null},error:null})}};
  vm.runInNewContext(source,{Response,createClient:(_url,key)=>key==='service'?admin:userClient,Deno:{env:{get:k=>({ALLOWED_ORIGINS:'https://po-thegrands.vercel.app',SUPABASE_SERVICE_ROLE_KEY:'service',SUPABASE_ANON_KEY:'anon',SUPABASE_URL:'https://example.invalid'}[k])},serve:fn=>handler=fn}});
  const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{origin:'https://po-thegrands.vercel.app','content-type':'application/json'},body:JSON.stringify(body)}));
  return {status:response.status,writes};
}
const upsert={action:'upsert',username:'purchase.test',password:'123456'};
for(const [label,body,target,status] of [
 ['owner ID',{...upsert,profile_id:ownerId},{id:ownerId,role:'owner'},403],
 ['another owner ID',{...upsert,profile_id:officeId},{id:officeId,role:'owner'},403],
 ['owner login name',upsert,{id:ownerId,role:'owner'},403],
 ['disabled office',{...upsert,profile_id:officeId},{id:officeId,role:'office',deleted_at:'2026-01-01'},403],
 ['missing explicit ID',{...upsert,profile_id:officeId},null,404],
 ['invalid explicit ID',{...upsert,profile_id:''},null,400],
 ['owner deletion',{action:'delete',profile_id:ownerId},null,400],
 ['null payload',null,null,400]]){
 test(`rejects ${label} before any write`,async()=>{const r=await invoke(body,{target});assert.equal(r.status,status);assert.deepEqual(r.writes,[]);});
}
test('lookup error fails closed',async()=>{const r=await invoke(upsert,{lookupError:{message:'offline'}});assert.equal(r.status,500);assert.deepEqual(r.writes,[]);});
test('rename collision prevents Auth write',async()=>{const r=await invoke({...upsert,profile_id:officeId},{target:{id:officeId,role:'office'},conflict:{id:ownerId,role:'owner'}});assert.equal(r.status,409);assert.deepEqual(r.writes,[]);});
test('office edit preserves role',async()=>{const r=await invoke({...upsert,profile_id:officeId},{target:{id:officeId,role:'office'}});assert.equal(r.status,200);assert.equal(r.writes[0][0],'auth-update');assert.equal(r.writes[1][0],'profile-update');assert.equal('role' in r.writes[1][1],false);});
test('new office uses insert',async()=>{const r=await invoke(upsert);assert.equal(r.status,200);assert.equal(r.writes[1][0],'profile-insert');assert.equal(r.writes[1][1].role,'office');});
test('non-owner cannot manage users',async()=>{const r=await invoke(upsert,{caller:'office'});assert.equal(r.status,403);assert.deepEqual(r.writes,[]);});
test('unauthenticated cannot manage users',async()=>{const r=await invoke(upsert,{authenticated:false});assert.equal(r.status,401);assert.deepEqual(r.writes,[]);});
