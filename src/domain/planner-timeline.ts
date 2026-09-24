import {plannerEntries} from './planner-presentation';
import {formatTime} from './schedule';
import type {Item} from './types';

export interface TimelineSlot {
 id:string;
 start:number;
 end:number;
 precision:'fixed'|'suggested'|'estimate'|'lower-bound';
 conflictMinutes:number;
 unknownTravel:boolean;
}

export interface TimelineLeg {from:string;to:string;duration?:number;}

export function transferMinutes(from:Item,to:Item,legs:TimelineLeg[]):number|undefined{
 if(from.travelMinutes!==undefined)return from.travelMinutes;
 const seconds=legs.find(leg=>leg.from===from.id&&leg.to===to.id)?.duration;
 return typeof seconds==='number'&&Number.isFinite(seconds)&&seconds>=0?Math.ceil(seconds/60):undefined;
}

export function planTimeline(items:Item[],legs:TimelineLeg[],dayStart=540):TimelineSlot[]{
 const connectorIds=new Set(plannerEntries(items).flatMap(entry=>entry.type==='transit'?entry.items.map(item=>item.id):[]));
 const slots:TimelineSlot[]=[];
 items.forEach((item,index)=>{
  const previous=slots[index-1],previousItem=items[index-1];
  const connector=!!previousItem&&(connectorIds.has(previousItem.id)||connectorIds.has(item.id));
  const travel=index===0?0:connector?0:transferMinutes(previousItem,item,legs);
  const missing=index>0&&travel===undefined;
  const earliest=previous?previous.end+(travel??0):dayStart;
  const fixed=item.time?Number(item.time.slice(0,2))*60+Number(item.time.slice(3)):undefined;
  const start=fixed??earliest;
  const unknownTravel=fixed===undefined&&(missing||!!previous?.unknownTravel);
  slots.push({id:item.id,start,end:start+item.duration,
   precision:fixed!==undefined?'fixed':index===0?'suggested':unknownTravel?'lower-bound':'estimate',
   conflictMinutes:fixed!==undefined&&previous?Math.max(0,earliest-fixed):0,
   unknownTravel});
 });
 return slots;
}

export function timelineLabel(slot:TimelineSlot):string{
 const prefix=slot.precision==='suggested'?'建议 ':slot.precision==='estimate'?'预计 ':slot.precision==='lower-bound'?'最早 ':'';
 return prefix+formatTime(slot.start);
}
