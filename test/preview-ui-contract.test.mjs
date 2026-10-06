import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {itemStatusLabels} from '../dist/preview-export.js';
const source=await readFile(new URL('../dist/preview-app.js',import.meta.url),'utf8');
test('PO detail uses shared Thai row-status labels while review tables stay unchanged',()=>{
 assert.ok(Object.values(itemStatusLabels).includes('รออนุมัติ'));
 assert.match(source,/itemsTable\(items,showItemStatus=false\)/);
 assert.match(source,/showItemStatus\?`<small>\$\{itemStatusLabels\[i\.state\]/);
 assert.match(source,/itemsTable\(p\.items,true\)/);
 assert.match(source,/itemsTable\(draft\.validated\)/);
});
test('detail action names and report subtitle describe the actual action and eligible item value',()=>{
 assert.match(source,/receive:'รับสินค้าทั้งใบ PO',receive_item:'รับสินค้า'/);
 assert.doesNotMatch(source,/aria-label="\$\{label\} · \$\{name\}"/);
 assert.match(source,/ยอดสั่งซื้อคิดจากรายการที่อนุมัติแล้วหรือรับสินค้าแล้ว/);
});
