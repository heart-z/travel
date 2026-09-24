import { dateRange, validDate } from './dates';
import { parseCents } from './money';
import { clone, uid, type Trip } from './types';
import {validateResources} from './resource-validation';
import {validatePacking} from './packing';
import {validateGuides} from './guides';
export function createTrip(input:{title:string;city:string;startDate:string;endDate:string;budget:string;companion:string}):Trip {
  const t:Trip={id:uid(),title:input.title.trim(),city:input.city.trim(),startDate:input.startDate,endDate:input.endDate,budget:parseCents(input.budget||'0'),archived:false,members:[{id:uid(),name:'我'}],items:[],expenses:[],settlements:[],imports:[],revision:0};
  if(input.companion.trim())t.members.push({id:uid(),name:input.companion.trim()});validateTrip(t);return t;
}
export function updateTrip(trip:Trip,patch:Partial<Pick<Trip,'title'|'city'|'startDate'|'endDate'|'budget'|'archived'>>):Trip {const next={...clone(trip),...patch,revision:trip.revision+1};validateTrip(next);return next;}
export function validateTrip(t:Trip):void {
  if(!t||typeof t.id!=='string'||!t.title?.trim()||t.title.length>60||!t.city?.trim()||t.city.length>80)throw new Error('填写旅行名称和目的城市');
  const dates=dateRange(t.startDate,t.endDate);const cents=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
  if(t.dayStartTimes&&(typeof t.dayStartTimes!=='object'||Array.isArray(t.dayStartTimes)||Object.entries(t.dayStartTimes).some(([date,time])=>!dates.includes(date)||typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))))throw new Error('每日出发时间无效');
  if(!cents(t.budget))throw new Error('预算无效');
  if(!Array.isArray(t.members)||t.members.length<1||t.members.length>2)throw new Error('首版支持一至两位同行人');
  const members=t.members.map(m=>m.id);if(new Set(members).size!==members.length||t.members.some(m=>!m.id||!m.name?.trim()||m.name.length>30))throw new Error('同行人无效');
  if(!Array.isArray(t.items)||t.items.length>500||!Array.isArray(t.expenses)||t.expenses.length>1000||!Array.isArray(t.settlements)||t.settlements.length>1000||!Array.isArray(t.imports)||t.imports.length>1000)throw new Error('旅行记录超出范围');
  for(const list of [t.items,t.expenses,t.settlements])if(new Set(list.map(x=>x.id)).size!==list.length)throw new Error('记录编号重复');
  for(const i of t.items){
    if(!dates.includes(i.date))throw new Error('范围外仍有行程，请先移动到保留的日期');
    if(!i.id||!i.name?.trim()||i.name.length>120||!Number.isInteger(i.order)||i.order<0||!Number.isInteger(i.duration)||i.duration<0||i.duration>2880||i.travelMinutes!==undefined&&(!Number.isInteger(i.travelMinutes)||i.travelMinutes<0||i.travelMinutes>2880)||!/^$|^([01]\d|2[0-3]):[0-5]\d$/.test(i.time)||typeof i.note!=='string'||i.note.length>2000)throw new Error('行程时间或内容无效');
    if(i.place&&(!Number.isFinite(i.place.latitude)||!Number.isFinite(i.place.longitude)||Math.abs(i.place.latitude)>90||Math.abs(i.place.longitude)>180||!['tencent','osm','manual'].includes(i.place.provider)))throw new Error('地点坐标无效');
  }
  for(const e of t.expenses){if(!e.id||!e.title?.trim()||!e.category||!validDate(e.date)||!cents(e.amount)||e.amount===0||!members.includes(e.payer)||!e.shares||Object.entries(e.shares).some(([m,n])=>!members.includes(m)||!cents(n))||Object.values(e.shares).reduce((s,n)=>s+n,0)!==e.amount)throw new Error('账单金额、付款人或分摊不正确');}
  for(const s of t.settlements)if(!s.id||!members.includes(s.from)||!members.includes(s.to)||s.from===s.to||!Number.isSafeInteger(s.amount)||s.amount<=0||s.amount>100000000000||!validDate(s.date))throw new Error('结算记录无效');
  validateResources(t);
  validatePacking(t);
  validateGuides(t);
}


