import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalRepository } from '../src/services/repository';
import { createTrip } from '../src/domain/trips';
test('storage saves and reloads and rejects stale writes',async()=>{
  let raw='';const store={get:()=>raw,set:(_key:string,value:string)=>{raw=value;}};
  const repo=new LocalRepository(store);const first=await repo.load();
  const t=createTrip({title:'旅行',city:'贵阳',startDate:'2026-09-30',endDate:'2026-10-02',budget:'200',companion:''});
  await repo.save({...first,trips:[t]});
  assert.equal((await new LocalRepository(store).load()).trips[0].title,'旅行');
  await assert.rejects(()=>repo.save(first),/已更新/);
});
test('corrupt or full storage does not discard the previous persisted state',async()=>{
  const repo=new LocalRepository({get:()=>'{bad json',set:()=>{throw new Error('should never write');}});
  await assert.rejects(()=>repo.load(),/损坏/);
  const full=new LocalRepository({get:()=>'',set:()=>{throw new Error('storage full');}});
  await assert.rejects(()=>full.save({version:0,trips:[]}),/storage full/);
});
