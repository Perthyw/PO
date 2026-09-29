import {createClient} from 'npm:@supabase/supabase-js@2';

const json=(body:unknown,status=200,origin='')=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}});

Deno.serve(async request=>{
  const origin=request.headers.get('origin')||'';
  const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(v=>v.trim()).filter(Boolean);
  if(!origin||!allowed.includes(origin))return json({message:'Origin not allowed'},403,'null');
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}});
  if(request.method!=='POST')return json({message:'Method not allowed'},405,origin);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,authorization=request.headers.get('authorization')||'';
  const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}}),admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return json({message:'กรุณาเข้าสู่ระบบอีกครั้ง'},401,origin);
  const {data:owner}=await admin.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(owner?.role!=='owner')return json({message:'เฉพาะเจ้าของเท่านั้นที่จัดการผู้ใช้งานได้'},403,origin);
  let body;try{body=await request.json();}catch{return json({message:'ข้อมูลไม่ถูกต้อง'},400,origin);}
  if(body.action==='list'){
    const {data,error}=await admin.from('profiles').select('id,login_email,login_name,display_name,role,can_export_report').eq('role','office').is('deleted_at',null).order('display_name');
    if(error)return json({message:'โหลดผู้ใช้งานไม่ได้'},500,origin);
    return json({users:data},200,origin);
  }
  if(body.action==='delete'){
    const id=String(body.profile_id||'');
    if(!id||id===user.id)return json({message:'ไม่สามารถลบบัญชีนี้ได้'},400,origin);
    const {data:target}=await admin.from('profiles').select('id,role,login_email').eq('id',id).eq('role','office').is('deleted_at',null).maybeSingle();
    if(!target)return json({message:'ไม่พบบัญชีออฟฟิศที่ต้องการลบ'},404,origin);
    const {error:authError}=await admin.auth.admin.updateUserById(id,{ban_duration:'876000h'});
    if(authError)return json({message:'ปิดบัญชีเข้าสู่ระบบไม่ได้'},400,origin);
    const tombstone=`deleted-${id}@invalid.local`;
    const {error:profileError}=await admin.from('profiles').update({login_email:tombstone,login_name:null,deleted_at:new Date().toISOString()}).eq('id',id);
    if(profileError)return json({message:'บันทึกสถานะบัญชีที่ลบไม่ได้'},500,origin);
    return json({user:{id,display_name:'',role:'office',deleted:true}},200,origin);
  }
  if(body.action!=='upsert')return json({message:'คำสั่งไม่ถูกต้อง'},400,origin);
  const loginName=String(body.username||'').trim().toLowerCase(),email=loginName+'@po.thegrands.local',displayName=String(body.display_name||loginName).trim(),password=String(body.password||''),canExportReport=body.can_export_report===true;
  if(!/^[a-z0-9._]{4,50}$/.test(loginName)||displayName.length<1||displayName.length>100)return json({message:'ชื่อผู้ใช้ใช้ตัวอังกฤษ ตัวเลข จุด หรือขีดล่าง 4–50 ตัว และระบุชื่อที่แสดง'},400,origin);
  const {data:existing}=body.profile_id?await admin.from('profiles').select('id,login_email,login_name').eq('id',String(body.profile_id)).is('deleted_at',null).maybeSingle():await admin.from('profiles').select('id,login_email,login_name').eq('login_name',loginName).is('deleted_at',null).maybeSingle();
  let id=existing?.id;
  if(id){
    if(password.length>0&&password.length<6)return json({message:'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'},400,origin);
    const update:Record<string,string|boolean>={email,email_confirm:true};
    if(password)update.password=password;
    const {error}=await admin.auth.admin.updateUserById(id,update);
    if(error)return json({message:password?'เปลี่ยนรหัสผ่านไม่ได้':'เปลี่ยนอีเมลไม่ได้'},400,origin);
  }else{
    if(password.length<6)return json({message:'บัญชีใหม่ต้องใช้รหัสผ่านอย่างน้อย 6 ตัวอักษร'},400,origin);
    const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true});
    if(error||!data.user)return json({message:error?.message||'สร้างบัญชีไม่ได้'},400,origin);
    id=data.user.id;
  }
  const {error:profileError}=await admin.from('profiles').upsert({id,login_email:email,login_name:loginName,display_name:displayName,role:'office',can_export_report:canExportReport,deleted_at:null},{onConflict:'id'});
  if(profileError)return json({message:'บันทึกสิทธิ์ผู้ใช้ไม่ได้'},500,origin);
  return json({user:{id,username:loginName,login_name:loginName,display_name:displayName,role:'office',can_export_report:canExportReport}},200,origin);
});
