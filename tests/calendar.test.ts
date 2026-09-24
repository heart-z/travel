import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarLanes,tripColor} from '../src/domain/calendar';
import {createTrip} from '../src/domain/trips';
const trip=(id:string,start:string,end:string)=>({...createTrip({title:id,city:'贵阳',startDate:start,endDate:end,budget:'',companion:''}),id});
test('overlapping calendar trips retain lanes for the whole month and nonoverlapping trips reuse lanes',()=>{
  const a=trip('a','2026-09-29','2026-10-03'),b=trip('b','2026-10-02','2026-10-04'),c=trip('c','2026-10-04','2026-10-05');
  const lanes=calendarLanes([c,b,a,{...a,id:'archived',archived:true}],'2026-10');
  assert.deepEqual(lanes.map(row=>row.map(t=>t.id)),[['a','c'],['b']]);
  assert.equal(tripColor(a.id),tripColor(calendarLanes([a],'2026-09')[0][0].id));
  assert.equal(calendarLanes([a],'2026-11').length,0);
});
