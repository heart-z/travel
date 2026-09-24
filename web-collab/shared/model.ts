export type Role='owner'|'editor'|'viewer';
export type Kind='participant'|'item'|'stay'|'transport'|'guide'|'expense'|'settlement'|'packing';
export type Data=Record<string,any>;
export interface Point{latitude:number;longitude:number;crs:'WGS84'|'GCJ02'}
export interface Entity{id:string;tripId:string;kind:Kind;version:number;updatedAt:string;updatedBy:string;data:Data}
export interface DayPlan{date:string|null;version:number;itemIds:string[]}
export interface Snapshot{tripId:string;title:string;startDate:string;endDate:string;timeZone:string;archived:boolean;version:number;seq:number;role:Role;days:DayPlan[];entities:Entity[];members:{id:string;username:string;role:Role}[]}
export class AppError extends Error{status:number;current?:unknown;constructor(message:string,status=400,current?:unknown){super(message);this.status=status;this.current=current}}
export function check(condition:unknown,message:string,status=400):asserts condition{if(!condition)throw new AppError(message,status)}
export const categories=[['clothing','衣物'],['documents','证件'],['toiletries','洗漱'],['electronics','电子'],['essentials','常备物品'],['driving','自驾用品']] as const;
export const modes=[['driving','自驾'],['walking','步行'],['train','火车'],['flight','飞机'],['bus','公交 / 大巴'],['manual','其他']] as const;
export function dateValid(v:unknown):v is string{return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v}
export function dates(start:string,end:string){check(dateValid(start)&&dateValid(end)&&end>=start,'旅行日期无效');const n=(Date.parse(end)-Date.parse(start))/86400000;check(n<366,'每趟旅行最多 366 天');return Array.from({length:n+1},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10))}
