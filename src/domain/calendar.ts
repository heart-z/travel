import type {Trip} from './types';
const colors=['#8a9f76','#c09b73','#8babb0','#b69690'];
export function tripColor(id:string):string {let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))>>>0;return colors[hash%colors.length];}
export function calendarLanes(trips:Trip[],month:string):Trip[][] {
  const visible=trips.filter(t=>!t.archived&&t.startDate.slice(0,7)<=month&&t.endDate.slice(0,7)>=month)
    .sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.id.localeCompare(b.id));
  const lanes:Trip[][]=[];
  for(const trip of visible){let lane=lanes.find(row=>row[row.length-1].endDate<trip.startDate);if(!lane){lane=[];lanes.push(lane);}lane.push(trip);}
  return lanes;
}
