import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planTimes,formatTime} from '../src/domain/schedule';
import type {Item} from '../src/domain/types';
const item=(id:string,time:string,duration=60):Item=>({id,name:id,date:'2026-09-17',order:0,time,duration,note:'',kind:'游玩'});
test('time suggestions use real route duration and never overwrite fixed times',()=>{
  const items=[item('a','09:00'),item('b',''),item('c','10:50')];
  const rows=planTimes(items,[{from:'a',to:'b',duration:1200},{from:'b',to:'c',duration:600}]);
  assert.equal(rows[1].start,620); assert.equal(rows[1].source,'estimate');
  assert.equal(rows[2].start,650); assert.equal(rows[2].conflictMinutes,40);
  assert.equal(items[1].time,''); assert.equal(items[2].time,'10:50');
});
test('missing traffic never invents arrival times but still detects overlapping stays',()=>{
  const rows=planTimes([item('a','09:00'),item('b','09:30'),item('c','')],[]);
  assert.equal(rows[1].conflictMinutes,30);assert.equal(rows[1].trafficUnknown,true);
  assert.equal(rows[2].start,undefined);assert.equal(rows[2].trafficUnknown,true);
});
test('overnight durations display next day and fixed early times conflict instead of silently moving a day',()=>{
  const rows=planTimes([item('a','23:30',120),item('b','')],[{from:'a',to:'b',duration:1800}]);
  assert.equal(formatTime(rows[0].end), '次日 01:30'); assert.equal(formatTime(rows[1].start),'次日 02:00');
  assert.equal(planTimes([item('a','23:30',120),item('b','01:00')],[])[1].conflictMinutes,1470);
});
