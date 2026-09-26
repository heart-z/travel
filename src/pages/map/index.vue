<script setup lang="ts">
import TripNav from '../../components/TripNav.vue';
import {computed,ref,watch,nextTick} from 'vue';
import {onLoad} from '@dcloudio/uni-app';
import {findTrip,initialize,state,saveTrip,notify,confirm,go,canEditTrip} from '../../state';
import {dateRange} from '../../domain/dates';
import {searchCity,saveDayCity,staysOn} from '../../domain/resources';
import {uid,type Place} from '../../domain/types';
import {changeLocation,locationState,locationLabels,type LocationState} from '../../domain/locations';
import {chosenMapPlace} from '../../domain/place-matching';
import type {Point} from '../../domain/geo';
import RouteMap from '../../components/RouteMap.vue';
import {routes,cloudEnabled,navigate,searchPlaces,type Leg} from '../../services/maps';
// #ifdef H5
import {searchOpenPlaces} from '../../services/open-map';
// #endif
const id=ref(''),date=ref(''),selected=ref(''),mode=ref<'driving'|'walking'>('driving');
const allDays=ref(false),legs=ref<Leg[]>([]),error=ref(''),query=ref(''),searching=ref(false),searched=ref(false),choices=ref<Place[]>([]),candidate=ref<Place>(),picking=ref(false);
const city=ref(''),selectionToken=ref(0);
const bindingMode=ref(false);
const savedPlaces=computed(()=>{const places=[...(trip.value?.items.flatMap(i=>i.place?[i.place]:[])||[]),...(trip.value?.stays?.flatMap(s=>s.place?[s.place]:[])||[])];return places.filter((p,n)=>places.findIndex(q=>q.id===p.id)===n);});
function useSavedPlace(index:number){const place=savedPlaces.value[index-1];if(place)candidate.value={...place};}
function chooseNativePlace(){
 // #ifdef MP-WEIXIN
 if(!current.value||locked.value)return;
 const anchor=current.value.place||items.value.filter(item=>item.place).slice(-1)[0]?.place;
 uni.chooseLocation({...(anchor?{latitude:anchor.latitude,longitude:anchor.longitude}:{}),success:result=>{try{candidate.value=chosenMapPlace(result,uid());}catch(e){notify(e);}},fail:result=>{if(!/cancel/i.test(result.errMsg||''))notify('微信地图选点失败，请检查定位授权后重试');}});
 // #endif
}
const trip=computed(()=>findTrip(id.value));
const days=computed(()=>trip.value?dateRange(trip.value.startDate,trip.value.endDate):[]);
const items=computed(()=>trip.value?.items.filter(i=>allDays.value||i.date===date.value).sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order)||[]);
const mapStays=computed(()=>trip.value?(allDays.value?trip.value.stays||[]:staysOn(trip.value,date.value)).filter(stay=>stay.kind!=='train'&&stay.place):[]);
const current=computed(()=>items.value.find(i=>i.id===selected.value));
const located=computed(()=>items.value.filter(i=>i.place).length+mapStays.value.length);
const locked=computed(()=>!canEditTrip(id.value)||state.busy||!state.ready);
const filter=ref<'all'|LocationState>('all');
const pending=computed(()=>items.value.filter(i=>locationState(i)==='pending').length);
const visibleItems=computed(()=>items.value.filter(i=>filter.value==='all'||locationState(i)===filter.value));
const filters:{id:'all'|LocationState;label:string}[]=[{id:'all',label:'全部'},{id:'pending',label:'待补位置'},{id:'located',label:'待核对入口'},{id:'confirmed',label:'已确认'},{id:'not-needed',label:'无需定位'}];
let request=0,lookup=0;
onLoad(async q=>{id.value=q?.id||'';mode.value=q?.mode==='walking'?'walking':'driving';bindingMode.value=q?.bind==='1';await initialize();date.value=q?.date||trip.value?.startDate||'';await nextTick();selected.value=q?.item||'';await nextTick();if(bindingMode.value)picking.value=true;});
watch([date,allDays],()=>{selected.value='';candidate.value=undefined;picking.value=false;choices.value=[];searched.value=false;lookup++;});
watch(selected,()=>{candidate.value=undefined;picking.value=false;choices.value=[];searched.value=false;query.value=current.value?.place?.name||current.value?.name||'';lookup++;});
watch(()=>[current.value?.date||date.value,trip.value?.dayCities,trip.value?.city],()=>{if(trip.value)city.value=searchCity(trip.value,current.value?.date||date.value);},{immediate:true});
watch([query,city],()=>{lookup++;searching.value=false;choices.value=[];candidate.value=undefined;searched.value=false;});
watch(()=>JSON.stringify([items.value.map(i=>[i.id,i.place,i.travelMode]),mode.value,allDays.value,trip.value?.transports]),()=>{void loadRoutes();});
async function loadRoutes(){const token=++request;legs.value=[];error.value='';if(allDays.value)return;try{const r=await routes(items.value,mode.value,trip.value?.transports);if(token===request)legs.value=r;}catch(e){if(token===request)error.value=e instanceof Error?e.message:'路线不可用';}}
async function rememberCity(){if(!trip.value||!canEditTrip(id.value)||state.busy)return;try{await saveTrip(saveDayCity(trip.value,current.value?.date||date.value,city.value));notify('已保存当日搜索城市');}catch(e){notify(e);}}
async function search(){if(!current.value)return;const token=++lookup;searching.value=true;searched.value=false;choices.value=[];candidate.value=undefined;error.value='';try{
  let result:Place[]=[];
  if(cloudEnabled())result=await searchPlaces(query.value,city.value.trim());
  else{
    // #ifdef H5
    result=await searchOpenPlaces([city.value.trim(),query.value.trim()].filter(Boolean).join(' '));
    // #endif
    // #ifndef H5
    throw Error('可点击地图手动选点；在线搜索需连接地图服务');
    // #endif
  }
  if(token===lookup){choices.value=result;searched.value=true;}
}catch(e){if(token===lookup)error.value=e instanceof Error?e.message:'查询失败';}finally{if(token===lookup)searching.value=false;}}
function pick(point:Point){if(!current.value||!picking.value)return;candidate.value={...point,id:'manual-'+Date.now(),name:current.value.name,address:'地图手动选点，请核实具体入口',provider:'manual'};}
async function saveLocation(){if(locked.value||!trip.value||!current.value||!candidate.value)return;try{await saveTrip(changeLocation(trip.value,selected.value,candidate.value));candidate.value=undefined;picking.value=false;notify('地点已绑定到该节点');if(bindingMode.value)uni.navigateBack();}catch(e){notify(e);}}
async function updateLocation(action:'confirm'|'skip'|'reset'|'remove'){
 if(locked.value||!trip.value||!current.value)return;
 const itemId=current.value.id;
 if(action==='remove'&&!await confirm('移除这个位置？','保留行程事项，之后可重新选点。'))return;
 if(locked.value||!trip.value)return;
 try{await saveTrip(changeLocation(trip.value,itemId,action));notify('地点状态已保存');}catch(e){notify(e);}
}
function selectItem(itemId:string){selected.value=itemId;selectionToken.value++;nextTick(()=>uni.pageScrollTo({selector:'#map-view',duration:200}));}
function copyPlace(){if(!current.value)return;const p=current.value.place;uni.setClipboardData({data:[current.value.name,p?.name,p?.address,p?`坐标（GCJ02）：${p.latitude}, ${p.longitude}`:''].filter(Boolean).join('\n'),fail:()=>notify('复制失败，请手动记录地点名称')});}
function openSettings(){uni.switchTab({url:'/pages/settings/index'});}
function cancelBinding(){uni.navigateBack();}
</script>
<template>
<view v-if="trip&&bindingMode" class="binding-screen">
 <view class="binding-heading"><view class="section-title">绑定行程地点</view><view v-if="current" class="subtitle">{{date.slice(5)}} · 第 {{items.findIndex(i=>i.id===selected)+1}} 项 · {{current.name}}</view><view v-else class="notice">未找到要绑定的行程，请返回后重新选择。</view></view>
 <view class="binding-map"><RouteMap embedded :items="items" :legs="[]" :selected="selected" :pickable="!!current&&!locked" :focus="candidate" @pick="pick" @select="itemId=>{const place=items.find(i=>i.id===itemId)?.place;if(place&&!locked)candidate={...place};}"/></view>
 <view class="binding-panel"><view class="binding-instruction">{{candidate?'已选候选位置，保存后才会绑定':'从微信地图搜索地点，或点击下方地图选点'}}</view><!-- #ifdef MP-WEIXIN --><button class="primary" :disabled="locked||!current" @click="chooseNativePlace">在微信地图选地点</button><!-- #endif --><picker :disabled="locked" :range="['也可选择已有地点',...savedPlaces.map(p=>p.name)]" :value="0" @change="useSavedPlace(Number($event.detail.value))"><view class="field field-text binding-picker">选择已保存的地点 ▾</view></picker><view v-if="candidate" class="binding-candidate"><view>{{candidate.name}}</view><text>{{candidate.latitude.toFixed(6)}}, {{candidate.longitude.toFixed(6)}} · GCJ-02</text></view><view v-else-if="current?.place" class="subtitle">已有位置保持不变，重新选点后再保存。</view><view class="actions"><button class="secondary" @click="cancelBinding">取消</button><button class="primary" :disabled="locked||!candidate||!current" @click="saveLocation">保存并返回日程</button></view></view>
