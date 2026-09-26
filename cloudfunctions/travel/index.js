const cloud=require('wx-server-sdk');
const {requestMap}=require('./tencent');
const {createHandler}=require('./handler');
const {createSharedHandler}=require('./sharing');
const {createSharingStore}=require('./sharing-store');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
// wx-server-sdk 3.0.1 returns data:null only for a missing document with this
// option. Permission, transport and missing-collection errors still propagate.
const db=cloud.database({throwOnNotFound:false});
const collection='travel_accounts';
async function read(dbOrTransaction,owner){const r=await dbOrTransaction.collection(collection).doc(owner).get();return r.data??{version:0,trips:[]};}
function publicData(d){return {version:d.version,trips:d.trips};}
const handler=createHandler({
  load:async owner=>publicData(await read(db,owner)),
  save:async(owner,data)=>db.runTransaction(async tx=>{
    const current=await read(tx,owner);if(current.version!==data.version)throw Error('数据已更新，请返回“我的”刷新后重试');
    const next={version:data.version+1,trips:data.trips};await tx.collection(collection).doc(owner).set({data:next});return next;
  }),
  map:(path,params)=>requestMap(path,params,process.env.TENCENT_MAP_KEY,process.env.TENCENT_MAP_SK)
});
const shared=createSharedHandler(createSharingStore(db,owner=>read(db,owner)));
exports.main=async event=>{try{const context=cloud.getWXContext();return {ok:true,data:event.action?.endsWith('Invite')||['listShared','members','requestEdit','approveEdit','saveShared'].includes(event.action)?await shared(event.action,event,context.OPENID):await handler(event,context)};}catch(e){return {ok:false,error:e.message||'服务异常'};}};
