export interface Place { id:string; name:string; address:string; latitude:number; longitude:number; provider:'tencent'|'osm'|'manual'; }
export type TransportMode='driving'|'walking'|'train'|'flight'|'bus'|'manual';
export interface Item { id:string; name:string; date:string; order:number; duration:number; time:string; note:string; kind:string; place?:Place; travelMode?:TransportMode; travelMinutes?:number; completed?:boolean; locationStatus?:'confirmed'|'not-needed'; }
export type PackingCategory='clothing'|'documents'|'toiletries'|'electronics'|'essentials'|'driving';
export interface PackingItem {id:string;name:string;category:PackingCategory;quantity:number;memberId:string;packed:boolean;note:string;carryMode?:'pack'|'wear';}
export interface Stay {id:string;name:string;checkIn:string;checkOut:string;status:'planned'|'booked';address:string;bookingNo:string;phone:string;note:string;amount:number;place?:Place;kind?:'hotel'|'train';}
export interface Transport {id:string;name:string;mode:TransportMode;departure:string;arrival:string;fromName:string;toName:string;fromItemId?:string;toItemId?:string;bookingNo:string;note:string;}
export interface Expense { id:string; title:string; amount:number; category:string; date:string; payer:string; shares:Record<string,number>; }
export interface Settlement { id:string; from:string; to:string; amount:number; date:string; }
export interface Guide {id:string;title:string;content:string;sourceUrl:string;sourceText?:string;dates:string[];itemIds:string[];category:'guide'|'transport'|'checklist';}
export interface Trip { id:string; title:string; city:string; startDate:string; endDate:string; budget:number; archived:boolean; members:{id:string;name:string}[]; items:Item[]; expenses:Expense[]; settlements:Settlement[]; imports:string[]; revision:number; schemaVersion?:2; stays?:Stay[]; transports?:Transport[]; dayCities?:Record<string,string>; dayStartTimes?:Record<string,string>; packing?:PackingItem[]; guides?:Guide[]; }
export interface AppData { version:number; trips:Trip[]; accountId?:string; }
export const uid=()=>Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);
export const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));

