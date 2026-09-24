import {clone,type Trip,type Stay,type Transport} from './types';
import {validateTrip} from './trips';
export {transportModes,transportLabels,validateResources} from './resource-validation';
export function staysOn(trip:Trip,date:string):Stay[]{return (trip.stays??[]).filter(s=>s.checkIn<=date&&date<s.checkOut);}
export function transportsOn(trip:Trip,date:string):{transport:Transport;event:'departure'|'arrival'|'both'}[]{
 return (trip.transports??[]).filter(t=>t.departure.startsWith(date+'T')||t.arrival.startsWith(date+'T')).map(transport=>({transport,event:transport.departure.startsWith(date+'T')?(transport.arrival.startsWith(date+'T')?'both':'departure'):'arrival'}));
}
export function saveStay(trip:Trip,stay:Stay):Trip {const next=clone(trip);next.stays=(next.stays??[]).filter(s=>s.id!==stay.id).concat(clone(stay));next.schemaVersion=2;next.revision++;validateTrip(next);return next;}
export function saveTransport(trip:Trip,transport:Transport):Trip {const next=clone(trip);next.transports=(next.transports??[]).filter(t=>t.id!==transport.id).concat(clone(transport));next.schemaVersion=2;next.revision++;validateTrip(next);return next;}
export function searchCity(trip:Trip,date:string):string{return trip.dayCities?.[date]||trip.city;}
export function saveDayCity(trip:Trip,date:string,city:string):Trip {const next=clone(trip);next.dayCities={...next.dayCities,[date]:city.trim()};next.schemaVersion=2;next.revision++;validateTrip(next);return next;}

