import type { Trip } from './types';
export function parseCents(text:string):number { if(!/^\d+(\.\d{1,2})?$/.test(text.trim()))throw new Error('请输入正确金额，最多两位小数'); const [a,b='']=text.trim().split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>100000000)throw new Error('金额超出范围');return n; }
export function yuan(cents:number):string {return (cents/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});}
export function splitEqual(amount:number,members:string[]):Record<string,number> { if(!Number.isSafeInteger(amount)||amount<0||!members.length||new Set(members).size!==members.length)throw new Error('分摊参数无效');return Object.fromEntries(members.map((id,i)=>[id,Math.floor(amount/members.length)+(i<amount%members.length?1:0)])); }
export function balances(trip:Trip):Record<string,number> {
  const result=Object.fromEntries(trip.members.map(m=>[m.id,0]));
  for(const e of trip.expenses){result[e.payer]+=e.amount;for(const [id,n] of Object.entries(e.shares))result[id]-=n;}
  for(const s of trip.settlements){result[s.from]+=s.amount;result[s.to]-=s.amount;}return result;
}
