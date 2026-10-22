import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Pagination from '../../src/components/Pagination';
import DailyReviewQueue from '../../src/components/DailyReviewQueue';
import DailySalesReview from '../../src/components/DailySalesReview';
import InfoDisclosure from '../../src/components/InfoDisclosure';
import { pageFromPath } from '../../src/lib/page-paths';
import { reviewSelection } from '../../src/data/review-selection';
import type { Sale } from '../../src/data/demo';

const sale=(id:string,method:Sale['method'],total:number):Sale=>({id,method,total,time:'2026-10-21T08:00:00+08:00',cashier:'cashier',status:'Pending',reviewState:'Awaiting Owner review',lines:[]});
test('a checked receipt subset sets exact payment totals and excludes unchecked, completed and other-day sales',()=>{
  const sales=[sale('cash','Cash',12.34),sale('digital','GCash',56),sale('cash2','Cash',0.1),{...sale('done','Cash',90),status:'Completed' as const},{...sale('old','Cash',99),time:'2026-10-20T08:00:00+08:00'}];
  const one=reviewSelection(sales,'2026-10-21',['cash']);assert.equal(one.expectedCash,12.34);assert.equal(one.expectedGCash,0);assert.equal(one.selected.length,1);
  const mixed=reviewSelection(sales,'2026-10-21',['cash','cash2','digital','done','old','cash']);assert.equal(mixed.expectedCash,12.44);assert.equal(mixed.expectedGCash,56);assert.equal(mixed.selected.length,3);
});
test('empty review queues and single-page pagination render nothing; multi-page pagination remains accessible',()=>{
  assert.equal(renderToStaticMarkup(createElement(DailyReviewQueue,{sales:[],onReview:()=>{}})),'');
  const props={label:'Inventory',page:1,pages:1,total:1,setPage:()=>{}};
  assert.equal(renderToStaticMarkup(createElement(Pagination,props)),'');
  assert.match(renderToStaticMarkup(createElement(Pagination,{...props,pages:2,total:7})),/Inventory pagination/);
});
test('daily review presents optional notes, separated totals and collapsed accessible SVG information',()=>{
  const html=renderToStaticMarkup(createElement(DailySalesReview,{persistent:true,date:'2026-10-21',sales:[sale('cash','Cash',14)],role:'Owner',owner:'owner',onClose:()=>{},onConfirm:()=>true}));
  assert.match(html,/Review notes \(optional\)/);assert.doesNotMatch(html,/<textarea[^>]*required/);
  assert.match(html,/review-total-grid/);assert.match(html,/How daily sales review works/);
  const info=renderToStaticMarkup(createElement(InfoDisclosure,{label:'Calculation',children:'Details'}));assert.match(info,/<svg/);assert.doesNotMatch(info,/<details[^>]*open/);
});
test('URL restoration respects Staff destinations and supports direct links',()=>{
  assert.equal(pageFromPath('/Reports',true),'Reports');assert.equal(pageFromPath('/Inventory',false),'POS');
  assert.equal(pageFromPath('/Audit-Trail',false),'Audit Trail');assert.equal(pageFromPath('/Login',true),'Dashboard');
});
