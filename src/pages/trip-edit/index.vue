<script setup lang="ts">
import {reactive,ref} from 'vue';import {onLoad} from '@dcloudio/uni-app';
import {initialize,findTrip,saveTrip,state,notify,go} from '../../state';import {today} from '../../domain/dates';import {createTrip,updateTrip} from '../../domain/trips';import {parseCents} from '../../domain/money';
const id=ref('');const form=reactive({title:'',city:'',startDate:today(),endDate:today(),budget:'',companion:''});
onLoad(async q=>{id.value=q?.id||'';await initialize();const t=findTrip(id.value);if(t)Object.assign(form,{title:t.title,city:t.city,startDate:t.startDate,endDate:t.endDate,budget:String(t.budget/100),companion:t.members[1]?.name||''});});
async function save(){try{const current=findTrip(id.value);const t=current?updateTrip(current,{title:form.title.trim(),city:form.city.trim(),startDate:form.startDate,endDate:form.endDate,budget:parseCents(form.budget||'0')}):createTrip(form);await saveTrip(t);if(current)uni.navigateBack();else uni.redirectTo({url:'/pages/itinerary/index?id='+t.id});}catch(e){notify(e);}}
</script>
<template><view class="screen"><text class="eyebrow">A NEW CHAPTER</text><view class="title">{{id?'整理这段旅程':'准备好，去走走。'}}</view><view class="subtitle">先定下目的地，剩下的慢慢安排。</view><view class="section">
<text class="label">旅行名称</text><input class="field" v-model="form.title" maxlength="60" placeholder="例如：贵阳的慢生活三日"/>
<text class="label">目的城市</text><input class="field" v-model="form.city" maxlength="80" placeholder="例如：贵阳"/>
<view class="two-col"><view><text class="label">出发日期</text><picker mode="date" :value="form.startDate" @change="form.startDate=$event.detail.value"><view class="field field-text">{{form.startDate}}</view></picker></view><view><text class="label">结束日期</text><picker mode="date" :value="form.endDate" @change="form.endDate=$event.detail.value"><view class="field field-text">{{form.endDate}}</view></picker></view></view>
<text class="label">旅行预算（元，可不填）</text><input class="field" v-model="form.budget" type="digit" placeholder="给旅行留一点余量"/>
<text class="label">同行人昵称（可不填）</text><input class="field" v-model="form.companion" :disabled="!!id" maxlength="30" placeholder="和谁一起出发？"/>
<view class="notice">{{id?'编辑日期不会删除已有计划；超出新日期范围的事项需先移动。同行人在创建后保持固定，以确保账本记录一致。':'同行人用于记账和分摊，由你维护行程，暂不需要对方登录。'}}</view>
<button class="primary section" :loading="state.busy" :disabled="state.busy||state.readOnly||!state.ready" @click="save">{{id?'保存旅行':'创建旅行 →'}}</button></view></view></template>

