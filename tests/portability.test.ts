import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {exportBackup,parseBackup,mergeBackup} from '../src/services/backup';import {createTrip} from '../src/domain/trips';import {FileStore,createServer} from '../server/app.cjs';
import {request} from 'node:http';
const data=()=>({version:0,trips:[createTrip({title:'迁移旅行',city:'贵阳',startDate:'2026-10-01',endDate:'2026-10-02',budget:'100',companion:''})]});
test('backup round trips complete data and merge never overwrites existing trips',()=>{const original=data();const backup=parseBackup(exportBackup(original));assert.deepEqual(backup,original);backup.trips[0].title='旧版本';assert.equal(mergeBackup(original,backup).trips[0].title,'迁移旅行');assert.throws(()=>parseBackup('{"schema":2}'));});
test('daily start and entered transfer minutes survive a complete backup',()=>{const original=data();const trip=original.trips[0];trip.dayStartTimes={'2026-10-01':'08:15'};trip.items=[{id:'a',name:'草原',date:'2026-10-01',order:0,time:'',duration:60,travelMinutes:35,note:'',kind:'游玩'}];const restored=parseBackup(exportBackup(original));assert.equal(restored.trips[0].dayStartTimes?.['2026-10-01'],'08:15');assert.equal(restored.trips[0].items[0].travelMinutes,35);});
test('self hosted persistence isolates users and rejects concurrent stale writes',async()=>{const dir=mkdtempSync(join(tmpdir(),'xingjian-test-'));try{const store=new FileStore(dir);const d=data();await store.save('alice',d);assert.equal((await store.load('bob')).trips.length,0);await assert.rejects(()=>store.save('alice',d),/已更新/);assert.equal((await new FileStore(dir).load('alice')).trips[0].title,'迁移旅行');}finally{rmSync(dir,{recursive:true,force:true});}});
test('self hosted API requires bearer auth and reuses the validated cloud-independent handler',async()=>{const dir=mkdtempSync(join(tmpdir(),'xingjian-api-'));const server=createServer({dataDir:dir,tokens:{'test-token-12345678901234567890':'alice'},mapKey:''});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));try{const address=server.address();if(!address||typeof address==='string')throw Error('address');const url=`http://127.0.0.1:${address.port}/api`;const missing=await fetch(url,{method:'POST',body:JSON.stringify({action:'load'})});assert.equal(missing.status,401);const result=await fetch(url,{method:'POST',headers:{Authorization:'Bearer test-token-12345678901234567890','Content-Type':'application/json'},body:JSON.stringify({action:'save',data:data()})});assert.equal((await result.json()).data.version,1);}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});}});
test('migration preserves complete Chinese records when HTTP splits a UTF-8 character',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'xingjian-migration-'));
  const server=createServer({dataDir:dir,tokens:{'test-token-12345678901234567890':'new-owner'},mapKey:''});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const trip=createTrip({title:'跨服务迁移',city:'贵阳',startDate:'2026-09-17',endDate:'2026-09-18',budget:'1000',companion:'小林'});
    const [a,b]=trip.members.map(m=>m.id);
    trip.archived=true;
    trip.items=[{id:'i',name:'酒店',date:trip.startDate,order:0,time:'22:00',duration:600,note:'预订备注',kind:'住宿',place:{id:'p',name:'测试位置',address:'测试地址',latitude:26.5,longitude:106.7,provider:'tencent'}}];
    trip.expenses=[{id:'e',title:'晚餐',category:'餐饮',date:trip.startDate,amount:10001,payer:a,shares:{[a]:5001,[b]:5000}}];
    trip.settlements=[{id:'s',from:b,to:a,amount:5000,date:trip.startDate}];
    const incoming=parseBackup(exportBackup({version:12,trips:[trip],accountId:'old-owner'}));
    const dest=mergeBackup({version:0,trips:[],accountId:'new-owner'},incoming);
    const address=server.address() as any,url=`http://127.0.0.1:${address.port}/api`;
    const payload=Buffer.from(JSON.stringify({action:'save',data:dest}));
    const cut=payload.indexOf(Buffer.from('跨'))+1;
    const response:any=await new Promise((resolve,reject)=>{
      const req=request(url,{method:'POST',headers:{Authorization:'Bearer test-token-12345678901234567890','Content-Type':'application/json'}},res=>{let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve(JSON.parse(text)));});
      req.on('error',reject);req.write(payload.subarray(0,cut));setTimeout(()=>req.end(payload.subarray(cut)),20);
    });
    assert.equal(response.ok,true);assert.equal(response.data.accountId,'new-owner');
    const persisted=await new FileStore(dir).load('new-owner');
    assert.deepEqual(persisted.trips,[trip]);assert.equal(persisted.version,1);
    const returned=parseBackup(exportBackup(persisted));assert.deepEqual(returned.trips,incoming.trips);
  }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));rmSync(dir,{recursive:true,force:true});}
});
