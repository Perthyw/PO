import {createPreviewService,previewStorageKey} from './preview-workflow.js';
import {createPreviewFixtures} from './preview-fixtures.js';
const notificationKey='po-the-grands-preview-notifications-v2';
let actor=null;
const getNotices=()=>{try{return JSON.parse(localStorage.getItem(notificationKey)||'[]')}catch{return [];}};
function addNotice(po,action,sourceActor){
 const map={
  create:['มีใบขอซื้อใหม่',`${sourceActor.display_name} เปิด ${po.po_number}`],
  approve:['ใบขอซื้อได้รับอนุมัติ',`${po.po_number} ได้รับอนุมัติแล้ว`],
  approve_all:['ใบขอซื้อได้รับอนุมัติ',`${po.po_number} ได้รับอนุมัติแล้ว`],
  approve_item:['รายการได้รับอนุมัติ',`${po.po_number} มีรายการได้รับอนุมัติ`],
  reject:['ใบขอซื้อไม่อนุมัติ',`${po.po_number} ไม่ได้รับการอนุมัติ`],
  reject_item:['รายการไม่อนุมัติ',`${po.po_number} มีรายการไม่อนุมัติ`],
  reject_all:['ใบขอซื้อไม่อนุมัติ',`${po.po_number} ไม่ได้รับการอนุมัติ`],
  return_item:['รายการส่งกลับแก้ไข',`${po.po_number} มีรายการส่งกลับแก้ไข`],
  receive:['ได้รับสินค้าแล้ว',`${sourceActor.display_name} ยืนยันรับสินค้า ${po.po_number}`],
  receive_all:['ได้รับสินค้าแล้ว',`${sourceActor.display_name} ยืนยันรับสินค้า ${po.po_number}`],
  receive_item:['ได้รับสินค้าแล้ว',`${sourceActor.display_name} ยืนยันรับสินค้าบางรายการใน ${po.po_number}`],
  close:['ปิดใบ PO แล้ว',`${po.po_number} ตรวจรับเอกสารและปิดแล้ว`],
  request_revision:['มีคำขอแก้ไขรายการ',`${po.po_number} ขอพักการอนุมัติรายการ`],
  resubmit:['มีรายการส่งอนุมัติใหม่',`${po.po_number} ส่งรายการแก้ไขแล้ว`],
  unlock_item:['ปลดล็อกรายการแก้ไข',`${po.po_number} ปลดล็อกรายการให้แก้ไขแล้ว`],
  refuse_revision:['คำขอแก้ไขไม่ได้รับอนุมัติ',`${po.po_number} คืนสถานะเดิมของรายการ`]
 }[action];
 if(!map)return;
 const notices=getNotices(),key=`${po.id}:${action}:${po.version}`;
 if(notices.some(n=>n.event_key===key))return;
 const ownerRecipient=['create','receive','receive_all','receive_item','request_revision','resubmit'].includes(action);
 notices.unshift({id:key,event_key:key,po_id:po.id,recipient_role:ownerRecipient?'owner':'office',recipient_id:ownerRecipient?null:po.created_by,title:map[0],message:map[1],action,created_at:new Date().toISOString(),read_at:null});
 try{localStorage.setItem(notificationKey,JSON.stringify(notices.slice(0,100)));}catch{/* Workflow is committed already; notice storage failure must not make a retry duplicate the command. */}
}
export function createPreviewAdapter({storage=globalThis.localStorage}={}){
 const workflow=createPreviewService({storage,fixtures:createPreviewFixtures()});
 const setActor=next=>{actor=next;};
 const list=async(status='',page=1,scope='all')=>workflow.list(actor,status,page,scope);
 const stats=async(scope='all')=>workflow.stats(actor,scope);
 const detail=async id=>workflow.load(id,actor);
 const create=async(items,poDate,key,actorArg)=>{const user=actorArg||actor,result=workflow.create(items,{actor:user,poDate,key});addNotice(result,'create',user);return result;};
 const action=async(po,actionName,reason='',confirmed=false,key=crypto.randomUUID(),user=actor,itemId=null,fields=null)=>{const actionMap={approve:'approve_all',approve_all:'approve_all',reject_all:'reject_all',approve_item:'approve_item',return_item:'return_item',reject_item:'reject_item',request_revision:'request_revision',unlock_item:'unlock_item',refuse_revision:'refuse_revision',receive:'receive_all',receive_all:'receive_all',receive_item:'receive_item',resubmit:'resubmit',close:'close'};const normalized=actionMap[actionName]||actionName;const result=workflow.mutate(po.id,normalized,{actor:user,itemId,reason,confirmed,key,expectedVersion:po.version,fields});addNotice(result,actionName,user);return result;};
 const report=async month=>workflow.report(month,actor);
 const departments=async()=>['อาหาร','ของหวาน','ผลไม้','ติ่มซำ','แซนวิช','สลัด','ครัวกลาง','แม่บ้าน','ออฟฟิศ','ช่าง','ภูดอย','บ้านโจ้','ท่ารั้ว'];
 const notifications=async()=>getNotices().filter(n=>actor?.role==='owner'?n.recipient_role==='owner':n.recipient_id===actor?.id);
 const markNotificationsRead=async()=>{const rows=getNotices(),ids=new Set((await notifications()).map(n=>n.id)),now=new Date().toISOString();for(const row of rows)if(ids.has(row.id)&&!row.read_at)row.read_at=now;try{localStorage.setItem(notificationKey,JSON.stringify(rows));}catch{}};
 const reset=()=>{workflow.reset();try{localStorage.removeItem(notificationKey);}catch{}};
 const notice=()=>workflow.notice();
 return {workflow,setActor,list,stats,detail,create,action,report,departments,notifications,markNotificationsRead,reset,notice,storageKey:previewStorageKey};
}
