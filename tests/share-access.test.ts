import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrip} from '../src/domain/trips';

const {createSharedHandler}=require('../cloudfunctions/travel/sharing.js');
const copy=<T>(value:T):T=>value===undefined?value:JSON.parse(JSON.stringify(value));

function fixture(){
 const trip=createTrip({title:'阿尔山之旅',city:'阿尔山',startDate:'2026-10-01',endDate:'2026-10-03',budget:'1200',companion:''});
 trip.stays=[{id:'stay-1',name:'森林酒店',checkIn:'2026-10-01',checkOut:'2026-10-02',status:'booked',address:'阿尔山',bookingNo:'SECRET-BOOKING',phone:'13800000000',note:'',amount:50000}];
 trip.transports=[{id:'rail-1',name:'火车',mode:'train',departure:'2026-10-01T08:00',arrival:'2026-10-01T10:00',fromName:'沈阳',toName:'阿尔山',bookingNo:'SECRET-TRAIN',note:'内部备注'}];
 const shares=new Map<string,any>(),invites=new Map<string,any>(),members=new Map<string,any>();
 const store={
  readPrivateTrip:async(owner:string,id:string)=>owner==='owner'&&id===trip.id?copy(trip):undefined,
  findShare:async(owner:string,id:string)=>[...shares.values()].find(s=>s.owner===owner&&s.originTripId===id),
  readShare:async(id:string)=>copy(shares.get(id)),
  writeShare:async(record:any)=>{shares.set(record.id,copy(record));},
  casShare:async(id:string,version:number,next:any)=>{const old=shares.get(id);if(old.version!==version)throw Error('数据已更新');const updated={...old,version:version+1,trip:copy(next)};shares.set(id,updated);return copy(updated);},
  writeInvite:async(code:string,invite:any)=>{invites.set(code,copy(invite));},
  readInvite:async(code:string)=>copy(invites.get(code)),
  readMember:async(id:string,openid:string)=>copy(members.get(id+':'+openid)),
  writeMember:async(member:any)=>{members.set(member.shareId+':'+member.openid,copy(member));},
  membersFor:async(openid:string)=>[...members.values()].filter(m=>m.openid===openid).map(copy),
  membersOf:async(id:string)=>[...members.values()].filter(m=>m.shareId===id).map(copy)
 };
 return {trip,store};
}

test('invite permits a viewer to read itinerary while hiding booking and money data',async()=>{
 const {trip,store}=fixture();
 const handle=createSharedHandler(store,{random:()=> 'random-token',now:()=>Date.parse('2026-09-25T00:00:00Z')});
 const invite=await handle('createInvite',{tripId:trip.id},'owner');
 const peek=await handle('peekInvite',{code:invite.code},'viewer');
 assert.equal(peek.title,trip.title);
 const joined=await handle('joinInvite',{code:invite.code,name:'旅伴'},'viewer');
 assert.equal(joined.role,'viewer');
 assert.equal(joined.trip.stays[0].bookingNo,'');
 assert.equal(joined.trip.stays[0].phone,'');
 assert.equal(joined.trip.stays[0].amount,0);
 assert.equal(joined.trip.transports[0].bookingNo,'');
 assert.equal(joined.trip.transports[0].note,'');
 assert.equal(joined.trip.budget,0);
 assert.deepEqual(joined.trip.expenses,[]);
 await assert.rejects(handle('saveShared',{shareId:joined.shareId,version:joined.version,trip},'viewer'),/没有编辑权限/);
 await assert.rejects(handle('members',{shareId:joined.shareId},'viewer'),/仅发起人/);
});

test('owner approval grants editing but stale writes are rejected',async()=>{
 const {trip,store}=fixture();
 let serial=0;
 const handle=createSharedHandler(store,{random:()=>String(++serial).padStart(24,'0'),now:()=>Date.parse('2026-09-25T00:00:00Z')});
 const invite=await handle('createInvite',{tripId:trip.id},'owner');
 const joined=await handle('joinInvite',{code:invite.code,name:'旅伴'},'viewer');
 const people=await handle('members',{shareId:joined.shareId},'owner');
 const pending=people.find((p:any)=>p.name==='旅伴');
 assert.equal(pending.pendingEdit,true);
 await assert.rejects(handle('approveEdit',{shareId:joined.shareId,memberId:pending.memberId},'viewer'),/仅发起人/);
 await handle('approveEdit',{shareId:joined.shareId,memberId:pending.memberId},'owner');
 const visible=(await handle('listShared',{},'viewer'))[0];
 assert.equal(visible.role,'editor');
 const changed={...visible.trip,title:'阿尔山新安排'};
 const saved=await handle('saveShared',{shareId:joined.shareId,version:visible.version,trip:changed},'viewer');
 assert.equal(saved.trip.title,'阿尔山新安排');
 await assert.rejects(handle('saveShared',{shareId:joined.shareId,version:visible.version,trip:changed},'viewer'),/数据已更新/);
});
