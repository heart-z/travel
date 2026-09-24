import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import path from 'node:path';
const {buildSync}=createRequire(path.resolve('package.json'))('esbuild');

const code=buildSync({entryPoints:['src/state.ts'],bundle:true,write:false,platform:'node',format:'cjs',external:['vue'],define:{'import.meta.env':JSON.stringify({VITE_API_URL:'https://example.test',VITE_CLOUD_ENV:'test-env'})}}).outputFiles[0].text;
function fixture(mode='selfhost') {
  const values=new Map<string,any>([['xingjian-provider',mode],['xingjian-api-token','alice']]);
  let offline=false,writes=0;
  const module={exports:{} as any};
  const uni={getStorageSync:(k:string)=>values.get(k)||'',setStorageSync:(k:string,v:any)=>values.set(k,v),showToast(){},request(options:any){
    if(offline){options.fail();return;}
    const owner=options.header.Authorization.slice(7);
    if(options.data.action==='save')writes++;
    options.success({statusCode:200,data:{ok:true,data:{version:options.data.action==='save'?1:0,trips:[],accountId:owner}}});
  }};
  vm.runInNewContext(code,{module,exports:module.exports,require:createRequire(path.resolve('package.json')),uni,console,setTimeout,clearTimeout,wx:{cloud:{}}});
  return {api:module.exports,values,setOffline:(v:boolean)=>offline=v,writes:()=>writes};
}
test('changing selfhost identity invalidates old state and cache before failed login',async()=>{
  const f=fixture(); await f.api.initialize(); assert.equal(f.api.state.data.accountId,'alice');
  f.setOffline(true); await f.api.changeToken('bob');
  assert.equal(f.api.state.ready,false); assert.equal(f.api.state.data.accountId,undefined);
  f.api.openCached(); assert.equal(f.api.state.ready,false);
  await assert.rejects(()=>f.api.commit(()=>{})); assert.equal(f.writes(),0);
  f.setOffline(false); await f.api.reload(); assert.equal(f.api.state.data.accountId,'bob');
});
test('offline remote cache is read only and cannot trigger any save',async()=>{
  const f=fixture(); await f.api.initialize(); f.setOffline(true); await f.api.reload(); f.api.openCached();
  assert.equal(f.api.state.readOnly,true); assert.equal(f.api.state.data.accountId,'alice');
  await assert.rejects(()=>f.api.commit(()=>{})); assert.equal(f.writes(),0);
  await f.api.switchBackend('local'); assert.equal(f.api.state.readOnly,false);
});
test('first use stays local even when a cloud environment is configured',()=>{
  const f=fixture(''); assert.equal(f.api.state.mode,'local');
});

