import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseDailyForecast,forecastRange,weatherPreparation} from '../src/domain/weather';
test('forecast distinguishes outside window from unknown data, with inclusive 16 day limit',()=>{
 assert.equal(forecastRange('2026-10-04','2026-09-19'),'available');
 assert.equal(forecastRange('2026-10-05','2026-09-19'),'future');
 assert.equal(forecastRange('2026-09-18','2026-09-19'),'past');
});
test('weather null fields never become zero temperature or zero rain',()=>{
 const payload={daily:{time:['2026-10-01'],temperature_2m_min:[null],temperature_2m_max:[10],precipitation_probability_max:[null],weather_code:[null],wind_speed_10m_max:[null]}};
 const result=parseDailyForecast(payload,'2026-10-01');assert.equal(result?.low,undefined);assert.equal(result?.rain,undefined);assert.equal(result?.high,10);assert.equal(result?.description,'天气数据不全');
 assert.equal(parseDailyForecast(payload,'2026-10-02'),undefined);assert.throws(()=>parseDailyForecast({},'2026-10-01'));
});
test('preparation hints derive only from actual available forecast values',()=>{
 const result=parseDailyForecast({daily:{time:['2026-10-01'],temperature_2m_min:[2],temperature_2m_max:[13],precipitation_probability_max:[80],weather_code:[61],wind_speed_10m_max:[25]}},'2026-10-01')!;
 assert.match(weatherPreparation(result).join(' '),/保暖/);assert.match(weatherPreparation(result).join(' '),/雨具/);
 assert.equal(weatherPreparation({date:'2026-10-01',description:'天气数据不全'}).length,0);
});
