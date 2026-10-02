// No persisted Auth client, token logging, or administrative password mutation.
const json=(body:unknown,status=200,origin='')=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}});
const invalidLogin='ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
Deno.serve(async request=>{
  const origin=request.headers.get('origin')||'';
  const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean);
  if(!origin||!allowed.includes(origin))return json({message:'Origin not allowed'},403,'null');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}});
  if(request.method!=='POST')return json({message:'Method not allowed'},405,origin);
  let body;
  try{if(Number(request.headers.get('content-length')||0)>4096)return json({message:'ข้อมูลไม่ถูกต้อง'},400,origin);const raw=await request.text();if(new TextEncoder().encode(raw).length>4096)return json({message:'ข้อมูลไม่ถูกต้อง'},400,origin);body=JSON.parse(raw);}catch{return json({message:'ข้อมูลไม่ถูกต้อง'},400,origin);}
  if(!body||typeof body!=='object'||Array.isArray(body))return json({message:'ข้อมูลไม่ถูกต้อง'},400,origin);
  const action=body.action;
  const fields=action==='login'?['action','username','password']:action==='update-login-name'?['action','username','currentPassword']:action==='change-password'?['action','newPassword','currentPassword']:[];
  if(!fields.length||Object.keys(body).some(key=>!fields.includes(key)))return json({message:'ข้อมูลไม่ถูกต้อง'},400,origin);
  const url=Deno.env.get('SUPABASE_URL')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'',service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  const auth=async(path:string,method:string,token:string,payload?:unknown)=>{
    const response=await fetch(url+'/auth/v1/'+path,{method,headers:{apikey:anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(40000)});
    let data;try{data=await response.json();}catch{data=null;}return {ok:response.ok,data};
  };
  const profiles=async(query:string,method='GET',payload?:unknown)=>{
    const response=await fetch(url+'/rest/v1/profiles?'+query,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',Prefer:'return=representation'},...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(15000)});
    let data;try{data=await response.json();}catch{data=null;}return {ok:response.ok,data};
  };
  const columns='id,role,login_name,login_email,display_name,deleted_at';
  const name=(value:unknown)=>typeof value==='string'?value.trim().toLowerCase():'';
  const validName=(value:string)=>/^[a-z0-9._]{4,50}$/.test(value);
  const logout=async(token:string)=>{try{await auth('logout?scope=local','POST',token);}catch{/* Do not leak cleanup errors or credentials. */}};
  try{
    if(action==='login'){
      const username=name(body.username),password=typeof body.password==='string'?body.password:'';
      if(!validName(username)||!password||password.length>512)return json({message:invalidLogin},400,origin);
      const found=await profiles('select='+columns+'&login_name=eq.'+encodeURIComponent(username)+'&deleted_at=is.null');
      if(!found.ok||!Array.isArray(found.data))return json({message:'เข้าสู่ระบบไม่ได้ กรุณาลองใหม่'},503,origin);
      const profile=found.data.length===1?found.data[0]:null;
      // Missing aliases still use the normal rate-limited Auth path with an unguessable nonexistent email.
      const email=profile?.login_email||'missing-'+crypto.randomUUID()+'@invalid.local';
      const signed=await auth('token?grant_type=password','POST',anon,{email,password});
      if(!signed.ok||!signed.data?.access_token||!signed.data?.refresh_token||!profile||signed.data.user?.id!==profile.id||!['owner','office'].includes(profile.role)){
        if(signed.data?.access_token)await logout(signed.data.access_token);
        return json({message:invalidLogin},400,origin);
      }
      // Recheck authorization after Auth succeeds and revoke any session not handed to the client.
      let handedOff=false;
      try{
        const active=await profiles('select='+columns+'&id=eq.'+encodeURIComponent(profile.id)+'&deleted_at=is.null');
        if(!active.ok||!Array.isArray(active.data)||active.data.length!==1||active.data[0].role!==profile.role)return json({message:invalidLogin},400,origin);
        const session=signed.data;
        handedOff=true;
        return json({access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in,expires_at:session.expires_at,token_type:session.token_type,user:{id:profile.id}},200,origin);
      }finally{if(!handedOff)await logout(signed.data.access_token);}
    }
    const bearer=request.headers.get('authorization')||'';
    if(!/^Bearer [^\s]+$/i.test(bearer))return json({message:'กรุณาเข้าสู่ระบบอีกครั้ง'},401,origin);
    const token=bearer.slice(7),verified=await auth('user','GET',token);
    if(!verified.ok||!verified.data?.id)return json({message:'กรุณาเข้าสู่ระบบอีกครั้ง'},401,origin);
    const id=verified.data.id,found=await profiles('select='+columns+'&id=eq.'+encodeURIComponent(id)+'&deleted_at=is.null');
    if(!found.ok||!Array.isArray(found.data))return json({message:'ตรวจบัญชีไม่ได้'},503,origin);
    const owner=found.data.length===1?found.data[0]:null;
    if(!owner||owner.role!=='owner')return json({message:'เฉพาะเจ้าของบัญชีเท่านั้น'},403,origin);
    const currentPassword=typeof body.currentPassword==='string'?body.currentPassword:'';
    if(!currentPassword||currentPassword.length>512)return json({message:'กรุณาระบุรหัสผ่านปัจจุบัน'},400,origin);
    const username=name(body.username),password=typeof body.newPassword==='string'?body.newPassword:'';
    if(action==='update-login-name'&&!validName(username))return json({message:'ชื่อเข้าระบบใช้ตัวอังกฤษ ตัวเลข จุด หรือขีดล่าง 4–50 ตัว'},400,origin);
    if(action==='change-password'&&(password.length<6||password.length>512))return json({message:'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'},400,origin);
    const reauth=await auth('token?grant_type=password','POST',anon,{email:verified.data.email,password:currentPassword});
    if(!reauth.ok||!reauth.data?.access_token)return json({message:'รหัสผ่านปัจจุบันไม่ถูกต้อง'},400,origin);
    const fresh=reauth.data.access_token;
    try{
      if(reauth.data.user?.id!==id)return json({message:'ตรวจบัญชีไม่ได้'},403,origin);
      if(action==='change-password'){
        const activeOwner=await profiles('select=id,role&id=eq.'+encodeURIComponent(id)+'&role=eq.owner&deleted_at=is.null');
        if(!activeOwner.ok||!Array.isArray(activeOwner.data)||activeOwner.data.length!==1||activeOwner.data[0].role!=='owner')return json({message:'ตรวจบัญชีไม่ได้'},403,origin);
        const updated=await auth('user','PUT',fresh,{password,current_password:currentPassword});
        if(!updated.ok||updated.data?.id!==id)return json({message:'เปลี่ยนรหัสผ่านไม่ได้ กรุณาลองใหม่'},400,origin);
        return json({success:true},200,origin);
      }
      const duplicate=await profiles('select=id&or=(login_name.eq.'+encodeURIComponent(username)+',login_email.eq.'+encodeURIComponent(username+'@po.thegrands.local')+')');
      if(!duplicate.ok||!Array.isArray(duplicate.data))return json({message:'ตรวจชื่อเข้าระบบไม่ได้'},503,origin);
      if(duplicate.data.some((row:{id:string})=>row.id!==id))return json({message:'ชื่อเข้าระบบนี้ถูกใช้แล้ว'},409,origin);
      const saved=await profiles('id=eq.'+encodeURIComponent(id)+'&role=eq.owner&deleted_at=is.null&select=login_name,display_name','PATCH',{login_name:username});
      if(!saved.ok||!Array.isArray(saved.data)||saved.data.length!==1)return json({message:'บันทึกชื่อเข้าระบบไม่ได้ กรุณาลองใหม่'},409,origin);
      return json({user:{id,login_name:saved.data[0].login_name,display_name:saved.data[0].display_name,role:'owner'}},200,origin);
    }finally{await logout(fresh);}
  }catch{return json({message:'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่'},503,origin);}
});
