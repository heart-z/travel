import {check,dateValid,categories,modes,type Kind,type Data} from './model.ts';
import {arrivalInstant} from './domain.ts';
const kinds=['participant','item','stay','transport','guide','expense','settlement','packing'];
export function safeObject(value:unknown):asserts value is Data{check(value&&typeof value==='object'&&!Array.isArray(value),'资料格式无效');for(const [key,v] of Object.entries(value)){check(!['__proto__','prototype','constructor'].includes(key),'包含不安全字段');if(v&&typeof v==='object')Array.isArray(v)?v.forEach(x=>{if(x&&typeof x==='object')safeObject(x)}):safeObject(v)}}
const text=(v:unknown,max=2000)=>typeof v==='string'&&v.length<=max;
const integer=(v:unknown,max=100000000)=>Number.isSafeInteger(v)&&(v as number)>=0&&(v as number)<=max;
export function validateEntity(kind:Kind,input:unknown):Data{
 check(kinds.includes(kind),'类型无效');safeObject(input);check(JSON.stringify(input).length<=30000,'内容过长');const d={...input};
 if(['participant','item','stay','transport','packing'].includes(kind))check(text(d.name,120)&&d.name.trim(),'名称需填写，最多 120 字');
 if(d.note===undefined)d.note='';check(text(d.note,12000),'备注过长');
 if(kind==='item'){d.date??=null;d.durationMinutes??=60;d.fixedTime??=null;d.completed??=false;d.place??=null;d.locationStatus??='unconfirmed';check(d.date===null||dateValid(d.date),'事项日期无效');check(integer(d.durationMinutes,10080),'停留时间无效');check(d.fixedTime===null||/^([01]\d|2[0-3]):[0-5]\d$/.test(d.fixedTime),'时刻无效');check(typeof d.completed==='boolean','状态无效');check(['confirmed','unconfirmed','not-needed'].includes(d.locationStatus),'位置状态无效');if(d.place){safeObject(d.place);check(Number.isFinite(d.place.latitude)&&Math.abs(d.place.latitude)<=90&&Number.isFinite(d.place.longitude)&&Math.abs(d.place.longitude)<=180&&['WGS84','GCJ02'].includes(d.place.crs),'坐标无效')}}
 if(kind==='packing'){check(categories.some(c=>c[0]===d.category),'物品分类无效');check(integer(d.quantity,999)&&d.quantity>0,'数量应为 1 至 999');check(typeof d.packed==='boolean'&&['pack','wear'].includes(d.carryMode),'物品状态无效');d.participantId??=null}
 if(kind==='stay'){check(dateValid(d.checkIn)&&dateValid(d.checkOut)&&d.checkOut>d.checkIn,'退房日期须晚于入住');check(['planned','booked'].includes(d.status),'预订状态无效');if(d.amount!==undefined)check(integer(d.amount),'金额无效')}
 if(kind==='transport'){check(modes.some(m=>m[0]===d.mode),'交通方式无效');check(['planned','booked'].includes(d.status),'预订状态无效');check(text(d.fromName,120)&&text(d.toName,120),'起止地点无效');d.departure??=null;d.arrival??=null;d.fromItemId??=null;d.toItemId??=null}
 if(kind==='guide'){check(text(d.title,120)&&d.title.trim()&&text(d.content,12000),'攻略标题或正文无效');d.sourceUrl??='';check(!d.sourceUrl||/^https?:\/\//i.test(d.sourceUrl)&&(()=>{try{return !!new URL(d.sourceUrl).hostname}catch{return false}})(),'链接仅支持 http / https');d.sourceText??='';check(text(d.sourceText,4000),'分享原文过长');d.dates??=[];d.itemIds??=[];check(Array.isArray(d.dates)&&d.dates.length<=366&&d.dates.every(dateValid)&&Array.isArray(d.itemIds)&&d.itemIds.length<=500,'关联无效');check(['guide','transport','checklist'].includes(d.category),'攻略分类无效')}
 if(kind==='expense'){check(text(d.title,120)&&d.title.trim()&&integer(d.amount)&&d.amount>0&&dateValid(d.date),'支出内容或金额无效');safeObject(d.shares);check(Object.values(d.shares).every(v=>integer(v))&&Object.values(d.shares).reduce((s:number,v)=>s+Number(v),0)===d.amount,'分摊金额总和应等于支出')}
 if(kind==='settlement')check(integer(d.amount)&&d.amount>0&&dateValid(d.date)&&d.from!==d.to,'结清记录无效');
 if(kind==='item'){
  d.travelMode??='driving';check(modes.some(m=>m[0]===d.travelMode),'交通方式无效');
  if(d.manualTravelMinutes===''||d.manualTravelMinutes===null)delete d.manualTravelMinutes;
  if(d.manualTravelMinutes!==undefined)check(integer(d.manualTravelMinutes,10080),'手工交通分钟无效');
 }
 if(kind==='transport'){
  if(d.departure)arrivalInstant(d.departure);if(d.arrival)arrivalInstant(d.arrival);
  check(!d.departure||!d.arrival||arrivalInstant(d.arrival)>=arrivalInstant(d.departure),'到达不能早于出发');
 }
 return d;
}
