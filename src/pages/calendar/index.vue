<script setup lang="ts">
import {computed,ref} from 'vue';
import {state,go} from '../../state';
import {today,monthCells,shiftMonth} from '../../domain/dates';
import {calendarLanes,tripColor} from '../../domain/calendar';
import StatusBanner from '../../components/StatusBanner.vue';
const month=ref(today().slice(0,7)),selected=ref(today());
const cells=computed(()=>monthCells(month.value));
const lanes=computed(()=>calendarLanes(state.data.trips,month.value));
const tripsOn=(date:string)=>state.data.trips.filter(t=>!t.archived&&t.startDate<=date&&t.endDate>=date);
const selectedTrips=computed(()=>tripsOn(selected.value));
const bands=(date:string)=>lanes.value.slice(0,3).map(lane=>lane.find(t=>t.startDate<=date&&t.endDate>=date));
const overflow=(date:string)=>lanes.value.slice(3).filter(lane=>lane.some(t=>t.startDate<=date&&t.endDate>=date)).length;
function change(n:number){month.value=shiftMonth(month.value,n);selected.value=month.value+'-01';}
</script>
<template><view class="screen"><text class="eyebrow">DAYS WORTH REMEMBERING</text><view class="title">把远方，写进日历。</view><view class="subtitle">每一段有颜色的日子，都是一次出发。</view><StatusBanner/>
<view class="card section calendar-card"><view class="row"><button class="text-button" @click="change(-1)">‹</button><text class="month-title">{{month.replace('-',' / ')}}</text><button class="text-button" @click="change(1)">›</button></view>
<view class="calendar"><text v-for="week in ['一','二','三','四','五','六','日']" :key="week" class="week">{{week}}</text>
<view v-for="(date,index) in cells" :key="index" class="cell" :class="{selected:date===selected,today:date===today()}" @click="date&&(selected=date)"><template v-if="date"><text class="day-number">{{Number(date.slice(-2))}}</text><view class="bands"><view v-for="(trip,n) in bands(date)" :key="n" class="band" :class="{start:trip&&(date===trip.startDate||index%7===0||date.slice(-2)==='01'),end:trip&&(date===trip.endDate||index%7===6||index===cells.length-1)}" :style="{background:trip?tripColor(trip.id):'transparent'}"/></view><text v-if="overflow(date)" class="overflow">+{{overflow(date)}}</text></template></view></view></view>
<view class="row section"><text class="section-title">{{selected.slice(5).replace('-',' 月 ')}} 日</text><button class="text-button small" @click="month=today().slice(0,7);selected=today()">回到今天</button></view>
<view v-if="!selectedTrips.length" class="empty">这一天，留给日常，也留给下一次期待。</view><view v-for="trip in selectedTrips" :key="trip.id" class="card section trip" :style="{borderLeftColor:tripColor(trip.id)}" @click="go('itinerary',{id:trip.id,date:selected})"><view class="row"><view><view class="section-title">{{trip.title}}</view><text class="subtitle">{{trip.city}} · {{trip.startDate.slice(5)}} — {{trip.endDate.slice(5)}}</text></view><text>↗</text></view></view><view class="footer-note">色带来自旅行日期 · 重叠旅行点击日期查看</view></view></template>
<style scoped>
.month-title{font-size:23px;font-family:inherit;letter-spacing:2px}.calendar-card{padding:20px 12px}.calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));row-gap:5px;margin-top:20px;text-align:center}.week{font-size:11px;color:#a0a492;padding:10px 0}.cell{height:70px;border-radius:10px;display:flex;flex-direction:column;align-items:center;font-size:13px;padding-top:5px}.day-number{height:24px}.cell.selected{background:#e6eddb;color:#367be7;font-weight:700}.cell.today .day-number{outline:1px dashed #94a57e;border-radius:50%;width:24px}.bands{width:100%;display:flex;flex-direction:column;gap:3px}.band{height:5px;width:100%}.band.start{border-radius:5px 0 0 5px;margin-left:3px;width:calc(100% - 3px)}.band.end{border-radius:0 5px 5px 0;width:calc(100% - 3px)}.band.start.end{border-radius:5px;width:calc(100% - 6px)}.overflow{font-size:9px;line-height:12px}.trip{margin-top:12px;border-left-width:4px}
</style>
<style scoped src="../../styles/calendar-ios.css"></style>
