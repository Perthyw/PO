import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {createPreviewService} from '../dist/preview-workflow.js';
import {createPreviewFixtures} from '../dist/preview-fixtures.js';
import {buildPreviewWorkbook} from '../dist/preview-export.js';
const require=createRequire(import.meta.url);
function excelJS(){const module={exports:{}};vm.runInThisContext('(function(module,exports,require){'+require('node:fs').readFileSync(new URL('../dist/vendor/exceljs.min.js',import.meta.url),'utf8')+'\n})')(module,module.exports,require);return module.exports;}
test('generated preview XLSX parses and reconciles confirmed, received, rejected, mixed and estimated item values',async()=>{
 const ExcelJS=excelJS(),actor={id:'preview-primary',role:'primary',display_name:'ฝ่ายจัดซื้อหลัก'},service=createPreviewService({storage:new MapStorage(),fixtures:createPreviewFixtures()}),report=service.report('2026-10',actor),workbook=await buildPreviewWorkbook(report,'2026-10',ExcelJS),buffer=await workbook.xlsx.writeBuffer(),parsed=new ExcelJS.Workbook();await parsed.xlsx.load(buffer);
 const summary=parsed.getWorksheet('สรุปทดลอง');assert.equal(summary.getCell('B3').value,report.total_cents/100);assert.equal(summary.getCell('B4').value,report.budget_authorized_cents/100);
 const sheet=parsed.getWorksheet('รายการสินค้า'),headers=sheet.getRow(1).values;const column=label=>headers.indexOf(label);for(const label of ['สถานะใบ PO','สถานะรายการ','ชนิดราคา','ครั้งที่แก้ไข','ก่อน VAT','VAT','รวมสุทธิ','วงเงินประมาณการ','ยอดซื้อที่นับรายงาน'])assert.ok(column(label)>0,label);
 const rows=[];sheet.eachRow((row,index)=>{if(index>1)rows.push(Object.fromEntries(headers.slice(1).map((header,i)=>[header,row.getCell(i+1).value])));});
 const closed=rows.find(row=>row['เลข PO']==='DEMO-2026-10107');assert.equal(closed['สถานะใบ PO'],'ปิดใบ PO แล้ว');assert.equal(closed['สถานะรายการ'],'รับสินค้าแล้ว');assert.equal(closed['รวมสุทธิ'],closed['ยอดซื้อที่นับรายงาน']);
 const rejected=rows.filter(row=>row['เลข PO']==='DEMO-2026-10109');assert.ok(rejected.length);assert.ok(rejected.every(row=>row['ยอดซื้อที่นับรายงาน']===0));
 const mixed=rows.filter(row=>row['เลข PO']==='DEMO-2026-10108');assert.ok(mixed.some(row=>row['สินค้า']==='ถุงมือ · อนุมัติ'&&row['ยอดซื้อที่นับรายงาน']>0));assert.ok(mixed.some(row=>row['สินค้า']==='น้ำยาทำความสะอาด · รับแล้ว'&&row['ยอดซื้อที่นับรายงาน']>0));assert.ok(mixed.some(row=>row['สินค้า']==='แก้วกระดาษ · รออนุมัติ'&&row['ยอดซื้อที่นับรายงาน']===0));
 const estimate=rows.find(row=>row['เลข PO']==='DEMO-2026-10104');assert.equal(estimate['วงเงินประมาณการ'],estimate['รวมสุทธิ']);assert.equal(estimate['ยอดซื้อที่นับรายงาน'],0);
});
class MapStorage{constructor(){this.map=new Map();}getItem(k){return this.map.get(k)||null;}setItem(k,v){this.map.set(k,String(v));}removeItem(k){this.map.delete(k);}}
