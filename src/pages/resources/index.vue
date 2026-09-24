<script setup lang="ts">
import TripNav from '../../components/TripNav.vue';
import { computed, reactive, ref } from 'vue';
import { onLoad } from '@dcloudio/uni-app';
import { initialize, findTrip, saveTrip, state, notify, confirm, message, go } from '../../state';
import { clone, uid, type Stay, type Transport, type TransportMode, type Place } from '../../domain/types';
import { saveStay, saveTransport } from '../../domain/resources';
import { parseCents, yuan } from '../../domain/money';
import { dateRange, validDate } from '../../domain/dates';
import { navigate } from '../../services/maps';
import {chosenMapPlace} from '../../domain/place-matching';

const id=ref(''), date=ref(''), tab=ref<'stay'|'transport'>('stay'), editing=ref(false), saving=ref(false), error=ref('');
const trip=computed(()=>findTrip(id.value));
const dates=computed(()=>trip.value?dateRange(trip.value.startDate,trip.value.endDate):[]);
const dateIndex=(value:string)=>Math.max(0,dates.value.indexOf(value));
const locked=computed(()=>saving.value||state.busy||state.readOnly||!state.ready);
const stays=computed(()=>[...(trip.value?.stays||[])].sort((a,b)=>a.checkIn.localeCompare(b.checkIn)));
const dayOnly=ref(false);
const visibleStays=computed(()=>stays.value.filter(s=>!dayOnly.value||(s.checkIn<=date.value&&date.value<s.checkOut)));
const trainNights=computed(()=>stays.value.filter(s=>s.kind==='train'));
const expanded=ref<string[]>([]);
const recordedAmount=computed(()=>stays.value.reduce((sum,s)=>sum+s.amount,0));
function toggleStay(stayId:string){expanded.value=expanded.value.includes(stayId)?expanded.value.filter(id=>id!==stayId):[...expanded.value,stayId];}
const transports=computed(()=>[...(trip.value?.transports||[])].sort((a,b)=>a.departure.localeCompare(b.departure)));
const transportPlans=computed(()=>trip.value?.guides?.filter(g=>g.category==='transport')||[]);
const modes:{value:TransportMode;label:string}[]=[{value:'train',label:'火车'},{value:'flight',label:'飞机'},{value:'bus',label:'大巴'},{value:'driving',label:'驾车'},{value:'walking',label:'步行'},{value:'manual',label:'其他'}];
const modeLabel=(mode:TransportMode)=>modes.find(m=>m.value===mode)?.label||'其他';
const stay=reactive({id:'',name:'',kind:'hotel' as 'hotel'|'train',checkIn:'',checkOut:'',status:'planned' as Stay['status'],address:'',bookingNo:'',phone:'',note:'',amount:''});
const stayPlace=ref<Place>();
const transport=reactive({id:'',name:'',mode:'train' as TransportMode,departureDate:'',departureTime:'',arrivalDate:'',arrivalTime:'',fromName:'',toName:'',fromItemId:'',toItemId:'',bookingNo:'',note:''});
const located=computed(()=>trip.value?.items.filter(i=>i.place)||[]);
const placeOptions=computed(()=>['不关联地点',...located.value.map(i=>`${i.name} · ${i.date.slice(5)}`)]);
const itemOptions=computed(()=>['不关联事项',...(trip.value?.items||[]).map(i=>`${i.name} · ${i.date.slice(5)}`)]);
const nights=(s:Stay)=>Math.round((Date.parse(s.checkOut)-Date.parse(s.checkIn))/86400000);
const stamp=(s:string)=>s.replace('T',' ');
onLoad(async q=>{
  id.value=q?.id||''; await initialize(); if(!trip.value)return;
  date.value=validDate(q?.date||'')?q!.date!:trip.value.startDate;
  dayOnly.value=!!q?.date;
  tab.value=q?.tab==='transport'?'transport':'stay';
  if(q?.edit){const s=trip.value.stays?.find(s=>s.id===q.edit);const t=trip.value.transports?.find(t=>t.id===q.edit);if(s)openStay(s);else if(t)openTransport(t);}
});
function reset(){editing.value=false;error.value='';stayPlace.value=undefined;Object.assign(stay,{id:'',name:'',kind:'hotel',checkIn:'',checkOut:'',status:'planned',address:'',bookingNo:'',phone:'',note:'',amount:''});Object.assign(transport,{id:'',name:'',mode:'train',departureDate:'',departureTime:'',arrivalDate:'',arrivalTime:'',fromName:'',toName:'',fromItemId:'',toItemId:'',bookingNo:'',note:''});}
function switchTab(value:'stay'|'transport'){if(saving.value)return;tab.value=value;}
function openStay(value?:Stay){if(locked.value)return;reset();tab.value='stay';if(value){Object.assign(stay,clone(value),{amount:String(value.amount/100)});stayPlace.value=value.place?clone(value.place):undefined;}else Object.assign(stay,{checkIn:date.value});editing.value=true;uni.pageScrollTo({scrollTop:0,duration:200});}
function openTransport(value?:Transport){if(locked.value)return;reset();tab.value='transport';if(value)Object.assign(transport,clone(value),{departureDate:value.departure.slice(0,10),departureTime:value.departure.slice(11),arrivalDate:value.arrival.slice(0,10),arrivalTime:value.arrival.slice(11)});else Object.assign(transport,{departureDate:date.value,arrivalDate:date.value});editing.value=true;uni.pageScrollTo({scrollTop:0,duration:200});}
function pickPlace(index:number){if(locked.value)return;const item=located.value[index-1];stayPlace.value=item?.place?clone(item.place):undefined;if(item?.place){if(!stay.name)stay.name=item.place.name;if(!stay.address)stay.address=item.place.address;}}
function chooseHotelLocation(existing?:Stay){
 // #ifdef MP-WEIXIN
 if(locked.value||stay.kind==='train'&&!existing||existing?.kind==='train')return;
 const anchor=existing?.place||stayPlace.value||trip.value?.items.find(item=>item.date===(existing?.checkIn||stay.checkIn)&&item.place)?.place;
 uni.chooseLocation({...(anchor?{latitude:anchor.latitude,longitude:anchor.longitude}:{}),success:async result=>{
  try{const place=chosenMapPlace(result,uid());if(existing&&trip.value){saving.value=true;await saveTrip(saveStay(trip.value,{...clone(existing),place,address:existing.address||place.address}));notify('酒店位置已保存');}else{stayPlace.value=place;if(!stay.name)stay.name=place.name;if(!stay.address)stay.address=place.address;}}
  catch(e){notify(e);}finally{saving.value=false;}
 },fail:result=>{if(!/cancel/i.test(result.errMsg||''))notify('微信地图选点失败，请检查定位授权后重试');}});
 // #endif
}
function pickItem(side:'from'|'to',index:number){if(locked.value)return;const item=trip.value?.items[index-1];if(side==='from'){transport.fromItemId=item?.id||'';if(item)transport.fromName=item.name;}else{transport.toItemId=item?.id||'';if(item)transport.toName=item.name;}}
function itemName(itemId:string){const item=trip.value?.items.find(i=>i.id===itemId);return item?`${item.name} · ${item.date}`:'不关联事项';}
async function save(){
  if(locked.value||!trip.value)return;saving.value=true;error.value='';
  try{
    if(tab.value==='stay'){
      const value:Stay={id:stay.id||uid(),name:stay.name.trim(),kind:stay.kind,checkIn:stay.checkIn,checkOut:stay.checkOut,status:stay.status,address:stay.address.trim(),bookingNo:stay.bookingNo.trim(),phone:stay.phone.trim(),note:stay.note.trim(),amount:parseCents(stay.amount||'0'),...(stayPlace.value?{place:clone(stayPlace.value)}:{})};
      await saveTrip(saveStay(trip.value,value));
    }else{
      const value:Transport={id:transport.id||uid(),name:transport.name.trim(),mode:transport.mode,departure:`${transport.departureDate}T${transport.departureTime}`,arrival:`${transport.arrivalDate}T${transport.arrivalTime}`,fromName:transport.fromName.trim(),toName:transport.toName.trim(),...(transport.fromItemId?{fromItemId:transport.fromItemId}:{}),...(transport.toItemId?{toItemId:transport.toItemId}:{}),bookingNo:transport.bookingNo.trim(),note:transport.note.trim()};
      await saveTrip(saveTransport(trip.value,value));
    }
    reset();notify('已保存');
  }catch(e){error.value=message(e);notify(e);}finally{saving.value=false;}
}
async function remove(kind:'stay'|'transport',resourceId:string){
  if(locked.value||!trip.value)return;saving.value=true;
  try{if(!await confirm('删除这条记录？','只删除本条住宿或交通记录，行程事项与账本保留。'))return;if(state.readOnly||!state.ready||!trip.value)return;const next=clone(trip.value);next.revision++;if(kind==='stay')next.stays=next.stays?.filter(s=>s.id!==resourceId);else next.transports=next.transports?.filter(t=>t.id!==resourceId);await saveTrip(next);notify('已删除');}catch(e){notify(e);}finally{saving.value=false;}
}
</script>

