import transform from 'coordtransform';
import type {Place} from './types';
export interface Point {latitude:number;longitude:number;}
// Stored places and Tencent route points are GCJ02; OSM tiles use WGS84.
export function fromMapPoint(p:Point):Point {const [longitude,latitude]=transform.wgs84togcj02(p.longitude,p.latitude);return {latitude,longitude};}
export function toMapPoint(p:Point):Point {const [longitude,latitude]=transform.gcj02towgs84(p.longitude,p.latitude);return {latitude,longitude};}
export function parseOpenPlaces(rows:unknown):Place[] {
  if(!Array.isArray(rows))throw Error('地点服务返回格式异常');
  return rows.filter(r=>r&&Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lon))&&Math.abs(Number(r.lat))<=90&&Math.abs(Number(r.lon))<=180&&typeof r.display_name==='string').map(r=>({
    id:`osm-${r.osm_type}-${r.osm_id??r.place_id}`,name:String(r.name||r.display_name.split(',')[0]),address:r.display_name+(r.category==='railway'?` · ${r.extratags?.station==='subway'?'地铁站':r.type==='station'?'铁路车站':r.type==='subway_entrance'?'地铁出入口':'铁路设施'}`:r.type==='bus_stop'?' · 公交站':''),
    ...fromMapPoint({latitude:Number(r.lat),longitude:Number(r.lon)}),provider:'osm' as const
  }));
}
