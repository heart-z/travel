import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {PassThrough} from 'node:stream';
import {EventEmitter} from 'node:events';
import crypto from 'node:crypto';

test('map transport preserves Chinese POI names across UTF-8 network chunk boundaries',async()=>{
  const module={exports:{} as any};
  const expected={status:0,data:[{title:'贵阳',address:'中文地址'}]};
  const payload=Buffer.from(JSON.stringify(expected)),cut=payload.indexOf(Buffer.from('贵'))+1;
  const https={get(_url:any,_options:any,callback:any){
    const req=Object.assign(new EventEmitter(),{destroy(){}});
    queueMicrotask(()=>{const response=Object.assign(new PassThrough(),{statusCode:200});callback(response);response.write(payload.subarray(0,cut));response.end(payload.subarray(cut));});return req;
  }};
  vm.runInNewContext(fs.readFileSync('cloudfunctions/travel/tencent.js','utf8'),{module,exports:module.exports,URL,Buffer,require:(name:string)=>name==='node:crypto'?crypto:https});
  const result=await module.exports.requestMap('/ws/place/v1/search',{keyword:'贵阳'},'test-key');
  assert.equal(result.data[0].title,'贵阳');assert.equal(result.data[0].address,'中文地址');
});
test('Tencent signature sorts raw parameters before URL encoding and never sends secret',async()=>{
 const module={exports:{} as any};let sent:URL|undefined;
 const https={get(url:URL,_options:any,callback:any){sent=url;const req=Object.assign(new EventEmitter(),{destroy(){}});queueMicrotask(()=>{const response=Object.assign(new PassThrough(),{statusCode:200});callback(response);response.end('{"status":0,"data":[]}');});return req;}};
 vm.runInNewContext(fs.readFileSync('cloudfunctions/travel/tencent.js','utf8'),{module,exports:module.exports,URL,Buffer,require:(name:string)=>name==='node:crypto'?crypto:https});
 await module.exports.requestMap('/ws/place/v1/search',{output:'json',keyword:'机场 A&B',boundary:'region(哈尔滨,0)'},'test-key','test-secret');
 assert.equal(sent!.searchParams.get('sig'),'296f0f9a5ffedfe2aaf9b25c41831416');assert.equal(sent!.searchParams.get('keyword'),'机场 A&B');assert.equal(sent!.href.includes('test-secret'),false);
});
