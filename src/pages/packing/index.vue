<script setup lang="ts">
import TripNav from '../../components/TripNav.vue';
import WeatherCard from '../../components/WeatherCard.vue';
import {computed,reactive,ref} from 'vue';
import {onLoad} from '@dcloudio/uni-app';
import {findTrip,initialize,state,saveTrip,notify,confirm,message,canEditTrip} from '../../state';
import {clone,uid,type PackingItem,type PackingCategory} from '../../domain/types';
import {packingCategories,packingTemplates,savePacking,addPackingTemplate,clothingSuggestions,type PackingDraft} from '../../domain/packing';
import {dateRange} from '../../domain/dates';

const date=ref('');
const id=ref(''),editing=ref(false),error=ref(''),owner=ref('*'),onlyPending=ref(false),templateIndex=ref(-1);
const activeCategory=ref('*'),showTemplates=ref(false),washIndex=ref(0);
const search=ref(''),carry=ref('all'),showWeather=ref(false);
function chooseCategory(category:string){activeCategory.value=category;carry.value='all';search.value='';}
const ownerLabels=computed(()=>['所有人',...owners.value.map(m=>m.name)]);
const ownerValues=computed(()=>['*',...owners.value.map(m=>m.id)]);
const categoryStats=computed(()=>packingCategories.map(c=>{const items=all.value.filter(p=>p.category===c.id&&(owner.value==='*'||p.memberId===owner.value));return {...c,total:items.length,ready:items.filter(p=>p.packed).length};}));
const washOptions=['途中不洗','每2天换洗','每3天换洗','每4天换洗'];
const weatherDates=computed(()=>trip.value?dateRange(trip.value.startDate,trip.value.endDate):[]);
const weatherPlaces=computed(()=>trip.value?.items.filter(i=>i.date===date.value).flatMap(i=>i.place?[i.place]:[])||[]);
const tripDays=computed(()=>trip.value?dateRange(trip.value.startDate,trip.value.endDate).length:1);
const trip=computed(()=>findTrip(id.value));
const locked=computed(()=>state.busy||!canEditTrip(id.value)||!state.ready);
const all=computed(()=>trip.value?.packing||[]);
const packed=computed(()=>all.value.filter(p=>p.packed).length);
const percent=computed(()=>all.value.length?Math.round(packed.value/all.value.length*100):0);
const owners=computed(()=>[{id:'',name:'共用'},...(trip.value?.members||[])]);
const ownerName=(memberId:string)=>owners.value.find(m=>m.id===memberId)?.name||'共用';
const filtered=computed(()=>all.value.filter(p=>(owner.value==='*'||p.memberId===owner.value)&&(!onlyPending.value||!p.packed)&&(activeCategory.value==='*'||p.category===activeCategory.value)&&(carry.value==='all'||(p.carryMode||'pack')===carry.value)&&(!search.value.trim()||[p.name,p.note,ownerName(p.memberId)].join(' ').includes(search.value.trim()))));
const groups=computed(()=>packingCategories.map(c=>({...c,items:filtered.value.filter(p=>p.category===c.id)})).filter(c=>c.items.length));
const form=reactive<PackingItem>({id:'',name:'',category:'clothing',quantity:1,memberId:'',packed:false,note:'',carryMode:'pack'});
const quantity=ref('1');
const drafts=ref<(PackingDraft&{selected:boolean;quantityText:string})[]>([]);
const selectedDraftCount=computed(()=>drafts.value.filter(p=>p.selected).length);
function selectAllDrafts(selected:boolean){drafts.value.forEach(p=>{p.selected=selected;});}
const templateOwner=ref('');
const templateOwners=computed(()=>templateIndex.value===1?trip.value?.members||[]:owners.value);
onLoad(async q=>{id.value=q?.id||'';date.value=q?.date||'';await initialize();if(trip.value&&!dateRange(trip.value.startDate,trip.value.endDate).includes(date.value))date.value=trip.value.startDate;});
function open(entry?:PackingItem){if(locked.value)return;error.value='';templateIndex.value=-1;Object.assign(form,{carryMode:'pack'},entry?clone(entry):{id:'',name:'',category:activeCategory.value==='*'?'clothing':activeCategory.value as PackingCategory,quantity:1,memberId:owner.value==='*'?trip.value?.members[0].id||'':owner.value,packed:false,note:''});quantity.value=String(form.quantity);editing.value=true;uni.pageScrollTo({scrollTop:0,duration:200});}
async function save(){if(locked.value||!trip.value)return;error.value='';try{await saveTrip(savePacking(trip.value,{...form,id:form.id||uid(),quantity:Number(quantity.value)}));editing.value=false;notify('已保存物品');}catch(e){error.value=message(e);}}
async function toggle(entry:PackingItem){if(locked.value||!trip.value)return;try{await saveTrip(savePacking(trip.value,{...entry,packed:!entry.packed}));}catch(e){notify(e);}}
async function remove(){if(locked.value||!trip.value||!form.id)return;const entryId=form.id;if(!await confirm('删除这件物品？',form.name))return;if(locked.value||!trip.value)return;try{const next=clone(trip.value);next.packing=next.packing?.filter(p=>p.id!==entryId);next.revision++;await saveTrip(next);editing.value=false;}catch(e){error.value=message(e);}}
function refreshClothes(){if(!trip.value)return;const cycle=washIndex.value===0?tripDays.value:[0,2,3,4][washIndex.value];drafts.value=clothingSuggestions(trip.value,cycle,templateOwner.value).map(p=>({...p,selected:true,quantityText:String(p.quantity)}));}
function openTemplate(index:number){if(locked.value)return;editing.value=false;error.value='';templateIndex.value=index;templateOwner.value=index===1?(owner.value&&owner.value!=='*'?owner.value:trip.value?.members[0].id||''):(owner.value==='*'?'':owner.value);if(index===1)refreshClothes();else drafts.value=packingTemplates[index].items.map(p=>({...clone(p),selected:true,quantityText:String(p.quantity)}));uni.pageScrollTo({scrollTop:0,duration:200});}
async function applyTemplate(){if(locked.value||!trip.value)return;error.value='';try{const selected=drafts.value.filter(p=>p.selected);if(!selected.length)throw Error('请至少选择一件物品');const before=all.value.length;const next=addPackingTemplate(trip.value,selected.map(p=>({name:p.name,category:p.category,note:p.note,quantity:Number(p.quantityText),memberId:templateOwner.value,carryMode:p.carryMode||'pack'})));await saveTrip(next);templateIndex.value=-1;notify(`已加入${(next.packing?.length||0)-before}项，重复物品已跳过`);}catch(e){error.value=message(e);}}
</script>

