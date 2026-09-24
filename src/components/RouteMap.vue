<script setup lang="ts">
import {computed,ref,watch,nextTick,getCurrentInstance,onMounted,onBeforeUnmount} from 'vue';
import {hasCoordinates,mapCamera} from '../domain/map-camera';
import {uid} from '../domain/types';
// #ifdef H5
import WebRouteMap from './WebRouteMap.vue';
// #endif
import type {Point} from '../domain/geo';import type {Item,Stay} from '../domain/types';import type {Leg} from '../services/maps';
const props=defineProps<{items:Item[];legs:Leg[];stays?:Stay[];selected?:string;large?:boolean;embedded?:boolean;pickable?:boolean;focus?:Point;selectionToken?:number}>();const emit=defineEmits<{select:[id:string];selectStay:[id:string];pick:[point:Point]}>();
const instance=getCurrentInstance(),nativeMapId='route-map-'+uid();
const located=computed(()=>props.items.filter(i=>i.place));
const locatedStays=computed(()=>(props.stays||[]).filter(stay=>stay.kind!=='train'&&stay.place));
const cameraItems=computed<Item[]>(()=>[...props.items,...locatedStays.value.map((stay,order)=>({id:'stay:'+stay.id,name:stay.name,date:stay.checkIn,order,time:'',duration:0,note:'',kind:'住宿',place:stay.place}))]);
const mapAvailable=computed(()=>hasCoordinates(cameraItems.value)||!!props.focus||!!props.pickable);
const overview=ref(false),resetToken=ref(0);
const effectiveSelected=computed(()=>overview.value?'':props.selected);
const camera=computed(()=>mapCamera(cameraItems.value,effectiveSelected.value,props.focus));
const cameraKey=computed(()=>[resetToken.value,effectiveSelected.value,...cameraItems.value.map(i=>`${i.id}:${i.place?.latitude??''}:${i.place?.longitude??''}`)].join('|'));
// #ifdef MP-WEIXIN
let cameraTimer:ReturnType<typeof setTimeout>|undefined;
function syncNativeCamera(){if(!mapAvailable.value)return;const context=uni.createMapContext(nativeMapId,instance?.proxy);const view=camera.value;if(view.fitPoints.length>1)context.includePoints({points:view.fitPoints,padding:[80,36,52,36]});else context.moveToLocation({latitude:view.center.latitude,longitude:view.center.longitude});}
watch(cameraKey,async()=>{await nextTick();if(cameraTimer)clearTimeout(cameraTimer);cameraTimer=setTimeout(syncNativeCamera,80);});
onMounted(()=>{cameraTimer=setTimeout(syncNativeCamera,120);});
onBeforeUnmount(()=>{if(cameraTimer)clearTimeout(cameraTimer);});
// #endif
watch(()=>[props.selected,props.selectionToken],()=>{overview.value=false;resetToken.value++;});
watch(()=>props.items.map(i=>`${i.id}:${i.place?.latitude??''}:${i.place?.longitude??''}`).join('|'),()=>{overview.value=false;resetToken.value++;});
watch(()=>locatedStays.value.map(stay=>`${stay.id}:${stay.place?.latitude}:${stay.place?.longitude}`).join('|'),()=>{overview.value=false;resetToken.value++;});
function showOverview(){overview.value=true;resetToken.value++;}
const markers=computed(()=>located.value.map((i,n)=>({id:n,latitude:i.place!.latitude,longitude:i.place!.longitude,iconPath:'/static/pin.png',width:i.id===effectiveSelected.value?32:26,height:i.id===effectiveSelected.value?40:32,callout:{content:i.id===effectiveSelected.value?`${props.items.indexOf(i)+1} ${i.name}`:String(props.items.indexOf(i)+1),display:'ALWAYS',padding:6,borderRadius:8,color:'#367be7',bgColor:'#ffffff',fontSize:12}})));
const stayMarkers=computed(()=>locatedStays.value.map((stay,index)=>({id:located.value.length+index,latitude:stay.place!.latitude,longitude:stay.place!.longitude,iconPath:'/static/pin.png',width:26,height:32,callout:{content:`住 · ${stay.place!.name||stay.name}`,display:'ALWAYS',padding:6,borderRadius:8,color:'#17806a',bgColor:'#ffffff',fontSize:12}})));
const displayMarkers=computed(()=>{const all=[...markers.value,...stayMarkers.value];return props.focus?[...all,{id:-1,latitude:props.focus.latitude,longitude:props.focus.longitude,iconPath:'/static/pin.png',width:32,height:40,callout:{content:'待保存的位置',display:'ALWAYS',padding:6,borderRadius:8,color:'#9c493b',bgColor:'#ffffff',fontSize:12}}]:all;});
const lines=computed(()=>props.legs.filter(l=>l.points.length>1).map(l=>({points:l.points,color:'#367be7',width:5})));
function selectMarker(id:string){overview.value=false;resetToken.value++;emit('select',id);}
function tapped(e:any){const index=e.detail.markerId,item=located.value[index],stay=locatedStays.value[index-located.value.length];if(item)selectMarker(item.id);else if(stay)emit('selectStay',stay.id);}
function pickNative(e:any){if(props.pickable&&Number.isFinite(e.detail.latitude)&&Number.isFinite(e.detail.longitude))emit('pick',{latitude:e.detail.latitude,longitude:e.detail.longitude});}
</script>
<template><view class="map-container" :class="{embedded}"><view class="map-controls"><text>{{effectiveSelected?'站点附近':props.focus?'候选位置':'位置总览'}}</text><button class="secondary small" @click="showOverview">{{embedded?'总览':'查看全部位置'}}</button></view><view class="map-shell" :class="{large}">
<!-- #ifdef MP-WEIXIN -->
<map v-if="mapAvailable" :id="nativeMapId" :key="cameraKey" class="native-map" :latitude="camera.center.latitude" :longitude="camera.center.longitude" :markers="displayMarkers" :polyline="lines" :scale="camera.scale" :max-scale="18" :show-scale="true" :enable-zoom="true" @tap="pickNative" @markertap="tapped" @callouttap="tapped"/>
<view v-if="!mapAvailable" class="map-message"><text class="map-symbol">⌖</text><view>这天暂无可用地图</view><view class="subtitle">当天地点没有坐标，日程仍可正常查看</view></view>
<!-- #endif -->
<!-- #ifdef H5 -->
<WebRouteMap v-if="mapAvailable" :items="items" :legs="legs" :stays="stays" :selected="effectiveSelected" :reset-token="resetToken" :large="large" :embedded="embedded" :pickable="pickable" :focus="focus" @select="selectMarker" @select-stay="emit('selectStay',$event)" @pick="emit('pick',$event)"/>
<view v-else class="map-message"><text class="map-symbol">⌖</text><view>这天暂无可用地图</view><view class="subtitle">当天地点没有坐标，日程仍可正常查看</view></view>
<!-- #endif -->
</view></view></template>
<style scoped>.map-container.embedded{height:100%;position:relative}.embedded .map-shell{height:100%;min-height:0;border:0;border-radius:0}.embedded .native-map{height:100%}.embedded .map-controls{position:absolute;top:8px;right:10px;z-index:4;margin:0}.embedded .map-controls>text{display:none}.embedded .map-controls button{background:#fff;box-shadow:0 2px 8px #18344e18;min-height:36px;padding:8px 12px;color:#3679dc}.map-controls{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-size:12px;color:var(--ink-muted)}.map-shell{border:1px solid #d9dfce;border-radius:20px;overflow:hidden;background:#e8ecdf;min-height:220px}.map-shell.large{min-height:0}.native-map{width:100%;height:280px}.large .native-map{height:42vh;min-height:280px;max-height:420px}.map-message{min-height:220px;padding:32px 20px;text-align:center;background:#f3f6fa;color:#536b88}.embedded .map-message{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}.map-symbol{font-size:28px;color:#748d67}.map-message .subtitle{font-size:12px;margin-top:8px}</style>




