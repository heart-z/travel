import {test} from 'node:test';import assert from 'node:assert/strict';
import {sheetAfterDrag,snapSheet,settleSheet} from '../src/domain/planner-sheet';
test('sheet drag expands and collapses across three bounded stops',()=>{
 assert.equal(sheetAfterDrag('map',4,-90),'split');assert.equal(sheetAfterDrag('split',0,-70),'list');assert.equal(sheetAfterDrag('list',0,90),'split');assert.equal(sheetAfterDrag('list',0,220),'map');assert.equal(sheetAfterDrag('map',0,-220),'list');assert.equal(sheetAfterDrag('map',0,90),'map');assert.equal(sheetAfterDrag('list',0,-90),'list');
});
test('horizontal gestures and small movements do not switch sheet mode',()=>{assert.equal(sheetAfterDrag('map',80,-50),'map');assert.equal(sheetAfterDrag('split',0,12),'split');});
test('sheet release settles to nearest stop or follows deliberate flick direction',()=>{
 const sizes=[242,420,600];assert.equal(snapSheet(280,0,sizes),'map');assert.equal(snapSheet(440,0,sizes),'split');assert.equal(snapSheet(560,0,sizes),'list');assert.equal(snapSheet(290,.8,sizes),'split');assert.equal(snapSheet(450,-.8,sizes),'split');assert.equal(snapSheet(200,-1,sizes),'map');assert.equal(snapSheet(700,1,sizes),'list');
});
test('a deliberate short upward swipe opens the itinerary instead of snapping back',()=>{
 const sizes=[218,420,600];
 assert.equal(settleSheet('map',278,0,sizes,3,-60),'split');
 assert.equal(settleSheet('split',480,0,sizes,0,-60),'list');
 assert.equal(settleSheet('list',540,0,sizes,0,60),'split');
 assert.equal(settleSheet('map',290,0,sizes,90,-60),'map');
 assert.equal(settleSheet('map',225,0,sizes,0,-12),'map');
});
