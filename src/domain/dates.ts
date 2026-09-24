export function validDate(s:string):boolean { if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d=new Date(s+'T00:00:00Z');return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s; }
export function dateRange(start:string,end:string):string[] {
  if(!validDate(start)||!validDate(end)||end<start) throw new Error('请选择有效的起止日期');
  const days=(Date.parse(end)-Date.parse(start))/86400000+1;
  if(days>90) throw new Error('一段旅行最多安排 90 天');
  return Array.from({length:days},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10));
}
export function today():string { const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function monthCells(month:string):(string|null)[] {
  if(!/^\d{4}-\d{2}$/.test(month)||!validDate(month+'-01')) throw new Error('月份无效');
  const first=new Date(month+'-01T00:00:00Z');const count=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
  return [...Array((first.getUTCDay()+6)%7).fill(null),...Array.from({length:count},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)];
}
export function shiftMonth(month:string,offset:number):string { const d=new Date(month+'-01T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,7); }
