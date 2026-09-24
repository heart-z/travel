import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrip,validateTrip} from '../src/domain/trips';
import {mapCamera} from '../src/domain/map-camera';
import {clothingSuggestions} from '../src/domain/packing';
import {mergeResourceSupplement} from '../src/services/resource-supplement';
const trip=()=>createTrip({title:'测试',city:'杭州',startDate:'2026-10-01',endDate:'2026-10-07',budget:'',companion:'同行'});
const point={id:'p',name:'位置',address:'',latitude:30,longitude:120,provider:'manual' as const};
const item=(id:string,place?:typeof point)=>({id,name:id,date:'2026-10-01',order:0,duration:0,time:'',note:'',kind:'景点',place});
test('single selected point uses bounded street zoom and never single-point auto-fit',()=>{
 const camera=mapCamera([item('a',point),item('b',{...point,latitude:48})],'a');
 assert.equal(camera.scale,14);assert.deepEqual(camera.fitPoints,[]);assert.equal(camera.center.latitude,30);
 assert.deepEqual(mapCamera([item('a',point)]).fitPoints,[]);
});
test('overview fits multiple distinct points but an unlocated selection does not zoom to an unrelated stop',()=>{
 const items=[item('a',point),item('b',{...point,latitude:48}),item('missing')];
 assert.equal(mapCamera(items,'missing').fitPoints.length,2);
 assert.equal(mapCamera(items,'a',undefined,true).fitPoints.length,2);
 assert.deepEqual(mapCamera([item('a',point),item('b',point)]).fitPoints,[]);
});
test('clothing quantities account for travel length and washing without assuming shared clothes',()=>{
 const t=trip();const week=clothingSuggestions(t,7),washed=clothingSuggestions(t,3);
 const count=(list:typeof week)=>list.filter(p=>p.name==='袜子').reduce((sum,p)=>sum+p.quantity,0);
 assert.equal(count(week),7);assert.equal(count(washed),3);assert.equal(week.find(p=>p.name==='袜子'&&p.carryMode==='pack')?.quantity,6);
 assert.ok(week.every(p=>p.memberId===t.members[0].id));assert.ok(week.some(p=>p.carryMode==='wear'));
 assert.equal(clothingSuggestions({...t,endDate:t.startDate},7).find(p=>p.name==='袜子')?.quantity,1);
});
test('overnight trains need dates but no invented arrival time or hotel booking',()=>{
 const t=trip();t.stays=[{id:'train',kind:'train',name:'车上过夜',checkIn:t.startDate,checkOut:'2026-10-02',status:'planned',address:'',bookingNo:'',phone:'',note:'车次待补',amount:0}];
 assert.doesNotThrow(()=>validateTrip(t));assert.throws(()=>validateTrip({...t,stays:[{...t.stays[0],kind:'wrong'}]} as any));
});
test('resource supplement adds bookings to existing trip without replacing itinerary ledger or existing bookings',()=>{
 const t=trip();t.items=[item('a',point)];t.packing=[];
 const stay={id:'hotel',name:'酒店',checkIn:'2026-10-02',checkOut:'2026-10-03',status:'booked' as const,address:'地址',bookingNo:'booking',phone:'',note:'截图',amount:50923};
 const data={version:5,trips:[t]},supplement={format:'xingjian-resources' as const,schema:1 as const,tripId:t.id,stays:[stay],transports:[]};
 const merged=mergeResourceSupplement(data,supplement);assert.equal(merged.trips[0].stays?.length,1);assert.deepEqual(merged.trips[0].items,t.items);assert.deepEqual(merged.trips[0].expenses,t.expenses);assert.equal(data.trips[0].stays,undefined);
 assert.equal(mergeResourceSupplement(merged,supplement).trips[0].stays?.length,1);
 assert.equal(mergeResourceSupplement(merged,{...supplement,stays:[{...stay,id:'another',amount:1}]}).trips[0].stays?.[0].amount,50923);
 assert.throws(()=>mergeResourceSupplement(data,{...supplement,tripId:'missing'}));
 assert.throws(()=>mergeResourceSupplement(data,{...supplement,stays:[{...stay,amount:-1}]}));
});
test('supplements append preparation and guides but preserve existing checked and edited records',()=>{
 const t=trip(),owner=t.members[0].id;
 const packing={id:'p',name:'外套',category:'clothing' as const,quantity:1,memberId:owner,packed:false,note:'建议',carryMode:'wear' as const};
 const guide={id:'g',title:'路线攻略',content:'要点',sourceUrl:'',dates:['2026-10-01'],itemIds:[],category:'guide' as const};
 const pack={format:'xingjian-resources' as const,schema:1 as const,tripId:t.id,stays:[],transports:[],packing:[packing],guides:[guide]};
 const data={version:0,trips:[t]},first=mergeResourceSupplement(data,pack);first.trips[0].packing![0].packed=true;first.trips[0].guides![0].content='用户更新';
 const second=mergeResourceSupplement(first,pack);assert.equal(second.trips[0].packing?.length,1);assert.equal(second.trips[0].packing?.[0].packed,true);assert.equal(second.trips[0].guides?.[0].content,'用户更新');assert.deepEqual(second.trips[0].items,t.items);assert.equal(data.trips[0].guides,undefined);
 assert.throws(()=>mergeResourceSupplement(data,{...pack,packing:[{...packing,memberId:'foreign'}]}));assert.throws(()=>mergeResourceSupplement(data,{...pack,guides:[{...guide,sourceUrl:'javascript:alert(1)'}]}));
});
test('location supplements bind stable item IDs and never overwrite a saved or deliberately unlocated point',()=>{
 const t=trip();t.items=[item('a'),{...item('b',point),order:1},{...item('c'),order:2,locationStatus:'not-needed'}];
 const pack={format:'xingjian-resources' as const,schema:1 as const,tripId:t.id,stays:[],transports:[],locationBindings:[{kind:'item' as const,id:'a',place:point},{kind:'item' as const,id:'b',place:{...point,latitude:45}},{kind:'item' as const,id:'c',place:point}]};
 const result=mergeResourceSupplement({version:0,trips:[t]},pack).trips[0];assert.deepEqual(result.items[0].place,point);assert.equal(result.items[1].place?.latitude,30);assert.equal(result.items[2].place,undefined);assert.equal(t.items[0].place,undefined);
 assert.throws(()=>mergeResourceSupplement({version:0,trips:[t]},{...pack,locationBindings:[{...pack.locationBindings[0],place:{...point,latitude:NaN}}]}));
});
