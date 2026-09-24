import type {Place} from '../domain/types';
import {toMapPoint} from '../domain/geo';
import {today} from '../domain/dates';
import {forecastRange,parseDailyForecast,type DailyForecast} from '../domain/weather';
const cache=new Map<string,{payload:unknown;at:number}>();
const pending=new Map<string,Promise<unknown>>();
export async function fetchWeather(place:Place,date:string):Promise<{forecast?:DailyForecast;updatedAt:number}>{
 const range=forecastRange(date,today());if(range!=='available')throw Error(range==='future'?'还未进入16天预报范围，临近出发再查':'此日期已过去，当前入口只查询预报');
 const point=toMapPoint(place),lat=point.latitude.toFixed(2),lon=point.longitude.toFixed(2),key=lat+','+lon+':'+today();
 let stored=cache.get(key);
 if(!stored||Date.now()-stored.at>30*60*1000){
  if(!pending.has(key)){
   const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max&timezone=Asia%2FShanghai&forecast_days=16`;
   pending.set(key,new Promise((resolve,reject)=>uni.request({url,timeout:12000,success:r=>r.statusCode===200?resolve(r.data):reject(Error('天气服务暂不可用，请稍后再试')),fail:()=>reject(Error('天气未连接，请检查网络；微信端还需配置天气服务域名'))})).finally(()=>pending.delete(key)));
  }
  const payload=await pending.get(key)!;parseDailyForecast(payload,date);stored={payload,at:Date.now()};cache.set(key,stored);
 }
 return {forecast:parseDailyForecast(stored.payload,date),updatedAt:stored.at};
}
