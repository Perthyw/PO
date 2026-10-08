const STORAGE_KEY='po-the-grands-preview-baseline-v1-revision-requests';

function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
 return value;
}
export function revisionItemFingerprint(item){return JSON.stringify(stable(item));}

export function createRevisionRequestStore(storage=globalThis.localStorage,now=()=>new Date().toISOString(),id=()=>crypto.randomUUID()){
 function read(){
  let raw;
  try{raw=storage.getItem(STORAGE_KEY);}catch{throw Error('อ่านคำขอแก้ไขจากเบราว์เซอร์ไม่ได้');}
  if(raw===null)return [];
  try{const value=JSON.parse(raw);if(!Array.isArray(value))throw Error();return value;}catch{throw Error('ข้อมูลคำขอแก้ไขเสียหาย กรุณาติดต่อผู้ดูแล');}
 }
 function write(records){
  try{storage.setItem(STORAGE_KEY,JSON.stringify(records));}catch{throw Error('บันทึกคำขอแก้ไขไม่ได้ กรุณาตรวจพื้นที่จัดเก็บข้อมูล');}
 }
 function forPO(poId){return read().find(record=>record.po_id===poId&&record.state==='pending')||null;}
 function create({po,actor,expectedVersion,selected,reason,requestKey}){
  if(!actor||actor.role!=='office'||po.created_by!==actor.id)throw Error('เฉพาะออฟฟิศเจ้าของใบ PO นี้ส่งคำขอแก้ไขได้');
  if(!['pending','approved'].includes(po.status))throw Error('ส่งคำขอแก้ไขได้เฉพาะใบ PO ที่รออนุมัติหรืออนุมัติแล้ว');
  if(!Number.isInteger(expectedVersion)||po.version!==expectedVersion)throw Error('ข้อมูลใบ PO เปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด');
  const cleanReason=String(reason||'').trim();
  if(!cleanReason)throw Error('กรุณาระบุเหตุผลที่ขอแก้ไข');
  if(cleanReason.length>2000)throw Error('เหตุผลต้องไม่เกิน 2,000 ตัวอักษร');
  if(!Array.isArray(selected)||selected.length===0)throw Error('เลือกสินค้าอย่างน้อย 1 รายการ');
  if(!requestKey||typeof requestKey!=='string')throw Error('คำขอไม่ถูกต้อง กรุณาลองใหม่');
  const fingerprints=new Set();
  const items=selected.map(entry=>{
   const index=Number(entry.index),item=po.items[index];
   if(!Number.isInteger(index)||index<0||!item)throw Error('รายการสินค้าที่เลือกไม่ถูกต้อง');
   const fingerprint=revisionItemFingerprint(item);
   if(fingerprint!==entry.fingerprint)throw Error('รายการสินค้าเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด');
   if(fingerprints.has(String(index)))throw Error('มีรายการสินค้าซ้ำในคำขอ');
   fingerprints.add(String(index));
   return {index,fingerprint,item:structuredClone(item)};
  });
  const records=read(),payloadFingerprint=JSON.stringify(stable({po_id:po.id,actor_id:actor.id,expectedVersion,items:items.map(({index,fingerprint})=>({index,fingerprint})),reason:cleanReason}));
  const retry=records.find(record=>record.request_key===requestKey);
  if(retry){if(retry.payload_fingerprint!==payloadFingerprint)throw Error('รหัสคำขอนี้ถูกใช้กับข้อมูลอื่นแล้ว');return structuredClone(retry);}
  if(records.some(record=>record.po_id===po.id&&record.state==='pending'))throw Error('ใบ PO นี้มีคำขอแก้ไขที่รอพิจารณาอยู่แล้ว');
  const record={id:id(),request_key:requestKey,payload_fingerprint:payloadFingerprint,po_id:po.id,po_number:po.po_number,creator_id:po.created_by,requester_name:actor.display_name,po_version:po.version,selected_items:items,reason:cleanReason,created_at:now(),state:'pending'};
  write([...records,record]);
  return structuredClone(record);
 }
 return Object.freeze({forPO,hasActive:poId=>Boolean(forPO(poId)),create,list:()=>structuredClone(read())});
}

export const revisionRequestStorageKey=STORAGE_KEY;
