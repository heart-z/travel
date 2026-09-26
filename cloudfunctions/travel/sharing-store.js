const {memberId}=require('./sharing');

function createSharingStore(db,readAccount){
 const trips='travel_shared_trips',members='travel_shared_memberships',invites='travel_share_invites';
 const missing=error=>/-502005|collection not exist/i.test(String(error?.code||'')+' '+String(error?.message||error));
 const get=async(collection,id)=>{const result=await db.collection(collection).doc(id).get();return result.data||undefined;};
 const page=async(collection,key,value)=>{const result=await db.collection(collection).where({[key]:value}).limit(100).get();return result.data||[];};
 return {
  ensureCollections:async()=>{for(const name of [trips,members,invites]){try{await db.collection(name).limit(1).get();}catch(error){if(!missing(error))throw error;try{await db.createCollection(name);}catch(createError){try{await db.collection(name).limit(1).get();}catch{throw createError;}}}}},
  readPrivateTrip:async(owner,id)=>(await readAccount(owner)).trips.find(trip=>trip.id===id),
  findShare:async(owner,id)=>(await page(trips,'owner',owner)).find(share=>share.originTripId===id),
  readShare:id=>get(trips,id),
  writeShare:async record=>{const {id,...data}=record;await db.collection(trips).doc(id).set({data:{...data,id}});},
  casShare:async(id,version,trip)=>db.runTransaction(async tx=>{
   const result=await tx.collection(trips).doc(id).get(),current=result.data;
   if(!current||current.version!==version)throw Error('数据已更新，请重新加载共享行程后重试');
   const next={...current,version:version+1,trip};delete next._id;
   await tx.collection(trips).doc(id).set({data:next});return next;
  }),
  writeInvite:(code,invite)=>db.collection(invites).doc(code).set({data:invite}),
  readInvite:code=>get(invites,code),
  readMember:(shareId,openid)=>get(members,memberId(shareId,openid)),
  writeMember:async member=>{const {memberId:id,...data}=member;await db.collection(members).doc(id).set({data:{...data,memberId:id}});},
  membersFor:async openid=>{try{return await page(members,'openid',openid);}catch(error){if(missing(error))return [];throw error;}},
  membersOf:shareId=>page(members,'shareId',shareId)
 };
}
module.exports={createSharingStore};
