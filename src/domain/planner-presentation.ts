import type {Item,TransportMode} from './types';

export type PlannerEntry=
 | {type:'point';item:Item;sourceIndex:number;number:number}
 | {type:'transit';items:Item[];sourceIndexes:number[]};

export function isTransition(item:Item):boolean{
 return item.kind==='交通'&&(!item.place||/→|前往|转场/.test(item.name));
}

export function plannerEntries(items:Item[]):PlannerEntry[]{
 const entries:PlannerEntry[]=[];let number=0;
 items.forEach((item,sourceIndex)=>{
  // A transfer is a connector only when it has a named event or place on
  // both sides. At the edge of a day it remains a visible itinerary event.
  const betweenPoints=isTransition(item)&&number>0&&items.slice(sourceIndex+1).some(next=>!isTransition(next));
  if(betweenPoints){
   const last=entries[entries.length-1];
   if(last?.type==='transit'){last.items.push(item);last.sourceIndexes.push(sourceIndex);}
   else entries.push({type:'transit',items:[item],sourceIndexes:[sourceIndex]});
  }else entries.push({type:'point',item,sourceIndex,number:++number});
 });
 return entries;
}

export function pointLabel(item:Item):string{
 if(item.kind==='住宿'&&item.name.includes('→'))return item.name.split('→').slice(-1)[0].trim();
 if(item.kind==='交通'){
  const arrival=item.name.match(/^(?:约\s*\d{1,2}:\d{2}\s*)?抵达(.+)$/);
  if(arrival)return arrival[1].trim();
  const departure=item.name.match(/^(.+?)出发$/);
  if(departure)return departure[1].trim();
  const transfer=item.name.match(/^(.+?)转往.+$/);
  if(transfer)return transfer[1].trim();
  const route=item.name.match(/^.+?\s*→\s*(.+)$/);
  if(route){
   const destination=route[1].replace(/(?:方向)?夜火车$/,'').trim();
   const mode=transitionMode(item);
   if(mode==='train'&&/夜火车/.test(item.name))return `夜火车前往${destination}`;
   if(mode==='flight')return `飞往${destination}`;
   return `前往${destination}`;
  }
 }
 return item.name;
}

export function presentationNote(note:string):string{
 return note.replace(/^Notion\s+记录为约\s*\d{1,2}:\d{2}，?\s*/,'').replace(/^Notion\s+(?:原文|写为)：\s*/,'').trim();
}

export function transitionMode(item:Item):TransportMode{
 if(item.travelMode)return item.travelMode;
 if(/火车|高铁|列车|铁路/.test(item.name))return 'train';
 if(/飞机|航班|飞往/.test(item.name))return 'flight';
 if(/步行|徒步/.test(item.name))return 'walking';
 if(/自驾|租车|驾车/.test(item.name))return 'driving';
 if(/大巴|公交|巴士/.test(item.name))return 'bus';
 return 'manual';
}
