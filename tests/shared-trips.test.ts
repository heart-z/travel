import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeSharedTrips} from '../src/domain/shared-trips';
import {createTrip} from '../src/domain/trips';

test('shared trip replaces the private origin in the visible list without mutating private backup',()=>{
 const personal=createTrip({title:'旧的本机安排',city:'阿尔山',startDate:'2026-10-01',endDate:'2026-10-02',budget:'0',companion:''});
 const shared={...personal,title:'共同更新的安排'};
 const privateData={version:4,trips:[personal]};
 const visible=mergeSharedTrips(privateData,[{shareId:'share-1',version:1,role:'editor' as const,pendingEdit:false,trip:shared}]);
 assert.equal(visible.trips.length,1);
 assert.equal(visible.trips[0].title,'共同更新的安排');
 assert.equal(privateData.trips[0].title,'旧的本机安排');
 assert.equal(visible.version,4);
});
