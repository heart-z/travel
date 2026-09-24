<script setup lang="ts">
import {computed,reactive,ref} from 'vue';
import {onLoad} from '@dcloudio/uni-app';
import TripNav from '../../components/TripNav.vue';
import {findTrip,initialize,state,saveTrip,notify,confirm,message} from '../../state';
import {clone,uid,type Guide} from '../../domain/types';
import {dateRange} from '../../domain/dates';
import {guideCategories,guideMatches,extractGuideUrl,saveGuide,removeGuide} from '../../domain/guides';
const id=ref(''),date=ref(''),item=ref(''),selected=ref(''),expanded=ref(''),search=ref(''),category=ref('*'),showAll=ref(false),editing=ref(false),error=ref('');
const trip=computed(()=>findTrip(id.value));
const locked=computed(()=>state.busy||state.readOnly||!state.ready);
const dates=computed(()=>trip.value?dateRange(trip.value.startDate,trip.value.endDate):[]);
const items=computed(()=>[...(trip.value?.items||[])].sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order));
const all=computed(()=>trip.value?.guides||[]);
const filtered=computed(()=>all.value.filter(g=>(!selected.value||g.id===selected.value)&&(category.value==='*'||g.category===category.value)&&guideMatches(g,search.value,showAll.value?{}:{date:date.value,itemId:item.value},trip.value)));
const scopeLabel=computed(()=>item.value?(trip.value?.items.find(i=>i.id===item.value)?.name||'已删除行程'):date.value);
const blank=():Guide=>({id:'',title:'',content:'',sourceUrl:'',sourceText:'',dates:[],itemIds:[],category:'guide'});
const form=reactive<Guide>(blank());
const staleDates=computed(()=>form.dates.filter(d=>!dates.value.includes(d)));
const staleItems=computed(()=>form.itemIds.filter(key=>!items.value.some(i=>i.id===key)));
onLoad(async q=>{id.value=q?.id||'';date.value=q?.date||'';item.value=q?.item||'';selected.value=q?.guide||'';expanded.value=selected.value;showAll.value=!!selected.value;await initialize();});
function open(g?:Guide){if(locked.value)return;Object.assign(form,g?clone(g):{...blank(),dates:date.value&&dates.value.includes(date.value)?[date.value]:[],itemIds:item.value&&items.value.some(i=>i.id===item.value)?[item.value]:[]});error.value='';editing.value=true;uni.pageScrollTo({scrollTop:0,duration:200});}
function toggle(field:'dates'|'itemIds',value:string){if(locked.value)return;form[field]=form[field].includes(value)?form[field].filter(v=>v!==value):[...form[field],value];}
function extract(){if(locked.value)return;const url=extractGuideUrl(form.sourceText||'');if(url){form.sourceUrl=url;error.value='';}else error.value='分享文字中未找到 http 或 https 链接，也可以手动填写下方网址。';}
async function save(){if(locked.value||!trip.value)return;try{error.value='';await saveTrip(saveGuide(trip.value,{...form,id:form.id||uid()}));editing.value=false;selected.value='';notify('攻略已保存');}catch(e){error.value=message(e);}}
async function remove(){if(locked.value||!trip.value||!form.id)return;const key=form.id;if(!await confirm('删除这条攻略？',form.title))return;if(locked.value||!trip.value)return;try{await saveTrip(removeGuide(trip.value,key));editing.value=false;selected.value='';}catch(e){error.value=message(e);}}
function associations(g:Guide):string[]{return [...g.dates.map(d=>d+(dates.value.includes(d)?'':'（已不在旅行日期内）')),...g.itemIds.map(key=>{const i=items.value.find(i=>i.id===key);return i?`${i.date.slice(5)} · ${i.name}`:'已删除的行程（关联保留）';})];}
function reset(){showAll.value=true;selected.value='';expanded.value='';search.value='';category.value='*';}
function toggleDetails(key:string){expanded.value=expanded.value===key?'':key;}
</script>
<template>
<view v-if="trip" class="screen guides-screen">
 <text class="eyebrow">SAVED FOR YOUR JOURNEY</text><view class="title">旅行攻略</view><view class="subtitle">{{trip.title}} · {{all.length}} 条收藏与备忘</view>
 <view v-if="state.readOnly" class="notice">当前为只读缓存，重新连接后可修改攻略。</view>
 <view v-if="editing" class="card section">
  <view class="row"><text class="section-title">{{form.id?'编辑攻略':'添加攻略'}}</text><button class="text-button small" :disabled="state.busy" @click="editing=false">取消</button></view>
  <label for="guide-title" class="label">标题</label><input id="guide-title" v-model="form.title" class="field" :disabled="locked" maxlength="120" placeholder="例如：阿尔山游玩顺序与避坑"/>
  <text class="label">分类</text><view class="pill-row"><button v-for="c in guideCategories" :key="c.id" class="pill" :class="{active:form.category===c.id}" :disabled="locked" @click="form.category=c.id">{{c.name}}</button></view>
  <label for="guide-content" class="label">攻略内容 / 我的重点</label><textarea id="guide-content" v-model="form.content" class="field notes" :disabled="locked" maxlength="12000" placeholder="记录路线、时间、注意事项；内容由你整理"/>
  <label for="guide-share" class="label">小红书等平台的分享文字（选填）</label><textarea id="guide-share" v-model="form.sourceText" class="field share" :disabled="locked" maxlength="4000" placeholder="粘贴复制的整段分享文字，原文会一起保存"/><button class="secondary section" :disabled="locked" @click="extract">从分享文字提取链接</button>
  <label for="guide-url" class="label">来源网址（选填）</label><input id="guide-url" v-model="form.sourceUrl" class="field" :disabled="locked" maxlength="2000" placeholder="https://…"/><view class="subtitle section">只保存文字和链接，不会自动读取笔记。查看来源时复制链接，再到原平台打开。</view>
  <text class="label">关联日期 · 可多选</text><view class="pill-row"><button v-for="d in dates" :key="d" class="pill" :class="{active:form.dates.includes(d)}" :disabled="locked" @click="toggle('dates',d)">{{form.dates.includes(d)?'✓ ':''}}{{d.slice(5)}}</button><button v-for="d in staleDates" :key="d" class="pill active" :disabled="locked" @click="toggle('dates',d)">{{d}} · 已过期 ×</button></view>
  <text class="label">关联行程 · 可多选</text><view class="association-list"><button v-for="i in items" :key="i.id" class="association" :class="{chosen:form.itemIds.includes(i.id)}" :disabled="locked" @click="toggle('itemIds',i.id)"><text>{{form.itemIds.includes(i.id)?'✓ ':'＋ '}}{{i.date.slice(5)}} · {{i.name}}</text></button><button v-for="key in staleItems" :key="key" class="association chosen" :disabled="locked" @click="toggle('itemIds',key)">已删除的行程 · 移除关联 ×</button></view><view v-if="!items.length" class="subtitle">还没有行程，可先保存攻略，之后再关联。</view>
  <view v-if="error" class="notice error">{{error}}</view><button class="primary section" :disabled="locked" :loading="state.busy" @click="save">保存攻略</button><button v-if="form.id" class="text-button delete section" :disabled="locked" @click="remove">删除攻略</button>
 </view>
 <template v-else>
  <view class="row section"><text class="section-title">我的攻略</text><button class="primary small" :disabled="locked" @click="open()">＋ 添加攻略</button></view>
  <label for="guide-search" class="label">搜索攻略</label><input id="guide-search" v-model="search" class="field" maxlength="200" placeholder="输入地点或关键词"/>
  <view class="pill-row section"><button class="pill" :class="{active:category==='*'}" @click="category='*'">全部分类</button><button v-for="c in guideCategories" :key="c.id" class="pill" :class="{active:category===c.id}" @click="category=c.id">{{c.name}}</button></view>
  <view v-if="selected||(!showAll&&(date||item))" class="notice row wrap"><text>{{selected?'正在查看选中的攻略':'关联：'+scopeLabel}}</text><button class="text-button small" @click="reset">查看全部攻略</button></view>
  <view v-if="!filtered.length" class="card section empty"><view class="section-title">{{all.length?'没有匹配的攻略':'把值得看的内容留在这里'}}</view><view class="subtitle">{{all.length?'试试其他关键词，或查看全部攻略。':'添加一条笔记，也可以粘贴小红书的分享链接。'}}</view><button v-if="all.length" class="text-button section" @click="reset">清除筛选</button></view>
  <view v-for="g in filtered" :key="g.id" class="card section guide-card">
   <view class="row"><text class="guide-category">{{guideCategories.find(c=>c.id===g.category)?.name}}</text><button class="text-button small" :disabled="locked" :aria-label="'编辑'+g.title" @click="open(g)">编辑</button></view>
   <button class="section-title guide-title" :aria-expanded="expanded===g.id" @click="toggleDetails(g.id)">{{g.title}}</button>
   <view v-if="g.content" class="guide-content" :class="{'guide-preview':expanded!==g.id,'guide-open':expanded===g.id}">{{g.content}}</view>
   <view v-if="associations(g).length" class="association-tags"><text v-for="(label,index) in (expanded===g.id?associations(g):associations(g).slice(0,2))" :key="index">{{label}}</text><text v-if="expanded!==g.id&&associations(g).length>2">另 {{associations(g).length-2}} 个关联</text></view><view v-else class="subtitle section">整趟旅行通用 · 尚未关联日期或行程</view>
   <button class="text-button detail-toggle" :aria-expanded="expanded===g.id" @click="toggleDetails(g.id)">{{expanded===g.id?'收起':'查看要点'}}</button>
  </view>
 </template>
 <TripNav :id="id" :date="date" active="guides"/>
