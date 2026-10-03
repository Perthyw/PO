import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {exportMonthlyExcel} from '../dist/export.js';
import {validateItems} from '../dist/domain.js';
const require=createRequire(import.meta.url);
test('actual Excel export includes cash credit and unspecified with unchanged currency formatting',async()=>{
 const module={exports:{}};vm.runInThisContext('(function(module,exports,require){'+await readFile(new URL('../dist/vendor/exceljs.min.js',import.meta.url),'utf8')+'\n})')(module,module.exports,require);const ExcelJS=module.exports;
 const saved={ExcelJS:globalThis.ExcelJS,document:globalThis.document,setTimeout:globalThis.setTimeout,create:URL.createObjectURL,revoke:URL.revokeObjectURL};
 let blob,filename;
 globalThis.ExcelJS=ExcelJS;globalThis.setTimeout=fn=>{fn();return 0;};URL.createObjectURL=b=>{blob=b;return 'blob:test';};URL.revokeObjectURL=()=>{};
 globalThis.document={body:{append(){}},createElement(){return {click(){filename=this.download;},remove(){}};}};
 try{
  const sample={name:'กระดาษ',spec:'A4',source:'ร้านทดสอบ',qty:'1',unit:'รีม',unit_price:'3000',vat:true};
  const items=validateItems([{...sample,payment_method:'credit'},{...sample,payment_method:'cash'},sample]);
  await exportMonthlyExcel({total_cents:900000,ordered_count:1,pending_count:0,rejected_count:0,rows:[{po_number:'TEST-ONLY',po_date:'2026-10-03',requester_name:'ทดสอบ',status:'approved',items}]},'2026-10');
  assert.equal(filename,'PO-The-Grands-2026-10.xlsx');
  const book=new ExcelJS.Workbook();await book.xlsx.load(await blob.arrayBuffer());
  const sheet=book.getWorksheet('รายการสินค้า');const headers=sheet.getRow(1).values;const payment=headers.indexOf('การชำระเงิน');assert.ok(payment>0);
  assert.deepEqual([2,3,4].map(row=>sheet.getCell(row,payment).value),['เครดิต','เงินสด','ไม่ระบุ']);
  for(const label of ['ราคาต่อหน่วย','ก่อน VAT','VAT','รวมสุทธิ'])assert.equal(sheet.getCell(2,headers.indexOf(label)).numFmt,'฿#,##0.00');
  assert.equal(sheet.getCell(2,headers.indexOf('รวมสุทธิ')).value,3000);const summary=book.getWorksheet('สรุปรายเดือน');assert.equal(summary.getCell('B5').value,9000);
  assert.equal(sheet.autoFilter,'A1:Q1');assert.equal(sheet.columnCount,17);
 }finally{globalThis.ExcelJS=saved.ExcelJS;globalThis.document=saved.document;globalThis.setTimeout=saved.setTimeout;URL.createObjectURL=saved.create;URL.revokeObjectURL=saved.revoke;}
});
