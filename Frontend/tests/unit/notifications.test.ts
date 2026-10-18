import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotificationsData } from '../../src/lib/data/notifications';
import { createApiClient } from '../../src/lib/api-client';

const item=(n:number)=>({id:`notification-${n}`,kind:'Void requests',revision:'1',read:false,orderIds:[`sale-${n}`],
  evidence:{actorId:'actor',actor:'Saved cashier',role:'Staff',time:'2026-10-18T01:00:00Z',reason:'Check receipt',orders:[{id:`sale-${n}`,number:`ORDER-${n}`} ]}});
test('notification pagination returns one complete consistent snapshot and refuses mixed or malformed evidence',async()=>{
  for(const mode of ['valid','changed','invalid'] as const){
    const data=createNotificationsData(createApiClient({fetcher:async input=>{
      const offset=Number(new URL(String(input),'https://test.invalid').searchParams.get('offset'));
      return Response.json({version:1,total:101,unread:101,hasMore:offset===0,snapshot:mode==='changed'&&offset>0?'new':'same',
        items:offset===0?Array.from({length:100},(_,i)=>item(i)):[mode==='invalid'?{...item(100),orderIds:['wrong-receipt']}:item(100)]});
    }}));
    if(mode==='valid')assert.equal((await data.read()).items.length,101);
    else await assert.rejects(()=>data.read(),mode==='changed'?/changed while loading/:/receipt set/);
  }
});
test('notification marker commands contain only the displayed revision and desired state and reject ambiguous success responses',async()=>{
  let sent:unknown;const notification=item(1);
  const data=createNotificationsData(createApiClient({accessToken:async()=> 'own-token',fetcher:async(_input,options)=>{
    assert.equal(new Headers(options?.headers).get('authorization'),'Bearer own-token');sent=JSON.parse(String(options?.body));
    return Response.json({id:notification.id,revision:'2',read:true});
  }}));
  await assert.rejects(()=>data.mark(notification as Parameters<typeof data.mark>[0],true),/saved notification read marker/);
  assert.deepEqual(sent,{revision:'1',read:true});
});
