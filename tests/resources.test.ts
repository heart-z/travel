import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrip,validateTrip,updateTrip} from '../src/domain/trips';
import {saveStay,saveTransport,staysOn,transportsOn,saveDayCity,searchCity} from '../src/domain/resources';
import {parseBackup,exportBackup} from '../src/services/backup';
import {moveItem} from '../src/domain/itinerary';
const trip=()=>createTrip({title:'跨城旅行',city:'阿尔山',startDate:'2026-10-01',endDate:'2026-10-07',budget:'',companion:'同行'});
const stay={id:'stay',name:'待确认酒店',checkIn:'2026-10-02',checkOut:'2026-10-04',status:'planned' as const,address:'',bookingNo:'',phone:'',note:'待预订',amount:0};
const transport={id:'train',name:'夜火车',mode:'train' as const,departure:'2026-10-01T21:00',arrival:'2026-10-02T05:00',fromName:'沈阳',toName:'乌兰浩特',bookingNo:'',note:'待确认班次'};
test('daily search regions persist independently and fall back to trip city',()=>{
 const original=trip(),t=saveDayCity(original,'2026-10-07',' 哈尔滨 ');assert.equal(searchCity(t,'2026-10-07'),'哈尔滨');assert.equal(searchCity(t,'2026-10-02'),'阿尔山');assert.equal(original.dayCities,undefined);assert.throws(()=>saveDayCity(t,'2026-10-08','上海'));assert.throws(()=>saveDayCity(t,'2026-10-07',' '));
});
test('one stay covers occupied nights but excludes checkout and does not create expenses',()=>{
 const original=trip(),t=saveStay(original,stay);assert.equal(staysOn(t,'2026-10-02').length,1);assert.equal(staysOn(t,'2026-10-03').length,1);assert.equal(staysOn(t,'2026-10-04').length,0);assert.equal(t.expenses.length,0);assert.equal(original.stays?.length??0,0);
 assert.equal(saveStay(t,{...stay,name:'已核对酒店'}).stays?.length,1);
});
test('overnight transport appears once in storage and on both event dates',()=>{
 const t=saveTransport(trip(),transport);assert.equal(t.transports?.length,1);assert.equal(transportsOn(t,'2026-10-01')[0].event,'departure');assert.equal(transportsOn(t,'2026-10-02')[0].event,'arrival');assert.equal(transportsOn(t,'2026-10-03').length,0);
 assert.equal(t.items.length,0);
});
test('invalid and out of range resource dates cannot be persisted or silently cut off',()=>{
 assert.throws(()=>saveStay(trip(),{...stay,checkOut:stay.checkIn}));assert.throws(()=>saveStay(trip(),{...stay,checkIn:'2026-02-30'}));
 assert.throws(()=>saveTransport(trip(),{...transport,arrival:'2026-10-01T20:00'}));assert.throws(()=>saveTransport(trip(),{...transport,arrival:'2026-10-02T25:00'}));
 assert.throws(()=>updateTrip(saveStay(trip(),stay),{endDate:'2026-10-03'}));
});
test('linked transport endpoints cannot be removed or moved away from booking dates',()=>{
 const t=trip();t.items=[{id:'a',name:'出发站',date:'2026-10-01',order:0,duration:0,time:'21:00',note:'',kind:'交通'},{id:'b',name:'到达站',date:'2026-10-02',order:0,duration:0,time:'05:00',note:'',kind:'交通'}];
 const linked=saveTransport(t,{...transport,fromItemId:'a',toItemId:'b'});
 assert.throws(()=>validateTrip({...linked,items:linked.items.slice(1)}));assert.throws(()=>moveItem(linked,'a','2026-10-02',0));
});
test('new backups preserve resources and old backups retain IDs notes and cents',()=>{
 const old=trip();old.items=[{id:'legacy',name:'住宿',date:'2026-10-01',order:0,duration:0,time:'',note:'未知订单不猜测',kind:'住宿'}];
 old.expenses=[{id:'old-cost',title:'旧账单',amount:12345,category:'住宿',date:'2026-10-01',payer:old.members[0].id,shares:{[old.members[0].id]:12345}}];
 const imported=parseBackup(JSON.stringify({format:'xingjian-backup',schema:1,data:{version:4,trips:[old]}}));assert.deepEqual(imported.trips[0],old);
 const data={version:4,trips:[saveTransport(saveStay(old,stay),transport)]};const backup=exportBackup(data);assert.equal(JSON.parse(backup).schema,2);assert.deepEqual(parseBackup(backup),data);
});
test('reordering cannot insert a road stop inside linked same-day transport',()=>{
 const t=trip();t.items=['a','b','c'].map((id,order)=>({id,name:id,date:'2026-10-01',order,time:'',duration:0,note:'',kind:'交通'}));
 const linked=saveTransport(t,{...transport,arrival:'2026-10-01T23:00',fromItemId:'a',toItemId:'b'});
 assert.throws(()=>moveItem(linked,'c','2026-10-01',1),/相邻/);
 assert.throws(()=>saveTransport(t,{...transport,arrival:'2026-10-01T23:00',fromItemId:'b',toItemId:'a'}),/相邻/);
});
