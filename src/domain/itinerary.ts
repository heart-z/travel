import { clone, uid, type Trip, type Place } from './types';
import { validateTrip } from './trips';
import {isTransition} from './planner-presentation';
export function parsePlaces(text:string):string[] {const names=[...new Set(text.split(/[\n,，、;；]+/).map(s=>s.trim()).filter(Boolean))];if(names.length>20)throw new Error('每次最多导入 20 个地点');return names;}
export function importItems(trip:Trip,date:string,drafts:{name:string;place?:Place;date?:string}[],requestId:string):Trip {
  if(trip.imports.includes(requestId))return clone(trip);
  if(!drafts.length||drafts.length>20||!requestId)throw new Error('请选择 1–20 个地点');
  const next=clone(trip);
  for(const d of drafts){const target=d.date??date;const order=next.items.filter(i=>i.date===target).length;next.items.push({id:uid(),name:d.name,date:target,order,duration:60,time:'',note:'',kind:'游玩',...(d.place?{place:d.place}:{})});}
  next.imports.push(requestId);next.revision++;validateTrip(next);return next;
}
export function moveItem(trip:Trip,id:string,date:string,index:number):Trip {
  const next=clone(trip);const item=next.items.find(i=>i.id===id);if(!item)throw new Error('行程已不存在');
  const oldDate=item.date;next.items=next.items.filter(i=>i.id!==id);
  const dest=next.items.filter(i=>i.date===date).sort((a,b)=>a.order-b.order);item.date=date;dest.splice(Math.max(0,Math.min(index,dest.length)),0,item);dest.forEach((i,n)=>i.order=n);
  next.items=next.items.filter(i=>i.date!==date).concat(dest);
  if(oldDate!==date)next.items.filter(i=>i.date===oldDate).sort((a,b)=>a.order-b.order).forEach((i,n)=>i.order=n);
  next.revision++;validateTrip(next);return next;
}
export function movePointWithTransit(trip:Trip,id:string,targetPointIndex:number):Trip{
 const next=clone(trip),item=next.items.find(i=>i.id===id);if(!item||isTransition(item))throw new Error('地点已不存在');
 const day=next.items.filter(i=>i.date===item.date).sort((a,b)=>a.order-b.order);
 const blocks:{pointId:string;items:typeof day}[]= [];let incoming:typeof day=[];
 for(const part of day){if(isTransition(part))incoming.push(part);else{blocks.push({pointId:part.id,items:[...incoming,part]});incoming=[];}}
 const from=blocks.findIndex(block=>block.pointId===id);if(from<0)throw new Error('地点已不存在');
 const [block]=blocks.splice(from,1);blocks.splice(Math.max(0,Math.min(targetPointIndex,blocks.length)),0,block);
 const reordered=[...blocks.flatMap(b=>b.items),...incoming];reordered.forEach((part,order)=>{part.order=order;});
 next.items=next.items.filter(i=>i.date!==item.date).concat(reordered);next.revision++;validateTrip(next);return next;
}

export function movePointToDayWithTransit(trip:Trip,id:string,date:string):Trip{
 const next=clone(trip),point=next.items.find(i=>i.id===id);
 if(!point||isTransition(point))throw new Error('地点已不存在');
 if(point.date===date)return next;
 const sourceDate=point.date,source=next.items.filter(i=>i.date===sourceDate).sort((a,b)=>a.order-b.order);
 const index=source.findIndex(i=>i.id===id),block=[point];
 for(let i=index-1;i>=0&&isTransition(source[i]);i--)block.unshift(source[i]);
 const ids=new Set(block.map(i=>i.id));
 const remaining=source.filter(i=>!ids.has(i.id));
 const destination=next.items.filter(i=>i.date===date).sort((a,b)=>a.order-b.order);
 block.forEach(i=>{i.date=date;});destination.push(...block);
 remaining.forEach((i,order)=>{i.order=order;});
 destination.forEach((i,order)=>{i.order=order;});
 next.items=next.items.filter(i=>i.date!==sourceDate&&i.date!==date).concat(remaining,destination);
 next.revision++;validateTrip(next);return next;
}
