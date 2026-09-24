import {clone,type Guide,type Trip} from './types';
import {validDate} from './dates';

export const guideCategories:{id:Guide['category'];name:string}[]=[{id:'guide',name:'游玩攻略'},{id:'transport',name:'交通提醒'},{id:'checklist',name:'出行备忘'}];
export function safeGuideUrl(value:string):boolean {
 // Keep this portable to mini-programs, where the browser URL constructor is not guaranteed.
 return value.length<=2000&&/^https?:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::\d{1,5})?(?:[/?#][^\s<>"\\]*)?$/i.test(value);
}
export function extractGuideUrl(text:string):string {
 const candidates=text.match(/https?:\/\/[^\s<>"'，。；！【】（）]+/gi)||[];
 return candidates.map(s=>s.replace(/[.,;!?)\]}]+$/g,'')).find(safeGuideUrl)||'';
}
export function validateGuides(trip:Trip):void {
 if(trip.guides===undefined)return;
 if(!Array.isArray(trip.guides)||trip.guides.length>300)throw Error('攻略列表无效或超过300条');
 const ids=new Set<string>();
 for(const g of trip.guides){
  if(!g||typeof g.id!=='string'||!g.id.trim()||g.id.length>120||ids.has(g.id))throw Error('攻略编号无效或重复');ids.add(g.id);
  if(typeof g.title!=='string'||!g.title.trim()||g.title.length>120)throw Error('攻略标题需填写，且不超过120字');
  if(typeof g.content!=='string'||g.content.length>12000||g.sourceText!==undefined&&(typeof g.sourceText!=='string'||g.sourceText.length>4000))throw Error('攻略内容或分享原文过长');
  if(typeof g.sourceUrl!=='string'||g.sourceUrl!==''&&!safeGuideUrl(g.sourceUrl))throw Error('来源链接须为有效的 http 或 https 网址');
  if(!guideCategories.some(c=>c.id===g.category))throw Error('攻略分类无效');
  if(!Array.isArray(g.dates)||g.dates.length>366||g.dates.some(d=>typeof d!=='string'||!validDate(d))||new Set(g.dates).size!==g.dates.length)throw Error('攻略关联日期无效');
  if(!Array.isArray(g.itemIds)||g.itemIds.length>500||g.itemIds.some(id=>typeof id!=='string'||!id.trim()||id.length>120)||new Set(g.itemIds).size!==g.itemIds.length)throw Error('攻略关联行程无效');
 }
}
export function saveGuide(trip:Trip,entry:Guide):Trip {
 const next=clone(trip);next.guides??=[];
 const value={...clone(entry),title:entry.title.trim(),content:entry.content.trim(),sourceUrl:entry.sourceUrl.trim()};
 const index=next.guides.findIndex(g=>g.id===entry.id);
 if(index<0)next.guides.push(value);else next.guides[index]=value;
 validateGuides(next);next.revision++;return next;
}
export function removeGuide(trip:Trip,id:string):Trip {const next=clone(trip);next.guides=(next.guides||[]).filter(g=>g.id!==id);next.revision++;return next;}
export function guideMatches(g:Guide,query:string,scope:{date?:string;itemId?:string}={},trip?:Trip):boolean {
 const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
 const haystack=[g.title,g.content,g.sourceUrl,g.sourceText||''].join('\n').toLocaleLowerCase();
 if(!words.every(word=>haystack.includes(word)))return false;
 if(scope.itemId)return g.itemIds.includes(scope.itemId);
 if(scope.date)return g.dates.includes(scope.date)||!!trip?.items.some(i=>i.date===scope.date&&g.itemIds.includes(i.id));
 return true;
}
