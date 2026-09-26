import type {AppData,Trip} from './types';

export type SharedRole='owner'|'editor'|'viewer';
export interface SharedTripRecord {shareId:string;version:number;role:SharedRole;pendingEdit:boolean;trip:Trip;}

export function mergeSharedTrips(privateData:AppData,shared:SharedTripRecord[]):AppData{
 const ids=new Set(shared.map(record=>record.trip.id));
 return {...privateData,trips:[...privateData.trips.filter(trip=>!ids.has(trip.id)),...shared.map(record=>record.trip)]};
}
