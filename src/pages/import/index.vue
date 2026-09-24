<script setup lang="ts">
import {computed,ref,reactive} from 'vue';
import {onLoad} from '@dcloudio/uni-app';
import {searchCity,saveDayCity} from '../../domain/resources';
import {initialize,findTrip,state,saveTrip,notify} from '../../state';
import {dateRange} from '../../domain/dates';
import {parsePlaces,importItems} from '../../domain/itinerary';
import {pointLabel,presentationNote} from '../../domain/planner-presentation';
import {savedPlaceCandidates,chosenMapPlace} from '../../domain/place-matching';
import {clone,uid,type Place} from '../../domain/types';
import {searchPlaces,cloudEnabled} from '../../services/maps';
// #ifdef H5
import {searchOpenPlaces} from '../../services/open-map';
// #endif

const id=ref(''),date=ref(''),itemId=ref(''),batch=ref(false),text=ref(''),busy=ref(false),requestId=ref(uid()),error=ref('');
const form=reactive({time:'',duration:'60',note:'',kind:'游玩'}),kinds=['游玩','餐饮','住宿','交通','其他'];
interface Draft {date:string;name:string;choices:Place[];place?:Place;include:boolean;manualSelection?:boolean;}
const drafts=ref<Draft[]>([]),city=ref('');
const trip=computed(()=>findTrip(id.value)),days=computed(()=>trip.value?dateRange(trip.value.startDate,trip.value.endDate):[]);
const selectedPlace=computed(()=>!batch.value?drafts.value[0]?.place:undefined);

