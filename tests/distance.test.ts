import test from 'node:test';
import assert from 'node:assert/strict';
import {straightLineMeters} from '../src/domain/distance';
import type {Place} from '../src/domain/types';

test('straight-line fallback reports zero for one place and a plausible gap between located stops',()=>{
 const river={latitude:49.461573,longitude:119.709888} as Place;
 const town={latitude:50.215591,longitude:119.578421} as Place;
 assert.equal(straightLineMeters(river,river),0);
 const meters=straightLineMeters(river,town);
 assert.ok(meters>83000&&meters<86000);
 assert.equal(straightLineMeters(river,town),straightLineMeters(town,river));
});
