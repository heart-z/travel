import type {Place} from './types';

export function straightLineMeters(from:Place,to:Place):number{
 const radians=(degrees:number)=>degrees*Math.PI/180;
 const lat1=radians(from.latitude),lat2=radians(to.latitude);
 const deltaLat=lat2-lat1,deltaLon=radians(to.longitude-from.longitude);
 const arc=Math.sin(deltaLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(deltaLon/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(Math.min(1,arc)));
}
