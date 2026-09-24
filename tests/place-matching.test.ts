import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrip} from '../src/domain/trips';
import {savedPlaceCandidates,chosenMapPlace} from '../src/domain/place-matching';

test('reuses a unique saved place but keeps same-named locations distinct',()=>{
 const trip=createTrip({title:'旅行',city:'呼伦贝尔',startDate:'2026-10-01',endDate:'2026-10-03',budget:'0',companion:''});
 const place={id:'p1',name:'莫尔格勒河景区',address:'呼伦贝尔',latitude:49.46,longitude:119.71,provider:'manual' as const};
 trip.items=[{id:'a',name:'莫尔格勒河景区',date:'2026-10-01',order:0,time:'',duration:60,note:'',kind:'游玩',place},
  {id:'b',name:'莫尔格勒河景区',date:'2026-10-02',order:0,time:'',duration:60,note:'',kind:'游玩',place:{...place,id:'p2',latitude:48.5}}];
 assert.equal(savedPlaceCandidates(trip,' 莫尔格勒河景区 ','2026-10-02')[0].id,'p2');
 assert.equal(savedPlaceCandidates(trip,'莫尔格勒河景区','2026-10-03').length,2);
 trip.items.pop();
 assert.deepEqual(savedPlaceCandidates(trip,'莫尔格勒河景区','2026-10-03'),[place]);
});

test('native map selection keeps GCJ-02 coordinates and rejects invalid results',()=>{
 assert.deepEqual(chosenMapPlace({name:' 阿尔山景区 ',address:' 内蒙古 ',latitude:47.2,longitude:120.4},'wx-1'),{id:'wx-1',name:'阿尔山景区',address:'内蒙古',latitude:47.2,longitude:120.4,provider:'manual'});
 assert.throws(()=>chosenMapPlace({name:'x',address:'',latitude:NaN,longitude:120},'bad'));
});