</view><view v-else class="screen"><view class="title">{{state.ready?'未找到这段旅行':'正在打开攻略…'}}</view><view v-if="state.error" class="notice error">{{state.error}}</view></view>
</template>
<style scoped>
.guide-intro{padding:20px;border-radius:20px;background:var(--surface-muted)}.guide-intro .subtitle,.empty .subtitle{margin-top:8px}.notes{min-height:180px;padding:12px}.share{min-height:100px;padding:12px}.association-list{max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:8px}.association{text-align:left;min-height:48px;padding:12px;background:var(--surface-muted);color:var(--ink-muted);font-size:14px;line-height:1.6;margin:0;white-space:normal}.association.chosen{color:var(--brand);background:#edf4ff}.guide-category{font-size:13px;color:var(--brand)}.guide-title{overflow-wrap:anywhere;margin-top:4px}.guide-content{white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.8;margin-top:12px}.association-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}.association-tags text{font-size:12px;line-height:1.6;padding:5px 10px;border-radius:8px;background:var(--surface-muted);color:var(--ink-muted);overflow-wrap:anywhere}.source-box{display:flex;flex-direction:column;align-items:flex-start;gap:12px;border-top:1px solid var(--line);padding-top:16px}.source-url{font-size:13px;color:var(--ink-muted);overflow-wrap:anywhere;max-width:100%}.source-original{padding-top:16px;border-top:1px solid var(--line)}.source-original .guide-content{font-size:13px;color:var(--ink-muted)}.delete{color:var(--danger);width:100%}.empty{text-align:center;padding:28px 20px}.guides-screen button{min-height:44px}.guide-card{overflow:hidden}
</style>
<style scoped>.guide-title{display:block;width:100%;text-align:left;padding:0;background:transparent;color:var(--ink);white-space:normal;line-height:1.5}.guide-preview{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;max-height:5.4em}.detail-toggle{margin:12px 0 0;padding:8px 0;text-align:left;min-width:80px}.guide-title::after{border:none}</style>
<style scoped src="../../styles/guides-ios.css"></style>
