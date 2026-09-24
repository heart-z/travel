const https=require('node:https');
const crypto=require('node:crypto');
function requestMap(path,params,key,secret){
  if(!key)return Promise.reject(Error('服务端尚未配置腾讯地图 Key'));
  const query={...params,key};delete query.sig;delete query.sk;
  const names=Object.keys(query).sort();
  const url=new URL('https://apis.map.qq.com'+path);names.forEach(k=>url.searchParams.set(k,String(query[k])));
  if(secret){const raw=path+'?'+names.map(k=>k+'='+String(query[k])).join('&')+secret;url.searchParams.set('sig',crypto.createHash('md5').update(raw,'utf8').digest('hex'));}
  return new Promise((resolve,reject)=>{const req=https.get(url,{timeout:12000},res=>{res.setEncoding('utf8');let raw='';res.on('data',c=>{raw+=c;if(raw.length>4000000){req.destroy();reject(Error('地图响应过大'));}});res.on('end',()=>{try{const data=JSON.parse(raw);if(res.statusCode!==200||data.status!==0)throw Error('Unavailable');resolve(data);}catch{reject(Error('地图服务暂不可用，请检查 Key、权限及配额'));}});});req.on('timeout',()=>{req.destroy();reject(Error('地图请求超时'));});req.on('error',()=>reject(Error('地图连接失败')));});
}
module.exports={requestMap};

