export interface RowBounds {top:number;bottom:number}

export function dropIndexAtY(y:number,rows:RowBounds[]):number{
 if(!rows.length)return -1;
 let target=0,distance=Infinity;
 rows.forEach((row,index)=>{const next=Math.abs(y-(row.top+row.bottom)/2);if(next<distance){distance=next;target=index;}});
 return target;
}

export function edgeScrollStep(y:number,viewport:RowBounds):number{
 const zone=Math.min(64,(viewport.bottom-viewport.top)/3);
 if(zone<=0)return 0;
 if(y<viewport.top+zone)return -Math.round(7+13*Math.min(1,(viewport.top+zone-y)/zone));
 if(y>viewport.bottom-zone)return Math.round(7+13*Math.min(1,(y-viewport.bottom+zone)/zone));
 return 0;
}
