import {validDate} from './dates';
export interface DailyForecast {date:string;low?:number;high?:number;rain?:number;wind?:number;description:string;}
export function forecastRange(date:string,today:string):'available'|'future'|'past'{
 if(!validDate(date)||!validDate(today))throw Error('天气日期无效');
 const days=(Date.parse(date)-Date.parse(today))/86400000;
 return days<0?'past':days>15?'future':'available';
}
export function parseDailyForecast(payload:unknown,date:string):DailyForecast|undefined{
 const daily=(payload as any)?.daily;
 if(!daily||!Array.isArray(daily.time))throw Error('天气服务返回的数据不完整');
 const index=daily.time.indexOf(date);if(index<0)return;
 const number=(key:string,min:number,max:number)=>{const v=daily[key]?.[index];return typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:undefined;};
 const code=number('weather_code',0,99);
 const description=code===undefined?'天气数据不全':code===0?'晴':code<=3?'多云':code<=48?'有雾':code<=57?'毛毛雨':code<=67?'有雨':code<=77?'有雪':code<=82?'阵雨':code<=86?'阵雪':'雷雨';
 return {date,low:number('temperature_2m_min',-100,70),high:number('temperature_2m_max',-100,70),rain:number('precipitation_probability_max',0,100),wind:number('wind_speed_10m_max',0,500),description};
}
export function weatherPreparation(forecast:DailyForecast):string[]{
 const tips:string[]=[];
 if(forecast.low!==undefined&&forecast.low<10)tips.push('早晚偏冷，准备保暖中层');
 if(forecast.rain!==undefined&&forecast.rain>=40)tips.push('有降水可能，带上雨具');
 if(forecast.wind!==undefined&&forecast.wind>=25)tips.push('风较大，备好防风外层');
 if(forecast.low!==undefined&&forecast.high!==undefined&&forecast.high-forecast.low>=10)tips.push('昼夜温差较大，分层穿衣');
 return tips;
}
