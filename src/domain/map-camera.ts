import type {Item} from './types';
import type {Point} from './geo';
export function hasCoordinates(items:Item[]):boolean{return items.some(i=>!!i.place);}
// Never fit a single point: native maps may select their maximum zoom.
export function mapCamera(items:Item[],selected='',focus?:Point,overview=false):{center:Point;scale:number;fitPoints:Point[]}{
 const points=items.flatMap(i=>i.place?[{latitude:i.place.latitude,longitude:i.place.longitude}]:[]);
 const target=focus||(!overview?items.find(i=>i.id===selected)?.place:undefined);
 if(target)return {center:{latitude:target.latitude,longitude:target.longitude},scale:14,fitPoints:[]};
 const unique=points.filter((p,i)=>points.findIndex(q=>q.latitude===p.latitude&&q.longitude===p.longitude)===i);
 if(unique.length<2)return {center:unique[0]||{latitude:35,longitude:105},scale:unique.length?14:4,fitPoints:[]};
 return {center:{latitude:unique.reduce((s,p)=>s+p.latitude,0)/unique.length,longitude:unique.reduce((s,p)=>s+p.longitude,0)/unique.length},scale:12,fitPoints:unique};
}
