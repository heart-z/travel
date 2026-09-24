import type {Item} from './types';
export interface PlannedTime {id:string;start?:number;end?:number;source:'fixed'|'estimate'|'unknown';conflictMinutes:number;trafficUnknown:boolean;}
export function formatTime(minutes?:number):string {
  if(minutes===undefined)return '时间待定';
  const day=Math.floor(minutes/1440),clock=minutes%1440;
  return `${day===1?'次日 ':day>1?`第 ${day+1} 日 `:''}${String(Math.floor(clock/60)).padStart(2,'0')}:${String(clock%60).padStart(2,'0')}`;
}
export function planTimes(items:Item[],legs:{from:string;to:string;duration?:number}[]):PlannedTime[] {
  const rows:PlannedTime[]=[];
  items.forEach((item,index)=>{
    const previous=rows[index-1];
    const leg=index?legs.find(l=>l.from===items[index-1].id&&l.to===item.id):undefined;
    const travel=leg&&typeof leg.duration==='number'&&Number.isFinite(leg.duration)&&leg.duration>=0?Math.ceil(leg.duration/60):undefined;
    const fixed=item.time?Number(item.time.slice(0,2))*60+Number(item.time.slice(3)):undefined;
    const arrival=previous?.end!==undefined&&travel!==undefined?previous.end+travel:undefined;
    const start=fixed??arrival;
    const earliest=arrival??previous?.end;
    rows.push({id:item.id,start,end:start===undefined?undefined:start+item.duration,
      source:fixed!==undefined?'fixed':start!==undefined?'estimate':'unknown',
      conflictMinutes:fixed!==undefined&&earliest!==undefined?Math.max(0,earliest-fixed):0,
      trafficUnknown:index>0&&travel===undefined});
  });
  return rows;
}
