import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateRange, monthCells } from '../src/domain/dates';
import { parseCents, splitEqual, balances } from '../src/domain/money';
import { parsePlaces, importItems, moveItem } from '../src/domain/itinerary';
import { createTrip, updateTrip, validateTrip } from '../src/domain/trips';

const trip = () => createTrip({ title: '贵阳旅行', city: '贵阳', startDate: '2026-09-30', endDate: '2026-10-02', budget: '1000', companion: '小林' });
test('dates cross month without losing days and reject calendar overflow', () => {
  assert.deepEqual(dateRange('2026-09-30', '2026-10-02'), ['2026-09-30', '2026-10-01', '2026-10-02']);
  assert.throws(() => dateRange('2026-02-30', '2026-03-02'));
  assert.throws(() => dateRange('2026-10-02', '2026-09-30'));
  assert.equal(monthCells('2026-02').filter(Boolean).length, 28);
});
test('money rejects imprecise or negative input and assigns remainder deterministically', () => {
  assert.equal(parseCents('12.30'), 1230);
  for (const value of ['-1', '1.001', 'NaN', '1e4']) assert.throws(() => parseCents(value));
  assert.deepEqual(splitEqual(100, ['a', 'b', 'c']), { a: 34, b: 33, c: 33 });
});
test('settlement closes balances without counting as spending', () => {
  const t = trip(); const [a,b] = t.members.map(m => m.id);
  t.expenses = [
    { id:'e1', title:'住宿', category:'住宿', date:'2026-09-30', amount:60000, payer:a, shares:{[a]:30000,[b]:30000} },
    { id:'e2', title:'餐饮', category:'餐饮', date:'2026-09-30', amount:10000, payer:b, shares:{[a]:5000,[b]:5000} }
  ];
  assert.deepEqual(balances(t), {[a]:25000,[b]:-25000});
  t.settlements.push({id:'s',from:b,to:a,amount:25000,date:'2026-09-30'});
  assert.deepEqual(balances(t), {[a]:0,[b]:0});
  assert.equal(t.expenses.reduce((n,e)=>n+e.amount,0),70000);
});
test('imports preserve order, tolerate unresolved places and reject duplicate request', () => {
  assert.deepEqual(parsePlaces('甲秀楼，青岩古镇\n 贵阳北站、甲秀楼'), ['甲秀楼','青岩古镇','贵阳北站']);
  const original=trip(); const t=importItems(original, '2026-09-30', [{name:'甲秀楼'},{name:'青岩古镇'}], 'request-1');
  assert.equal(original.items.length,0);
  assert.deepEqual(t.items.map(i=>i.name),['甲秀楼','青岩古镇']);
  assert.equal(t.items[0].place,undefined);
  assert.equal(importItems(t,'2026-09-30',[{name:'甲秀楼'}],'request-1').items.length,2);
});
test('moving across days reindexes and shortening dates never silently deletes items', () => {
  const t=importItems(trip(),'2026-09-30',[{name:'A'},{name:'B'},{name:'C'}],'r');
  const moved=moveItem(t,t.items[1].id,'2026-10-02',0);
  assert.deepEqual(moved.items.filter(i=>i.date==='2026-09-30').map(i=>[i.name,i.order]),[['A',0],['C',1]]);
  assert.equal(moved.items.find(i=>i.name==='B')?.date,'2026-10-02');
  assert.throws(()=>updateTrip(moved,{endDate:'2026-10-01'}));
});
test('invalid shares and foreign member references cannot be persisted', () => {
  const t=trip();t.expenses.push({id:'e',title:'餐费',category:'餐饮',date:t.startDate,amount:100,payer:t.members[0].id,shares:{stranger:100}});
  assert.throws(()=>validateTrip(t));
  t.expenses[0].shares={[t.members[0].id]:99}; assert.throws(()=>validateTrip(t));
});
test('aggregate settlement may exceed one individual expense limit',()=>{const t=trip();const [a,b]=t.members.map(m=>m.id);t.expenses=[1,2].map(n=>({id:String(n),title:'住宿',category:'住宿',date:t.startDate,amount:60000000,payer:a,shares:{[b]:60000000}}));t.settlements.push({id:'s',from:b,to:a,amount:120000000,date:t.startDate});assert.doesNotThrow(()=>validateTrip(t));assert.deepEqual(balances(t),{[a]:0,[b]:0});});
test('batch imports distribute dates atomically and append in each day independently',()=>{
  const t=importItems(trip(),'2026-09-30',[{name:'Existing'}],'initial');
  const next=importItems(t,'2026-09-30',[{name:'A',date:'2026-10-01'},{name:'B',date:'2026-09-30'},{name:'C',date:'2026-10-01'}],'multi');
  assert.deepEqual(next.items.map(i=>[i.name,i.date,i.order]),[['Existing','2026-09-30',0],['A','2026-10-01',0],['B','2026-09-30',1],['C','2026-10-01',1]]);
  assert.throws(()=>importItems(t,'2026-09-30',[{name:'Invalid',date:'2026-10-03'}],'invalid'));
  assert.equal(t.items.length,1);
  assert.equal(importItems(next,'2026-09-30',[{name:'A'}],'multi').items.length,4);
});
