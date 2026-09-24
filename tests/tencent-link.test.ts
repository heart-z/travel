import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(path.resolve('package.json'));
const {buildSync}=require('esbuild');
function fixture(url='http://127.0.0.1:8787',token='map-access',online='true'){
 const code=buildSync({entryPoints:['src/services/map-backend.ts'],bundle:true,write:false,platform:'node',format:'cjs',define:{'import.meta.env':JSON.stringify({VITE_MAP_API_URL:url,VITE_MAP_ONLINE:online})}}).outputFiles[0].text;
 const values=new Map<string,any>([['xingjian-provider','local'],['xingjian-map-token',token],['xingjian-api-token','storage-secret']]);
 const requests:any[]=[];const module={exports:{} as any};
 vm.runInNewContext(code,{module,exports:module.exports,require,uni:{getStorageSync:(k:string)=>values.get(k),setStorageSync:(k:string,v:any)=>values.set(k,v),request:(r:any)=>{requests.push(r);r.success({statusCode:200,data:{ok:true,data:[]}});}}});
 return {api:module.exports,values,requests};
}
test('Tencent maps work independently of local trip storage',async()=>{
 const f=fixture();assert.equal(f.api.mapAvailable(),true);await f.api.mapCall('search',{keyword:'阿尔山',city:'阿尔山'});
 assert.equal(f.requests[0].url,'http://127.0.0.1:8787/api');assert.equal(f.requests[0].header.Authorization,'Bearer map-access');assert.equal(f.values.get('xingjian-provider'),'local');
});
test('map connection rejects missing credentials and unsafe remote HTTP',async()=>{
 await assert.rejects(()=>fixture('https://maps.example','').api.mapCall('search',{}),/令牌/);
 await assert.rejects(()=>fixture('http://maps.example').api.mapCall('search',{}),/HTTPS/);
});
test('separate map connection cannot write trip data',async()=>{
 const f=fixture();await assert.rejects(()=>f.api.mapCall('save',{trips:[]}),/地图/);assert.equal(f.requests.length,0);
});

test('preview mode blocks online map requests even with backend configured',async()=>{const f=fixture('https://maps.example','map-access','');assert.equal(f.api.mapAvailable(),false);await assert.rejects(()=>f.api.mapCall('search',{}),/关闭/);assert.equal(f.requests.length,0);});

