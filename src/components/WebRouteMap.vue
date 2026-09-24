<script setup lang="ts">
import {onMounted,onBeforeUnmount,watch,ref} from 'vue';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {toMapPoint,fromMapPoint,type Point} from '../domain/geo';
import {uid,type Item,type Stay} from '../domain/types';
import {mapCamera} from '../domain/map-camera';
import type {Leg} from '../services/maps';
const props=defineProps<{items:Item[];legs:Leg[];stays?:Stay[];selected?:string;large?:boolean;embedded?:boolean;pickable?:boolean;focus?:Point;resetToken?:number}>();
const emit=defineEmits<{select:[id:string];selectStay:[id:string];pick:[point:Point]}>();
const mapId='map-'+uid(),error=ref('');let map:L.Map|undefined,overlays:L.LayerGroup,observer:ResizeObserver|undefined,resizeTimer:ReturnType<typeof setTimeout>|undefined;
function latlng(p:Point):L.LatLngTuple{const w=toMapPoint(p);return [w.latitude,w.longitude];}
function render(fit=true){
  if(!map)return;overlays.clearLayers();const located=props.items.filter(i=>i.place);
  for(const item of located){const label=document.createElement('span');label.textContent=`${props.items.indexOf(item)+1}. ${item.place!.name}`;
    const badge=document.createElement('span');badge.className='route-pin-badge';badge.textContent=String(props.items.indexOf(item)+1);
    const marker=L.marker(latlng(item.place!),{title:item.name,alt:item.name,keyboard:true,bubblingMouseEvents:false,icon:L.divIcon({className:'route-pin'+(item.id===props.selected?' is-selected':''),html:badge,iconSize:[44,44],iconAnchor:[22,22]})}).addTo(overlays);
    marker.bindTooltip(label,{permanent:located.length<=2||item.id===props.selected,interactive:true,direction:'top',offset:[0,-16]}).on('click',()=>emit('select',item.id));
  }
  for(const stay of props.stays||[]){if(stay.kind==='train'||!stay.place)continue;const badge=document.createElement('span');badge.className='route-pin-badge stay-pin-badge';badge.textContent='住';badge.style.background='#17806a';const marker=L.marker(latlng(stay.place),{title:stay.place.name||stay.name,alt:stay.name,keyboard:true,bubblingMouseEvents:false,icon:L.divIcon({className:'route-pin stay-pin',html:badge,iconSize:[44,44],iconAnchor:[22,22]})}).addTo(overlays);marker.bindTooltip(`住宿 · ${stay.place.name||stay.name}`,{permanent:true,interactive:true,direction:'top',offset:[0,-16]}).on('click',()=>emit('selectStay',stay.id));}
  for(const leg of props.legs)if(leg.points.length>1)L.polyline(leg.points.map(latlng),{color:'#367be7',weight:5}).addTo(overlays);
  for(let i=1;i<props.items.length;i++){const a=props.items[i-1],b=props.items[i];if(a.date===b.date&&a.place&&b.place&&!props.legs.some(l=>l.from===a.id&&l.to===b.id&&l.points.length>1))L.polyline([latlng(a.place),latlng(b.place)],{color:'#93acd0',weight:2,dashArray:'6 8'}).addTo(overlays);}
  if(props.focus)L.circleMarker(latlng(props.focus),{radius:11,color:'#be713d',weight:3,fillOpacity:0.3}).addTo(overlays);
  if(fit)positionCamera();
}
function positionCamera(){if(!map)return;const stayItems:Item[]=(props.stays||[]).filter(stay=>stay.kind!=='train'&&stay.place).map((stay,order)=>({id:'stay:'+stay.id,name:stay.name,date:stay.checkIn,order,time:'',duration:0,note:'',kind:'住宿',place:stay.place}));const camera=mapCamera([...props.items,...stayItems],props.selected,props.focus);if(camera.fitPoints.length>1)map.fitBounds(L.latLngBounds(camera.fitPoints.map(latlng)),{paddingTopLeft:[40,80],paddingBottomRight:[40,50],maxZoom:14,animate:false});else map.setView(latlng(camera.center),camera.scale,{animate:false});}
onMounted(()=>{map=L.map(mapId,{scrollWheelZoom:false}).setView([35,105],4);overlays=L.layerGroup().addTo(map);
  const tiles=L.tileLayer(import.meta.env.VITE_MAP_TILE_URL||'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
  tiles.on('tileerror',()=>error.value='底图加载失败，请检查网络；地点列表仍可使用');tiles.on('tileload',()=>error.value='');
  map.on('click',(e:L.LeafletMouseEvent)=>{if(props.pickable)emit('pick',fromMapPoint({latitude:e.latlng.lat,longitude:e.latlng.lng}));});
  L.control.scale({imperial:false}).addTo(map);
  observer=new ResizeObserver(()=>{map?.invalidateSize();clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(!props.selected&&!props.focus&&map&&map.getSize().y>=150)positionCamera();},120);});observer.observe(document.getElementById(mapId)!);render();
});
watch(()=>JSON.stringify(props.items.map(i=>[i.id,i.place?.latitude,i.place?.longitude])),()=>render());
watch(()=>JSON.stringify(props.stays?.map(stay=>[stay.id,stay.place?.latitude,stay.place?.longitude])),()=>render());
watch(()=>props.legs,()=>render(false),{deep:true});
watch(()=>[props.selected,props.resetToken],()=>render());
watch(()=>props.focus,()=>render(),{deep:true});
onBeforeUnmount(()=>{observer?.disconnect();clearTimeout(resizeTimer);map?.remove();map=undefined;});
</script>
<template><view class="web-map-root" :class="{embedded}"><view :id="mapId" class="web-map" :class="{large}"/><view v-if="error" class="map-status map-error">{{error}}</view><view v-if="!embedded" class="map-status">可拖动、双指缩放或使用 ＋ / −。虚线仅示意顺序，不是导航路线。{{pickable?'点击地图可选位置。':''}}</view></view></template>
<style scoped>.web-map-root.embedded{height:100%;position:relative}.embedded .web-map{height:100%;min-height:0}.embedded .map-error{position:absolute;bottom:0;left:0;right:0;z-index:5;font-size:10px;background:#fff4e8ee}.web-map{height:280px;width:100%;z-index:0}.web-map.large{height:42vh;min-height:280px;max-height:420px}.map-status{padding:10px 14px;font-size:12px;color:#6b7b90;background:#edf4ff;line-height:1.5}.web-map :deep(.leaflet-tooltip){font-size:12px;line-height:1.5;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.web-map :deep(.leaflet-control-attribution){font-size:10px;line-height:1.4}.web-map :deep(.leaflet-control-scale-line){font-size:11px;line-height:1.2}.web-map :deep(.route-pin){display:flex;align-items:center;justify-content:center;background:transparent;border:0}.web-map :deep(.route-pin-badge){display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:3px solid white;border-radius:50%;background:#367be7;color:white;font-size:13px;font-weight:700;box-shadow:0 2px 8px #153c7a50}.web-map :deep(.route-pin.is-selected .route-pin-badge){background:#164ca5;box-shadow:0 0 0 5px #367be730}.web-map :deep(.leaflet-tooltip.leaflet-interactive){cursor:pointer;min-height:32px;padding:8px 10px}</style>

