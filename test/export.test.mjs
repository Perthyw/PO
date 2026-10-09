import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {exportMonthlyExcel} from '../dist/export.js';
import {validateItems} from '../dist/domain.js';
const require=createRequire(import.meta.url);

async function captureWorkbook(report){
 const module={exports:{}};
 vm.runInThisContext('(function(module,exports,require){'+await readFile(new URL('../dist/vendor/exceljs.min.js',import.meta.url),'utf8')+'\n})')(module,module.exports,require);
 const ExcelJS=module.exports,saved={ExcelJS:globalThis.ExcelJS,document:globalThis.document,setTimeout:globalThis.setTimeout,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 let blob,filename;
 globalThis.ExcelJS=ExcelJS;globalThis.setTimeout=fn=>{fn();return 0;};URL.createObjectURL=value=>{blob=value;return 'blob:test';};URL.revokeObjectURL=()=>{};
 globalThis.document={body:{append(){}},createElement(){return {click(){filename=this.download;},remove(){}};}};
 try{await exportMonthlyExcel(report,'2026-10');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await blob.arrayBuffer());return {workbook,filename};}
 finally{globalThis.ExcelJS=saved.ExcelJS;globalThis.document=saved.document;globalThis.setTimeout=saved.setTimeout;URL.createObjectURL=saved.create;URL.revokeObjectURL=saved.revoke;}
}
const item=(overrides={})=>({line_no:1,department:'อาหาร',name:'รายการล่าสุด',spec:'สเปคใหม่',source:'ร้านใหม่',note:'หมายเหตุพนักงานใหม่',payment_method:'credit',qty:'2',unit:'กล่อง',unit_price:'120.00',vat:true,base_cents:22430,tax_cents:1570,total_cents:24000,...overrides});

test('Excel preserves legacy approval notes without overwriting staff notes',async()=>{
 const po={id:'legacy-note',po_number:'LEGACY-1',po_date:'2026-10-09',requester_name:'ออฟฟิศ',status:'approved',items:[item()],events:[{action:'approve',reason:'วางที่ออฟฟิศ'}]};
 const {workbook}=await captureWorkbook({rows:[po],total_cents:24000,ordered_count:1,pending_count:0,rejected_count:0});
 const sheet=workbook.getWorksheet('รายการสินค้า');
 assert.equal(sheet.getCell('J2').value,'หมายเหตุพนักงานใหม่');
 assert.equal(sheet.getCell('K2').value,'วางที่ออฟฟิศ');
 assert.equal(po.approval_note,undefined);
});

test('actual Excel export preserves payment labels, item formats, and unchanged monthly total',async()=>{
 const sample={name:'กระดาษ',spec:'A4',source:'ร้านทดสอบ',qty:'1',unit:'รีม',unit_price:'3000',vat:true};
 const items=validateItems([{...sample,payment_method:'credit'},{...sample,payment_method:'cash'},sample]);
 const {workbook,filename}=await captureWorkbook({total_cents:900000,ordered_count:1,pending_count:0,rejected_count:0,rows:[{po_number:'TEST-ONLY',po_date:'2026-10-03',requester_name:'ทดสอบ',status:'approved',items}]});
 assert.equal(filename,'PO-The-Grands-2026-10.xlsx');
 const sheet=workbook.getWorksheet('รายการสินค้า'),headers=sheet.getRow(1).values,payment=headers.indexOf('การชำระเงิน');
 assert.deepEqual([2,3,4].map(row=>sheet.getCell(row,payment).value),['เครดิต','เงินสด','ไม่ระบุ']);
 for(const label of ['ราคาต่อหน่วย','ก่อน VAT','VAT','รวมสุทธิ'])assert.equal(sheet.getCell(2,headers.indexOf(label)).numFmt,'฿#,##0.00');
 assert.equal(sheet.getCell(2,headers.indexOf('รวมสุทธิ')).value,3000);assert.equal(workbook.getWorksheet('สรุปรายเดือน').getCell('B5').value,9000);
 assert.equal(sheet.autoFilter,'A1:R1');assert.equal(sheet.columnCount,18);
});

