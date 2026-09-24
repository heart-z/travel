<script setup lang="ts">
import {computed,ref,watch,nextTick,onMounted,onBeforeUnmount,getCurrentInstance} from 'vue';
import {onLoad,onShow} from '@dcloudio/uni-app';
import {state,initialize,findTrip,go,saveTrip,notify,confirm,reload} from '../../state';
import {dateRange,today} from '../../domain/dates';
import {tripStatus} from '../../domain/trip-status';
import {formatTime} from '../../domain/schedule';
import {planTimeline,timelineLabel,transferMinutes} from '../../domain/planner-timeline';
import {movePointWithTransit,movePointToDayWithTransit} from '../../domain/itinerary';
import {locationState,locationLabels} from '../../domain/locations';
import {staysOn,transportsOn} from '../../domain/resources';
import {clone,type Item,type TransportMode,type Transport} from '../../domain/types';
import {routes,navigate,type Leg} from '../../services/maps';
import RouteMap from '../../components/RouteMap.vue';
import StatusBanner from '../../components/StatusBanner.vue';
import TripNav from '../../components/TripNav.vue';
import WeatherCard from '../../components/WeatherCard.vue';
import type {Place} from '../../domain/types';
import {sheetAfterDrag,settleSheet,type SheetMode} from '../../domain/planner-sheet';
import {hasCoordinates} from '../../domain/map-camera';
import {straightLineMeters} from '../../domain/distance';
import {dropIndexAtY,edgeScrollStep,type RowBounds} from '../../domain/planner-drag';
import {isTransition,plannerEntries,pointLabel,presentationNote,transitionMode} from '../../domain/planner-presentation';
const instance=getCurrentInstance();
const availableHeight=ref(660),wideLandscape=ref(false),dragHeight=ref<number>(),dragExpanded=ref(false);
const snapSizes=computed(()=>{const max=Math.max(180,availableHeight.value-72),min=Math.min(218,max*.66);return [min,Math.max(min+28,Math.min(max-28,availableHeight.value*.64)),max];});
const sheetStyle=computed(()=>wideLandscape.value?{}:!mapAvailable.value?{height:'0px',flex:'1 1 0%'}:{height:(dragHeight.value??(layout.value==='map'&&cardOpen.value?90:snapSizes.value[['map','split','list'].indexOf(layout.value)]))+'px',flex:'0 0 auto',transition:dragHeight.value===undefined?'height 340ms cubic-bezier(.22,1,.36,1)':'none'});
const mapStyle=computed(()=>wideLandscape.value?{}:{height:'0px',minHeight:'60px',flex:'1 1 0%'});
function measureSheet(){nextTick(()=>{const info=uni.getSystemInfoSync();wideLandscape.value=info.windowWidth>=600&&info.windowHeight<=520;uni.createSelectorQuery().in(instance?.proxy).select('.planner').boundingClientRect().select('.planner-header').boundingClientRect().exec((rects:any[])=>{if(rects[0]&&rects[1])availableHeight.value=rects[0].height-rects[1].height-74-(info.safeAreaInsets?.bottom||0);});});}
let dragStart:{x:number;y:number;height:number;mode:SheetMode}|undefined,dragLastY=0,dragLastAt=0,dragVelocity=0,carouselClickBlockedUntil=0;
function beginSheetDrag(e:any){
 if(!mapAvailable.value)return;
 const p=e.touches?.[0]||e,hadDetail=layout.value==='map'&&cardOpen.value;
 const start={x:p.clientX,y:p.clientY,height:snapSizes.value[['map','split','list'].indexOf(layout.value)],mode:layout.value};
 dragStart=start;dragLastY=p.clientY;dragLastAt=Date.now();dragVelocity=0;
 const freeze=(height:number)=>{if(dragStart!==start||wideLandscape.value||!Number.isFinite(height))return;start.height=height;dragHeight.value=height;dragExpanded.value=start.mode==='map'&&height>snapSizes.value[0]+35;};
 // #ifdef H5
 const root=instance?.proxy?.$el as HTMLElement|undefined;
 const sheet=root?.querySelector?.('.planner-sheet');
 if(sheet)freeze(sheet.getBoundingClientRect().height+(hadDetail?(root?.querySelector?.('.map-dock')?.getBoundingClientRect().height||0):0));
 // #endif
 // #ifdef MP-WEIXIN
 uni.createSelectorQuery().in(instance?.proxy).select('.planner-sheet').boundingClientRect().select('.map-dock').boundingClientRect().exec((rects:any[])=>{if(dragStart!==start)return;if(rects[0])freeze(rects[0].height+(hadDetail?(rects[1]?.height||0):0));cardOpen.value=false;});
 // #endif
 // #ifndef MP-WEIXIN
 cardOpen.value=false;
 // #endif
}
function moveSheetDrag(e:any){if(!dragStart)return;const p=e.touches?.[0]||e,dy=p.clientY-dragStart.y,dx=p.clientX-dragStart.x;if(Math.abs(dx)>Math.abs(dy))return;const now=Date.now(),dt=now-dragLastAt;if(dt>0)dragVelocity=.5*dragVelocity+.5*(dragLastY-p.clientY)/dt;dragLastY=p.clientY;dragLastAt=now;if(wideLandscape.value)return;const raw=dragStart.height-dy,min=snapSizes.value[0],max=snapSizes.value[2];dragHeight.value=raw<min?min+(raw-min)*.18:raw>max?max+(raw-max)*.18:raw;dragExpanded.value=layout.value==='map'&&dragHeight.value>min+35;}
function endSheetDrag(e:any){if(!dragStart)return;const p=e.changedTouches?.[0]||e,dx=p.clientX-dragStart.x,dy=p.clientY-dragStart.y;const velocity=Date.now()-dragLastAt>100?0:dragVelocity,previous=layout.value;if(Math.abs(dy)>30&&Math.abs(dy)>Math.abs(dx))carouselClickBlockedUntil=Date.now()+400;layout.value=dragHeight.value!==undefined?settleSheet(dragStart.mode,dragHeight.value,velocity,snapSizes.value,dx,dy):sheetAfterDrag(dragStart.mode,dx,dy);if(previous!==layout.value)lightFeedback();dragStart=undefined;dragHeight.value=undefined;dragExpanded.value=false;}
function lightFeedback(){
 // #ifdef MP-WEIXIN
 uni.vibrateShort({type:'light',fail:()=>{}});
 // #endif
}
function cancelSheetDrag(){dragStart=undefined;dragHeight.value=undefined;dragExpanded.value=false;}
onMounted(()=>{measureSheet();uni.onWindowResize(measureSheet);});
onBeforeUnmount(()=>uni.offWindowResize(measureSheet));
// #ifdef H5
onMounted(()=>{document.addEventListener('mouseup',endSheetDrag);document.addEventListener('mousemove',moveSheetDrag);});
onBeforeUnmount(()=>{document.removeEventListener('mouseup',endSheetDrag);document.removeEventListener('mousemove',moveSheetDrag);});
// #endif
const id=ref(''),day=ref(''),selected=ref(''),mode=ref<'driving'|'walking'>('driving');
const legs=ref<Leg[]>([]),routeError=ref(''),routing=ref(false),expanded=ref<string[]>([]);
const manageItemId=ref('');
const expandedTransits=ref<string[]>([]);
function toggleTransit(key:string){expandedTransits.value=expandedTransits.value.includes(key)?expandedTransits.value.filter(x=>x!==key):[key];}
const overview=ref(false),layout=ref<'map'|'split'|'list'>('map'),listAnchor=ref(''),selectionToken=ref(0);
const cardOpen=ref(false);
const carouselIndex=ref(0);
function browseStop(index:number){const item=stops.value[index];if(!item)return;carouselIndex.value=index;cardOpen.value=false;selected.value=item.id;selectionToken.value++;}
function openCarouselStop(value:string){if(Date.now()<carouselClickBlockedUntil)return;void selectStop(value);}
function swipeStop(e:any){const index=Number(e.detail.current);if(index!==carouselIndex.value)browseStop(index);}
const selectedItem=computed(()=>trip.value?.items.find(i=>i.id===selected.value));
async function focusSavedPlace(payload:{tripId:string;itemId:string;date:string}){if(payload.tripId!==id.value)return;await nextTick();layout.value='split';await selectStop(payload.itemId,false);}
onMounted(()=>uni.$on('trip-place-saved',focusSavedPlace));
onBeforeUnmount(()=>uni.$off('trip-place-saved',focusSavedPlace));
const relatedGuides=(itemId:string)=>trip.value?.guides?.filter(g=>g.itemIds.includes(itemId))||[];
function openGuides(itemId=''){go('guides',{id:id.value,date:day.value,...(itemId?{item:itemId}:{})});}
function bindLocation(itemId:string){selected.value=itemId;carouselIndex.value=Math.max(0,stops.value.findIndex(i=>i.id===itemId));selectionToken.value++;layout.value='map';cardOpen.value=false;go('map',{id:id.value,date:day.value,item:itemId,mode:mode.value,bind:'1'});}
const mapItems=computed(()=>overview.value?days.value.flatMap(date=>plannerEntries((trip.value?.items||[]).filter(i=>i.date===date).sort((a,b)=>a.order-b.order)).flatMap(entry=>entry.type==='point'?[entry.item]:[])):stops.value);
const mapStays=computed(()=>trip.value?(overview.value?trip.value.stays||[]:staysOn(trip.value,day.value)).filter(stay=>stay.kind!=='train'&&stay.place):[]);
const visibleLegs=computed(()=>{const ids=new Set(mapItems.value.map(i=>i.id));return legs.value.filter(l=>ids.has(l.from)&&ids.has(l.to));});
const mapAvailable=computed(()=>hasCoordinates(mapItems.value)||mapStays.value.length>0);
const showList=computed(()=>layout.value!=='map'||!mapAvailable.value);
const dayIndex=computed(()=>days.value.indexOf(day.value)+1);
const weatherPlaces=computed(()=>[...items.value.flatMap(i=>i.place?[i.place]:[]),...tonight.value.flatMap(s=>s.place?[s.place]:[])].filter((p,i,a)=>a.findIndex(q=>q.id===p.id)===i));
async function resetList(){listAnchor.value='';await nextTick();listAnchor.value='planner-list-top';}
function chooseDay(value:string){const hadMap=mapAvailable.value;overview.value=false;cardOpen.value=false;carouselIndex.value=0;day.value=value;const next=plannerEntries((trip.value?.items||[]).filter(i=>i.date===value).sort((a,b)=>a.order-b.order)).flatMap(entry=>entry.type==='point'?[entry.item]:[]);if(!hasCoordinates(next))layout.value='list';else if(!hadMap)layout.value='split';void resetList();}
function showOverview(){overview.value=true;selected.value='';cardOpen.value=false;void resetList();}
function focusItem(item:Item){if(!item.place){layout.value='list';expanded.value=item.note?[item.id]:[];return;}if(layout.value==='list')layout.value='split';void selectStop(item.id);}
function toggleDetails(itemId:string){expanded.value=expanded.value.includes(itemId)?expanded.value.filter(id=>id!==itemId):[...expanded.value,itemId];}
function toggleManage(itemId:string){manageItemId.value=manageItemId.value===itemId?'':itemId;}
async function moveStopToDay(item:Item,index:number){const date=days.value[index];if(!trip.value||locked.value||!date||date===day.value)return;try{await saveTrip(movePointToDayWithTransit(trip.value,item.id,date));manageItemId.value='';chooseDay(date);}catch(error){notify(error);}}
let request=0;
const modeValues:TransportMode[]=['driving','walking','train','flight','bus','manual'];
const modeLabels=['驾车','步行','铁路','飞机','大巴','手动'];
const trip=computed(()=>findTrip(id.value));
const currentDate=ref(today());
const status=computed(()=>trip.value?tripStatus(trip.value.startDate,trip.value.endDate,currentDate.value):undefined);
let dateRefreshTimer:ReturnType<typeof setTimeout>|undefined;
function refreshDate(){currentDate.value=today();const now=new Date();const midnight=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);dateRefreshTimer=setTimeout(refreshDate,midnight.getTime()-now.getTime()+1000);}
onMounted(refreshDate);
onBeforeUnmount(()=>{if(dateRefreshTimer)clearTimeout(dateRefreshTimer);});
onShow(()=>{currentDate.value=today();});
const locked=computed(()=>state.busy||state.readOnly||!state.ready);
const dayAnchor=computed(()=>'day-'+day.value);
const days=computed(()=>trip.value?dateRange(trip.value.startDate,trip.value.endDate):[]);
const items=computed(()=>trip.value?.items.filter(i=>i.date===day.value).sort((a,b)=>a.order-b.order)||[]);
const entries=computed(()=>plannerEntries(items.value));
const routeStops=computed(()=>entries.value.flatMap((entry,index)=>{
 if(entry.type!=='point')return [];
 const next=entries.value[index+1],connector=next?.type==='transit'?next.items[0]:next?.type==='point'&&isTransition(next.item)?next.item:undefined;
 return [{...entry.item,...(connector?{travelMode:entry.item.travelMode||transitionMode(connector)}:{})}];
}));
function hasDirectNextPoint(index:number){return entries.value[index+1]?.type==='point';}
function directTravelMode(index:number){const from=entries.value[index],next=entries.value[index+1];if(from?.type!=='point'||next?.type!=='point')return 'manual';return from.item.travelMode||(isTransition(next.item)?transitionMode(next.item):'manual');}
const stops=computed(()=>entries.value.flatMap(e=>e.type==='point'?[e.item]:[]));
const completedCount=computed(()=>items.value.filter(i=>i.completed).length);
const completionPercent=computed(()=>items.value.length?Math.round(completedCount.value/items.value.length*100):0);
watch(items,()=>{const index=stops.value.findIndex(i=>i.id===selected.value);carouselIndex.value=index>=0?index:Math.min(carouselIndex.value,Math.max(0,stops.value.length-1));if(selected.value&&index<0){selected.value='';cardOpen.value=false;}void measureSheet();});
const tonight=computed(()=>trip.value?staysOn(trip.value,day.value):[]);
const checkouts=computed(()=>trip.value?.stays?.filter(s=>s.checkOut===day.value&&s.kind!=='train')||[]);
const journeys=computed(()=>trip.value?transportsOn(trip.value,day.value):[]);
const hotels=computed(()=>items.value.filter(i=>i.kind==='住宿'));
const dayStartTime=computed(()=>trip.value?.dayStartTimes?.[day.value]||'09:00');
const dayStartMinutes=computed(()=>Number(dayStartTime.value.slice(0,2))*60+Number(dayStartTime.value.slice(3)));
const scheduleLegs=computed(()=>[...(trip.value?.transports||[]).flatMap(t=>{
 const start=Date.parse(t.departure),end=Date.parse(t.arrival);
 return t.fromItemId&&t.toItemId&&Number.isFinite(start)&&Number.isFinite(end)&&end>=start?[{from:t.fromItemId,to:t.toItemId,duration:(end-start)/1000}]:[];
}),...legs.value]);
const timeline=computed(()=>planTimeline(items.value,scheduleLegs.value,dayStartMinutes.value));
function timeFor(item:Item){const slot=timeline.value[items.value.findIndex(i=>i.id===item.id)];return slot?timelineLabel(slot):'时间待定';}
function routeMinutes(item:Item){const index=items.value.findIndex(i=>i.id===item.id),next=items.value[index+1];return next?transferMinutes(item,next,scheduleLegs.value):undefined;}
function routeClock(item:Item){const index=items.value.findIndex(i=>i.id===item.id),current=timeline.value[index],minutes=routeMinutes(item);return current&&minutes!==undefined?`${current.unknownTravel?'最早':'预计'} ${formatTime(current.end)}–${formatTime(current.end+minutes)}`:'';}
function routeDistance(from:Item,to:Item){const road=legs.value.find(leg=>leg.from===from.id&&leg.to===to.id)?.distance;if(typeof road==='number'&&Number.isFinite(road))return road<1000?`${Math.round(road)} 米`:`${(road/1000).toFixed(1)} 公里`;if(from.place&&to.place){const direct=straightLineMeters(from.place,to.place);return `直线约 ${direct<1000?`${Math.round(direct)} 米`:`${(direct/1000).toFixed(1)} 公里`}`;}return '里程待定位';}
function routeDistanceAt(index:number){const entry=entries.value[index],from=entry?.type==='point'?entry:entries.value[index-1],next=entries.value[index+1],destination=next?.type==='transit'?entries.value[index+2]:next;return from?.type==='point'&&destination?.type==='point'?routeDistance(from.item,destination.item):'里程待确认';}
async function setDayStart(e:any){if(!trip.value||locked.value)return;const value=String(e.detail.value||'');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))return;try{const next=clone(trip.value);next.dayStartTimes={...next.dayStartTimes,[day.value]:value};next.revision++;await saveTrip(next);}catch(error){notify(error);}}
async function setTravelMinutes(item:Item,e:any){if(!trip.value||locked.value)return;const raw=String(e.detail.value??'').trim(),value=raw===''?undefined:Number(raw);if(value!==undefined&&(!Number.isInteger(value)||value<0||value>2880)){notify('交通耗时请填 0–2880 分钟');return;}if(item.travelMinutes===value)return;try{const next=clone(trip.value),target=next.items.find(i=>i.id===item.id);if(!target)return;if(value===undefined)delete target.travelMinutes;else target.travelMinutes=value;next.revision++;await saveTrip(next);}catch(error){notify(error);}}
async function setTransitMinutes(item:Item,e:any){const raw=String(e.detail.value??'').trim(),value=Number(raw);if(raw===''||!Number.isInteger(value)||value<0||value>2880){notify('交通耗时请填 0–2880 分钟');return;}if(value!==item.duration)await updateItem(item,{duration:value});}
onLoad(async q=>{id.value=q?.id||'';if(q?.mode==='walking'||q?.mode==='driving')mode.value=q.mode;await initialize();day.value=q?.date||trip.value?.startDate||'';});
watch(days,value=>{if(value.length&&!value.includes(day.value))day.value=value[0];});
watch(day,()=>{selected.value='';expanded.value=[];expandedTransits.value=[];manageItemId.value='';cardOpen.value=false;});
watch(layout,()=>{cardOpen.value=false;});
watch(()=>JSON.stringify([items.value.map(i=>[i.id,i.place,i.travelMode]),mode.value,trip.value?.transports]),()=>{void loadRoutes();});
async function loadRoutes(){const token=++request;legs.value=[];routeError.value='';routing.value=false;routing.value=true;try{const result=await routes(routeStops.value,mode.value,trip.value?.transports);if(token===request)legs.value=result;}catch(e){if(token===request)routeError.value=e instanceof Error?e.message:'路线暂不可用';}finally{if(token===request)routing.value=false;}}
function label(value:TransportMode){return modeLabels[modeValues.indexOf(value)]||'手动';}
function linkedTransport(item:Item){const index=items.value.findIndex(i=>i.id===item.id);return trip.value?.transports?.find(t=>t.fromItemId===item.id&&t.toItemId===items.value[index+1]?.id);}
async function selectStop(value:string,fromMap=true){const item=trip.value?.items.find(i=>i.id===value);if(!item)return;overview.value=false;if(day.value!==item.date){day.value=item.date;await nextTick();}selected.value=value;carouselIndex.value=stops.value.findIndex(i=>i.id===value);selectionToken.value++;if(!item.place){layout.value='list';expanded.value=[item.id];cardOpen.value=false;return;}await nextTick();cardOpen.value=true;if(fromMap&&layout.value!=='map'){listAnchor.value='';await nextTick();const index=stops.value.findIndex(i=>i.id===value);if(index>=0)listAnchor.value=`stop-${index}`;}}

