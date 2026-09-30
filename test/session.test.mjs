import test from 'node:test';
import assert from 'node:assert/strict';
import {config} from '../dist/config.js';
import {api} from '../dist/api.js';

test('Supabase session persists, restores with profile, refreshes, and clears disabled profiles',async()=>{
  const originalFetch=globalThis.fetch;
  const originalStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const originalUrl=config.supabaseUrl,originalKey=config.publishableKey;
  const values=new Map();
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  config.supabaseUrl='https://example.supabase.co';
  config.publishableKey='test-public-key';
  let profileActive=true,profileNetworkError=false,refreshCount=0,profileReads=0;
  globalThis.fetch=async(url,init)=>{
    if(url.includes('grant_type=password'))return Response.json({access_token:'initial-access',refresh_token:'initial-refresh',expires_in:3600,user:{id:'office'}});
    if(url.includes('grant_type=refresh_token')){refreshCount++;return Response.json({access_token:'renewed-access',refresh_token:'renewed-refresh',expires_in:3600,user:{id:'office'}});}
    if(url.includes('/profiles?')){profileReads++;if(profileNetworkError)throw Error('offline');assert.equal(init.headers.Authorization,`Bearer ${refreshCount?'renewed-access':'initial-access'}`);return Response.json(profileActive?[{id:'office',role:'office',display_name:'ออฟฟิศ'}]:[]);}
    if(url.includes('/logout'))return Response.json({});
    throw Error(`Unexpected request: ${url}`);
  };
  try{
    await api.logout();
    assert.equal(await api.restoreSession(),null);
    assert.equal((await api.login('qa.office03','test-password')).id,'office');
    const saved=JSON.parse(values.get('po-the-grands-supabase-session-v1'));
    assert.equal(saved.refresh_token,'initial-refresh');

    // Simulate page reload with an access token close to expiry.
    saved.expires_at=Date.now()/1000+30;
    values.set('po-the-grands-supabase-session-v1',JSON.stringify(saved));
    const restored=await api.restoreSession();
    assert.equal(restored.role,'office');
    assert.equal(refreshCount,1);
    assert.equal(JSON.parse(values.get('po-the-grands-supabase-session-v1')).access_token,'renewed-access');

    // A network outage while restoring must report an error and preserve the session for retry.
    profileNetworkError=true;
    await assert.rejects(()=>api.restoreSession(),/เชื่อมต่อไม่ได้/);
    assert.equal(JSON.parse(values.get('po-the-grands-supabase-session-v1')).access_token,'renewed-access');
    profileNetworkError=false;

    // A banned account has no active profile, so a reload must clear its stored session.
    profileActive=false;
    assert.equal(await api.restoreSession(),null);
    assert.equal(values.has('po-the-grands-supabase-session-v1'),false);
    assert.equal(profileReads,4);
  }finally{
    globalThis.fetch=originalFetch;
    config.supabaseUrl=originalUrl;
    config.publishableKey=originalKey;
    if(originalStorage)Object.defineProperty(globalThis,'localStorage',originalStorage);
    else delete globalThis.localStorage;
  }
});
