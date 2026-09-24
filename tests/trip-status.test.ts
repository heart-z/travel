import test from 'node:test';
import assert from 'node:assert/strict';
import {tripStatus} from '../src/domain/trip-status';

test('trip status counts down to departure using calendar days',()=>{
 assert.deepEqual(tripStatus('2026-10-01','2026-10-07','2026-09-24'),{phase:'upcoming',label:'7天后出发',description:'距离出发还有 7 天'});
 assert.equal(tripStatus('2026-10-01','2026-10-07','2026-09-30').label,'明天出发');
});

test('trip status includes the first and last travel days',()=>{
 assert.equal(tripStatus('2026-10-01','2026-10-07','2026-10-01').label,'出行第1天');
 assert.equal(tripStatus('2026-10-01','2026-10-07','2026-10-07').label,'出行第7天');
 assert.equal(tripStatus('2026-10-01','2026-10-07','2026-10-08').phase,'finished');
});

test('trip status works across a year boundary',()=>{
 assert.equal(tripStatus('2026-12-31','2027-01-02','2026-12-30').label,'明天出发');
 assert.equal(tripStatus('2026-12-31','2027-01-02','2027-01-01').label,'出行第2天');
});
