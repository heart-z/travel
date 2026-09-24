import type { Item, Place, Transport } from '../domain/types';
import { mapCall as callCloud,mapAvailable as cloudEnabled } from './map-backend';
import {RoutePlanner,type RouteData} from './route-planner';
export { cloudEnabled,cloudEnabled as mapAvailable };
export type {Leg} from './route-planner';
export async function searchPlaces(keyword:string,city:string):Promise<Place[]>{return callCloud('search',{keyword,city});}
const planner=new RoutePlanner((from,to,mode)=>{if(!cloudEnabled())return Promise.reject(Error('道路耗时待查询：尚未连接地图服务'));return callCloud<RouteData>('route',{from,to,mode});});
export const routes=(items:Item[],mode:'driving'|'walking',transports:Transport[]=[])=>cloudEnabled()?planner.plan(items,mode,transports):Promise.resolve([]);
export function navigate(place:Place){
  // #ifdef MP-WEIXIN
  uni.openLocation({latitude:place.latitude,longitude:place.longitude,name:place.name,address:place.address,fail:()=>uni.showToast({title:'打开地图失败，请稍后重试',icon:'none'})});
  // #endif
  // #ifdef H5
  const url='https://uri.amap.com/marker?position='+place.longitude+','+place.latitude+'&name='+encodeURIComponent(place.name)+'&coordinate=gaode&callnative=1';window.open(url,'_blank','noopener,noreferrer');
  // #endif
}

