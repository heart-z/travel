import test from 'node:test';
import assert from 'node:assert/strict';
import {plannerEntries,pointLabel,presentationNote,transitionMode} from '../src/domain/planner-presentation';
import {movePointWithTransit,movePointToDayWithTransit} from '../src/domain/itinerary';
import {createTrip} from '../src/domain/trips';
import type {Item} from '../src/domain/types';
const step=(id:string,kind:string,name:string,place=false):Item=>({id,kind,name,date:'2026-10-04',order:0,time:'',duration:60,note:'',...(place?{place:{id,name,address:'',latitude:48,longitude:119,provider:'manual' as const}}:{})});
test('route descriptions become one transit group between numbered places',()=>{
 const entries=plannerEntries([step('a','游玩','莫日格勒河'),step('b','交通','莫日格勒河 → 额尔古纳'),step('c','交通','前往午餐地点'),step('d','餐饮','额尔古纳午餐')]);
 assert.deepEqual(entries.map(e=>e.type==='point'?`point:${e.number}:${e.item.id}`:`transit:${e.items.map(i=>i.id).join(',')}`),['point:1:a','transit:b,c','point:2:d']);
});
test('the first and last daily events remain named points while transport connects two points',()=>{
 const entries=plannerEntries([
  step('arrival','交通','约16:30抵达沈阳'),
  step('train','交通','沈阳 → 乌兰浩特方向夜火车'),
 ]);
 assert.deepEqual(entries.map(e=>e.type==='point'?`point:${e.number}:${e.item.name}`:'transit'),[
  'point:1:约16:30抵达沈阳','point:2:沈阳 → 乌兰浩特方向夜火车'
 ]);
 const mixed=plannerEntries([
  step('origin','交通','黑山头出发'),step('drive','交通','前往呼伦湖'),step('lake','游玩','呼伦湖'),step('night','交通','满洲里 → 哈尔滨夜火车')
 ]);
 assert.deepEqual(mixed.map(e=>e.type==='point'?`point:${e.number}:${e.item.id}`:`transit:${e.items.map(i=>i.id).join(',')}`),[
  'point:1:origin','transit:drive','point:2:lake','point:3:night'
 ]);
});
test('arrival locations remain points and route names stay out of place labels',()=>{
 const entries=plannerEntries([step('a','交通','抵达沈阳桃仙机场',true),step('b','交通','桃仙机场 → 沈阳站',true),step('c','住宿','呼伦湖 → 满洲里，入住',true)]);
 assert.equal(entries[0].type,'point');
 assert.equal(entries[1].type,'transit');
 assert.equal(pointLabel(step('c','住宿','呼伦湖 → 满洲里，入住')),'满洲里，入住');
 assert.equal(pointLabel(step('d','交通','约16:30抵达沈阳')),'沈阳');
 assert.equal(pointLabel(step('e','交通','黑山头出发')),'黑山头');
 assert.equal(pointLabel(step('f','交通','哈尔滨转往机场')),'哈尔滨');
 assert.equal(pointLabel(step('g','交通','满洲里 → 哈尔滨夜火车')),'夜火车前往哈尔滨');
 assert.equal(presentationNote('Notion 记录为约 16:30，实际以票面为准'),'实际以票面为准');
});
test('known rail and air travel is named without defaulting to driving',()=>{
 assert.equal(transitionMode(step('a','交通','沈阳 → 乌兰浩特夜火车')),'train');
 assert.equal(transitionMode(step('b','交通','返程航班')),'flight');
 assert.equal(transitionMode(step('c','交通','前往呼伦湖')),'manual');
});
test('moving a point carries its incoming transit step',()=>{
 const trip=createTrip({title:'路线',city:'海拉尔',startDate:'2026-10-04',endDate:'2026-10-04',budget:'0',companion:''});
 trip.items=[step('a','游玩','草原'),step('b','游玩','莫尔格勒河'),step('c','交通','前往黑山头'),step('d','住宿','黑山头')].map((item,order)=>({...item,order}));
 const moved=movePointWithTransit(trip,'d',1);
 assert.deepEqual(moved.items.map(i=>i.id),['a','c','d','b']);
 assert.deepEqual(moved.items.map(i=>i.order),[0,1,2,3]);
});
test('moving a point to another day carries its incoming transit and reorders both days',()=>{
 const trip=createTrip({title:'路线',city:'海拉尔',startDate:'2026-10-04',endDate:'2026-10-05',budget:'0',companion:''});
 trip.items=[step('a','游玩','草原'),step('b','交通','前往黑山头'),step('c','住宿','黑山头'),{...step('d','游玩','阿尔山'),date:'2026-10-05'}].map((item,order)=>({...item,order:order===3?0:order}));
 const moved=movePointToDayWithTransit(trip,'c','2026-10-05');
 assert.deepEqual(moved.items.filter(i=>i.date==='2026-10-04').map(i=>i.id),['a']);
 assert.deepEqual(moved.items.filter(i=>i.date==='2026-10-05').map(i=>i.id),['d','b','c']);
 assert.deepEqual(moved.items.filter(i=>i.date==='2026-10-05').map(i=>i.order),[0,1,2]);
 assert.equal(trip.items.find(i=>i.id==='c')?.date,'2026-10-04');
});
