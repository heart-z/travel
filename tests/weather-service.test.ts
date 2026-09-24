import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fetchWeather} from '../src/services/weather';
import {today} from '../src/domain/dates';
test('invalid successful weather responses can be retried and valid responses are cached',async()=>{
 const previous=(globalThis as any).uni;let calls=0;
 (globalThis as any).uni={request(options:any){calls++;options.success({statusCode:200,data:calls===1?{}:{daily:{time:[today()],temperature_2m_min:[3],temperature_2m_max:[14]}}});}};
 try{
  const place={id:'weather-test',name:'测试地点',address:'',latitude:47.1,longitude:119.9};
  await assert.rejects(fetchWeather(place,today()),/不完整/);
  assert.equal((await fetchWeather(place,today())).forecast?.low,3);
  await fetchWeather(place,today());assert.equal(calls,2);
 }finally{(globalThis as any).uni=previous;}
});
