<script setup lang="ts">
import {computed,ref} from 'vue';
import {onLoad,onShow,onShareAppMessage} from '@dcloudio/uni-app';
import {state,sharedAccess,sharedStatus,initialize,switchBackend,refreshSharedTrips,findTrip,notify,go} from '../../state';
import {createInvite,peekInvite,joinInvite,sharedMembers,requestEdit,approveEdit,type InviteInfo,type InvitePreview,type SharedMember} from '../../services/shared';
declare const wx:any;

const id=ref(''),code=ref(''),name=ref(''),preview=ref<InvitePreview>(),invite=ref<InviteInfo>(),members=ref<SharedMember[]>([]),working=ref(false),error=ref('');
const trip=computed(()=>findTrip(id.value));
const access=computed(()=>sharedAccess[id.value]);
const isOwner=computed(()=>access.value?.role==='owner');

onLoad(async query=>{
 id.value=String(query?.id||'');code.value=String(query?.code||'');
 // #ifdef MP-WEIXIN
 wx.hideShareMenu();
 // #endif
 await initialize();
 if(code.value){try{preview.value=await peekInvite(code.value);}catch(e){error.value=e instanceof Error?e.message:'邀请无法打开';}}
 else if(id.value&&access.value?.role==='owner')await loadMembers();
});
onShow(()=>{if(id.value&&isOwner.value)void loadMembers();});
onShareAppMessage(()=>({title:`一起看看${trip.value?.title||invite.value?.title||'这趟旅行'}`,path:`/pages/share/index?code=${encodeURIComponent(invite.value?.code||'')}`}));
async function loadMembers(){if(!access.value||!isOwner.value)return;try{members.value=await sharedMembers(access.value.shareId);}catch(e){error.value=e instanceof Error?e.message:'成员列表加载失败';}}
async function makeInvite(){if(!trip.value)return;working.value=true;error.value='';try{if(state.mode!=='cloud')throw Error('请先在“我的”切换微信云开发，并迁移这趟旅行');await refreshSharedTrips();invite.value=await createInvite(trip.value.id);
 // #ifdef MP-WEIXIN
 wx.showShareMenu({withShareTicket:false});
 // #endif
 void refreshSharedTrips().then(loadMembers).catch(e=>{error.value=e instanceof Error?e.message:'成员列表加载失败';});}catch(e){error.value=e instanceof Error?e.message:'创建邀请失败';}finally{working.value=false;}}
