import {clone,type Item,type Place,type Trip} from './types';
export type LocationState='pending'|'located'|'confirmed'|'not-needed';
export function locationState(item:Item):LocationState{return item.locationStatus==='not-needed'?'not-needed':item.place?(item.locationStatus==='confirmed'?'confirmed':'located'):'pending';}
export const locationLabels:Record<LocationState,string>={pending:'待补位置',located:'已有位置 · 待核对入口',confirmed:'入口已确认','not-needed':'无需定位'};
export function changeLocation(trip:Trip,itemId:string,action:'confirm'|'skip'|'reset'|'remove'|Place):Trip{
 const next=clone(trip),item=next.items.find(i=>i.id===itemId);if(!item)throw Error('计划已变化，请重新选择');
 if(typeof action==='object'){item.place=clone(action);delete item.locationStatus;}
 else if(action==='confirm'){if(!item.place)throw Error('请先添加位置');item.locationStatus='confirmed';}
 else if(action==='skip'){if(item.place)throw Error('已有位置，请先移除再标为无需定位');item.locationStatus='not-needed';}
 else if(action==='remove'){delete item.place;delete item.locationStatus;}
 else delete item.locationStatus;
 next.revision++;return next;
}
