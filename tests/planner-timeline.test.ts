import test from 'node:test';
import assert from 'node:assert/strict';
import {planTimeline,timelineLabel} from '../src/domain/planner-timeline';
import {createTrip,validateTrip} from '../src/domain/trips';
import type {Item} from '../src/domain/types';

const item=(id:string,time='',duration=60,kind='游玩'):Item=>({id,name:id,date:'2026-10-04',order:0,time,duration,note:'',kind});

test('a fixed start, stop duration and entered travel minutes push later visits forward',()=>{
 const stops=[{...item('grassland','08:30'),travelMinutes:30},item('river','',90),item('town')];
 const slots=planTimeline(stops,[],540);
 assert.deepEqual(slots.map(s=>[s.start,s.end,s.precision]),[[510,570,'fixed'],[600,690,'estimate'],[690,750,'lower-bound']]);
 assert.equal(timelineLabel(slots[2]),'最早 11:30');
 assert.equal(stops[1].time,'');
});

test('a transport item between places contributes its duration without another imagined transfer',()=>{
 const stops=[item('lake','',60),item('drive','',45,'交通'),item('town','',30)];
 stops[1].name='前往黑山头';
 const slots=planTimeline(stops,[],540);
 assert.deepEqual(slots.map(s=>[s.start,s.end,s.precision]),[[540,600,'suggested'],[600,645,'estimate'],[645,675,'estimate']]);
});

test('a later fixed appointment stays fixed and reports a confirmed overlap',()=>{
 const stops=[{...item('a','09:00'),travelMinutes:30},item('b','10:00')];
 const slots=planTimeline(stops,[],540);
 assert.equal(slots[1].start,600);
 assert.equal(slots[1].conflictMinutes,30);
 assert.equal(slots[1].precision,'fixed');
});

test('a real route duration can fill an unentered transfer and cross midnight',()=>{
 const stops=[item('a','23:30',90),item('b')];
 const slots=planTimeline(stops,[{from:'a',to:'b',duration:1800}],540);
 assert.equal(slots[1].start,1530);
 assert.equal(timelineLabel(slots[1]),'预计 次日 01:30');
});

test('editable daily start and transfer minutes have bounded persisted values',()=>{
 const trip=createTrip({title:'路线',city:'阿尔山',startDate:'2026-10-04',endDate:'2026-10-04',budget:'0',companion:''});
 trip.dayStartTimes={'2026-10-04':'08:15'};
 trip.items=[{...item('a'),travelMinutes:35}];
 assert.doesNotThrow(()=>validateTrip(trip));
 trip.items[0].travelMinutes=-1;
 assert.throws(()=>validateTrip(trip));
 trip.items[0].travelMinutes=35;
 trip.dayStartTimes={'2026-10-05':'08:15'};
 assert.throws(()=>validateTrip(trip));
});
