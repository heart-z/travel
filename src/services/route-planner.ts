import {clone,type Item,type Place,type Transport,type TransportMode} from '../domain/types';
export interface RouteData {distance:number;duration:number;points:{latitude:number;longitude:number}[];}
export interface Leg {from:string;to:string;distance?:number;duration?:number;points:{latitude:number;longitude:number}[];mode?:TransportMode;error?:string;}
type RequestRoute=(from:Place,to:Place,mode:'driving'|'walking')=>Promise<RouteData>;
// Brief in-memory deduplication only; no background fetching or offline map archive.
export class RoutePlanner {
 private cache=new Map<string,{at:number;data:RouteData}>();
 private pending=new Map<string,Promise<RouteData>>();
 constructor(private request:RequestRoute){}
 private async road(a:Place,b:Place,mode:'driving'|'walking'):Promise<RouteData>{
  const key=JSON.stringify([a.latitude,a.longitude,b.latitude,b.longitude,mode]);
  const cached=this.cache.get(key);if(cached&&Date.now()-cached.at<30000)return clone(cached.data);
  if(this.pending.has(key))return clone(await this.pending.get(key)!);
  const pending=this.request(a,b,mode).then(data=>{
   if(!Number.isFinite(data.distance)||data.distance<0||!Number.isFinite(data.duration)||data.duration<0||!Array.isArray(data.points)||data.points.some(p=>!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||Math.abs(p.latitude)>90||Math.abs(p.longitude)>180))throw Error('地图服务返回了无效路线');
   if(this.cache.size>=100)this.cache.delete(this.cache.keys().next().value!);
   this.cache.set(key,{at:Date.now(),data:clone(data)});return data;
  });
  this.pending.set(key,pending);try{return clone(await pending);}finally{this.pending.delete(key);}
 }
 async plan(input:Item[],defaultMode:'driving'|'walking',transports:Transport[]=[]):Promise<Leg[]>{
  const items=clone(input),legs:Leg[]=[];
  for(let i=0;i<items.length-1;i++){
   const a=items[i],b=items[i+1];
   const booking=transports.find(t=>t.fromItemId===a.id&&t.toItemId===b.id);
   const mode=booking?.mode??a.travelMode??defaultMode;
   if(booking||!['driving','walking'].includes(mode)){legs.push({from:a.id,to:b.id,mode,points:[]});continue;}
   if(!a.place||!b.place)continue;
   try{legs.push({...await this.road(a.place,b.place,mode as 'driving'|'walking'),from:a.id,to:b.id,mode});}
   catch(e){legs.push({from:a.id,to:b.id,mode,points:[],error:e instanceof Error?e.message:'路线暂不可用'});}
  }
  return legs;
 }
}
