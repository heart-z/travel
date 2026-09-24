import type {Place,Trip} from './types';

const key=(name:string)=>name.normalize('NFKC').trim().replace(/\s+/g,'').toLocaleLowerCase();

export function savedPlaceCandidates(trip:Trip,name:string,date:string):Place[]{
 const target=key(name);if(!target)return [];
 const matches=[
  ...trip.items.filter(item=>item.place&&(key(item.name)===target||key(item.place.name)===target)).map(item=>({place:item.place!,date:item.date})),
  ...(trip.stays||[]).filter(stay=>stay.place&&(key(stay.name)===target||key(stay.place.name)===target)).map(stay=>({place:stay.place!,date:stay.checkIn}))
 ].sort((a,b)=>Number(b.date===date)-Number(a.date===date));
 const seen=new Set<string>();
 return matches.flatMap(({place})=>{const position=`${place.latitude.toFixed(5)}:${place.longitude.toFixed(5)}`;if(seen.has(position))return [];seen.add(position);return [place];});
}

export function chosenMapPlace(result:{name:string;address:string;latitude:number;longitude:number},id:string):Place{
 const {latitude,longitude}=result;
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||Math.abs(latitude)>90||Math.abs(longitude)>180)throw new Error('地图没有返回有效坐标，请重新选点');
 return {id,name:String(result.name||'').trim()||'地图选点',address:String(result.address||'').trim(),latitude,longitude,provider:'manual'};
}
