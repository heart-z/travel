import {parseOpenPlaces} from '../domain/geo';
import type {Place} from '../domain/types';
let pending=false,lastQuery=0;
const cache=new Map<string,Place[]>();
// Explicit single-query searches only: no autocomplete, bulk lookup or prefetch.
export async function searchOpenPlaces(query:string):Promise<Place[]> {
  const q=query.trim();if(!q||q.length>160)throw Error('请输入明确的地点名称（最多160字）');
  if(cache.has(q))return cache.get(q)!;
  if(pending||Date.now()-lastQuery<1100)throw Error('请稍等一秒再搜索');
  pending=true;lastQuery=Date.now();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
    const base=import.meta.env.VITE_GEOCODING_URL||'https://nominatim.openstreetmap.org/search';
    const url=new URL(base);url.searchParams.set('q',q);url.searchParams.set('format','jsonv2');url.searchParams.set('limit','5');url.searchParams.set('accept-language','zh-CN');url.searchParams.set('extratags','1');
    const response=await fetch(url.toString(),{signal:controller.signal});
    if(!response.ok)throw Error('地点查询暂不可用，可在地图上手动选点');
    const places=parseOpenPlaces(await response.json());cache.set(q,places);return places;
  }catch(e){throw Error(e instanceof Error&&e.name==='AbortError'?'查询超时，可在地图上手动选点':e instanceof Error?e.message:'地点查询失败');}
  finally{clearTimeout(timer);pending=false;}
}