onLoad(async q=>{
 id.value=q?.id||'';date.value=q?.date||'';itemId.value=q?.item||'';batch.value=q?.batch==='1';
 await initialize();city.value=trip.value?searchCity(trip.value,date.value):'';
 const item=trip.value?.items.find(i=>i.id===itemId.value);
 if(item){const name=pointLabel(item);text.value=name;Object.assign(form,{time:item.time,duration:String(item.duration),note:presentationNote(item.note),kind:item.kind});drafts.value=[{date:item.date,name,choices:item.place?[item.place]:[],place:item.place,include:true,manualSelection:!!item.place}];}
});
async function rememberCity(){if(!trip.value||state.readOnly||state.busy||busy.value)return;try{await saveTrip(saveDayCity(trip.value,date.value,city.value));notify('已保存当日搜索城市');}catch(e){notify(e);}}
function invalidate(){drafts.value=[];requestId.value=uid();error.value='';}
function nameInput(event:any){text.value=String(event.detail.value||'');if(drafts.value[0]?.manualSelection&&!batch.value){drafts.value[0].name=text.value.trim();requestId.value=uid();error.value='';}else invalidate();}
function makeDraft(name:string):Draft{const choices=trip.value?savedPlaceCandidates(trip.value,name,date.value):[];return {date:date.value,name,choices,place:choices.length===1?choices[0]:undefined,include:true};}
function ensureSingleDraft(){const name=text.value.trim();if(!name)return;const current=drafts.value[0];if(current&&current.name===name)return current;const draft=makeDraft(name);drafts.value=[draft];return draft;}
async function resolve(){
 error.value='';try{
  const names=batch.value?parsePlaces(text.value):[text.value.trim()].filter(Boolean);
  if(!names.length)throw new Error('先输入想去的地点');
  const previous=drafts.value;drafts.value=names.map(name=>{const result=makeDraft(name),saved=previous.find(d=>d.name===name);if(saved?.place){result.place=saved.place;result.manualSelection=saved.manualSelection;result.choices=[saved.place,...result.choices.filter(p=>p.id!==saved.place!.id)];}return result;});requestId.value=uid();
  if(!cloudEnabled()){
   // #ifdef H5
   if(!batch.value){busy.value=true;const draft=drafts.value[0];const found=await searchOpenPlaces([city.value.trim(),draft.name].filter(Boolean).join(' '));draft.choices=[...draft.choices,...found.filter(place=>!draft.choices.some(saved=>saved.id===place.id))];if(draft.choices.length===1)draft.place=draft.choices[0];}
   // #endif
   return;
  }
  busy.value=true;
  for(const draft of drafts.value){const found=await searchPlaces(draft.name,city.value);draft.choices=[...draft.choices,...found.filter(place=>!draft.choices.some(saved=>saved.id===place.id))];if(draft.choices.length===1)draft.place=draft.choices[0];}
 }catch(e){error.value=e instanceof Error?e.message:'查询失败';}finally{busy.value=false;}
}
function choose(draft:Draft,index:number){draft.place=index===0?undefined:draft.choices[index-1];draft.manualSelection=index!==0;}
function toggle(draft:Draft,event:any){draft.include=event.detail.value;}
function clearLocation(draft:Draft){draft.place=undefined;draft.manualSelection=false;}
function chooseOnMap(draft?:Draft){
 // #ifdef MP-WEIXIN
 if(state.readOnly||state.busy)return;
 let target=draft||ensureSingleDraft();
 if(!target){target={date:date.value,name:'',choices:[],include:true};drafts.value=[target];}
 const anchor=target.place||trip.value?.items.filter(item=>item.date===target!.date&&item.place).sort((a,b)=>b.order-a.order)[0]?.place;
 uni.chooseLocation({...(anchor?{latitude:anchor.latitude,longitude:anchor.longitude}:{}),success:result=>{
  try{const place=chosenMapPlace(result,uid());target!.place=place;target!.manualSelection=true;target!.choices=[place,...target!.choices.filter(choice=>choice.id!==place.id)];if(!target!.name){target!.name=place.name;text.value=place.name;}drafts.value=[...drafts.value];error.value='';}
  catch(e){notify(e);}
 },fail:result=>{if(!/cancel/i.test(result.errMsg||''))notify('微信地图选点失败，请检查定位授权后重试');}});
 // #endif
}
async function save(){
 if(!trip.value)return;
 try{
  if(!batch.value)ensureSingleDraft();
  const selected=drafts.value.filter(d=>d.include);
  if(!selected.length)throw new Error(batch.value?'请先整理地点，并至少保留一条':'请先输入地点或计划名称');
  let next=clone(trip.value),focusItemId='';
  if(itemId.value){
   const item=next.items.find(i=>i.id===itemId.value);if(!item)throw new Error('计划已不存在');
   if(JSON.stringify(item.place)!==JSON.stringify(selected[0].place))delete item.locationStatus;
   Object.assign(item,{name:selected[0].name,place:selected[0].place,time:form.time,duration:Number(form.duration),note:form.note,kind:form.kind});
   if(!selected[0].place)delete item.place;next.revision++;focusItemId=item.id;
  }else{
   const oldIds=new Set(next.items.map(i=>i.id));next=importItems(next,date.value,selected,requestId.value);
   if(!batch.value){const item=next.items[next.items.length-1];Object.assign(item,{time:form.time,duration:Number(form.duration),note:form.note,kind:form.kind});}
   const located=next.items.filter(i=>!oldIds.has(i.id)&&i.place);focusItemId=located.length?located[located.length-1].id:'';
  }
  await saveTrip(next);
  const focused=next.items.find(i=>i.id===focusItemId);
  if(focused?.place)uni.$emit('trip-place-saved',{tripId:id.value,itemId:focused.id,date:focused.date});
  uni.navigateBack();
 }catch(e){notify(e);}
}
</script>

