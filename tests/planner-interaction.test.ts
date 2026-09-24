import test from 'node:test';
import assert from 'node:assert/strict';
import {hasCoordinates} from '../src/domain/map-camera';
import {dropIndexAtY,edgeScrollStep} from '../src/domain/planner-drag';
import type {Item} from '../src/domain/types';

const item=(id:string,latitude?:number):Item=>({id,name:id,date:'2026-10-04',order:0,duration:60,time:'',note:'',kind:'游玩',...(latitude===undefined?{}:{place:{id,name:id,address:'',latitude,longitude:119,provider:'manual' as const}})});

test('a day without saved coordinates has no usable map',()=>{
 assert.equal(hasCoordinates([item('a'),item('b')]),false);
 assert.equal(hasCoordinates([item('a'),item('b',47)]),true);
});

test('drag drop chooses the row nearest the finger and clamps outside the list',()=>{
 const rows=[{top:100,bottom:150},{top:160,bottom:210},{top:220,bottom:270}];
 assert.equal(dropIndexAtY(180,rows),1);
 assert.equal(dropIndexAtY(275,rows),2);
 assert.equal(dropIndexAtY(20,rows),0);
});
test('dragging near the list edges scrolls toward hidden cards',()=>{
 const viewport={top:100,bottom:500};
 assert.equal(edgeScrollStep(300,viewport),0);
 assert.ok(edgeScrollStep(108,viewport)<0);
 assert.ok(edgeScrollStep(492,viewport)>0);
 assert.ok(edgeScrollStep(100,viewport)<edgeScrollStep(145,viewport));
});