<template>
<view class="screen resources" v-if="trip">
  <text class="eyebrow">TRAVEL BOOKINGS</text><view class="title">住宿与交通</view><view class="subtitle">{{trip.title}} · {{trip.startDate.slice(5)}} — {{trip.endDate.slice(5)}}</view>
  <view v-if="state.readOnly" class="notice">当前为只读缓存，重新连接后可整理住宿与交通。</view>
  <view v-if="!editing" class="resource-tabs"><button :class="{selected:tab==='stay'}" :disabled="saving" @click="switchTab('stay')">住宿 · {{stays.length}}</button><button :class="{selected:tab==='transport'}" :disabled="saving" @click="switchTab('transport')">交通 / 过夜 · {{transports.length+trainNights.length}}</button></view>

  <view v-if="editing" class="editor section">
    <view class="editor-heading"><text>{{tab==='stay'?(stay.id?'编辑住宿':'记录一处落脚点'):(transport.id?'编辑交通':'记录一段旅途')}}</text><button class="quiet" :disabled="saving" @click="reset">取消</button></view>
    <template v-if="tab==='stay'">
      <text class="label">过夜方式</text><view class="pill-row"><button class="pill" :class="{active:stay.kind==='hotel'}" :disabled="locked" @click="stay.kind='hotel'">酒店 / 民宿</button><button class="pill" :class="{active:stay.kind==='train'}" :disabled="locked" @click="stay.kind='train'">车上过夜</button></view><text class="label">住宿 / 过夜名称 *</text><input class="field" v-model="stay.name" :disabled="locked" maxlength="80" placeholder="酒店、民宿或计划中的落脚点"/>
      <view class="two-col"><view><text class="label">入住日期 *</text><picker :range="dates" :value="dateIndex(stay.checkIn||trip.startDate)" :disabled="locked" @change="stay.checkIn=dates[Number($event.detail.value)]"><view class="field field-text">{{stay.checkIn||'选择日期'}}</view></picker></view><view><text class="label">退房日期 *</text><picker :range="dates" :value="dateIndex(stay.checkOut||stay.checkIn||trip.startDate)" :disabled="locked" @change="stay.checkOut=dates[Number($event.detail.value)]"><view class="field field-text">{{stay.checkOut||'选择日期'}}</view></picker></view></view>
      <text class="label">预订状态</text><view class="pill-row"><button class="pill" :class="{active:stay.status==='planned'}" :disabled="locked" @click="stay.status='planned'">计划中</button><button class="pill" :class="{active:stay.status==='booked'}" :disabled="locked" @click="stay.status='booked'">已预订</button></view>
      <text class="label">关联已有地点（选填）</text><picker :range="placeOptions" :disabled="locked" @change="pickPlace(Number($event.detail.value))"><view class="field field-text">{{stayPlace?.name||'从已定位的行程事项选择'}}</view></picker>
      <text class="label">地址（选填）</text><input class="field" v-model="stay.address" :disabled="locked" maxlength="300" placeholder="详细地址，暂不确定可留空"/>
      <!-- #ifdef MP-WEIXIN -->
      <button v-if="stay.kind!=='train'" class="secondary section" :disabled="locked" @click="chooseHotelLocation()">{{stayPlace?'更换酒店地图位置':'在微信地图定位酒店'}}</button>
      <!-- #endif -->
      <view v-if="stayPlace" class="notice">地图位置 · {{stayPlace.name}}<view>{{stayPlace.address}}</view></view>
      <view class="two-col"><view><text class="label">预订编号（选填）</text><input class="field" v-model="stay.bookingNo" :disabled="locked" maxlength="100" placeholder="订单号"/></view><view><text class="label">联系电话（选填）</text><input class="field" v-model="stay.phone" :disabled="locked" maxlength="40" placeholder="住宿联系电话"/></view></view>
      <text class="label">记录金额（元，选填）</text><input class="field" type="digit" v-model="stay.amount" :disabled="locked" placeholder="0.00"/>
      <text class="label">备注（选填）</text><textarea class="field notes" v-model="stay.note" :disabled="locked" maxlength="2000" placeholder="入住方式、房型或待核对的信息"/>
      <view class="notice">入住当天起展示当晚住宿，退房日单独提醒。车上过夜同样按开始日期与结束日期记录，不猜测车次和时刻。这里的金额不自动计入账本。</view>
    </template>
    <template v-else>
      <view v-if="transportPlans.length" class="notice">以下交通提醒保留原计划与待确认信息，不等同于已出票的交通订单。</view><view v-for="guide in transportPlans" :key="guide.id" class="resource-card"><view class="card-top"><text class="resource-name">{{guide.title}}</text><text class="status">计划提醒</text></view><view class="detail">{{guide.dates.map(d=>d.slice(5)).join(' · ')}}</view><view class="detail note-text">{{guide.content.slice(0,180)}}{{guide.content.length>180?'…':''}}</view><button class="secondary small section" @click="go('guides',{id,guide:guide.id})">查看交通安排与关联日程</button></view>
      <text class="label">名称 / 班次 *</text><input class="field" v-model="transport.name" :disabled="locked" maxlength="80" placeholder="例如：夜间火车（班次待确认）"/>
      <text class="label">交通方式</text><view class="pill-row"><button v-for="m in modes" :key="m.value" class="pill" :class="{active:transport.mode===m.value}" :disabled="locked" @click="transport.mode=m.value">{{m.label}}</button></view>
      <view class="journey-block"><text class="block-title">出发</text><text class="label">出发地点 *</text><input class="field" v-model="transport.fromName" :disabled="locked" maxlength="100" placeholder="车站、机场或出发地点"/><text class="label">关联行程事项（选填）</text><picker :range="itemOptions" :disabled="locked" @change="pickItem('from',Number($event.detail.value))"><view class="field field-text">{{itemName(transport.fromItemId)}}</view></picker><view class="two-col"><view><text class="label">日期 *</text><picker :range="dates" :value="dateIndex(transport.departureDate||trip.startDate)" :disabled="locked" @change="transport.departureDate=dates[Number($event.detail.value)]"><view class="field field-text">{{transport.departureDate||'选择日期'}}</view></picker></view><view><text class="label">时间 *</text><picker mode="time" :value="transport.departureTime" :disabled="locked" @change="transport.departureTime=$event.detail.value"><view class="field field-text">{{transport.departureTime||'选择时间'}}</view></picker></view></view></view>
      <view class="journey-block"><text class="block-title">到达</text><text class="label">到达地点 *</text><input class="field" v-model="transport.toName" :disabled="locked" maxlength="100" placeholder="车站、机场或到达地点"/><text class="label">关联行程事项（选填）</text><picker :range="itemOptions" :disabled="locked" @change="pickItem('to',Number($event.detail.value))"><view class="field field-text">{{itemName(transport.toItemId)}}</view></picker><view class="two-col"><view><text class="label">日期 *</text><picker :range="dates" :value="dateIndex(transport.arrivalDate||transport.departureDate||trip.startDate)" :disabled="locked" @change="transport.arrivalDate=dates[Number($event.detail.value)]"><view class="field field-text">{{transport.arrivalDate||'选择日期'}}</view></picker></view><view><text class="label">时间 *</text><picker mode="time" :value="transport.arrivalTime" :disabled="locked" @change="transport.arrivalTime=$event.detail.value"><view class="field field-text">{{transport.arrivalTime||'选择时间'}}</view></picker></view></view></view>
      <text class="label">预订编号（选填）</text><input class="field" v-model="transport.bookingNo" :disabled="locked" maxlength="100" placeholder="订单号，未知可留空"/><text class="label">备注（选填）</text><textarea class="field notes" v-model="transport.note" :disabled="locked" maxlength="2000" placeholder="座位、行李或待核对的信息"/>
      <view class="notice">时间均为北京时间。跨夜行程请选择实际到达日期；关联事项须与对应出发或到达日期一致。</view>
    </template>
    <view v-if="error" class="form-error">{{error}}</view><button class="primary section" :loading="saving" :disabled="locked" @click="save">保存{{tab==='stay'?'住宿':'交通'}}</button>
  </view>

  <template v-else>
    <view class="section-heading"><text>{{tab==='stay'?'每一晚，都安排好':'从这一站，到下一站'}}</text><button class="add-resource" :disabled="locked" @click="tab==='stay'?openStay():openTransport()">＋ {{tab==='stay'?'住宿':'交通'}}</button></view>
    <template v-if="tab==='stay'">
      <view class="row"><picker :range="dates" :value="dateIndex(date)" @change="date=dates[Number($event.detail.value)];dayOnly=true"><view class="pill">{{date}} ▾</view></picker><button class="secondary small" @click="dayOnly=!dayOnly">{{dayOnly?'查看全程住宿':'只看当晚'}}</button></view><view v-if="stays.length" class="notice">已记录 {{stays.length}} 段过夜安排 · 金额合计 ¥{{yuan(recordedAmount)}}<view>车票金额未知时不计入；不自动写入账本。</view></view>
      <view v-for="s in visibleStays" :key="s.id" class="resource-card">
       <view class="card-top"><text class="resource-name">{{s.name}}</text><text v-if="s.kind==='train'" class="status">车上过夜</text><text v-else class="status" :class="{booked:s.status==='booked'}">{{s.place?'已定位':s.status==='booked'?'已预订':'待定位'}}</text></view>
       <view class="date-line">{{s.checkIn}} → {{s.checkOut}}<text class="night-count">{{nights(s)}} 晚</text></view>
       <view v-if="s.address||s.place" class="detail">{{s.address||s.place?.address||s.place?.name}}</view>
       <view v-if="s.place&&s.address&&s.place.name!==s.name" class="detail">地图位置 · {{s.place.name}}</view>
       <view v-if="s.bookingNo&&expanded.includes(s.id)" class="detail">预订编号 · {{s.bookingNo}}</view><view v-if="s.phone&&expanded.includes(s.id)" class="detail">联系电话 · {{s.phone}}</view><view v-if="s.note&&expanded.includes(s.id)" class="detail note-text">{{s.note}}</view>
       <view class="card-bottom"><text class="amount">{{s.amount?'¥'+yuan(s.amount):'金额待补充'}}</text><view class="card-actions"><button @click="toggleStay(s.id)">{{expanded.includes(s.id)?'收起':'详情'}}</button><button v-if="s.place" @click="navigate(s.place)">导航 ↗</button><!-- #ifdef MP-WEIXIN --><button v-if="s.kind!=='train'&&!s.place&&!state.readOnly" :disabled="locked" @click="chooseHotelLocation(s)">定位</button><!-- #endif --><button v-if="!state.readOnly" :disabled="locked" @click="openStay(s)">编辑</button><button v-if="!state.readOnly" class="remove" :disabled="locked" @click="remove('stay',s.id)">删除</button></view></view>
      </view>
      <view v-if="!visibleStays.length" class="empty-resource"><text class="empty-icon">☾</text><view>给旅途留一个安心的落脚点</view><text class="detail">添加一次住宿，入住的每一晚都会出现在行程里。</text></view>
    </template>
    <template v-else>
      <view v-for="t in transports" :key="t.id" class="resource-card"><view class="card-top"><text class="resource-name">{{t.name}}</text><text class="status">{{modeLabel(t.mode)}}</text></view><view class="route-stop"><text class="route-dot"/><view><text class="stop-name">{{t.fromName}}</text><view class="detail">{{stamp(t.departure)}} 出发</view></view></view><view class="route-stop"><text class="route-dot arrival"/><view><text class="stop-name">{{t.toName}}</text><view class="detail">{{stamp(t.arrival)}} 到达<text v-if="t.departure.slice(0,10)!==t.arrival.slice(0,10)" class="overnight">跨日</text></view></view></view><view v-if="t.bookingNo" class="detail">预订编号 · {{t.bookingNo}}</view><view v-if="t.note" class="detail note-text">{{t.note}}</view><view class="card-bottom"><text class="detail">北京时间</text><view class="card-actions" v-if="!state.readOnly"><button :disabled="locked" @click="openTransport(t)">编辑</button><button class="remove" :disabled="locked" @click="remove('transport',t.id)">删除</button></view></view></view>
      <view v-for="night in trainNights" :key="night.id" class="resource-card"><view class="card-top"><text class="resource-name">{{night.name}}</text><text class="status">车上过夜</text></view><view class="date-line">{{night.checkIn}} → {{night.checkOut}}</view><view class="detail">{{night.note}}</view><view class="notice">这是过夜安排，尚不是车票记录。拿到票后可添加准确车次与出发、到达时间。</view></view><view v-if="!transports.length&&!trainNights.length" class="empty-resource"><text class="empty-icon">↗</text><view>把出发和到达，一起记下来</view><text class="detail">飞机、夜火车或城市间的移动，都可以在这里安排。</text></view>
    </template>
    <view class="notice">记录覆盖整段旅行。已有行程里的住宿事项会继续保留，可按需要自行整理。</view>
  </template>
