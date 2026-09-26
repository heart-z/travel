const crypto=require('node:crypto');
const {validateTrip}=require('./domain.cjs');

const copy=value=>JSON.parse(JSON.stringify(value));
const memberId=(shareId,openid)=>crypto.createHash('sha256').update(shareId+':'+openid).digest('hex').slice(0,40);
function viewerTrip(trip){
 const value=copy(trip);
 value.budget=0;value.expenses=[];value.settlements=[];value.packing=[];
 value.stays=(value.stays||[]).map(stay=>({...stay,bookingNo:'',phone:'',note:'',amount:0}));
 value.transports=(value.transports||[]).map(transport=>({...transport,bookingNo:'',note:''}));
 return value;
}
function createSharedHandler(store,options={}){
 const random=options.random||(()=>crypto.randomBytes(16).toString('hex'));
 const now=options.now||Date.now;
 const expiry=7*24*60*60*1000;
 const readShare=async id=>{const share=await store.readShare(id);if(!share)throw Error('共享旅行不存在');return share;};
 const access=async(id,openid)=>{const share=await readShare(id),member=await store.readMember(id,openid);if(!member)throw Error('尚未加入这趟旅行');return {share,member};};
 const ownerOnly=async(id,openid)=>{const entry=await access(id,openid);if(entry.share.owner!==openid||entry.member.role!=='owner')throw Error('仅发起人可以管理分享');return entry;};
 const result=(share,member)=>({shareId:share.id,version:share.version,role:member.role,pendingEdit:Boolean(member.pendingEdit),trip:member.role==='viewer'?viewerTrip(share.trip):copy(share.trip)});
 const inviteFor=async code=>{if(typeof code!=='string'||code.length<12||code.length>80)throw Error('分享链接无效');const invite=await store.readInvite(code);if(!invite||invite.expiresAt<=now())throw Error('分享链接已失效');return {invite,share:await readShare(invite.shareId)};};
 return async(action,event={},openid)=>{
  if(!openid)throw Error('请从微信小程序登录');
  if(action==='createInvite'){
   const tripId=event.tripId;if(typeof tripId!=='string'||!tripId||tripId.length>120)throw Error('旅行编号无效');
   const privateTrip=await store.readPrivateTrip(openid,tripId);if(!privateTrip)throw Error('仅旅行创建者可以邀请');
   if(store.ensureCollections)await store.ensureCollections();
   let share=await store.findShare(openid,tripId);
   if(!share){validateTrip(privateTrip);share={id:random(),owner:openid,originTripId:tripId,version:0,trip:copy(privateTrip)};await store.writeShare(share);}
   if(!await store.readMember(share.id,openid))await store.writeMember({shareId:share.id,openid,memberId:memberId(share.id,openid),name:'发起人',role:'owner',pendingEdit:false});
   const code=random(),expiresAt=now()+expiry;await store.writeInvite(code,{shareId:share.id,expiresAt});
   return {code,shareId:share.id,expiresAt,title:share.trip.title};
  }
  if(action==='peekInvite'){
   const {share}=await inviteFor(event.code);
   return {title:share.trip.title,city:share.trip.city,startDate:share.trip.startDate,endDate:share.trip.endDate};
  }
  if(action==='joinInvite'){
   const {share}=await inviteFor(event.code),name=String(event.name||'').trim();
   if(!name||name.length>30)throw Error('请填写 1–30 字的称呼');
   let member=await store.readMember(share.id,openid);
   if(!member){const all=await store.membersOf(share.id);if(all.length>=20)throw Error('这趟旅行的协同人数已满');member={shareId:share.id,openid,memberId:memberId(share.id,openid),name,role:'viewer',pendingEdit:true};await store.writeMember(member);}
   return result(share,member);
  }
  if(action==='listShared'){
   const memberships=await store.membersFor(openid);
   const visible=[];
   for(const member of memberships.slice(0,50)){const share=await store.readShare(member.shareId);if(share)visible.push(result(share,member));}
   return visible;
  }
  if(action==='members'){
   await ownerOnly(event.shareId,openid);
   return (await store.membersOf(event.shareId)).map(({memberId,name,role,pendingEdit})=>({memberId,name,role,pendingEdit:Boolean(pendingEdit)}));
  }
  if(action==='requestEdit'){
   const {member}=await access(event.shareId,openid);
   if(member.role==='viewer'&&!member.pendingEdit)await store.writeMember({...member,pendingEdit:true});
   return {pendingEdit:member.role==='viewer'};
  }
  if(action==='approveEdit'){
   await ownerOnly(event.shareId,openid);
   const people=await store.membersOf(event.shareId),member=people.find(person=>person.memberId===event.memberId);
   if(!member||member.role!=='viewer')throw Error('编辑申请不存在');
   await store.writeMember({...member,role:'editor',pendingEdit:false});return {approved:true};
  }
  if(action==='saveShared'){
   const {share,member}=await access(event.shareId,openid);
   if(member.role==='viewer')throw Error('没有编辑权限，请等待发起人批准');
   if(!Number.isSafeInteger(event.version)||event.version<0||!event.trip||event.trip.id!==share.trip.id)throw Error('共享旅行数据无效');
   validateTrip(event.trip);if(JSON.stringify(event.trip).length>700000)throw Error('共享旅行数据过大');
   const updated=await store.casShare(share.id,event.version,event.trip);
   return result(updated,member);
  }
  throw Error('不支持的共享操作');
 };
}
module.exports={createSharedHandler,viewerTrip,memberId};