<template>
<view class="screen">
 <text class="eyebrow">PLACES TO GO</text>
 <view class="title">{{itemId?'把计划写仔细':batch?'想去的地方，一起放进来。':'下一站，去哪里？'}}</view>
 <view class="subtitle">{{date}} · {{trip?.title}}</view>
 <template v-if="cloudEnabled()"><text class="label">搜索城市</text><input class="field" v-model="city" :disabled="busy" maxlength="80" placeholder="填写城市以减少同名地点" @input="invalidate"/><button class="text-button small" :disabled="busy||state.busy||state.readOnly||!city.trim()" @click="rememberCity">记住当日城市</button></template>
 <text class="label">{{batch?'每行一个地点，也支持逗号分隔':'地点或计划名称'}}</text>
 <textarea v-if="batch" class="field field-text" v-model="text" maxlength="2000" placeholder="甲秀楼&#10;青岩古镇&#10;贵阳北站" @input="invalidate"/>
 <input v-else class="field" v-model="text" maxlength="120" placeholder="搜索地点，或记录一项计划" @input="nameInput"/>
 <!-- #ifdef MP-WEIXIN -->
 <button v-if="!batch" class="map-select-button" :disabled="busy||state.busy||state.readOnly" @click="chooseOnMap()"><text>⌖</text>{{selectedPlace?'更换地图地点':'在微信地图选地点'}}</button>
 <!-- #endif -->
 <view v-if="selectedPlace" class="chosen-place"><view><text class="chosen-title">{{selectedPlace.name}}</text><text class="chosen-address">{{selectedPlace.address||'已保存地图坐标'}}</text></view><button aria-label="清除已选位置" @click="clearLocation(drafts[0])">×</button></view>
 <view v-if="!batch&&drafts[0]?.choices.length>1" class="candidate-picker"><picker :range="['不关联位置',...drafts[0].choices.map(p=>p.name+' · '+p.address)]" :value="drafts[0].place?drafts[0].choices.findIndex(p=>p.id===drafts[0].place!.id)+1:0" @change="choose(drafts[0],Number($event.detail.value))"><view>发现 {{drafts[0].choices.length}} 个同名地点，选择一个 ▾</view></picker></view>
 <button v-if="batch||cloudEnabled()" class="secondary section" :loading="busy" :disabled="busy" @click="resolve">{{batch?'整理地点清单':'查找地图候选'}}</button>
 <button v-if="!batch&&!cloudEnabled()&&!selectedPlace&&text.trim()" class="text-button small" @click="resolve">查找本次旅行用过的同名地点</button>
 <view v-if="error" class="notice error">{{error}}。仍可保存为待补位置的计划。</view>
 <view v-if="batch" v-for="(draft,index) in drafts" :key="index" class="card section" style="margin-top:12px"><view class="row"><text>{{index+1}}. {{draft.name}}</text><switch :checked="draft.include" color="#367be7" style="transform:scale(.75)" @change="toggle(draft,$event)"/></view><picker :range="['暂不关联位置',...draft.choices.map(p=>p.name+' · '+p.address)]" :value="draft.place?draft.choices.findIndex(p=>p.id===draft.place!.id)+1:0" @change="choose(draft,Number($event.detail.value))"><view class="subtitle" style="padding-top:10px">{{draft.place?draft.place.name+' · '+draft.place.address:draft.choices.length?'有 '+draft.choices.length+' 个候选，请点击选择':'位置待补充'}} ▾</view></picker><!-- #ifdef MP-WEIXIN --><button class="text-button small" @click="chooseOnMap(draft)">在微信地图选点</button><!-- #endif --><picker :range="days" :value="days.indexOf(draft.date)" @change="draft.date=days[Number($event.detail.value)]"><view class="badge section" style="margin-top:12px">安排到 {{draft.date}} ▾</view></picker></view>
 <template v-if="!batch"><view class="two-col"><view><text class="label">开始时间（可留空）</text><picker mode="time" :value="form.time||'09:00'" @change="form.time=$event.detail.value"><view class="field field-text">{{form.time||'时间待定'}} ▾</view></picker><text v-if="form.time" class="link subtitle" @click="form.time=''">清空时间</text></view><view><text class="label">{{form.kind==='交通'?'交通耗时（分钟）':'停留时长（分钟）'}}</text><input class="field" type="number" v-model="form.duration"/></view></view><text class="label">类型</text><view class="pill-row"><text v-for="kind in kinds" :key="kind" class="pill" :class="{active:form.kind===kind}" @click="form.kind=kind">{{kind}}</text></view><text class="label">备注</text><textarea class="field field-text" v-model="form.note" maxlength="2000" placeholder="门票、预约信息，或者想吃的那家店…"/></template>
 <button class="primary section" :disabled="busy||state.busy||state.readOnly||!state.ready||(!text.trim()&&!drafts.length)" :loading="state.busy" @click="save">{{itemId?'保存修改':'确认加入行程'}}</button>
</view>
</template>

<style scoped>
.map-select-button{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:50px;margin-top:12px;border:1px solid #b9d3f6;border-radius:13px;background:#edf5ff;color:#2868b7;font-size:15px;font-weight:650}.map-select-button text{font-size:22px;line-height:1}.chosen-place{display:flex;align-items:center;gap:12px;margin-top:9px;padding:12px 13px;border:1px solid #cce6dc;border-radius:12px;background:#f2fbf7}.chosen-place>view{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}.chosen-title{font-size:14px;color:#276f5c;font-weight:650}.chosen-address{font-size:12px;color:#5b7e70;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.chosen-place button{width:40px;height:40px;min-height:40px;background:transparent;color:#6d9485;font-size:24px}.candidate-picker{margin-top:10px;padding:11px 12px;border-radius:9px;background:#f3f6fa;color:#547197;font-size:13px}
</style>
