import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

// Exercise the deployed entry point; replace only the external SDK/database boundary.
function fixture(readError?: Error, initial?: unknown) {
  const records = new Map<string, any>();
  if (initial) records.set('alice', initial);
  let options: any = {}, queue = Promise.resolve();
  function collection() {
    return {
      where() { throw Error('where is not supported in transactions'); },
      doc(id: string) { return {
        async get() {
          if (readError) throw readError;
          if (!records.has(id) && options.throwOnNotFound !== false) throw Error('document does not exist');
          return { data: records.get(id) ?? null, errMsg: 'document.get:ok' };
        },
        async set({data}: any) { records.set(id, structuredClone(data)); return {errMsg:'document.set:ok'}; }
      }; }
    };
  }
  const db = {collection, runTransaction(fn: any) {
    const result = queue.then(() => fn({collection}));
    queue = result.catch(() => {}); return result;
  }};
  const cloud = {init() {}, database(config: any) {options=config ?? {};return db;}, getWXContext: () => ({OPENID:'alice'})};
  const filename = path.resolve('cloudfunctions/travel/index.js');
  const realRequire = createRequire(filename), exports: any = {};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'), {exports,process,require:(name:string)=>name==='wx-server-sdk'?cloud:realRequire(name)}, {filename});
  return {call: exports.main, records};
}

test('cloud adapter creates a missing account using transaction document reads', async () => {
  const f=fixture();
  const loaded=await f.call({action:'load'});
  assert.equal(loaded.ok,true); assert.equal(loaded.data.version,0);
  const saved=await f.call({action:'save',data:{version:0,trips:[]}});
  assert.equal(saved.ok,true); assert.equal(saved.data.version,1);
  assert.equal(saved.data.accountId,'alice'); assert.equal(f.records.get('alice').version,1);
});

test('cloud adapter preserves document data and rejects simultaneous stale saves', async () => {
  const f=fixture(undefined,{version:7,trips:[]});
  assert.equal((await f.call({action:'load'})).data.version,7);
  const results=await Promise.all([f.call({action:'save',data:{version:7,trips:[]}}),f.call({action:'save',data:{version:7,trips:[]}})]);
  assert.equal(results.filter(r=>r.ok).length,1);
  assert.match(results.find(r=>!r.ok).error,/数据已更新/);
  assert.equal(f.records.get('alice').version,8);
});

test('cloud adapter propagates permission network and missing-collection failures without writing', async () => {
  for(const message of ['permission denied','network timeout','collection does not exist']) {
    const f=fixture(Error(message));
    const result=await f.call({action:'save',data:{version:0,trips:[]}});
    assert.equal(result.ok,false); assert.equal(result.error,message); assert.equal(f.records.size,0);
  }
});
