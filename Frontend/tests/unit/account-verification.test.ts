import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createManagementData } from '../../src/lib/data/management';
import { mapAccounts } from '../../src/lib/data/mappers';
import type { ManagedAccount } from '../../src/lib/data/contracts';

test('profile-only PATCH retains trusted pending/verified status and subsequent list refresh uses fresh provider state',async()=>{
  for(const state of ['pending','verified','existing'] as const) {
    const row:ManagedAccount={id:'test-account',full_name:'Recipient',username:'recipient',role:'Staff',active:true,
      email:'recipient@example.invalid',emailVerification:state,created_at:'2026-10-26T00:00:00Z',updated_at:'2026-10-26T00:00:00Z'};
    const {email,emailVerification,...profile}=row;
    const request=async<T>(_path:string,options?:RequestInit):Promise<T>=>
      (options?.method==='PATCH'?{profile:{...profile,full_name:'Renamed'}}:{accounts:[{...row,emailVerification:'verified'}]}) as T;
    const service=createManagementData(request);
    const result=await service.saveAccount({source:[row],accounts:mapAccounts([row])},{...mapAccounts([row])[0],name:'Renamed'});
    assert.equal(result.accounts[0].emailVerification,state);
    assert.equal(result.accounts[0].email,email);
    assert.equal(result.accounts[0].name,'Renamed');
    assert.equal((await service.accounts()).accounts[0].emailVerification,'verified');
  }
});