<TripNav :id="id" :date="date" active="resources"/></view>
<view v-else class="screen"><view class="title">{{state.ready?'未找到这段旅行':'正在打开旅行…'}}</view><view class="notice" v-if="state.error">{{state.error}}</view></view>
</template>

<style scoped>
.resources{padding-bottom:44px}.resource-tabs{display:flex;margin:26px 0 22px;padding:5px;background:#edf2f8;border-radius:16px;gap:6px}.resource-tabs button{flex:1;margin:0;background:transparent;color:#6f8198;font-size:15px;border-radius:12px;line-height:42px}.resource-tabs button.selected{background:#ffffff;color:#367be7;box-shadow:0 2px 8px #367be710}button:after{border:none}.section-heading,.editor-heading,.card-top,.card-bottom{display:flex;align-items:center;justify-content:space-between;gap:12px}.section-heading{margin:20px 0 16px;font-size:16px;color:#367be7}.add-resource{margin:0;background:#367be7;color:#ffffff;font-size:13px;border-radius:20px;padding:0 16px;line-height:36px}.resource-card{padding:20px;margin-bottom:14px;background:#ffffff;border:1px solid #e5ecf4;border-radius:20px}.resource-name{font-size:19px;font-weight:600;min-width:0;overflow-wrap:anywhere}.status{flex-shrink:0;font-size:11px;padding:5px 9px;border-radius:8px;background:#f1f5fa;color:#6c82a1}.status.booked{background:#e9f2ff;color:#367be7}.date-line{font-size:12px;color:#60758f;margin:16px 0;line-height:1.7}.night-count{margin-left:10px;color:#7990ad}.detail{font-size:12px;color:#75849a;line-height:1.8;overflow-wrap:anywhere}.note-text{white-space:pre-wrap;margin-top:10px}.card-bottom{border-top:1px solid #e8eef6;margin-top:16px;padding-top:12px}.amount{font-size:13px;color:#526f95}.card-actions{display:flex;gap:14px}.card-actions button,.quiet{font-size:12px;line-height:30px;padding:0;margin:0;background:transparent;color:#367be7}.card-actions .remove{color:#b96558}.empty-resource{text-align:center;padding:38px 24px;background:#edf3fb;border-radius:20px;color:#4f6f99;line-height:2}.empty-resource .detail{display:block;margin-top:8px}.empty-icon{display:block;font-size:44px;font-family:inherit;color:#9bb7da;margin-bottom:18px}.editor{background:#ffffff;border:1px solid #e5ecf4;border-radius:20px;padding:20px}.editor-heading{font-size:18px;color:#367be7;margin-bottom:22px}.editor .two-col{gap:12px}.editor .two-col>view{min-width:0}.editor .field{box-sizing:border-box;width:100%}.editor .field-text{font-size:13px;overflow-wrap:anywhere;height:auto;min-height:48px}.editor .pill{margin:0;line-height:28px;font-size:12px}.notes{height:110px;padding-top:14px}.journey-block{border-left:2px solid #dbe7f6;padding-left:14px;margin:22px 0}.block-title{color:#367be7;font-size:15px;font-weight:600}.form-error{color:#a05345;background:#f8eee8;padding:12px;margin-top:16px;border-radius:10px;font-size:13px}.route-stop{display:flex;gap:12px;margin-top:18px}.route-dot{width:8px;height:8px;border:2px solid #7fa2d1;border-radius:50%;margin-top:6px;flex-shrink:0}.route-dot.arrival{background:#7fa2d1}.stop-name{font-size:15px;color:#4f6f99}.overnight{margin-left:8px;color:#5478ad}button[disabled]{opacity:.45}
</style>




<style scoped src="../../styles/resources-ios.css"></style>
