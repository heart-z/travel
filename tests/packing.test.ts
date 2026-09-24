import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrip,validateTrip} from '../src/domain/trips';
import {exportBackup,parseBackup} from '../src/services/backup';
import {LocalRepository} from '../src/services/repository';
import {addPackingTemplate,savePacking,packingTemplates} from '../src/domain/packing';
import {changeLocation,locationState} from '../src/domain/locations';
const trip=()=>createTrip({title:'清单测试',city:'阿尔山',startDate:'2026-10-01',endDate:'2026-10-07',budget:'',companion:'同行'});
const entry={id:'coat',name:'外套',category:'clothing',quantity:1,memberId:'',packed:false,note:''};
test('packing rejects invalid quantities, owners and malformed imported lists',()=>{
 for(const patch of [{quantity:0},{quantity:1.5},{quantity:1000},{memberId:'missing'},{packed:'yes'},{category:'invalid'},{name:' '},{note:5}]){
  assert.throws(()=>validateTrip({...trip(),packing:[{...entry,...patch}]} as any));
 }
 for(const packing of [null,{},[entry,entry]])assert.throws(()=>validateTrip({...trip(),packing} as any));
});
test('template repeat preserves packed state and quantity and separates member ownership',()=>{
 const original=trip(),draft=packingTemplates[1].items[0];
 let t=addPackingTemplate(original,[draft,draft]);assert.equal(t.packing?.length,1);
 t=savePacking(t,{...t.packing![0],quantity:3,packed:true});
 t=addPackingTemplate(t,[draft,{...draft,memberId:t.members[0].id}]);
 assert.equal(t.packing?.length,2);assert.equal(t.packing![0].quantity,3);assert.equal(t.packing![0].packed,true);assert.equal(original.packing,undefined);
 const data=parseBackup(exportBackup({version:2,trips:[t]}));assert.deepEqual(data.trips[0].packing,t.packing);
 assert.deepEqual(t.expenses,original.expenses);
});
test('changing a coordinate clears prior confirmation and skipped plans are reversible',()=>{
 const t=trip();t.items=[{id:'a',name:'景点',date:t.startDate,order:0,duration:0,time:'',note:'备注保留',kind:'景点'}];
 const place={id:'p',name:'入口',address:'手动',latitude:40,longitude:120,provider:'manual' as const};
 const skipped=changeLocation(t,'a','skip');assert.equal(locationState(skipped.items[0]),'not-needed');
 const located=changeLocation(skipped,'a',place);assert.equal(locationState(located.items[0]),'located');
 const confirmed=changeLocation(located,'a','confirm');assert.equal(locationState(confirmed.items[0]),'confirmed');
 const moved=changeLocation(confirmed,'a',{...place,latitude:41});assert.equal(locationState(moved.items[0]),'located');
 const removed=changeLocation(moved,'a','remove');assert.equal(locationState(removed.items[0]),'pending');assert.equal(removed.items[0].note,'备注保留');assert.equal(t.items[0].place,undefined);
});
test('location status cannot falsely confirm a missing point or hide an existing point',()=>{
 const t=trip();const item={id:'a',name:'景点',date:t.startDate,order:0,duration:0,time:'',note:'',kind:'景点'};
 for(const locationStatus of ['confirmed','invalid'])assert.throws(()=>validateTrip({...t,items:[{...item,locationStatus}]} as any));
 assert.throws(()=>validateTrip({...t,items:[{...item,locationStatus:'not-needed',place:{id:'p',name:'位置',address:'',latitude:40,longitude:120,provider:'manual'}}]} as any));
});
test('packing completion survives local reload and schema 2 backup while schema 1 stays unchanged',async()=>{
 const old=trip();assert.deepEqual(parseBackup(JSON.stringify({format:'xingjian-backup',schema:1,data:{version:0,trips:[old]}})).trips[0],old);
 let raw='';const repo=new LocalRepository({get:()=>raw,set:(_,v)=>{raw=v;}});
 const next={...old,packing:[{...entry,memberId:old.members[0].id,packed:true}]};
 const saved=await repo.save({version:0,trips:[next]} as any);assert.deepEqual(await repo.load(),saved);assert.deepEqual(parseBackup(exportBackup(saved)),saved);
 assert.deepEqual(saved.trips[0].items,old.items);assert.deepEqual(saved.trips[0].expenses,old.expenses);
});
