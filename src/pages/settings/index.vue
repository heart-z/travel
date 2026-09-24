<script setup lang="ts">
import {parseResourceSupplement,mergeResourceSupplement} from '../../services/resource-supplement';
import {switchBackend,openCached,changeToken} from '../../state';import {type BackendMode} from '../../services/backend';
declare const wx:any;
const token=ref('');
import {separateMapConfigured,saveMapToken} from '../../services/map-backend';
const mapToken=ref('');
function setMapToken(){saveMapToken(mapToken.value);mapToken.value='';notify('地图服务令牌已保存，返回行程即可使用');}
async function changeMode(mode:BackendMode){if(!await confirm('切换存储服务','请先导出备份。切换只更换数据来源，不自动搬运或删除任何数据；导入备份即可迁移。'))return;try{await switchBackend(mode);}catch(e){notify(e);}}
async function setToken(){try{await changeToken(token.value);token.value='';notify(state.error||'令牌已保存在本机');}catch(e){notify(e);}}
function downloadBackup(){try{const content=exportBackup(state.data),name='xingjian-'+today()+'.json';
// #ifdef H5
const link=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type:'application/json'}));link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
// #endif
// #ifdef MP-WEIXIN
const path=wx.env.USER_DATA_PATH+'/'+name;wx.getFileSystemManager().writeFile({filePath:path,data:content,encoding:'utf8',success:()=>wx.shareFileMessage({filePath:path,fileName:name}),fail:()=>notify('保存备份失败，可改用复制备份')});
// #endif
}catch(e){notify(e);}}
import {computed,ref} from 'vue';import {state,reload,notify,confirm,commit,saveTrip,go} from '../../state';import {exportBackup,parseBackup,mergeBackup} from '../../services/backup';import {updateTrip,createTrip} from '../../domain/trips';import {importItems} from '../../domain/itinerary';import {today} from '../../domain/dates';import StatusBanner from '../../components/StatusBanner.vue';
const backup=ref(''),showBackup=ref(false);const archived=computed(()=>state.data.trips.filter(t=>t.archived));
function exportData(){try{backup.value=exportBackup(state.data);showBackup.value=true;}catch(e){notify(e);}}
function copy(){uni.setClipboardData({data:backup.value,success:()=>notify('已复制备份，请保存为 JSON 文件')});}
function readBackupFile(){
// #ifdef H5
 const picker=document.createElement('input');picker.type='file';picker.accept='.json,application/json';picker.onchange=async()=>{const file=picker.files?.[0];if(!file)return;if(file.size>5*1024*1024){notify('备份文件不能超过5MB');return;}try{backup.value=await file.text();showBackup.value=true;notify('文件已读取，请确认导入');}catch{notify('文件读取失败');}};picker.click();
// #endif
// #ifdef MP-WEIXIN
 wx.chooseMessageFile({count:1,type:'file',extension:['json'],success:(r:any)=>{const file=r.tempFiles?.[0];if(!file)return;if(file.size>5*1024*1024){notify('备份文件不能超过5MB');return;}wx.getFileSystemManager().readFile({filePath:file.path,encoding:'utf8',success:(value:any)=>{backup.value=value.data;showBackup.value=true;notify('文件已读取，请确认导入');},fail:()=>notify('文件读取失败')});}});
// #endif
}
async function restore(){try{
 if(JSON.parse(backup.value)?.format==='xingjian-resources'){
  const pack=parseResourceSupplement(backup.value),next=mergeResourceSupplement(state.data,pack);
  const before=state.data.trips.find(t=>t.id===pack.tripId)!,after=next.trips.find(t=>t.id===pack.tripId)!;
  const incomingLocatedStays=new Set(pack.stays.filter(s=>s.place&&!before.stays?.some(old=>old.id===s.id)).map(s=>s.id));
  const count=(t:typeof before)=>(t.stays?.length||0)+(t.transports?.length||0)+(t.packing?.length||0)+(t.guides?.length||0)+t.items.filter(i=>i.place).length+(t.stays?.filter(s=>s.place&&!incomingLocatedStays.has(s.id)).length||0);
  const added=count(after)-count(before),total=pack.stays.length+pack.transports.length+(pack.packing?.length||0)+(pack.guides?.length||0)+(pack.locationBindings?.length||0);
  if(!await confirm('补充旅行资料',`「${before.title}」新增 ${added} 条，跳过 ${total-added} 条重复或日期冲突记录。已有行程、账本、清单状态和攻略保留。`))return;
  await commit(current=>{current.trips=mergeResourceSupplement(current,pack).trips;});notify('旅行资料已补充');return;
 }
 const incoming=parseBackup(backup.value);if(!await confirm('导入备份',`将合并 ${incoming.trips.length} 段旅行，相同编号的旅行保留当前版本，不会覆盖。`))return;await commit(current=>{current.trips=mergeBackup(current,incoming).trips;});notify('备份已导入');
}catch(e){notify(e);}}
async function archive(id:string,value:boolean){const t=state.data.trips.find(t=>t.id===id);if(!t||!await confirm(value?'归档旅行':'恢复旅行',value?'归档后从首页隐藏，数据仍会保留。':'将旅行恢复到首页。'))return;try{await saveTrip(updateTrip(t,{archived:value}));}catch(e){notify(e);}}
async function demo(){try{let t=createTrip({title:'贵阳，慢慢逛',city:'贵阳',startDate:today(),endDate:today(),budget:'2000',companion:'旅伴'});t=importItems(t,t.startDate,[{name:'甲秀楼'},{name:'青岩古镇'},{name:'贵阳北站'}],'demo');await saveTrip(t);go('itinerary',{id:t.id});}catch(e){notify(e);}}
</script>
<template><view class="screen"><text class="eyebrow">MY TRAVEL NOTEBOOK</text><view class="title">我的手账</view><view class="subtitle">旅行属于你，数据也是。</view><StatusBanner/>
<view class="card section"><view class="row"><text class="section-title">{{state.mode==='cloud'?'微信云端模式':state.mode==='selfhost'?'自托管模式':'本机模式'}}</text><text class="badge">{{state.data.trips.length}} 段旅行</text></view><view class="subtitle section">{{state.mode==='local'?'数据仅保存在当前设备或浏览器，清理缓存会丢失。请定期导出备份。':'数据保存在你选择的远程服务中，请定期导出备份。费用以你的账户套餐为准。'}}</view><button class="secondary small section" :disabled="state.busy" @click="reload">重新加载数据</button><button v-if="state.error&&state.mode!=='local'" class="text-button section" @click="openCached">断网时，查看上次账户缓存（只读）</button></view>
<view class="card section"><view class="section-title">存储服务，可自由切换</view><view class="pill-row section"><text class="pill" :class="{active:state.mode==='local'}" @click="changeMode('local')">本机</text><text class="pill" :class="{active:state.mode==='cloud'}" @click="changeMode('cloud')">微信云开发</text><text class="pill" :class="{active:state.mode==='selfhost'}" @click="changeMode('selfhost')">自己的服务器</text></view><view class="subtitle section">首次使用云端：切换到「微信云开发」，导入一次旅行备份。之后同一微信账号打开小程序会从云端加载，编辑后自动保存。自托管需先配置 HTTPS 地址。</view><text class="label">自托管个人访问令牌</text><input class="field" password v-model="token" placeholder="仅保存于本机，不写入项目代码"/><button class="text-button small section" :disabled="!token.trim()" @click="setToken">保存令牌</button></view>
<view v-if="separateMapConfigured()" class="card section"><view class="section-title">腾讯地图连接</view><view class="subtitle section">地点搜索与道路路线由地图服务提供，行程继续保存在当前存储中。</view><text class="label">地图服务访问令牌</text><input class="field" password v-model="mapToken" placeholder="填写服务访问令牌，不是腾讯地图 Key"/><button class="text-button small section" :disabled="!mapToken.trim()" @click="setMapToken">保存地图令牌</button></view><view class="card section"><view class="section-title">数据随时带走</view><view class="subtitle" style="margin-top:8px">包含旅行、行程、地点、住宿交通、行李衣物、攻略和账本的 JSON 备份，可迁移到其他后端。导入采用合并方式。</view><view class="notice">首次迁移：将 JSON 文件发到手机，先切换到微信云开发，再选择聊天里的文件并确认导入。同一微信账号后续会读取云端数据；本机模式与云端模式之间切换仍需手动迁移。相同编号的旅行会保留云端已有版本。</view><view class="actions"><button class="secondary small" :disabled="!state.ready" @click="exportData">导出完整备份</button><button class="secondary small" @click="showBackup=!showBackup">导入备份</button></view><view class="actions"><button class="text-button small" :disabled="!state.ready" @click="downloadBackup">保存备份文件 ↗</button><button class="secondary small" @click="readBackupFile">选择 JSON 文件</button></view><view v-if="showBackup"><textarea class="field field-text section backup" v-model="backup" maxlength="-1" placeholder="在这里粘贴 JSON 备份"/><view class="actions"><button class="small secondary" @click="copy">复制备份</button><button class="small primary" :disabled="state.busy||!state.ready||state.readOnly" @click="restore">确认导入</button></view></view></view>
<view class="section"><view class="section-title">管理旅行</view><view class="row notice" v-for="t in state.data.trips" :key="t.id"><text>{{t.title}}{{t.archived?' · 已归档':''}}</text><button class="text-button small" @click="archive(t.id,!t.archived)">{{t.archived?'恢复':'归档'}}</button></view></view>
<button class="text-button section" @click="demo">添加一段示例旅行</button><view class="footer-note">行间 0.1 · 认真计划，自在出发</view></view></template>
<style scoped>.backup{font:11px monospace;height:230px}</style>

