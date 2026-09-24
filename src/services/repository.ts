import { clone, type AppData } from '../domain/types';
import { validateTrip } from '../domain/trips';
export function validateData(data:AppData):void {if(!data||!Number.isSafeInteger(data.version)||data.version<0||!Array.isArray(data.trips)||data.trips.length>100)throw new Error('数据格式无效');data.trips.forEach(validateTrip);if(new Set(data.trips.map(t=>t.id)).size!==data.trips.length)throw new Error('旅行编号重复');}
export interface Repository {load():Promise<AppData>;save(data:AppData):Promise<AppData>;}
export class LocalRepository implements Repository {
  constructor(private storage:{get:(key:string)=>string;set:(key:string,value:string)=>void},private key='xingjian-v1'){}
  async load():Promise<AppData>{ const raw=this.storage.get(this.key);if(!raw)return {version:0,trips:[]};try{const d=JSON.parse(raw);validateData(d);return d;}catch{throw new Error('本地数据损坏，已停止写入以保留原始数据');} }
  async save(data:AppData):Promise<AppData>{validateData(data);const current=await this.load();if(current.version!==data.version)throw new Error('数据已更新，请刷新后再操作');const next={...clone(data),version:data.version+1};this.storage.set(this.key,JSON.stringify(next));return next;}
}
