import {clone,type AppData,type Stay,type Transport,type PackingItem,type Guide,type Place} from '../domain/types';
import {validateData} from './repository';
export interface ResourceSupplement {format:'xingjian-resources';schema:1;tripId:string;stays:Stay[];transports:Transport[];packing?:PackingItem[];guides?:Guide[];locationBindings?:{kind:'item'|'stay';id:string;place:Place}[];}
export function parseResourceSupplement(text:string):ResourceSupplement{
 const v=JSON.parse(text);
 if(!v||v.format!=='xingjian-resources'||v.schema!==1||typeof v.tripId!=='string'||!Array.isArray(v.stays)||!Array.isArray(v.transports))throw Error('住宿交通补充包格式无效');
 return v;
}
export function mergeResourceSupplement(current:AppData,pack:ResourceSupplement):AppData{
 if(pack.format!=='xingjian-resources'||pack.schema!==1||!Array.isArray(pack.stays)||!Array.isArray(pack.transports))throw Error('住宿交通补充包格式无效');
 const next=clone(current),trip=next.trips.find(t=>t.id===pack.tripId);if(!trip)throw Error('请先导入对应旅行的完整备份，再导入住宿交通补充包');
 // Validate even duplicate incoming records, before deciding which to skip.
 validateData({...next,trips:[{...clone(trip),stays:clone(pack.stays),transports:clone(pack.transports),...(pack.packing!==undefined?{packing:clone(pack.packing)}:{}),...(pack.guides!==undefined?{guides:clone(pack.guides)}:{})}]});
 trip.stays??=[];trip.transports??=[];let added=0;
 for(const stay of pack.stays){
  if(trip.stays.some(s=>s.id===stay.id||(stay.bookingNo&&s.bookingNo===stay.bookingNo)||(s.checkIn<stay.checkOut&&stay.checkIn<s.checkOut)))continue;
  trip.stays.push(clone(stay));added++;
 }
 for(const transport of pack.transports){
  if(trip.transports.some(t=>t.id===transport.id||(t.departure===transport.departure&&t.fromName===transport.fromName&&t.toName===transport.toName)))continue;
  trip.transports.push(clone(transport));added++;
 }
 if(pack.packing){trip.packing??=[];for(const entry of pack.packing){if(trip.packing.some(p=>p.id===entry.id||(p.category===entry.category&&p.memberId===entry.memberId&&p.name.trim().toLocaleLowerCase()===entry.name.trim().toLocaleLowerCase()&&(p.carryMode||'pack')===(entry.carryMode||'pack'))))continue;trip.packing.push(clone(entry));added++;}}
 if(pack.guides){trip.guides??=[];for(const guide of pack.guides){if(trip.guides.some(g=>g.id===guide.id))continue;trip.guides.push(clone(guide));added++;}}
 if(pack.locationBindings!==undefined){
  if(!Array.isArray(pack.locationBindings)||pack.locationBindings.length>1000)throw Error('地点关联格式无效');
  for(const binding of pack.locationBindings){
   const p=binding?.place;if(!binding||!['item','stay'].includes(binding.kind)||typeof binding.id!=='string'||!p||typeof p.id!=='string'||!p.id||typeof p.name!=='string'||!p.name.trim()||typeof p.address!=='string'||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180||!['tencent','osm','manual'].includes(p.provider))throw Error('地点关联或坐标无效');
   const target=binding.kind==='item'?trip.items.find(i=>i.id===binding.id):trip.stays?.find(s=>s.id===binding.id);
   if(!target||target.place||('locationStatus' in target&&target.locationStatus==='not-needed'))continue;
   target.place=clone(p);added++;
  }
 }
 if(added)trip.revision++;validateData(next);return next;
}