</view>
<view v-else-if="trip" class="screen map-screen"><view class="map-heading"><view><view class="title">旅行地图</view><view class="subtitle">{{trip.title}}</view></view><picker :range="days" :value="days.indexOf(date)" @change="date=days[Number($event.detail.value)];allDays=false"><view class="map-date">{{allDays?'选择日期':date.slice(5)}} ▾</view></picker></view>
<view id="map-view" class="map-primary"><RouteMap large :selection-token="selectionToken" :items="items" :legs="legs" :stays="mapStays" :selected="selected" :pickable="picking" :focus="candidate" @select="selected=$event" @select-stay="go('resources',{id,date,tab:'stay',edit:$event})" @pick="pick"/></view>
<view class="map-tools"><button class="secondary small" @click="allDays=!allDays">{{allDays?'只看当天':'查看整趟旅行'}}</button><text>{{located}} 个地点 · {{pending}} 个待定位</text></view>
<view v-if="!items.length" class="notice">{{allDays?'这趟旅行还没有行程事项。':'这一天还没有行程事项，可切换日期或查看整趟旅行。'}}</view>
<view v-else-if="!located" class="notice">当前有行程，但还没有保存坐标。可先从下方选择计划、手动选点；休息等事项可标为无需定位。</view>
<view v-if="error" class="notice error">{{error}}</view><view v-if="legs.some(l=>l.error)" class="notice" @click="loadRoutes">部分路段暂不可用，已保留其他路线 · 点击重试</view>
<view class="notice">{{picking?'正在选点：点击地图确定候选位置，再到下方保存。':'地图连线只表示行程顺序；道路、耗时与路况请在导航中核对。'}}</view>
<picker :range="items.map((i,n)=>(n+1)+'. '+i.name+(' · '+locationLabels[locationState(i)]))" :value="Math.max(0,items.findIndex(i=>i.id===selected))" @change="selected=items[Number($event.detail.value)]?.id||''"><view class="field field-text">{{current?current.name:'选择要定位的计划'}} ▾</view></picker>
<view v-if="current" id="location-detail" class="card section location-detail"><view class="row"><view class="section-title">{{current.name}}</view><text class="badge">{{locationLabels[locationState(current)]}}</text></view><view class="subtitle section">{{current.date}} · {{current.place?.address||'尚未关联位置'}}</view><view class="actions"><button v-if="current.place" class="primary" @click="navigate(current.place)">打开导航 ↗</button><button class="secondary" @click="copyPlace">复制地点</button></view>
<view v-if="current.place&&current.locationStatus!=='confirmed'" class="notice">已有坐标不一定是停车场或景区入口。请在导航中核实后，再标记入口已确认。</view>
<view v-if="canEditTrip(id)" class="pill-row section"><button v-if="current.place" class="pill" :disabled="locked" @click="updateLocation(current.locationStatus==='confirmed'?'reset':'confirm')">{{current.locationStatus==='confirmed'?'撤销入口确认':'已核对入口'}}</button><button v-if="!current.place" class="pill" :disabled="locked" @click="updateLocation(current.locationStatus==='not-needed'?'reset':'skip')">{{current.locationStatus==='not-needed'?'改为待补位置':'无需定位'}}</button><button v-if="current.place" class="text-button small" :disabled="locked" @click="updateLocation('remove')">移除位置</button></view>
<template v-if="canEditTrip(id)"><template v-if="cloudEnabled()"><text class="label">搜索城市 / 区域</text><input class="field" v-model="city" maxlength="80" placeholder="例如：哈尔滨"/><button class="text-button small" :disabled="state.busy||!city.trim()" @click="rememberCity">记住当日城市</button><text class="label">地点名称</text><input class="field" v-model="query" placeholder="例如：沈阳桃仙国际机场"/><view class="actions"><button class="secondary small" :disabled="searching||!query.trim()" @click="search">{{searching?'正在查询…':'搜索地点'}}</button></view></template><view class="actions"><button class="secondary small" :disabled="locked" @click="picking=!picking">{{picking?'停止地图选点':'在地图上选点'}}</button></view>
<view v-if="searched&&!choices.length" class="notice">没有找到候选，请尝试更明确的名称，或在地图上选点。</view>
<view v-for="place in choices" :key="place.id" class="candidate" :class="{chosen:candidate?.id===place.id}" @click="candidate=place"><view>{{place.name}}</view><view class="subtitle">{{place.address}}</view></view>
<view v-if="candidate" class="notice"><view>待保存：{{candidate.name}}</view><view>{{candidate.address}}</view><button class="primary small section" :disabled="state.busy||!state.ready" @click="saveLocation">保存到这项计划</button></view></template></view>
<view class="section"><view class="row"><view class="section-title">{{allDays?'全程地点':'当天地点'}}</view><text class="subtitle">{{items.length}} 项计划</text></view><view class="pill-row section"><button v-for="f in filters" :key="f.id" class="pill" :class="{active:filter===f.id}" @click="filter=f.id">{{f.label}}</button></view>
<view v-if="!visibleItems.length" class="empty">这个分类下暂无事项</view>
<view v-for="item in visibleItems" :key="item.id" class="location-row" :class="{selected:selected===item.id}"><button class="location-select" @click="selectItem(item.id)"><text class="stop-number">{{items.indexOf(item)+1}}</text><view class="location-copy"><view class="stop-name">{{item.name}}</view><view class="subtitle">{{allDays?item.date.slice(5)+' · ':''}}{{locationLabels[locationState(item)]}}</view></view></button><button v-if="item.place" class="secondary small" :aria-label="'导航到'+item.name" @click="navigate(item.place)">导航 ↗</button></view></view>
<TripNav :id="id" :date="date" active="map"/><view class="footer-note">按已有位置规划 · 导航前核对实际入口</view></view>
<view v-else class="screen"><view class="title">{{state.ready?'这台设备还没有这趟旅行':'正在打开地图…'}}</view><view class="notice">{{state.error||'网页与微信的数据分别保存在各自设备。请从有行程的设备导出备份，再到“我的”导入。'}}</view><button class="secondary" @click="openSettings">前往我的备份</button></view></template>
<style scoped>.map-screen .eyebrow{display:none}.map-screen .title{font-size:24px;margin-top:0}.map-screen .section{margin-top:16px}.candidate{padding:12px;margin-top:12px;border:1px solid var(--line);border-radius:12px}.candidate.chosen{border:2px solid var(--brand)}.candidate .subtitle{font-size:13px;overflow-wrap:anywhere}.map-stats{display:grid;grid-template-columns:repeat(3,1fr);background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:10px 8px}.map-stats>view{display:flex;flex-direction:column;text-align:center;font-size:12px;color:var(--ink-muted);border-right:1px solid var(--line)}.map-stats>view:last-child{border:0}.stat-number{font-size:22px;color:var(--brand);font-family:inherit}.location-detail .row{flex-wrap:wrap}.location-row{display:flex;align-items:center;gap:8px;padding:12px;background:var(--surface);border:1px solid var(--line);border-radius:16px;margin-top:12px}.location-row.selected{border-color:var(--brand);background:var(--surface-muted)}.location-select{display:flex;align-items:center;gap:12px;flex:1;min-width:0;background:transparent;text-align:left;padding:4px;font-weight:400}.location-copy{min-width:0}.stop-name{font-size:15px;font-weight:600;overflow-wrap:anywhere}.stop-number{width:28px;flex-shrink:0;font-family:inherit;font-size:20px;color:var(--ink-muted)}.location-row .small{flex-shrink:0}.map-screen .row{flex-wrap:wrap}.binding-screen{height:calc(100vh - var(--window-top,0px));height:calc(100dvh - var(--window-top,0px));display:flex;flex-direction:column;background:#fff;overflow:hidden}.binding-heading{padding:16px;flex-shrink:0}.binding-map{flex:1;min-height:150px}.binding-panel{padding:14px 18px calc(18px + env(safe-area-inset-bottom));flex-shrink:0;border-radius:22px 22px 0 0;background:#fff}.binding-instruction{font-size:13px;color:#5a7191;margin-bottom:10px}.binding-picker{font-size:13px}.binding-candidate{font-size:13px;color:var(--ink);margin-top:10px}.binding-candidate text{font-size:11px;color:var(--ink-muted)}.binding-panel .actions{margin-top:12px}@media(max-height:520px){.binding-screen{display:grid;grid-template-columns:55% 45%;grid-template-rows:auto minmax(0,1fr)}.binding-heading{grid-column:1/-1;padding:8px 16px}.binding-map{min-height:0}.binding-panel{overflow:auto}}</style>
<style scoped>.map-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:5px 0 15px}.map-heading .title{font-size:23px}.map-heading .subtitle{font-size:13px;margin-top:3px}.map-date{min-height:44px;display:flex;align-items:center;white-space:nowrap;padding:0 13px;background:#fff;border:1px solid var(--line);border-radius:13px;color:var(--brand);font-size:13px;font-weight:600}.map-primary{overflow:hidden;border-radius:20px;background:#eaf0f5}.map-tools{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px;color:var(--ink-muted);font-size:12px}.map-tools .secondary{min-height:40px;padding:7px 12px}.map-stats{margin-top:16px!important;border-radius:15px;box-shadow:none}.map-stats .stat-number{font-size:18px}.location-row{margin-top:0;border-radius:0;border-bottom:0;box-shadow:none}.location-row:last-child{border-bottom:1px solid var(--line);border-radius:0 0 16px 16px}.location-row:first-of-type{border-radius:16px 16px 0 0}.map-screen>.notice{font-size:12px;line-height:1.55}@media(max-width:360px){.map-heading .title{font-size:21px}.map-tools text{font-size:11px}}</style>