<template>
<view v-if="trip" class="screen packing-screen">
 <view class="prep-header"><view><view class="title">出行准备</view><view class="subtitle">{{trip.title}}</view></view><button v-if="!editing&&templateIndex<0" class="add-circle" :disabled="locked" aria-label="添加物品" @click="open()">＋</button></view>
 <view v-if="!canEditTrip(id)" class="notice">行李清单仅向获准编辑的成员显示。</view>
 <view v-if="!editing&&templateIndex<0" class="compact-progress"><view class="row"><text>{{packed}} / {{all.length}} 项已准备</text><text>{{percent}}%</text></view><view class="progress-track"><view class="progress-fill" :style="{width:percent+'%'}"/></view></view>
 <view v-if="editing" class="card section">
  <view class="row"><view class="section-title">{{form.id?'编辑物品':'添加物品'}}</view><button class="text-button small" :disabled="state.busy" @click="editing=false">取消</button></view>
  <label for="packing-name" class="label">物品名称</label><input id="packing-name" class="field" v-model="form.name" :disabled="locked" maxlength="80" placeholder="例如：保暖外套"/>
  <view class="two-col"><view><text class="label">分类</text><picker :range="packingCategories.map(c=>c.name)" :value="packingCategories.findIndex(c=>c.id===form.category)" :disabled="locked" @change="form.category=packingCategories[Number($event.detail.value)].id"><view class="field field-text">{{packingCategories.find(c=>c.id===form.category)?.name}} ▾</view></picker></view>
  <view><label for="packing-quantity" class="label">数量 · 1–999</label><input id="packing-quantity" class="field" type="number" v-model="quantity" :disabled="locked" maxlength="3"/></view></view>
  <text class="label">谁来准备</text><picker :range="owners.map(m=>m.name)" :value="owners.findIndex(m=>m.id===form.memberId)" :disabled="locked" @change="form.memberId=owners[Number($event.detail.value)].id"><view class="field field-text">{{ownerName(form.memberId)}} ▾</view></picker>
  <text class="label">怎么携带</text><view class="pill-row"><button class="pill" :class="{active:form.carryMode!=='wear'}" :disabled="locked" @click="form.carryMode='pack'">装进行李</button><button v-if="form.category==='clothing'" class="pill" :class="{active:form.carryMode==='wear'}" :disabled="locked" @click="form.carryMode='wear'">出发时穿</button></view><label for="packing-note" class="label">备注（选填）</label><textarea id="packing-note" class="field packing-notes" v-model="form.note" :disabled="locked" maxlength="2000" placeholder="颜色、放在哪个包，或还需要准备什么"/>
  <view v-if="error" class="notice error">{{error}}</view>
  <button class="primary section" :disabled="locked" :loading="state.busy" @click="save">保存物品</button>
  <button v-if="form.id" class="text-button delete-button" :disabled="locked" @click="remove">删除这件物品</button>
 </view>

 <view v-else-if="templateIndex>=0" class="card section">
  <view class="row"><view class="section-title">{{packingTemplates[templateIndex].name}}</view><button class="text-button small" :disabled="state.busy" @click="templateIndex=-1">取消</button></view>
  <view class="notice">{{packingTemplates[templateIndex].description}} 可取消勾选或修改名称、数量后加入。</view>
  <view class="template-selection"><text>已选 {{selectedDraftCount}} / {{drafts.length}} 项</text><view><button :disabled="locked||selectedDraftCount===drafts.length" @click="selectAllDrafts(true)">全选</button><button :disabled="locked||selectedDraftCount===0" @click="selectAllDrafts(false)">取消全选</button></view></view>
  <text class="label">本次为谁准备</text><picker :range="templateOwners.map(m=>m.name)" :value="templateOwners.findIndex(m=>m.id===templateOwner)" :disabled="locked" @change="templateOwner=templateOwners[Number($event.detail.value)].id"><view class="field field-text">{{ownerName(templateOwner)}} ▾</view></picker>
  <view v-if="templateIndex===1" class="notice"><view>这趟 {{tripDays}} 天 · 每位成员分别准备</view><view class="pill-row section"><button v-for="(option,index) in washOptions" :key="option" class="pill" :class="{active:washIndex===index}" :disabled="locked" @click="washIndex=index">{{option}}</button></view><button class="text-button small" :disabled="locked" @click="refreshClothes">按此换洗周期重算建议</button><view>重算会重置下方未加入的编辑。数量含当天穿着，已拆成穿着和装包；不是实际天气预报。</view></view><view v-for="(draft,index) in drafts" :key="index" class="template-row">
   <button class="check-button" :class="{checked:draft.selected}" :disabled="locked" :aria-label="(draft.selected?'取消选择':'选择')+draft.name+(draft.carryMode==='wear'?'出发时穿':'装包')" @click="draft.selected=!draft.selected">{{draft.selected?'✓':'＋'}}</button>
   <view class="template-fields"><label :for="'draft-'+index" class="label">{{draft.carryMode==='wear'?'出发时穿':'装进行李'}}</label><input :id="'draft-'+index" class="field" v-model="draft.name" :disabled="locked||!draft.selected" maxlength="80"/></view>
   <view class="template-quantity"><label :for="'count-'+index" class="label">数量</label><input :id="'count-'+index" class="field" type="number" v-model="draft.quantityText" :disabled="locked||!draft.selected" maxlength="3"/></view>
  </view>
  <view v-if="error" class="notice error">{{error}}</view>
  <button class="primary section" :disabled="locked||selectedDraftCount===0" :loading="state.busy" @click="applyTemplate">加入选中物品（{{selectedDraftCount}}）</button>
  <view class="subtitle section">同分类、归属、名称和携带方式的物品会跳过，已有数量和收拾状态保留。</view>
 </view>

 <template v-else>
  <view class="prep-tools"><picker :range="ownerLabels" :value="ownerValues.indexOf(owner)" @change="owner=ownerValues[Number($event.detail.value)]"><view class="owner-control">{{ownerLabels[ownerValues.indexOf(owner)]}} ▾</view></picker><button class="pending-control" :class="{enabled:onlyPending}" @click="onlyPending=!onlyPending">{{onlyPending?'✓ 只看未准备':'只看未准备'}}</button></view>
  <view class="prep-search"><input v-model="search" maxlength="80" placeholder="搜索物品或备注" aria-label="搜索物品或备注"/><button v-if="search" @click="search=''" aria-label="清除搜索">×</button></view>
  <template v-if="activeCategory==='*'&&!search.trim()">
   <view class="list-caption">按分类整理</view><view class="category-list"><button v-for="(c,index) in categoryStats" :key="c.id" class="category-row" @click="chooseCategory(c.id)"><view class="category-symbol" :class="'symbol-'+c.id">{{['衣','证','洗','电','用','车'][index]}}</view><view class="category-copy"><view>{{c.name}}</view><text>{{c.total?c.ready+' / '+c.total+' 项已准备':'尚未添加物品'}}</text></view><text class="category-remaining">{{c.total-c.ready>0?(c.total-c.ready)+' 待准备':c.total?'已备齐':''}}</text><text class="chevron">›</text></button></view>
  </template>
  <template v-else>
   <view class="category-heading"><button @click="chooseCategory('*')">‹ 分类</button><text>{{activeCategory==='*'?'搜索结果':packingCategories.find(c=>c.id===activeCategory)?.name}}</text><text class="result-count">{{filtered.length}} 项</text></view>
   <view v-if="activeCategory==='clothing'" class="carry-segment"><button v-for="option in [{id:'all',name:'全部衣物'},{id:'pack',name:'装进行李'},{id:'wear',name:'出发时穿'}]" :key="option.id" :class="{selected:carry===option.id}" @click="carry=option.id">{{option.name}}</button></view>
   <view v-if="!filtered.length" class="packing-empty"><view>这里暂时没有物品</view><text class="subtitle">可以切换成员、筛选条件，或添加物品。</text></view>
   <view v-for="group in groups" :key="group.id" class="packing-group"><view v-if="activeCategory==='*'" class="list-caption">{{group.name}}</view><view class="packing-list"><view v-for="entry in group.items" :key="entry.id" class="packing-row" :class="{done:entry.packed}"><button class="item-check" :disabled="locked" :aria-label="(entry.packed?'标记未收拾：':'标记已收拾：')+entry.name+' '+ownerName(entry.memberId)+(entry.carryMode==='wear'?' 出发时穿':' 装包')" @click="toggle(entry)"><view class="check-circle" :class="{checked:entry.packed}">{{entry.packed?'✓':''}}</view></button><button class="item-detail" :disabled="locked" :aria-label="'编辑'+entry.name+' '+ownerName(entry.memberId)" @click="open(entry)"><view class="packing-content"><view class="packing-name">{{entry.name}}</view><view class="packing-meta">{{ownerName(entry.memberId)}} · {{entry.carryMode==='wear'?'出发时穿':'装进行李'}}{{entry.note?' · 有备注':''}}</view></view><text class="item-quantity">×{{entry.quantity}}</text><text class="chevron">›</text></button></view></view></view>
   <view class="detail-hint">点圆圈标记完成，点物品查看备注和修改。</view>
  </template>
  <view class="prep-extras"><button class="utility-row" @click="showTemplates=!showTemplates"><text>衣物建议与物品模板</text><text>{{showTemplates?'收起':'›'}}</text></button><view v-if="showTemplates" class="template-panel"><button v-for="(t,index) in packingTemplates" :key="t.id" class="template-choice" :disabled="locked" @click="openTemplate(index)"><text>{{index===1?'按天数与换洗准备衣物':t.name}}</text><text>＋</text></button></view><button class="utility-row" @click="showWeather=!showWeather"><text>天气与穿衣参考</text><text>{{showWeather?'收起':'›'}}</text></button><view v-if="showWeather" class="weather-panel"><picker :range="weatherDates" :value="weatherDates.indexOf(date)" @change="date=weatherDates[Number($event.detail.value)]"><view class="text-button small">{{date.slice(5)}} ▾</view></picker><WeatherCard :date="date" :places="weatherPlaces"/></view></view>

 </template>