test('actual Excel readback exports current accepted items and a separate owner edit audit',async()=>{
 const old1=item({name:'ก่อนแก้',spec:'ก่อนสเปค',source:'ร้านเดิม',note:'หมายเหตุเดิม',payment_method:'cash',qty:'1',unit:'ชิ้น',unit_price:'100.00',vat:true,base_cents:9346,tax_cents:654,total_cents:10000});
 const latest1=item();
 const old2=item({line_no:2,department:'ออฟฟิศ',name:'อุปกรณ์เดิม',spec:'รุ่นเดิม',source:'ร้านเดิม',note:'โน้ตสอง',payment_method:'cash',qty:'1',unit:'ชิ้น',unit_price:'1000',vat:false,base_cents:100000,tax_cents:0,total_cents:100000});
 const latest2={...old2,name:'อุปกรณ์อัปเดต',note:'โน้ตอัปเดต'};
 const lifecycle={action:'approve',actor_name:'เจ้าของ',at:'2026-10-06T01:00:00Z',reason:'อนุมัติ'};
 const approved={po_number:'TEST-EDIT',po_date:'2026-10-03',requester_name:'พนักงาน',department:'หลายแผนก/สาขา',status:'approved',approval_note:'หมายเหตุเจ้าของแยกช่อง',total_cents:124000,items:[latest1,latest2],events:[lifecycle],edit_history:[
  {action:'owner_edit',actor_name:'เจ้าของหนึ่ง',at:'2026-10-05T03:04:05Z',amount_delta_cents:14000,before:[old1,old2],after:[latest1,latest2]},
  {action:'owner_edit',actor_name:'เจ้าของสอง',at:'2026-10-06T05:06:07Z',amount_delta_cents:0,before_items:[{...latest1,spec:'รายละเอียดก่อนรอบสอง',source:'ร้านก่อนรอบสอง',department:'เดิม',unit:'ถุง',payment_method:'cash',note:'โน้ตก่อน',vat:false,base_cents:24000,tax_cents:0}],after_items:[{...latest1,department:'อาหาร',spec:'สเปคใหม่',source:'ร้านใหม่',unit:'กล่อง',payment_method:'credit',note:'หมายเหตุพนักงานใหม่',vat:true}]}
 ]};
 const partial={po_number:'TEST-PARTIAL',po_date:'2026-10-04',requester_name:'พนักงาน',status:'approved',items:[item({line_no:1,name:'รายการที่อนุมัติ',decision:'approved'}),item({line_no:2,name:'ห้ามส่งออก ราคาลับ',decision:'rejected',unit_price:'999999',base_cents:99999900,tax_cents:6999993,total_cents:106999893})]};
 const legacyRejected={po_number:'TEST-LEGACY-REJECT',po_date:'2026-10-05',requester_name:'พนักงาน',status:'rejected',items:[item({name:'legacy ห้ามส่งออก',unit_price:'888888',total_cents:88888800})],edit_history:[{action:'owner_edit',actor_name:'เจ้าของเก่า',at:'2026-10-07T02:00:00Z',amount_delta_cents:100,before:[item({name:'ชื่อก่อน',unit_price:'887888',total_cents:88788800})],after:[item({name:'ชื่อหลัง',unit_price:'887889',total_cents:88788900})]}],events:[{...lifecycle,action:'reject'}]};
 const {workbook}=await captureWorkbook({total_cents:148000,ordered_count:2,pending_count:0,rejected_count:1,rows:[approved,partial,legacyRejected]});
 const itemsSheet=workbook.getWorksheet('รายการสินค้า'),headers=itemsSheet.getRow(1).values,cell=(row,label)=>itemsSheet.getCell(row,headers.indexOf(label)).value;
 assert.equal(itemsSheet.columnCount,18);assert.equal(itemsSheet.autoFilter,'A1:R1');assert.equal(workbook.getWorksheet('สรุปรายเดือน').getCell('B5').value,1480);
 assert.equal(itemsSheet.rowCount,4);assert.deepEqual([cell(2,'สินค้า'),cell(3,'สินค้า'),cell(4,'สินค้า')],['รายการล่าสุด','อุปกรณ์อัปเดต','รายการที่อนุมัติ']);
 assert.equal(cell(2,'จำนวน'),2);assert.equal(cell(2,'ราคาต่อหน่วย'),120);assert.equal(cell(2,'ประเภทภาษี'),'VAT 7%');assert.equal(cell(2,'แผนก/สาขา'),'อาหาร');
 assert.equal(cell(2,'หมายเหตุพนักงาน'),'หมายเหตุพนักงานใหม่');assert.equal(cell(2,'หมายเหตุเจ้าของ'),'หมายเหตุเจ้าของแยกช่อง');
 assert.equal(cell(3,'หมายเหตุพนักงาน'),'โน้ตอัปเดต');assert.equal(cell(3,'ประเภทภาษี'),'NON VAT');assert.equal(cell(3,'VAT'),0);assert.equal(cell(3,'รวมสุทธิ'),1000);assert.equal(itemsSheet.getCell(2,headers.indexOf('ราคาต่อหน่วย')).numFmt,'฿#,##0.00');
 assert.ok(!itemsSheet.model.rows.some(row=>JSON.stringify(row).includes('ห้ามส่งออก')));assert.ok(!itemsSheet.model.rows.some(row=>JSON.stringify(row).includes('999999')));
 const history=workbook.getWorksheet('ประวัติการแก้ไข'),h=history.getRow(1).values,hcell=(row,label)=>history.getCell(row,h.indexOf(label)).value;
 assert.equal(history.rowCount,5);assert.equal(history.autoFilter,`A1:M1`);
 assert.deepEqual([hcell(2,'ลำดับรายการ'),hcell(3,'ลำดับรายการ'),hcell(4,'ลำดับรายการ')],[1,2,1]);
 assert.deepEqual([hcell(2,'ผู้แก้ไข'),hcell(4,'ผู้แก้ไข'),hcell(5,'ผู้แก้ไข')],['เจ้าของหนึ่ง','เจ้าของสอง','เจ้าของเก่า']);
 assert.match(hcell(2,'เวลาแก้ไข (กรุงเทพฯ)'),/2569/);assert.match(hcell(2,'ช่องที่แก้ไข'),/ชื่อสินค้า/);assert.match(hcell(2,'ช่องที่แก้ไข'),/จำนวน/);assert.match(hcell(2,'ช่องที่แก้ไข'),/ราคาต่อหน่วย/);
 assert.match(hcell(4,'ช่องที่แก้ไข'),/รายละเอียด \/ สเปค/);assert.match(hcell(4,'ช่องที่แก้ไข'),/การชำระเงิน/);assert.match(hcell(4,'ช่องที่แก้ไข'),/หมายเหตุพนักงาน/);
 assert.match(hcell(2,'ข้อมูลก่อนแก้ไข'),/สินค้า: ก่อนแก้/);assert.match(hcell(2,'ข้อมูลหลังแก้ไข'),/สินค้า: รายการล่าสุด/);assert.equal(hcell(2,'ผลต่างยอดรายการ'),140);assert.equal(hcell(3,'ผลต่างยอดรายการ'),0);
 assert.equal(hcell(2,'ผลต่างยอด PO (ครั้งเดียวต่อการแก้)'),140);assert.equal(hcell(3,'ผลต่างยอด PO (ครั้งเดียวต่อการแก้)'),null);assert.equal(hcell(4,'ผลต่างยอด PO (ครั้งเดียวต่อการแก้)'),0);assert.equal(hcell(5,'ผลต่างยอด PO (ครั้งเดียวต่อการแก้)'),1);
 for(const label of ['ยอดรายการก่อนแก้','ยอดรายการหลังแก้','ผลต่างยอดรายการ','ผลต่างยอด PO (ครั้งเดียวต่อการแก้)'])assert.equal(history.getCell(2,h.indexOf(label)).numFmt,'฿#,##0.00;[Red]-฿#,##0.00');
 assert.ok(!history.model.rows.some(row=>JSON.stringify(row).includes('reject')));
});
