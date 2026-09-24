import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RoutePlanner} from '../src/services/route-planner';
import {planTimes} from '../src/domain/schedule';
import type {Item} from '../src/domain/types';
const items=():Item[]=>['a','b','c'].map((id,i)=>({id,name:id,date:'2026-10-01',order:i,time:'',duration:0,note:'',kind:'游玩',place:{id,name:id,address:'',latitude:40+i,longitude:120,provider:'manual'}}));
test('one failed road leg preserves successful legs and never invents travel time',async()=>{
 const planner=new RoutePlanner(async(from)=>{if(from.latitude===40)throw Error('无可行道路');return {distance:1000,duration:600,points:[]};});
 const legs=await planner.plan(items(),'driving');assert.equal(legs.length,2);assert.equal(legs[0].error,'无可行道路');assert.equal(legs[0].duration,undefined);assert.equal(legs[1].duration,600);
 assert.equal(planTimes(items(),legs)[1].source,'unknown');
});
test('manual per-leg modes and linked bookings bypass road requests',async()=>{
 let calls=0;const planner=new RoutePlanner(async()=>{calls++;return {distance:1000,duration:600,points:[]};});
 const stops=items();stops[0].travelMode='train';
 let legs=await planner.plan(stops,'walking');assert.equal(calls,1);assert.equal(legs[0].mode,'train');assert.equal(legs[0].duration,undefined);
 legs=await planner.plan(items(),'driving',[{id:'f',name:'航班',mode:'flight',departure:'2026-10-01T08:00',arrival:'2026-10-01T10:00',fromName:'a',toName:'b',fromItemId:'a',toItemId:'b',bookingNo:'',note:''}]);
 assert.equal(calls,2);assert.equal(legs[0].mode,'flight');assert.equal(legs[0].duration,undefined);
});
test('unchanged geometry reuses results while coordinate edits invalidate only affected legs',async()=>{
 let calls=0;const planner=new RoutePlanner(async()=>{calls++;return {distance:1000,duration:600,points:[]};});
 const stops=items();await planner.plan(stops,'driving');stops[0].note='修改备注';await planner.plan(stops,'driving');assert.equal(calls,2);
 stops[0].place!.latitude=39;await planner.plan(stops,'driving');assert.equal(calls,3);
});
test('missing places are not bypassed and failed requests can be retried',async()=>{
 let calls=0;const planner=new RoutePlanner(async()=>{if(++calls===1)throw Error('暂时失败');return {distance:1000,duration:600,points:[]};});
 const stops=items();delete stops[1].place;assert.equal((await planner.plan(stops,'driving')).length,0);assert.equal(calls,0);
 await planner.plan(items().slice(0,2),'driving');assert.equal((await planner.plan(items().slice(0,2),'driving'))[0].duration,600);
});
