import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {createRequire} from 'node:module';

const {buildSync}=createRequire(path.resolve('package.json'))('esbuild');
const code=buildSync({entryPoints:['src/services/cloud.ts'],bundle:true,write:false,platform:'node',format:'cjs',define:{'import.meta.env':JSON.stringify({VITE_CLOUD_ENV:'test-env'})}}).outputFiles[0].text;

function fixture(callFunction:()=>Promise<unknown>,instantTimeout=false){
 const module={exports:{} as any};
 const wx={cloud:{init(){},callFunction}};
 vm.runInNewContext(code,{module,exports:module.exports,wx,setTimeout:instantTimeout?(callback:()=>void)=>{callback();return 1;}:setTimeout,clearTimeout,console});
 return module.exports.callCloud as (action:string)=>Promise<unknown>;
}

test('a cloud load that never returns ends with an actionable error',async()=>{
 const callCloud=fixture(()=>new Promise(()=>{}),true);
 await assert.rejects(()=>callCloud('load'),/连接云端超时/);
});

test('an uncertain cloud save reports its result as unconfirmed',async()=>{
 const callCloud=fixture(()=>new Promise(()=>{}),true);
 await assert.rejects(()=>callCloud('save'),/保存超时，结果尚未确认/);
});

test('a responding cloud load still returns its data',async()=>{
 const callCloud=fixture(async()=>({result:{ok:true,data:{version:1,trips:[]}}}));
 assert.equal((await callCloud('load') as {version:number}).version,1);
});

test('cloud polling failure is shown as a short network error',async()=>{
 const callCloud=fixture(async()=>{throw Error('cloud.callFunction:fail -404005 exceed max poll retry. (trace: long SDK log)');});
 await assert.rejects(()=>callCloud('load'),/^Error: 微信云端连接失败（-404005），请切换网络后重试$/);
});
