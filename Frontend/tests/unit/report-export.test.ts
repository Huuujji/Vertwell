import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvCell } from '../../src/lib/report-export';
test('Adjustment 9 CSV neutralizes formulas after whitespace and preserves quoted multiline evidence',()=>{
 for(const input of ['=1+1',' +SUM(A1)','\uFEFF@cmd','\t=cmd','\r\n-1'])assert.ok(csvCell(input).startsWith('"\''));
 assert.equal(csvCell('Receipt "one"\nEvidence'),'"Receipt ""one""\nEvidence"');assert.equal(csvCell('₱4.00'),'"₱4.00"');
});