<TripNav :id="id" :date="date" active="packing"/></view>
<view v-else class="screen"><view class="title">{{state.ready?'未找到这段旅行':'正在打开清单…'}}</view><view v-if="state.error" class="notice error">{{state.error}}</view></view>
</template>

<style scoped>
.category-filters{margin-bottom:16px}.packing-summary{background:linear-gradient(125deg,#e8f1ff,#f5f9ff);color:var(--ink);padding:18px;border-radius:20px}.summary-label{font-size:13px;opacity:.85}.summary-number{font-size:30px;font-family:inherit;line-height:1.4}.summary-number text{font-size:14px;font-family:inherit}.summary-percent{font-size:24px}.progress-track{height:6px;border-radius:8px;background:#dce8f7;margin:18px 0}.progress-fill{height:100%;border-radius:8px;background:var(--brand)}.summary-foot{font-size:13px;line-height:1.8}.packing-filters{margin:20px 0;display:flex;flex-direction:column;gap:12px;align-items:flex-start}.pending-filter{background:transparent;padding:10px 0;color:var(--ink-muted);font-size:13px}.pending-filter.enabled{color:var(--brand)}.packing-group{margin:28px 0}.group-heading{display:flex;flex-wrap:wrap;gap:6px;align-items:baseline;justify-content:space-between;margin-bottom:12px}.group-count{font-size:13px;color:var(--ink-muted);margin-left:12px}.packing-list{border:1px solid var(--line);border-radius:20px;overflow:hidden;background:var(--surface)}.packing-row{display:flex;align-items:center;gap:12px;padding:16px 12px;border-bottom:1px solid var(--line)}.packing-row:last-child{border-bottom:none}.check-button{flex-shrink:0;padding:0;width:48px;min-height:48px;background:var(--surface-muted);color:var(--brand);font-size:22px;border:1px solid var(--line);border-radius:14px}.check-button.checked{background:var(--brand);color:var(--on-brand)}.packing-content{flex:1;min-width:0}.packing-name{font-size:16px;font-weight:600;overflow-wrap:anywhere}.quantity{font-size:13px;margin-left:8px;color:var(--ink-muted);white-space:nowrap}.packing-meta,.packing-note{font-size:13px;color:var(--ink-muted);margin-top:4px;overflow-wrap:anywhere}.packing-note{white-space:pre-wrap}.done .packing-name{text-decoration:line-through;color:var(--ink-muted)}.packing-empty{background:var(--surface-muted);padding:32px 20px;text-align:center;border-radius:20px;line-height:2}.template-choice{display:flex;align-items:center;justify-content:space-between;text-align:left;margin-top:12px;padding:20px;background:var(--surface);border:1px solid var(--line);font-size:15px;font-weight:500;gap:12px}.template-choice .subtitle{margin-top:6px}.template-row{display:flex;align-items:flex-end;gap:8px;margin-top:12px}.template-fields{flex:1;min-width:0}.template-quantity{width:68px;flex-shrink:0}.template-row .label{margin-top:4px}.packing-notes{padding:12px;min-height:110px}.delete-button{color:var(--danger);width:100%;margin-top:12px}.packing-screen .two-col>view{min-width:0}
.template-selection{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0;color:var(--ink-muted);font-size:13px}.template-selection>view{display:flex;gap:4px}.template-selection button{min-height:44px;padding:8px;color:var(--brand);background:transparent;font-size:12px}.template-selection button[disabled]{opacity:.45}
</style>

<style scoped src="../../styles/packing-ios.css"></style>