async function updateItem(item:Item,change:Partial<Item>){if(!trip.value||locked.value)return;try{const t=clone(trip.value);const target=t.items.find(i=>i.id===item.id);if(!target)return;Object.assign(target,change);t.revision++;await saveTrip(t);}catch(e){notify(e);}}
function setMode(item:Item,index:number){const value=modeValues[index];if(value)void updateItem(item,{travelMode:value});}
const dragging=ref(false),dragItemId=ref(''),dragFrom=ref(-1),dragTo=ref(-1),dragOffset=ref(0),dragOffsetX=ref(0);
const dragTargetDayIndex=ref(-1),dragEdgeDirection=ref(0);
const listScrollTop=ref(0);
let dragHold:ReturnType<typeof setTimeout>|undefined,dragEdgeTimer:ReturnType<typeof setTimeout>|undefined,dragScrollTimer:ReturnType<typeof setInterval>|undefined;
let pressY=0,pressX=0,dragPointerY=0,dragScrollOrigin=0,observedScrollTop=0,dragScrollAmount=0,listMaxScroll=0;
let dragRows:RowBounds[]=[],listViewport:RowBounds|undefined,suppressStopClick=false;
function cancelDragHold(){if(dragHold){clearTimeout(dragHold);dragHold=undefined;}}
function clearDragEdge(){if(dragEdgeTimer){clearTimeout(dragEdgeTimer);dragEdgeTimer=undefined;}dragEdgeDirection.value=0;}
function clearDragScroll(){if(dragScrollTimer){clearInterval(dragScrollTimer);dragScrollTimer=undefined;}dragScrollAmount=0;}
function updateDragTarget(y:number){if(dragTargetDayIndex.value!==days.value.indexOf(day.value))return;const next=dropIndexAtY(y,dragRows);if(next>=0&&next!==dragTo.value){dragTo.value=next;lightFeedback();}}
function setDragScroll(amount:number){if(amount===dragScrollAmount)return;clearDragScroll();if(!amount)return;dragScrollAmount=amount;dragScrollTimer=setInterval(()=>{if(!dragging.value)return;const next=Math.max(0,Math.min(listMaxScroll,listScrollTop.value+dragScrollAmount));if(next!==listScrollTop.value)listScrollTop.value=next;},50);}
function onPlannerListScroll(e:any){const next=Number(e.detail?.scrollTop);if(!Number.isFinite(next))return;const delta=next-observedScrollTop;observedScrollTop=next;if(!delta)return;if(!dragging.value){cancelDragHold();return;}dragRows=dragRows.map(row=>({top:row.top-delta,bottom:row.bottom-delta}));dragOffset.value=dragPointerY-pressY+next-dragScrollOrigin;if(Math.abs(dragPointerY-pressY)>12)updateDragTarget(dragPointerY);}
function advanceDragDay(direction:number,delay:number){dragEdgeTimer=setTimeout(()=>{const next=dragTargetDayIndex.value+direction;if(next>=0&&next<days.value.length){dragTargetDayIndex.value=next;lightFeedback();advanceDragDay(direction,1500);}else clearDragEdge();},delay);}
function setDragEdge(direction:number){if(direction===dragEdgeDirection.value)return;clearDragEdge();if(!direction)return;dragEdgeDirection.value=direction;advanceDragDay(direction,650);}
function stopPressStart(e:any,item:Item,index:number){if(locked.value||(stops.value.length<2&&days.value.length<2))return;const p=e.touches?.[0];if(!p)return;cancelDragHold();pressX=p.clientX;pressY=p.clientY;dragPointerY=pressY;dragHold=setTimeout(()=>{dragHold=undefined;dragging.value=true;lightFeedback();dragItemId.value=item.id;dragFrom.value=index;dragTo.value=index;dragTargetDayIndex.value=days.value.indexOf(day.value);dragScrollOrigin=observedScrollTop;listScrollTop.value=observedScrollTop;dragOffset.value=0;dragOffsetX.value=0;uni.createSelectorQuery().in(instance?.proxy).select('.planner-list').boundingClientRect().select('.list-content').boundingClientRect().selectAll('.stop-block').boundingClientRect().exec((result:any[])=>{if(!dragging.value)return;const viewport=result?.[0],content=result?.[1];listViewport=viewport?{top:viewport.top,bottom:viewport.bottom}:undefined;listMaxScroll=viewport&&content?Math.max(0,content.height-viewport.height):0;dragRows=(result?.[2]||[]).map((r:any)=>({top:r.top,bottom:r.bottom}));if(Math.abs(dragPointerY-pressY)>12){updateDragTarget(dragPointerY);if(listViewport&&!dragEdgeDirection.value)setDragScroll(edgeScrollStep(dragPointerY,listViewport));}});},420);}
function stopPressMove(e:any){const p=e.touches?.[0];if(!p)return;if(!dragging.value){if(Math.abs(p.clientY-pressY)>10||Math.abs(p.clientX-pressX)>10)cancelDragHold();return;}e.preventDefault?.();dragPointerY=p.clientY;dragOffset.value=dragPointerY-pressY+observedScrollTop-dragScrollOrigin;dragOffsetX.value=Math.max(-72,Math.min(72,p.clientX-pressX));const width=uni.getSystemInfoSync().windowWidth,edge=Math.min(58,width*.16),direction=Math.abs(p.clientX-pressX)>45?(p.clientX>=width-edge?1:p.clientX<=edge?-1:0):0;setDragEdge(direction);if(direction){clearDragScroll();return;}updateDragTarget(dragPointerY);setDragScroll(listViewport&&Math.abs(dragPointerY-pressY)>12?edgeScrollStep(dragPointerY,listViewport):0);}
async function stopPressEnd(){cancelDragHold();clearDragEdge();clearDragScroll();if(!dragging.value)return;const from=dragFrom.value,to=dragTo.value,key=dragItemId.value,targetDate=days.value[dragTargetDayIndex.value];dragging.value=false;dragItemId.value='';dragTargetDayIndex.value=-1;dragRows=[];listViewport=undefined;dragOffset.value=0;dragOffsetX.value=0;suppressStopClick=true;setTimeout(()=>{suppressStopClick=false;},250);if(from<0||locked.value||!trip.value)return;try{if(targetDate&&targetDate!==day.value){await saveTrip(movePointToDayWithTransit(trip.value,key,targetDate));chooseDay(targetDate);lightFeedback();}else if(to>=0&&from!==to){await saveTrip(movePointWithTransit(trip.value,key,to));lightFeedback();}}catch(e){notify(e);}}
function stopPressCancel(){cancelDragHold();clearDragEdge();clearDragScroll();dragging.value=false;dragItemId.value='';dragTargetDayIndex.value=-1;dragRows=[];listViewport=undefined;dragOffset.value=0;dragOffsetX.value=0;}
function stopMainClick(item:Item){if(!suppressStopClick)focusItem(item);}
onBeforeUnmount(()=>{cancelDragHold();clearDragEdge();clearDragScroll();});
async function remove(item:Item){if(!trip.value||locked.value||!await confirm('移除计划',`从行程中移除“${item.name}”？`))return;if(locked.value)return;try{const t=clone(trip.value);t.items=t.items.filter(i=>i.id!==item.id);t.items.filter(i=>i.date===day.value).sort((a,b)=>a.order-b.order).forEach((i,n)=>i.order=n);t.revision++;await saveTrip(t);}catch(e){notify(e);}}
function resources(tab='stay',edit=''){go('resources',{id:id.value,date:day.value,tab,...(edit?{edit}:{})});}
function arrivalText(t:Transport){const date=t.arrival.slice(0,10);const dates=dateRange(t.departure.slice(0,10),date);return `${dates.length===2?'次日 ':dates.length>2?date.slice(5)+' ':''}${t.arrival.slice(11)}`;}
</script>
<template>
<view v-if="trip" class="planner" :class="['layout-'+layout,{'no-map':!mapAvailable}]">
 <view class="planner-header"><view class="planner-heading"><view class="planner-title">{{trip.title}}</view><view class="planner-meta">{{trip.startDate.slice(5).replace('-','/')}} — {{trip.endDate.slice(5).replace('-','/')}} · {{days.length}} 天</view></view><button class="header-action" :disabled="locked" aria-label="编辑旅行" @click="go('trip-edit',{id})"><image src="/static/ui/edit.svg"/></button></view>
 <view v-if="state.error" class="planner-warning" @click="reload">{{state.error}} · 点击重试</view>
 <view v-if="mapAvailable" class="planner-map" :style="mapStyle" ><RouteMap embedded :items="mapItems" :legs="overview?[]:visibleLegs" :stays="mapStays" :selected="selected" :selection-token="selectionToken" @select="selectStop" @select-stay="resources('stay',$event)"/></view>
 <view class="planner-sheet" :style="sheetStyle">
   <view v-if="mapAvailable" class="sheet-drag-handle" @touchstart="beginSheetDrag" @touchmove.stop.prevent="moveSheetDrag" @touchend="endSheetDrag" @touchcancel="cancelSheetDrag" @mousedown="beginSheetDrag"><view class="drag-bar"/><text>{{layout==='map'?'上滑看行程':layout==='split'?'继续上滑看完整行程':'下滑看地图'}}</text></view>
  <scroll-view scroll-x :scroll-into-view="dayAnchor" class="planner-dates" :show-scrollbar="false"><view class="date-strip"><button class="planner-date overview-date" :class="{active:overview}" @click="showOverview"><text>总览</text><text>{{days.length}} 天</text></button><button v-for="(date,index) in days" :id="`day-${date}`" :key="date" class="planner-date" :class="{active:!overview&&day===date,'drag-day-target':dragging&&dragTargetDayIndex===index&&date!==day}" @click="chooseDay(date)"><text>{{date.slice(5).replace('-','.')}}</text><text>第 {{index+1}} 天</text></button></view></scroll-view>
  <view v-if="layout==='map'&&mapAvailable" v-show="!cardOpen" class="map-carousel" @touchstart="beginSheetDrag" @touchmove="moveSheetDrag" @touchend="endSheetDrag" @touchcancel="cancelSheetDrag">
    <template v-if="!overview&&stops.length"><swiper class="stop-carousel" :current="carouselIndex" next-margin="24px" previous-margin="16px" @change="swipeStop"><swiper-item v-for="(item,index) in stops" :key="item.id"><button class="carousel-card" @click="openCarouselStop(item.id)"><view class="carousel-icon">{{index+1}}</view><view class="carousel-copy"><view class="carousel-kind">{{item.kind}}<text>{{timeFor(item)}}</text></view><view class="carousel-name">{{pointLabel(item)}}</view><view class="carousel-meta">停留 {{item.duration}} 分钟<text v-if="relatedGuides(item.id).length"> · 攻略 {{relatedGuides(item.id).length}}</text></view></view></button></swiper-item></swiper></template>
    <view v-else class="map-summary"><view><view>{{overview?'整趟旅行':'当天行程'}} · {{mapItems.length}} 项安排</view><text>{{mapItems.filter(i=>i.place).length}} 项已定位，上滑查看完整行程</text></view></view>
  </view>
  <scroll-view v-if="showList||dragExpanded" scroll-y :scroll-top="dragging?listScrollTop:undefined" class="planner-list" :scroll-into-view="listAnchor" :scroll-with-animation="false" :show-scrollbar="false" @scroll="onPlannerListScroll">
   <view id="planner-list-top" :key="overview?'overview':day" class="list-content">
    <template v-if="overview"><view class="section-heading"><view><text class="content-title">整趟旅行</text><view class="content-caption">{{trip.items.length}}项安排 · {{trip.items.filter(i=>i.place).length}}处已定位</view></view><text class="overview-tag">{{days.length}} DAYS</text></view><button v-for="(date,index) in days" :key="date" class="overview-card" @click="chooseDay(date)"><view class="day-number">D{{index+1}}</view><view class="overview-copy"><view>{{date}}<text class="overview-count">{{trip.items.filter(i=>i.date===date).length}}项</text></view><view class="content-caption">{{trip.items.filter(i=>i.date===date).slice(0,3).map(i=>i.name).join(' · ')||'还没有安排'}}</view><view class="overview-hotel">{{staysOn(trip,date)[0]?.name||'暂无过夜安排'}}</view></view><text class="chevron">›</text></button></template>
    <template v-else>
      <view class="section-heading"><view><text class="content-title">第 {{dayIndex}} 天</text><text class="content-count">{{stops.length}} 个地点或事项</text></view><view class="section-actions"><view v-if="status" class="trip-status" :class="'trip-status-'+status.phase" :aria-label="status.description"><view class="trip-status-dot"/><text>{{status.label}}</text></view><button class="add-stop" :disabled="locked" @click="go('import',{id,date:day})">＋ 添加</button></view></view>
      <picker v-if="items.length&&!items[0].time" class="day-start-picker" mode="time" :value="dayStartTime" :disabled="locked" @change="setDayStart"><view>当天从 <text>{{dayStartTime}}</text> 起算 <text class="day-start-arrow">›</text></view></picker>
     <view v-if="completedCount&&items.length" class="day-progress" :aria-label="`当天已完成 ${completedCount} / ${items.length} 项`"><view class="day-progress-fill" :style="{width:completionPercent+'%'}"/></view>
     <button v-if="tonight.length||hotels.length" class="stay-brief" @click="resources('stay',tonight[0]?.id||'')"><view class="stay-symbol"><image src="/static/ui/hotel.svg"/></view><view class="stay-copy"><text class="stay-label">{{tonight[0]?.kind==='train'?'今晚 · 车上过夜':'今晚住这里'}}</text><text class="stay-name">{{tonight[0]?.name||hotels[0]?.name}}</text></view><text class="stay-status">{{tonight[0]?.kind!=='train'&&tonight[0]&&!tonight[0].place?'待定位':tonight[0]?.status==='booked'?'已订':'查看'}} ›</text></button>
     <view v-if="checkouts.length||journeys.length" class="reminders"><button v-for="stay in checkouts" :key="stay.id" @click="resources('stay',stay.id)">今日退房 · {{stay.name}} ›</button><button v-for="entry in journeys" :key="entry.transport.id" @click="resources('transport',entry.transport.id)">{{entry.transport.name}} · {{entry.event==='arrival'?'到达 '+entry.transport.arrival.slice(11):'出发 '+entry.transport.departure.slice(11)+' → '+arrivalText(entry.transport)}} ›</button></view>
     <view v-if="routeError" class="notice error" @click="loadRoutes">{{routeError}} · 重试</view><view v-if="legs.some(l=>l.error)" class="content-caption" @click="loadRoutes">部分路段暂不可用 · 点击重试</view>
     <view v-if="!items.length" class="planner-empty"><view>这一天，留给新的期待</view><text>添加地点或活动，慢慢排好旅程。</text></view>
     <view v-if="stops.length>1||days.length>1" class="drag-hint">长按拖动排序，靠近左右边缘可移到其他天</view>
     <view class="stop-list"><view v-for="(entry,entryIndex) in entries" :key="entry.type==='point'?entry.item.id:entry.items[0].id" class="journey-entry">
       <view v-if="entry.type==='point'" class="point-entry">
        <view :id="`stop-${entry.number-1}`" class="stop-block" :class="{'dragging-stop':dragItemId===entry.item.id,'drop-before':dragging&&dragTo===entry.number-1&&dragTo<dragFrom&&dragTargetDayIndex===days.indexOf(day),'drop-after':dragging&&dragTo===entry.number-1&&dragTo>dragFrom&&dragTargetDayIndex===days.indexOf(day)}" :style="dragItemId===entry.item.id?{transform:`translate(${dragOffsetX}px, ${dragOffset}px)`}:{}">
         <view class="planner-stop" :class="{selected:selected===entry.item.id,completed:entry.item.completed}">
          <view class="stop-main" @touchstart="stopPressStart($event,entry.item,entry.number-1)" @touchmove="stopPressMove" @touchend="stopPressEnd" @touchcancel="stopPressCancel" @click="stopMainClick(entry.item)">
           <text class="stop-number">{{entry.item.completed?'✓':entry.number}}</text>
           <view class="stop-copy"><view class="stop-title">{{pointLabel(entry.item)}}</view><view class="stop-meta"><text class="time-value">{{timelineLabel(timeline[entry.sourceIndex])}}</text><text> · {{entry.item.kind}}</text><text> · 停留 {{entry.item.duration}} 分</text></view></view>
          </view>
          <view class="stop-corner-actions"><button class="stop-more" :aria-label="`更多操作：${pointLabel(entry.item)}`" :aria-expanded="manageItemId===entry.item.id" @click.stop="toggleManage(entry.item.id)">···</button></view>
          <view v-if="timeline[entry.sourceIndex]?.conflictMinutes" class="stop-alert">时间冲突 {{timeline[entry.sourceIndex].conflictMinutes}} 分钟</view>
          <view class="stop-quick-actions">
           <button @click="openGuides(entry.item.id)"><image src="/static/ui/guide.svg"/>攻略{{relatedGuides(entry.item.id).length?` ${relatedGuides(entry.item.id).length}`:' +'}}</button>
           <button @click="entry.item.note?toggleDetails(entry.item.id):go('import',{id,date:day,item:entry.item.id})"><image src="/static/ui/note.svg"/>{{entry.item.note?'备注':'加备注'}}</button>
          </view>
          <view v-if="manageItemId===entry.item.id" class="stop-manage-actions"><button :disabled="locked" @click="go('import',{id,date:day,item:entry.item.id})">编辑地点</button><button :disabled="locked" @click="bindLocation(entry.item.id)">{{entry.item.place?'查看位置':'补充位置'}}</button><picker v-if="days.length>1" :range="days" :value="days.indexOf(day)" :disabled="locked" @change="moveStopToDay(entry.item,Number($event.detail.value))"><view class="manage-day">移到其他天</view></picker><button class="manage-remove" :disabled="locked" @click="remove(entry.item)">移除</button></view>
          <view v-if="expanded.includes(entry.item.id)&&presentationNote(entry.item.note)" class="stop-details"><view class="stop-note">{{presentationNote(entry.item.note)}}</view></view>
         </view>
        </view>
        <view v-if="hasDirectNextPoint(entryIndex)" class="journey-transfer">
         <view class="transfer-top"><text class="transfer-dot">↗</text><text class="transfer-label">交通</text><picker v-if="!linkedTransport(entry.item)" :disabled="locked" :range="modeLabels" :value="modeValues.indexOf(directTravelMode(entryIndex))" @change="setMode(entry.item,Number($event.detail.value))"><view class="transfer-mode">{{directTravelMode(entryIndex)==='manual'?'选择方式':label(directTravelMode(entryIndex))}} ▾</view></picker><text v-else class="transfer-mode">{{label(linkedTransport(entry.item)?.mode||directTravelMode(entryIndex))}}</text><text class="transfer-distance">{{routeDistanceAt(entryIndex)}}</text></view>
         <view class="transfer-bottom"><text>{{routeClock(entry.item)||'耗时待填'}}</text><view v-if="!linkedTransport(entry.item)" class="transfer-minute"><input type="number" :disabled="locked" :value="entry.item.travelMinutes===undefined?'':String(entry.item.travelMinutes)" placeholder="分钟" @blur="setTravelMinutes(entry.item,$event)"/><text>分</text></view><button v-if="linkedTransport(entry.item)" @click="resources('transport',linkedTransport(entry.item)?.id)">查看交通</button></view>
        </view>
       </view>
       <view v-if="entry.type==='transit'" class="transit-group"><view class="transit-row"><text class="transfer-dot">↗</text><text class="transit-label">交通</text><picker v-if="entry.items.length===1" :disabled="locked" :range="modeLabels" :value="modeValues.indexOf(transitionMode(entry.items[0]))" @change="setMode(entry.items[0],Number($event.detail.value))"><view class="transit-mode">{{transitionMode(entry.items[0])==='manual'?'选择方式':label(transitionMode(entry.items[0]))}} ▾</view></picker><text v-else class="transit-mode">{{entry.items.length===1?label(transitionMode(entry.items[0])):entry.items.length+' 段交通'}}</text><text class="transfer-distance">{{routeDistanceAt(entryIndex)}}</text><button v-if="entry.items.length>1" @click="toggleTransit(entry.items[0].id)">{{expandedTransits.includes(entry.items[0].id)?'收起':'调整'}}</button></view><view class="transit-time"><text>{{timelineLabel(timeline[entry.sourceIndexes[0]])}}–{{formatTime(timeline[entry.sourceIndexes[entry.sourceIndexes.length-1]].end)}}</text><view v-if="entry.items.length===1" class="transfer-minute"><input type="number" :disabled="locked" :value="String(entry.items[0].duration)" @blur="setTransitMinutes(entry.items[0],$event)"/><text>分</text></view></view><view v-if="expandedTransits.includes(entry.items[0].id)" class="transit-details"><view v-for="part in entry.items" :key="part.id" class="transit-part"><text>{{part.name}}</text><picker :disabled="locked" :range="modeLabels" :value="modeValues.indexOf(transitionMode(part))" @change="setMode(part,Number($event.detail.value))"><view>{{label(transitionMode(part))}} ▾</view></picker><view class="transfer-minute"><input type="number" :disabled="locked" :value="String(part.duration)" @blur="setTransitMinutes(part,$event)"/><text>分</text></view><button @click="go('import',{id,date:day,item:part.id})">编辑</button></view></view></view>
     </view></view>
     <view class="weather-slot"><WeatherCard :date="day" :places="weatherPlaces"/></view>
     <view class="list-footer"><button :disabled="locked" @click="go('import',{id,date:day,batch:'1'})">批量添加安排</button></view>
    </template>
   </view>
  </scroll-view>
 </view>
 <view v-if="dragging" class="drag-day-tray"><text>{{dragTargetDayIndex>0?`‹ ${days[dragTargetDayIndex-1].slice(5).replace('-','.')}`:''}}</text><view><text class="drag-day-title">第 {{dragTargetDayIndex+1}} 天 · {{days[dragTargetDayIndex]?.slice(5).replace('-','.')}}</text><text class="drag-day-caption">{{dragTargetDayIndex===days.indexOf(day)?dragTo!==dragFrom?`松手排到第 ${dragTo+1} 位`:'上下拖动排序 · 左右边缘换天':'松手移到这一天'}}</text></view><text>{{dragTargetDayIndex<days.length-1?`${days[dragTargetDayIndex+1].slice(5).replace('-','.')} ›`:''}}</text></view>
 <view v-if="cardOpen&&selectedItem" class="map-dock">
  <view v-if="cardOpen&&selectedItem" class="place-preview">
   <view class="preview-top"><text class="preview-category">{{selectedItem.kind}} · {{selectedItem.date.slice(5)}} · 第 {{stops.findIndex(i=>i.id===selected)+1}} 站</text><button class="preview-close" aria-label="关闭地点卡片" @click="cardOpen=false">×</button></view>
   <view class="preview-title">{{pointLabel(selectedItem)}}</view>
   <view class="preview-address">{{selectedItem.place?.address||selectedItem.place?.name||'还没有保存位置'}}</view>
    <view class="preview-time">{{timeFor(selectedItem)}}<text> · 停留 {{selectedItem.duration}} 分钟</text></view>
   <view class="preview-actions"><button v-if="selectedItem.place" class="primary" @click="navigate(selectedItem.place)">导航</button><button v-if="relatedGuides(selectedItem.id).length" @click="openGuides(selectedItem.id)">攻略 {{relatedGuides(selectedItem.id).length}}</button></view>
  </view>
 </view>
 <TripNav :id="id" :date="day" active="itinerary" :reserve-space="false"/>
