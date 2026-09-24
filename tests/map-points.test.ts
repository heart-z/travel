import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fromMapPoint,toMapPoint,parseOpenPlaces} from '../src/domain/geo';
import {createTrip,validateTrip} from '../src/domain/trips';
test('OSM coordinates are converted into the existing GCJ02 storage convention',()=>{
  const stored=fromMapPoint({latitude:39.915,longitude:116.404});
  assert.ok(Math.abs(stored.longitude-116.41024449916938)<0.000001);
  const shown=toMapPoint(stored);
  assert.ok(Math.abs(shown.latitude-39.915)<0.00002);
  assert.ok(Math.abs(shown.longitude-116.404)<0.00002);
});
test('open place candidates retain identity and address and discard invalid coordinates',()=>{
  const places=parseOpenPlaces([{place_id:42,osm_type:'node',osm_id:7,name:'机场',display_name:'机场，中国',lat:'41.64',lon:'123.483'},{lat:'oops',lon:'0'}]);
  assert.equal(places.length,1);assert.equal(places[0].name,'机场');assert.equal(places[0].provider,'osm');
  const t=createTrip({title:'地图',city:'沈阳',startDate:'2026-10-01',endDate:'2026-10-01',budget:'',companion:''});
  t.items=[{id:'i',name:'机场',date:t.startDate,time:'',duration:0,note:'',kind:'交通',order:0,place:places[0]}];
  assert.doesNotThrow(()=>validateTrip(t));
});
