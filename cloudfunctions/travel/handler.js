const {validateTrip}=require('./domain.cjs');
function decodePolyline(encoded){const a=[...encoded];for(let i=2;i<a.length;i++)a[i]=a[i-2]+a[i]/1000000;return Array.from({length:a.length/2},(_,i)=>({latitude:a[i*2],longitude:a[i*2+1]}));}
function validateData(data){if(!data||!Number.isSafeInteger(data.version)||data.version<0||!Array.isArray(data.trips)||data.trips.length>100||JSON.stringify(data).length>700000)throw Error('数据格式或大小无效');data.trips.forEach(validateTrip);if(new Set(data.trips.map(t=>t.id)).size!==data.trips.length)throw Error('旅行编号重复');}
function createHandler(deps){return async(event,context)=>{
  const owner=context.OPENID;if(!owner)throw Error('请从微信小程序登录');
  switch(event.action){
    case 'load':return {...await deps.load(owner),accountId:owner};
    case 'save':validateData(event.data);if(event.data.accountId&&event.data.accountId!==owner)throw Error('账户已切换，请重新加载后再编辑');return {...await deps.save(owner,event.data),accountId:owner};
    case 'search':{
      const keyword=String(event.keyword||'').trim(),city=String(event.city||'').trim();if(!keyword||keyword.length>120||!city||city.length>80)throw Error('请填写地点与城市');
      const r=await deps.map('/ws/place/v1/search',{keyword,boundary:`region(${city},0)`,page_size:'6'});
      return (r.data||[]).map(p=>({id:p.id,name:p.title,address:p.address,latitude:p.location.lat,longitude:p.location.lng,provider:'tencent'}));
    }
    case 'route':{
      const valid=p=>p&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&Math.abs(p.latitude)<=90&&Math.abs(p.longitude)<=180;
      if(!valid(event.from)||!valid(event.to)||!['driving','walking'].includes(event.mode))throw Error('路线参数无效');
      const r=await deps.map(`/ws/direction/v1/${event.mode}/`,{from:`${event.from.latitude},${event.from.longitude}`,to:`${event.to.latitude},${event.to.longitude}`});
      const route=r.result?.routes?.[0];if(!route)throw Error('暂无可用路线');return {distance:route.distance,duration:route.duration*60,points:decodePolyline(route.polyline)};
    }
    default:throw Error('不支持的操作');
  }
};}
module.exports={createHandler,decodePolyline,validateData};

