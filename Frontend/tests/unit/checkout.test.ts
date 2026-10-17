import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCheckoutData,decodeQuote,decodeReceipt,type CheckoutCommand } from '../../src/lib/data/checkout';
import { createApiClient } from '../../src/lib/api-client';
const id='00000000-0000-4000-8000-000000000001';
const quote={version:1,revision:'1',quoteToken:'a'.repeat(64),businessDate:'2026-10-17',subtotal:'12.50',tax:'1.50',total:'14.00',
  lines:[{productId:id,variantId:null,name:'Purchased name',sku:'SKU-1',quantity:1,unitPrice:'12.50',originalUnitPrice:'12.50',modifiers:[],components:[]}]};
test('checkout decoding preserves exact cents and rejects unsafe values, inconsistent totals and missing purchased fields',()=>{
  assert.equal(decodeQuote(quote).total,'14.00');
  for(const invalid of [{...quote,total:'13.99'},{...quote,subtotal:'12.501'}, {...quote,total:'9007199254740991.00'},
    {...quote,lines:[{...quote.lines[0],quantity:0}]},{...quote,quoteToken:'invalid'},{...quote,lines:[{...quote.lines[0],sku:undefined}]}])
    assert.throws(()=>decodeQuote(invalid));
  assert.throws(()=>decodeReceipt({...quote,providerVerified:true}));
});
test('an explicit checkout retry sends the original operation exactly; a failed response never triggers an automatic retry',async()=>{
  const command:CheckoutCommand={operationId:id,revision:'1',quoteToken:quote.quoteToken,lines:[{productId:id,variantId:null,modifierIds:[],quantity:'1'}],payment:{method:'Cash',amount:'14.00',cashTendered:'20'}};
  const bodies:string[]=[];
  const request=createApiClient({accessToken:async()=>'caller-token',fetcher:async(_url,options)=>{
    bodies.push(String(options?.body));assert.equal(new Headers(options?.headers).get('authorization'),'Bearer caller-token');
    if(bodies.length===1)throw new TypeError('Lost response');
    return Response.json({...quote,saleId:id,orderNumber:'20261017-1',operationId:id,occurredAt:'2026-10-17T00:00:00Z',status:'Completed',reviewState:'Owner checkout',
      cashierName:'Owner',cashierRole:'Owner',method:'Cash',cashTendered:'20',change:'6',reference:null,stockCommitted:true,providerVerified:false,replayed:true});
  }});
  const service=createCheckoutData(request);await assert.rejects(()=>service.checkout(command));assert.equal(bodies.length,1);
  assert.equal((await service.checkout(command)).replayed,true);assert.equal(bodies[0],bodies[1]);
});
