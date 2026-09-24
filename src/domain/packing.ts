import {clone,uid,type Trip,type PackingItem,type PackingCategory} from './types';
import {dateRange} from './dates';

export const packingCategories:{id:PackingCategory;name:string;hint:string}[]=[
 {id:'clothing',name:'衣物',hint:'穿得舒服，留出换洗'},
 {id:'documents',name:'证件',hint:'出发前再检查一次'},
 {id:'toiletries',name:'洗漱',hint:'带上习惯用的日常物品'},
 {id:'electronics',name:'电子',hint:'设备、线材与电量'},
 {id:'essentials',name:'常备物品',hint:'按自己的需要准备'},
 {id:'driving',name:'自驾用品',hint:'取车前核对所需物品'}
];
export function validatePacking(trip:Trip){
 if(trip.packing===undefined)return;
 if(!Array.isArray(trip.packing)||trip.packing.length>500)throw Error('行李清单格式无效或超过500项');
 const ids=new Set<string>();
 for(const p of trip.packing){
  if(!p||typeof p.id!=='string'||!p.id||p.id.length>120||ids.has(p.id))throw Error('行李编号无效或重复');ids.add(p.id);
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>80)throw Error('物品名称需填写，且不超过80字');
  if(!packingCategories.some(c=>c.id===p.category))throw Error('行李分类无效');
  if(p.carryMode!==undefined&&!['pack','wear'].includes(p.carryMode))throw Error('携带方式无效');
  if(!Number.isSafeInteger(p.quantity)||p.quantity<1||p.quantity>999)throw Error('数量请输入1至999的整数');
  if(typeof p.memberId!=='string'||(p.memberId!==''&&!trip.members.some(m=>m.id===p.memberId)))throw Error('行李归属成员不存在');
  if(typeof p.packed!=='boolean'||typeof p.note!=='string'||p.note.length>2000)throw Error('收拾状态或备注无效');
 }
}
export function savePacking(trip:Trip,entry:PackingItem):Trip{
 const next=clone(trip);next.packing??=[];
 const value={...clone(entry),name:entry.name.trim(),note:entry.note.trim()};
 const index=next.packing.findIndex(p=>p.id===entry.id);
 if(index<0)next.packing.push(value);else next.packing[index]=value;
 validatePacking(next);next.revision++;return next;
}
export type PackingDraft=Omit<PackingItem,'id'|'packed'>;
export function addPackingTemplate(trip:Trip,entries:PackingDraft[]):Trip{
 const next=clone(trip);next.packing??=[];
 const key=(p:PackingDraft)=>JSON.stringify([p.category,p.memberId,p.name.trim().toLocaleLowerCase(),p.carryMode||'pack']);
 const existing=new Set(next.packing.map(key));
 for(const entry of entries){if(existing.has(key(entry)))continue;next.packing.push({...clone(entry),name:entry.name.trim(),note:entry.note.trim(),id:uid(),packed:false});existing.add(key(entry));}
 validatePacking(next);next.revision++;return next;
}
const draft=(category:PackingCategory,name:string,quantity=1,note=''):PackingDraft=>({category,name,quantity,note,memberId:''});
export function clothingSuggestions(trip:Trip,washEveryDays:number,memberId=trip.members[0].id):PackingDraft[]{
 const days=dateRange(trip.startDate,trip.endDate).length;
 if(!Number.isInteger(washEveryDays)||washEveryDays<1||washEveryDays>366)throw Error('换洗间隔无效');
 const cycle=Math.min(days,washEveryDays);
 return [
  {...draft('clothing','外套',1,'按实际温度选择防风或保暖外套；不是天气预报'),carryMode:'wear' as const},
  {...draft('clothing','舒适步行鞋',1,'出发时穿着，不额外占行李箱'),carryMode:'wear' as const},
  draft('clothing','保暖中层',1,'根据实际天气增减'),draft('clothing','长袖上衣',Math.max(1,Math.ceil(cycle/2)),'包括出发当天穿的；若穿在身上，请将相应件数另列为出发时穿'),
  draft('clothing','长裤',Math.min(2,Math.ceil(cycle/3)),'总准备量，可按洗换习惯调整'),
  draft('clothing','袜子',cycle,'按每天一双、洗换间隔估算；包含出发当天'),draft('clothing','内衣',cycle,'按每天一套、洗换间隔估算；包含出发当天'),
  draft('clothing','睡衣',1,'车上过夜与酒店内休息按需准备'),draft('clothing','帽子',1,'按户外活动需要选择')
 ].flatMap(p=>{
  if(['长袖上衣','长裤','袜子','内衣'].includes(p.name))return [
   {...p,quantity:1,carryMode:'wear' as const,note:'出发当天穿着'},
   ...(p.quantity>1?[{...p,quantity:p.quantity-1,carryMode:'pack' as const,note:`按${cycle}天一轮换洗建议的备用数量，可编辑；含当天穿着共${p.quantity}件`}]:[])
  ];
  return [p];
 }).map(p=>({...p,memberId}));
}
export const packingTemplates=[
 {id:'basic',name:'日常出行',description:'证件、洗漱与电子物品，按需勾选。',items:[draft('documents','身份证'),draft('toiletries','牙刷与牙膏'),draft('toiletries','毛巾'),draft('electronics','手机充电器'),draft('electronics','充电宝'),draft('essentials','纸巾'),draft('essentials','水杯')]},
 {id:'autumn',name:'秋季 / 户外衣物',description:'装备示例，不是目的地天气预报；请按实际天气与活动调整。',items:[draft('clothing','外套'),draft('clothing','保暖中层'),draft('clothing','长袖上衣',2),draft('clothing','长裤',2),draft('clothing','袜子',3),draft('clothing','内衣',3),draft('clothing','舒适步行鞋'),draft('clothing','帽子')]},
 {id:'driving',name:'自驾准备',description:'结合车辆配置与租车要求核对。',items:[draft('documents','驾驶证'),draft('driving','车载充电器'),draft('driving','手机支架'),draft('driving','太阳镜')]}
];
