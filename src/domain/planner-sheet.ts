export type SheetMode='map'|'split'|'list';
export function snapSheet(height:number,velocity:number,sizes:number[]):SheetMode{
 const modes:SheetMode[]=['map','split','list'];
 let index=sizes.reduce((best,v,i)=>Math.abs(v-height)<Math.abs(sizes[best]-height)?i:best,0);
 if(velocity>.45)index=Math.min(2,sizes.findIndex(v=>v>height+8)<0?2:sizes.findIndex(v=>v>height+8));
 if(velocity<-.45){index=0;for(let i=2;i>=0;i--)if(sizes[i]<height-8){index=i;break;}}
 return modes[index];
}
export function sheetAfterDrag(mode:SheetMode,dx:number,dy:number):SheetMode{
 if(Math.abs(dy)<40||Math.abs(dy)<Math.abs(dx))return mode;
 const modes:SheetMode[]=['map','split','list'];
 const step=Math.abs(dy)>180?2:1;
 return modes[Math.max(0,Math.min(2,modes.indexOf(mode)+(dy<0?step:-step)))];
}

export function settleSheet(mode:SheetMode,height:number,velocity:number,sizes:number[],dx:number,dy:number):SheetMode{
 if(Math.abs(dx)>Math.abs(dy))return mode;
 const nearest=snapSheet(height,velocity,sizes);
 if(Math.abs(dy)<48)return nearest;
 const modes:SheetMode[]=['map','split','list'];
 const current=modes.indexOf(mode),step=Math.abs(dy)>260?2:1;
 const gesture=Math.max(0,Math.min(2,current+(dy<0?step:-step)));
 return modes[dy<0?Math.max(gesture,modes.indexOf(nearest)):Math.min(gesture,modes.indexOf(nearest))];
}
