import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSalesWorkflowData,decodeWorkflowResult,restoreWorkflowCommand,type WorkflowCommand } from '../../src/lib/data/sales-workflow';
import { createApiClient } from '../../src/lib/api-client';
const id='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const command:WorkflowCommand={operationId:id,kind:'sale.void',targets:[{saleId:id,token:'a'.repeat(64)},{saleId:other,token:'b'.repeat(64)}],reason:'Exact approved set'};
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
