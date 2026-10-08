import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {createPreviewService} from '../dist/preview-workflow.js';
import {createPreviewFixtures} from '../dist/preview-fixtures.js';
import {buildPreviewWorkbook,createPreviewDownload} from '../dist/preview-export.js';
const require=createRequire(import.meta.url);
function excelJS(){const module={exports:{}};vm.runInThisContext('(function(module,exports,require){'+require('node:fs').readFileSync(new URL('../dist/vendor/exceljs.min.js',import.meta.url),'utf8')+'\n})')(module,module.exports,require);return module.exports;}
const actor={id:'preview-primary',role:'office',can_export_report:true,display_name:'ฝ่ายจัดซื้อหลัก'};
const reportFor=month=>createPreviewService({storage:new MapStorage(),fixtures:createPreviewFixtures()}).report(month,actor);
test('generated XLSX parses and reconciles mixed actual-price item totals and legacy columns',async()=>{
 const ExcelJS=excelJS(),report=reportFor('2026-10'),workbook=await buildPreviewWorkbook(report,'2026-10',ExcelJS),buffer=await workbook.xlsx.writeBuffer(),parsed=new ExcelJS.Workbook();await parsed.xlsx.load(buffer);
 const summary=parsed.getWorksheet('สรุปรายเดือน');assert.equal(summary.getCell('B5').value,report.total_cents/100);
 const sheet=parsed.getWorksheet('รายการสินค้า'),headers=sheet.getRow(1).values;const column=label=>headers.indexOf(label);for(const label of ['สถานะ PO','สถานะรายการ','ก่อน VAT','VAT','รวมสุทธิ','ยอดนับรายงาน','แหล่งซื้อ','การชำระเงิน','หมายเหตุ'])assert.ok(column(label)>0,label);
 const rows=[];sheet.eachRow((row,index)=>{if(index>1)rows.push(Object.fromEntries(headers.slice(1).map((header,i)=>[header,row.getCell(i+1).value])));});
 const mixed=rows.filter(row=>row['เลข PO']==='DEMO-2026-20107');assert.ok(mixed.some(row=>row['สินค้า']==='ถุงมือ · อนุมัติ'&&row['ยอดนับรายงาน']>0));assert.ok(mixed.some(row=>row['สินค้า']==='น้ำยาทำความสะอาด · รับแล้ว'&&row['ยอดนับรายงาน']>0));assert.ok(mixed.some(row=>row['สินค้า']==='แก้วกระดาษ · รออนุมัติ'&&row['ยอดนับรายงาน']===0));
 const rejected=rows.filter(row=>row['เลข PO']==='DEMO-2026-20108');assert.ok(rejected.length);assert.ok(rejected.every(row=>row['ยอดนับรายงาน']===0));const closed=rows.find(row=>row['เลข PO']==='DEMO-2026-20106');assert.equal(closed['สถานะ PO'],'ปิดใบ PO แล้ว');assert.equal(closed['สถานะรายการ'],'รับสินค้าแล้ว');assert.equal(closed['รวมสุทธิ'],closed['ยอดนับรายงาน']);
});
test('preview export returns a named persistent blob URL for a direct user download click',async()=>{
 const ExcelJS=excelJS(),report=reportFor('2026-10');let blob=null,revoked=false;const create=URL.createObjectURL,revoke=URL.revokeObjectURL;URL.createObjectURL=value=>{blob=value;return 'blob:preview-test';};URL.revokeObjectURL=()=>{revoked=true;};
 try{const file=await createPreviewDownload(report,'2026-10',ExcelJS);assert.equal(file.url,'blob:preview-test');assert.equal(file.filename,'PO-The-Grands-2026-10.xlsx');assert.equal(blob.type,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');assert.ok(blob.size>0);assert.equal(revoked,false);}finally{URL.createObjectURL=create;URL.revokeObjectURL=revoke;}
});
class MapStorage{constructor(){this.map=new Map();}getItem(k){return this.map.get(k)||null;}setItem(k,v){this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