</view>
<view v-else class="screen"><StatusBanner/><view v-if="!state.error" class="empty">{{state.ready?'未找到这段旅行':'正在打开旅行…'}}</view></view>
</template>
<style scoped>
.planner{height:calc(100vh - var(--window-top,0px));height:calc(100dvh - var(--window-top,0px));max-width:1180px;margin:auto;display:flex;flex-direction:column;overflow:hidden;padding-bottom:calc(74px + env(safe-area-inset-bottom));background:#edf4fb}.planner-header{padding:10px 18px;display:flex;gap:12px;align-items:center;background:#fff;flex-shrink:0;border-bottom:1px solid var(--line)}.planner-heading{flex:1;min-width:0}.planner-title{font-size:17px;font-weight:650;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.planner-meta{font-size:11px;color:var(--ink-muted);margin-top:2px}.header-action{padding:8px 12px;min-height:44px;font-size:12px;background:var(--surface-muted);color:var(--brand);border-radius:12px}.planner-warning{padding:6px 12px;background:#fff0e6;font-size:12px;flex-shrink:0}.planner-map{height:32%;min-height:130px;flex-shrink:0}.layout-map .planner-map{height:52%}.planner-sheet{display:flex;flex:1;min-height:0;flex-direction:column;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -3px 16px #193b6610;position:relative;z-index:2}.layout-list .planner-sheet{border-radius:0;box-shadow:none}.sheet-top{padding:7px 14px 4px;flex-shrink:0}.sheet-grip{width:34px;height:3px;background:#dce4ed;border-radius:3px;margin:0 auto 4px}.sheet-tools{display:flex;justify-content:space-between;align-items:center;gap:8px}.view-switch{display:flex;gap:2px;background:#f3f6fa;border-radius:10px;padding:2px}.view-switch button{background:transparent;color:#64748b;font-size:11px;min-width:44px;min-height:44px;padding:7px 10px;border-radius:8px}.view-switch button.active{background:#fff;color:var(--brand);box-shadow:0 1px 5px #15345112}.mode-toggle{font-size:11px;padding:8px 6px;min-height:44px;color:#68798e;background:transparent}.planner-dates{width:100%;white-space:nowrap;border-bottom:1px solid var(--line);flex-shrink:0}.date-strip{display:flex;gap:2px;padding:0 12px}.planner-date{display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:64px;min-height:54px;margin:0;padding:6px 10px;background:transparent;border-radius:0;color:#66758a;font-size:13px;font-weight:600;border-bottom:3px solid transparent}.planner-date text+text{font-size:10px;font-weight:400;margin-top:2px}.planner-date.active{color:var(--brand);border-bottom-color:var(--brand);background:linear-gradient(transparent,#eff5ff)}.planner-list{flex:1;height:0;min-height:0}.list-content{padding:14px 16px 24px}.section-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px}.content-title{font-size:16px;font-weight:650}.content-count{font-size:12px;color:#8490a2;margin-left:8px}.content-caption{font-size:12px;line-height:1.6;color:var(--ink-muted);overflow-wrap:anywhere}.add-stop{color:var(--brand);background:#edf4ff;border-radius:10px;padding:8px 12px;font-size:12px;min-height:44px}.stay-brief{display:flex;align-items:center;width:100%;gap:10px;background:#f4f8ff;border:1px solid #e3ecf9;padding:12px;margin-bottom:12px;border-radius:14px;text-align:left;font-weight:400}.stay-symbol{width:34px;height:34px;border-radius:10px;background:#e5efff;padding:7px;flex-shrink:0}.stay-symbol image{width:20px;height:20px}.stay-copy{display:flex;flex-direction:column;flex:1;min-width:0;gap:2px}.stay-label{font-size:10px;color:#73819a}.stay-name{font-size:12px;line-height:1.5;color:#304863;overflow-wrap:anywhere}.stay-status{font-size:11px;color:var(--brand);flex-shrink:0}.reminders{display:grid;gap:6px;margin-bottom:12px}.reminders button{font-size:12px;color:#5b6680;background:#fff8ec;padding:10px 12px;text-align:left;font-weight:400;border-radius:10px}.planner-stop{border:1px solid #e7edf5;border-radius:15px;background:#fff;overflow:hidden}.planner-stop.selected{border-color:#75a7f5;background:#f8fbff;box-shadow:0 0 0 1px #75a7f51c}.planner-stop.completed{opacity:.7}.stop-main{display:flex;align-items:flex-start;gap:10px;padding:13px 12px 6px}.stop-number{width:23px;height:23px;background:var(--brand);color:#fff;border-radius:8px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:11px;line-height:23px}.stop-copy{flex:1;min-width:0}.stop-title{font-size:14px;font-weight:600;line-height:1.55;overflow-wrap:anywhere}.stop-meta{display:flex;flex-wrap:wrap;gap:4px;font-size:11px;color:#7c889b;margin-top:3px}.stop-kind{font-size:10px;padding:3px 6px;background:#f2f5f9;color:#7a8798;border-radius:5px;flex-shrink:0}.stop-mini-actions{display:flex;justify-content:flex-end;gap:8px;padding:0 10px 4px}.stop-mini-actions button{font-size:11px;min-height:44px;min-width:44px;background:transparent;color:var(--brand);padding:6px}.stop-alert{margin:4px 12px;background:#fff0ec;color:#b45d3c;padding:6px;font-size:11px;border-radius:6px}.stop-details{padding:0 12px 12px}.stop-note{font-size:12px;line-height:1.7;background:#f2f5fa;border-radius:9px;padding:10px;margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere}.edit-tools{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}.edit-tools button,.edit-tools picker>view{padding:8px 10px;min-height:44px;font-size:11px;background:#eff4fb;color:#567093;border-radius:8px}.edit-tools .remove-stop{color:#b15c53;background:#fff2ee}.planner-leg{display:flex;align-items:center;gap:8px;padding:9px 6px 9px 32px;font-size:10px;color:#8491a4;position:relative;min-height:36px}.planner-leg:before{content:'';position:absolute;left:23px;top:4px;bottom:4px;border-left:1px dashed #d7e0ed}.planner-leg>text:nth-child(2){flex:1}.planner-leg button{min-height:32px;font-size:10px;padding:4px;color:var(--brand);background:transparent}.list-footer{display:flex;gap:8px;margin-top:14px}.list-footer button{flex:1;background:#f1f6fc;color:#5e779b;font-size:12px;padding:12px 6px}.route-disclaimer{font-size:10px;color:#8b97a8;text-align:center;margin-top:16px}.weather-slot{margin-top:16px}.planner-empty{text-align:center;padding:28px 12px;color:#536b88;font-size:14px;line-height:2}.planner-empty text{font-size:12px;color:#8291a5}.overview-card{display:flex;align-items:flex-start;gap:12px;text-align:left;width:100%;background:#fff;border:1px solid var(--line);padding:14px;margin-bottom:10px;font-weight:400}.day-number{font-weight:700;color:var(--brand);font-size:14px;min-width:30px}.overview-copy{flex:1;min-width:0;font-size:13px}.overview-count{font-size:11px;color:#8590a3;margin-left:10px}.overview-hotel{font-size:11px;color:#5479ab;margin-top:6px;overflow-wrap:anywhere}.overview-tag{font-size:11px;letter-spacing:1px;color:#8ca3c2}.chevron{color:#9bacbf}.next-brief{font-size:12px;padding:12px;background:#eaf3ff;color:var(--brand);margin-bottom:10px;border-radius:10px}.next-brief text{display:block;font-size:10px;margin-top:4px}@media(min-width:800px){.planner{padding-bottom:74px}.planner-map{height:38%}.list-content{padding:20px 28px}.planner-header{padding:14px 28px}.planner-title{font-size:20px}}@media(max-height:700px) and (min-height:521px){.planner-map{height:24%;min-height:110px}.planner-header{padding-top:6px;padding-bottom:6px}.planner-date{min-height:48px}.stay-brief{padding:9px;margin-bottom:8px}}@media(max-height:520px){.layout-map .planner-map{height:30%;min-height:70px}.planner-header{padding:5px 12px}.planner-meta{display:none}.planner-map{height:26%;min-height:85px}.sheet-top{padding-top:3px}.sheet-grip{display:none}.planner-date{min-height:44px}.planner{padding-bottom:64px}}
.day-progress{height:5px;margin:-5px 0 14px;background:#dce8f7;border-radius:5px;overflow:hidden}.day-progress-fill{height:100%;background:var(--brand);border-radius:5px;transition:width 180ms ease}@media(prefers-reduced-motion:reduce){.day-progress-fill{transition:none}}
@media(min-width:600px) and (max-height:520px){.planner{display:grid;grid-template-columns:42% 58%;grid-template-rows:auto minmax(0,1fr)}.planner-header{grid-column:1 / -1}.planner-map,.layout-map .planner-map{grid-column:1;grid-row:2;height:100%;min-height:0}.planner-sheet{grid-column:2;grid-row:2;border-radius:0;min-width:0}.layout-list .planner-sheet{grid-column:1 / -1}.planner-warning{position:absolute;top:50px;z-index:10;left:0;right:0}.list-content{padding:12px 16px}.sheet-top{padding-bottom:2px}}</style>
<style scoped src="../../styles/map-workspace.css"></style>
