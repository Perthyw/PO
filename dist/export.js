import {monthLabel,statuses,paymentLabels,acceptedItems,ownerAnnotations} from './domain.js';

const editFields={department:'แผนก/สาขา',name:'ชื่อสินค้า',spec:'รายละเอียด / สเปค',source:'แหล่งซื้อ',qty:'จำนวน',unit:'หน่วย',unit_price:'ราคาต่อหน่วย',vat:'ประเภทภาษี',payment_method:'การชำระเงิน',note:'หมายเหตุพนักงาน'};
const fieldValue=(key,value)=>key==='vat'?(value?'VAT 7%':'NON VAT'):key==='payment_method'?(paymentLabels[value]||'ไม่ระบุ'):String(value??'');
const itemDescription=item=>Object.entries(editFields).map(([key,label])=>`${label}: ${fieldValue(key,item?.[key])}`).join('\n');
const lineNumber=(item,index)=>Number(item?.line_no??index+1)||index+1;
const cents=value=>Number(value??0);
const timestamp=value=>{if(!value)return '';const time=new Date(value);return Number.isNaN(time.getTime())?String(value):new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(time);};

function addEditHistory(workbook,rows){
 const sheet=workbook.addWorksheet('ประวัติการแก้ไข',{views:[{state:'frozen',ySplit:1}]});
 sheet.columns=[{header:'เลข PO',key:'po',width:21},{header:'เวลาแก้ไข (กรุงเทพฯ)',key:'at',width:25},{header:'ผู้แก้ไข',key:'actor',width:20},{header:'ลำดับรายการ',key:'line',width:14},{header:'ชื่อสินค้าก่อนแก้',key:'beforeName',width:28},{header:'ชื่อสินค้าหลังแก้',key:'afterName',width:28},{header:'ช่องที่แก้ไข',key:'fields',width:32},{header:'ข้อมูลก่อนแก้ไข',key:'before',width:42},{header:'ข้อมูลหลังแก้ไข',key:'after',width:42},{header:'ยอดรายการก่อนแก้',key:'beforeTotal',width:20},{header:'ยอดรายการหลังแก้',key:'afterTotal',width:20},{header:'ผลต่างยอดรายการ',key:'delta',width:20},{header:'ผลต่างยอด PO (ครั้งเดียวต่อการแก้)',key:'poDelta',width:25}];
 for(const po of rows){
  const history=(po.edit_history??[]).filter(event=>event.action==='owner_edit');
  for(const entry of history){
   const before=entry.before??entry.before_items??[],after=entry.after??entry.after_items??[];
   const oldLines=new Map(before.map((item,index)=>[lineNumber(item,index),item]));
   const newLines=new Map(after.map((item,index)=>[lineNumber(item,index),item]));
   const lines=[...new Set([...oldLines.keys(),...newLines.keys()])].sort((a,b)=>a-b);
   const changedLines=lines.map(line=>({line,old:oldLines.get(line)||{},next:newLines.get(line)||{}})).filter(({old,next})=>Object.keys(editFields).some(key=>fieldValue(key,old[key])!==fieldValue(key,next[key])));
   changedLines.forEach(({line,old,next},index)=>{
    const changed=Object.keys(editFields).filter(key=>fieldValue(key,old[key])!==fieldValue(key,next[key]));
    const beforeTotal=cents(old.total_cents),afterTotal=cents(next.total_cents),lineDelta=afterTotal-beforeTotal;
    const computedPoDelta=lines.reduce((sum,currentLine)=>sum+cents(newLines.get(currentLine)?.total_cents)-cents(oldLines.get(currentLine)?.total_cents),0);
    const poDelta=entry.amount_delta_cents??(entry.after_total_cents!=null&&entry.before_total_cents!=null?cents(entry.after_total_cents)-cents(entry.before_total_cents):computedPoDelta);
    sheet.addRow({po:po.po_number,at:timestamp(entry.at??entry.created_at),actor:entry.actor_name||'',line,beforeName:old.name||'',afterName:next.name||'',fields:changed.map(key=>editFields[key]).join(' / '),before:itemDescription(old),after:itemDescription(next),beforeTotal:beforeTotal/100,afterTotal:afterTotal/100,delta:lineDelta/100,poDelta:index===0?Number(poDelta)/100:null});
   });
  }
 }
 for(const key of ['beforeTotal','afterTotal','delta','poDelta'])sheet.getColumn(key).eachCell((cell,row)=>{if(row>1)cell.numFmt='฿#,##0.00;[Red]-฿#,##0.00';});
 sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF164B49'}};
 sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:sheet.columnCount}};sheet.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};});
}
export async function exportMonthlyExcel(report,month){
 if(!globalThis.ExcelJS)throw Error('ส่วนสร้างไฟล์ Excel โหลดไม่สำเร็จ กรุณารีโหลดหน้าแล้วลองอีกครั้ง');
 const workbook=new ExcelJS.Workbook();workbook.creator='PO The Grands';workbook.created=new Date();
 const summary=workbook.addWorksheet('สรุปรายเดือน',{views:[{state:'frozen',ySplit:4}]});summary.columns=[{width:24},{width:22}];summary.addRow(['PO The Grands']);summary.addRow(['สรุปประจำเดือน',monthLabel(month)]);summary.addRow(['เกณฑ์ยอดสั่งซื้อ','เฉพาะใบที่อนุมัติแล้ว / รับสินค้าแล้ว / ปิดแล้ว']);summary.addRow([]);summary.addRows([['ยอดสั่งซื้อรวม',report.total_cents/100],['จำนวนใบที่อนุมัติแล้ว',report.ordered_count],['รออนุมัติ',report.pending_count],['ไม่อนุมัติ',report.rejected_count]]);summary.getCell('B5').numFmt='฿#,##0.00';summary.getRow(1).font={bold:true,size:18,color:{argb:'FF164B49'}};summary.getRow(2).font={bold:true};summary.getRow(3).font={italic:true,color:{argb:'FF5A6C70'}};
 const items=workbook.addWorksheet('รายการสินค้า',{views:[{state:'frozen',ySplit:1}]});items.columns=[{header:'เลข PO',key:'po',width:21},{header:'วันที่ PO',key:'date',width:14},{header:'ผู้ขอ',key:'requester',width:20},{header:'แผนก/สาขา',key:'department',width:20},{header:'สถานะ',key:'status',width:22},{header:'สินค้า',key:'name',width:28},{header:'รายละเอียด / สเปค',key:'spec',width:38},{header:'แหล่งซื้อ',key:'source',width:28},{header:'การชำระเงิน',key:'paymentMethod',width:18},{header:'หมายเหตุพนักงาน',key:'note',width:32},{header:'หมายเหตุเจ้าของ',key:'ownerNote',width:32},{header:'จำนวน',key:'qty',width:12},{header:'หน่วย',key:'itemUnit',width:14},{header:'ราคาต่อหน่วย',key:'unitPrice',width:16},{header:'ประเภทภาษี',key:'vatType',width:13},{header:'ก่อน VAT',key:'base',width:16},{header:'VAT',key:'tax',width:14},{header:'รวมสุทธิ',key:'total',width:16}];
 for(const po of report.rows){
  for(const item of acceptedItems(po))items.addRow({po:po.po_number,date:po.po_date,requester:po.requester_name,department:item.department||po.department||'',status:statuses[po.status]||po.status,name:item.name,spec:item.spec,source:item.source,paymentMethod:paymentLabels[item.payment_method]||'ไม่ระบุ',note:item.note||'',ownerNote:ownerAnnotations(po).approval_note,qty:Number(item.qty),itemUnit:item.unit||'ชิ้น',unitPrice:Number(item.unit_price),vatType:item.vat?'VAT 7%':'NON VAT',base:item.base_cents/100,tax:item.tax_cents/100,total:item.total_cents/100});
 }
 ['unitPrice','base','tax','total'].forEach(key=>{items.getColumn(key).eachCell((cell,row)=>{if(row>1)cell.numFmt='฿#,##0.00';});});items.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};items.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF164B49'}};items.autoFilter={from:{row:1,column:1},to:{row:1,column:items.columnCount}};items.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};});
 addEditHistory(workbook,report.rows);
 const buffer=await workbook.xlsx.writeBuffer(),blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`PO-The-Grands-${month}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
