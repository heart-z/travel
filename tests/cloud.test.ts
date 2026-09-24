import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler, decodePolyline } from '../cloudfunctions/travel/handler.js';
test('cloud identifies owner from context and rejects unauthenticated calls',async()=>{
  let readOwner='';const h=createHandler({load:async(id:string)=>{readOwner=id;return {version:0,trips:[]};},save:async()=>({version:1,trips:[]}),map:async()=>({})});
  await assert.rejects(()=>h({action:'load',owner:'victim'},{}),/登录/);
  await h({action:'load',owner:'victim'},{OPENID:'real-owner'});
  assert.equal(readOwner,'real-owner');
});
test('cloud validates data before writes',async()=>{
  let wrote=false;const h=createHandler({load:async()=>({version:0,trips:[]}),save:async()=>{wrote=true;},map:async()=>({})});
  await assert.rejects(()=>h({action:'save',data:{version:0,trips:[{}]}},{OPENID:'a'}));
  assert.equal(wrote,false);
});
test('cloud rejects data loaded under a different account before persistence',async()=>{
  let wrote=false;const h=createHandler({load:async()=>({version:0,trips:[]}),save:async()=>{wrote=true;},map:async()=>({})});
  await assert.rejects(()=>h({action:'save',data:{version:0,trips:[],accountId:'alice'}},{OPENID:'bob'}),/账户/);
  assert.equal(wrote,false);
});
test('polyline decoding uses millionth degree delta without mutating response',()=>{
  const encoded=[26.5,106.7,10000,-20000];
  assert.deepEqual(decodePolyline(encoded),[{latitude:26.5,longitude:106.7},{latitude:26.51,longitude:106.68}]);
  assert.deepEqual(encoded,[26.5,106.7,10000,-20000]);
});