async function join(){if(!preview.value||!name.value.trim())return;working.value=true;error.value='';try{if(state.mode!=='cloud')await switchBackend('cloud');await refreshSharedTrips();const joined=await joinInvite(code.value,name.value.trim());await refreshSharedTrips();uni.redirectTo({url:'/pages/itinerary/index?id='+encodeURIComponent(joined.trip.id)});}catch(e){error.value=e instanceof Error?e.message:'加入失败';}finally{working.value=false;}}
async function askToEdit(){if(!access.value)return;working.value=true;try{await requestEdit(access.value.shareId);await refreshSharedTrips();notify('已发送编辑申请');}catch(e){notify(e);}finally{working.value=false;}}
async function approve(member:SharedMember){if(!access.value)return;working.value=true;try{await approveEdit(access.value.shareId,member.memberId);await loadMembers();notify('已允许共同编辑');}catch(e){notify(e);}finally{working.value=false;}}
function openSettings(){uni.switchTab({url:'/pages/settings/index'});}
</script>
<template>
<view class="screen share-screen">
 <view v-if="code" class="share-intro"><text class="eyebrow">TRAVEL TOGETHER</text><view class="title">一起看这段旅程</view><view v-if="preview" class="share-feature"><view class="share-city">{{preview.city}}</view><view class="share-title">{{preview.title}}</view><view class="share-date">{{preview.startDate.slice(5)}} — {{preview.endDate.slice(5)}}</view></view><view class="share-copy">加入后可先查看行程。发起人批准后，你就能共同编辑；账本金额与预订编号不会向只读成员展示。</view><text class="label">怎么称呼你</text><input class="field" v-model="name" maxlength="30" placeholder="例如：小林"/><button class="primary share-main-action" :disabled="working||!preview||!name.trim()" @click="join">{{working?'正在加入…':'加入这趟旅行'}}</button><view v-if="state.mode!=='cloud'" class="share-tip">加入时会切换到微信云端；本机原有数据不会删除。</view></view>
 <view v-else-if="trip"><text class="eyebrow">TRAVEL TOGETHER</text><view class="title">分享这段旅程</view><view class="subtitle">{{trip.title}}</view><view v-if="state.mode!=='cloud'" class="notice">这趟旅行当前保存在本机。请先到“我的”切换微信云开发并导入这趟旅行，才能让朋友看到同一份行程。<button class="secondary small" @click="openSettings">前往我的</button></view><template v-else><view class="share-feature"><view class="share-city">{{trip.city}}</view><view class="share-title">{{trip.title}}</view><view class="share-date">{{trip.startDate.slice(5)}} — {{trip.endDate.slice(5)}}</view></view><template v-if="!access||isOwner"><view class="share-copy">朋友打开后先以只读身份加入；你可以在这里批准编辑申请。</view><button class="primary share-main-action" :disabled="working" @click="makeInvite">{{working?'正在准备…':invite?'重新生成邀请':'生成分享邀请'}}</button><button v-if="invite" class="secondary share-main-action" open-type="share">发给微信好友</button><view v-if="invite" class="share-tip">邀请在 7 天内有效；好友加入后会持续看到这趟旅行的新安排。</view><view v-if="isOwner" class="share-members"><view class="row"><view class="section-title">同行成员</view><button class="text-button small" @click="loadMembers">刷新申请</button></view><view v-for="member in members" :key="member.memberId" class="share-member"><view><view>{{member.name}}</view><text>{{member.role==='owner'?'发起人':member.role==='editor'?'可共同编辑':member.pendingEdit?'申请编辑中':'只读成员'}}</text></view><button v-if="member.pendingEdit&&member.role==='viewer'" class="secondary small" :disabled="working" @click="approve(member)">允许编辑</button></view></view></template><view v-else class="share-copy">{{access.role==='editor'?'你可以共同编辑这趟旅行。':'你目前可以查看行程，编辑需发起人批准。'}}</view><button v-if="access.role==='viewer'&&!access.pendingEdit" class="primary share-main-action" :disabled="working" @click="askToEdit">申请共同编辑</button><view v-if="access.role==='viewer'&&access.pendingEdit" class="share-tip">编辑申请已发送，等待发起人批准。</view></template></view>
 <view v-else class="empty">没有找到这趟旅行。请从收到的微信邀请重新打开。</view>
 <view v-if="error||sharedStatus.error" class="notice error">{{error||sharedStatus.error}}</view>
 <button v-if="trip" class="text-button share-return" @click="go('itinerary',{id})">返回行程</button>
</view>
</template>
<style scoped>.share-screen{padding-top:30px}.share-intro,.share-screen{max-width:600px}.share-feature{margin-top:26px;padding:26px 22px;border-radius:23px;background:linear-gradient(145deg,#294e5c,#2e706b);color:#fff}.share-city{font-size:12px;color:#d3e9e4}.share-title{margin-top:22px;font-size:25px;font-weight:650;line-height:1.35}.share-date{margin-top:10px;font-size:13px;color:#e7f4f1}.share-copy{margin:23px 2px 16px;color:#627286;font-size:14px;line-height:1.7}.share-main-action{width:100%;min-height:48px;margin-top:14px}.share-tip{margin-top:13px;color:#7d8b9d;font-size:12px;line-height:1.6}.share-members{margin-top:30px}.share-member{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:66px;padding:11px 3px;border-bottom:1px solid var(--line);font-size:15px}.share-member text{display:block;margin-top:4px;font-size:12px;color:#8391a3}.share-return{margin-top:24px}.share-screen .notice button{margin-top:12px}</style>
