<script setup lang="ts">
import {computed} from 'vue';
import {state,go} from '../../state';
import {today,dateRange} from '../../domain/dates';
import StatusBanner from '../../components/StatusBanner.vue';
const trips=computed(()=>state.data.trips.filter(t=>!t.archived).sort((a,b)=>a.startDate.localeCompare(b.startDate)));
const status=(start:string,end:string)=>today()<start?'即将出发':today()>end?'旅行回忆':'正在旅行';
const groups=computed(()=>['正在旅行','即将出发','旅行回忆'].map(label=>({label,trips:trips.value.filter(t=>status(t.startDate,t.endDate)===label)})).filter(g=>g.trips.length));
</script>
<template>
<view class="screen trips-home">
 <view class="home-top"><view class="brand-mark">行</view><view class="home-brand"><view>行间旅行</view><text>把想去的地方，排成旅程</text></view></view>
 <view class="home-heading"><view><view class="home-title">我的旅行</view><text class="home-count">{{trips.length}} 段旅程</text></view><button class="primary home-add" :disabled="state.readOnly||!state.ready" @click="go('trip-edit')">＋ 新建</button></view>
 <StatusBanner/>
 <view v-if="state.ready&&!trips.length" class="card home-empty"><view>从一段新旅程开始</view><text>先写下日期和目的地，其他安排可以慢慢补上。</text><button class="primary" :disabled="state.readOnly" @click="go('trip-edit')">创建旅行</button></view>
 <view v-for="group in groups" :key="group.label" class="trip-group"><view class="group-label">{{group.label}}</view><button v-for="trip in group.trips" :key="trip.id" class="home-trip" :aria-label="`打开${trip.title}`" @click="go('itinerary',{id:trip.id})"><view class="trip-topline"><text class="trip-destination">{{trip.city}}</text><text class="trip-date">{{trip.startDate.slice(5).replace('-','.')}} — {{trip.endDate.slice(5).replace('-','.')}}</text></view><view class="trip-name"><text>{{trip.title}}</text><text class="trip-arrow">›</text></view><view class="trip-facts"><text>{{dateRange(trip.startDate,trip.endDate).length}} 天 · {{trip.items.length}} 项安排</text><text>住宿 {{trip.stays?.filter(s=>s.kind!=='train').length||0}} 处 · 行李 {{trip.packing?.filter(p=>p.packed).length||0}}/{{trip.packing?.length||0}}</text></view></button></view>
</view>
</template>
<style scoped>
.trips-home{padding-top:24px}.home-top{display:flex;align-items:center;gap:12px}.brand-mark{width:46px;height:46px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:15px;background:var(--brand);color:#fff;font-size:23px;font-weight:650}.home-brand{min-width:0}.home-brand>view{font-size:23px;font-weight:700;line-height:1.3;letter-spacing:-.4px}.home-brand text{display:block;margin-top:2px;font-size:13px;color:var(--ink-muted)}.home-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:34px 0 18px}.home-title{font-size:21px;font-weight:700;line-height:1.3}.home-count{display:block;margin-top:3px;font-size:13px;color:var(--ink-muted)}.home-add{padding:11px 17px;font-size:14px;font-weight:650}.trip-group{margin-top:20px}.group-label{font-size:14px;font-weight:650;color:#59708e;margin:0 0 10px 2px}.home-trip{display:block;width:100%;min-height:154px;margin:0 0 13px;padding:17px 18px;text-align:left;background:#fff;border:1px solid #e2eaf4;border-radius:20px;box-shadow:0 5px 16px #203c6609;color:var(--ink);font-weight:400}.trip-topline{display:flex;align-items:center;justify-content:space-between;gap:8px}.trip-destination{font-size:13px;padding:4px 9px;border-radius:8px;background:#edf4ff;color:#376da9;max-width:55%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.trip-date{font-size:13px;color:#6b7b90;white-space:nowrap}.trip-name{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-top:15px;font-size:20px;font-weight:700;line-height:1.35;letter-spacing:-.3px;overflow-wrap:anywhere}.trip-arrow{font-size:28px;line-height:1;color:#8aa3c4;font-weight:400}.trip-facts{display:flex;flex-wrap:wrap;gap:3px 16px;margin-top:12px;font-size:13px;line-height:1.55;color:#6b7b90}.home-empty{padding:26px 20px}.home-empty>view{font-size:19px;font-weight:650}.home-empty>text{display:block;margin-top:8px;font-size:14px;color:var(--ink-muted)}.home-empty button{margin-top:18px}@media(max-width:360px){.home-brand>view{font-size:21px}.trip-name{font-size:18px}.trip-topline{flex-wrap:wrap}.home-trip{min-height:166px}}
</style>
<style scoped src="../../styles/home-ios.css"></style>
