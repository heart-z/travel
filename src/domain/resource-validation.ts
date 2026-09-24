import type {Trip,TransportMode} from './types';
import {validDate} from './dates';


export const transportModes:TransportMode[]=['driving','walking','train','flight','bus','manual'];
export const transportLabels:Record<TransportMode,string>={driving:'驾车',walking:'步行',train:'火车',flight:'飞机',bus:'大巴',manual:'自行安排'};
const text=(value:unknown,max=120)=>typeof value==='string'&&value.length<=max;
const datetime=(value:string)=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(value)&&validDate(value.slice(0,10));
export function validateResources(trip:Trip):void {
 if(trip.schemaVersion!==undefined&&trip.schemaVersion!==2)throw Error('不支持的旅行数据版本');
 const within=(date:string)=>validDate(date)&&date>=trip.startDate&&date<=trip.endDate;
 for(const list of [trip.stays??[],trip.transports??[]]){
  if(!Array.isArray(list)||list.length>200||list.some(r=>!r||!text(r.id)||!r.id)||new Set(list.map(r=>r.id)).size!==list.length)throw Error('住宿或交通记录无效');
 }
 for(const stay of trip.stays??[]){
  if(stay.kind!==undefined&&!['hotel','train'].includes(stay.kind))throw Error('过夜类型无效');
  if(!text(stay.name)||!stay.name.trim()||!within(stay.checkIn)||!within(stay.checkOut)||stay.checkOut<=stay.checkIn)throw Error('住宿需填写名称及有效入住、退房日期，且在旅行范围内');
  if(!['planned','booked'].includes(stay.status)||!text(stay.address,500)||!text(stay.bookingNo)||!text(stay.phone,80)||!text(stay.note,2000)||!Number.isSafeInteger(stay.amount)||stay.amount<0||stay.amount>100000000)throw Error('住宿信息或预计金额无效');
  if(stay.place&&(!Number.isFinite(stay.place.latitude)||!Number.isFinite(stay.place.longitude)||Math.abs(stay.place.latitude)>90||Math.abs(stay.place.longitude)>180||!['tencent','osm','manual'].includes(stay.place.provider)))throw Error('住宿地点坐标无效');
 }
 for(const segment of trip.transports??[]){
  if(!text(segment.name)||!segment.name.trim()||!transportModes.includes(segment.mode)||!datetime(segment.departure)||!datetime(segment.arrival)||segment.arrival<=segment.departure||!within(segment.departure.slice(0,10))||!within(segment.arrival.slice(0,10)))throw Error('交通出发、到达时间无效，请明确日期且到达晚于出发');
  if(!text(segment.fromName)||!segment.fromName.trim()||!text(segment.toName)||!segment.toName.trim()||!text(segment.bookingNo)||!text(segment.note,2000))throw Error('请填写交通起终点，并检查班次和备注');
  if(segment.fromItemId&&segment.fromItemId===segment.toItemId)throw Error('交通起终点不能关联同一项计划');
  for(const [id,date] of [[segment.fromItemId,segment.departure.slice(0,10)],[segment.toItemId,segment.arrival.slice(0,10)]]){
   if(id){const item=trip.items.find(i=>i.id===id);if(!item||item.date!==date)throw Error('计划被交通记录关联，请先修改交通关联或日期再移动、删除计划');}
  }
  if(segment.fromItemId&&segment.toItemId&&segment.departure.slice(0,10)===segment.arrival.slice(0,10)){
   const day=trip.items.filter(i=>i.date===segment.departure.slice(0,10)).sort((a,b)=>a.order-b.order);
   const from=day.findIndex(i=>i.id===segment.fromItemId),to=day.findIndex(i=>i.id===segment.toItemId);
   if(to!==from+1)throw Error('已关联交通的出发、到达事项需按顺序相邻，请先调整交通关联再重排行程');
  }
 }
 if(trip.dayCities!==undefined){if(!trip.dayCities||typeof trip.dayCities!=='object'||Array.isArray(trip.dayCities))throw Error('每日城市无效');for(const [date,city] of Object.entries(trip.dayCities))if(!within(date)||!text(city,80)||!city.trim())throw Error('每日城市或日期无效');}
 for(const item of trip.items){
  if(item.travelMode!==undefined&&!transportModes.includes(item.travelMode))throw Error('交通方式无效');
  if(item.completed!==undefined&&typeof item.completed!=='boolean')throw Error('行程完成状态无效');
  if(item.locationStatus!==undefined&&!['confirmed','not-needed'].includes(item.locationStatus))throw Error('地点确认状态无效');
  if(item.locationStatus==='confirmed'&&!item.place)throw Error('请先添加位置再确认入口');
  if(item.locationStatus==='not-needed'&&item.place)throw Error('已有位置不能标为无需定位，请先移除位置');
 }
}

