import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSalesWorkflowData,decodeWorkflowResult,decodeRefundBalance,restoreWorkflowCommand,type WorkflowCommand } from '../../src/lib/data/sales-workflow';
import { createApiClient } from '../../src/lib/api-client';
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const command:WorkflowCommand={operationId:id,kind:'sale.void',targets:[{saleId:id,token:'a'.repeat(64)},{saleId:other,token:'b'.repeat(64)}],reason:'Exact approved set'};
test('refund received-money projection fails closed for missing, partial or inconsistent evidence',()=>{
 assert.equal(decodeRefundBalance(undefined),null);
 const balance={paymentId:id,received:'14.00',method:'Cash',receivedAt:'2026-10-27T01:00:00Z',refunded:'4.00',remaining:'10.00'};
 assert.deepEqual(decodeRefundBalance(balance),balance);
 for(const patch of [{paymentId:null},{receivedAt:null},{method:null},{remaining:'14.00'},{remaining:null},{received:'14.001'},{refunded:'-1'}])assert.throws(()=>decodeRefundBalance({...balance,...patch}));
 assert.equal(decodeRefundBalance({...balance,received:null,remaining:null})?.received,null);
});
test('manual-refund lost response retains exact payout evidence and operation without automatic retries',async()=>{
 const c:WorkflowCommand={operationId:id,kind:'refund.record',targets:[{saleId:other,token:'a'.repeat(64)}],reasonId:'duplicate',notes:'Actual payment evidence',refund:{amount:'4.00',method:'Cash',reference:'Paid-8',paidAt:'2026-10-27T01:00:00Z',evidence:'Operator receipt',paidConfirmed:true}};
 const bodies:string[]=[];const service=createSalesWorkflowData(createApiClient({fetcher:async(_url,options)=>{bodies.push(String(options?.body));if(bodies.length===1)throw new TypeError('Lost response');return Response.json({version:1,operationId:id,kind:'refund.record',replayed:true,results:[{saleId:other,outcome:'refunded'}]});}}));
 await assert.rejects(()=>service.execute(c));assert.equal(bodies.length,1);assert.equal((await service.execute(restoreWorkflowCommand(JSON.parse(bodies[0]!)))).replayed,true);assert.equal(bodies[0],bodies[1]);
 assert.throws(()=>decodeWorkflowResult({version:1,operationId:id,kind:'refund.record',replayed:false,results:[{saleId:other,outcome:'voided'}]},c));
});
test('workflow bulk results require every exact selected ID once and make stale/ineligible outcomes explicit',()=>{
  const result={version:1,operationId:id,kind:'sale.void',replayed:true,results:[{saleId:id,outcome:'voided'},{saleId:other,outcome:'stale'}]};
  assert.equal(decodeWorkflowResult(result,command).results[1]!.outcome,'stale');
  for(const invalid of [{...result,results:result.results.slice(0,1)},{...result,results:[result.results[0],result.results[0]]},
    {...result,operationId:other},{...result,kind:'review.confirm'},{...result,results:[result.results[0],{saleId:other,outcome:'reviewed'}]}])assert.throws(()=>decodeWorkflowResult(invalid,command));
  assert.throws(()=>restoreWorkflowCommand({...command,targets:[]}));assert.throws(()=>restoreWorkflowCommand({...command,kind:'accounts.delete'}));
});
test('a workflow retry sends the exact actor-scoped command after a lost response and never automatically repeats a write',async()=>{
  const bodies:string[]=[],headers:string[]=[];const request=createApiClient({accessToken:async()=>'session-only',fetcher:async(_url,options)=>{
    bodies.push(String(options?.body));headers.push(new Headers(options?.headers).get('authorization')!);
    if(bodies.length===1)throw new TypeError('Lost committed response');
    return Response.json({version:1,operationId:id,kind:'sale.void',replayed:true,results:[{saleId:id,outcome:'voided'},{saleId:other,outcome:'stale'}]});
  }});
  const service=createSalesWorkflowData(request);await assert.rejects(()=>service.execute(command));assert.equal(bodies.length,1);
  await service.execute(restoreWorkflowCommand(JSON.parse(bodies[0]!)));assert.equal(bodies[0],bodies[1]);assert.deepEqual(headers,['Bearer session-only','Bearer session-only']);assert.ok(!bodies[0]!.includes('session-only'));
});
test('workflow reads reject missing contracts instead of substituting sample sales or treating failure as an empty queue',async()=>{
  const request=createApiClient({fetcher:async()=>Response.json({items:[],hasMore:false})});
  await assert.rejects(()=>createSalesWorkflowData(request).read(),/version/);
});
