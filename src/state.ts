import { reactive } from 'vue';
import { clone, type AppData, type Trip } from './domain/types';
import { validateTrip } from './domain/trips';
import { LocalRepository, validateData, type Repository } from './services/repository';
import { backendMode,backendCall,setBackend,saveToken,type BackendMode } from './services/backend';
import {RemoteCache} from './services/cache';
import {mergeSharedTrips,type SharedTripRecord} from './domain/shared-trips';
import {listShared,saveShared} from './services/shared';
const local=new LocalRepository({get:key=>uni.getStorageSync(key),set:(key,value)=>uni.setStorageSync(key,value)});
const repository=():Repository=>backendMode()==='local'?local:{load:()=>backendCall<AppData>('load'),save:data=>backendCall<AppData>('save',{data})};
export const state=reactive({data:{version:0,trips:[]} as AppData,ready:false,busy:false,error:'',readOnly:false,mode:backendMode()});
let privateData:AppData={version:0,trips:[]};
let sharedTrips:SharedTripRecord[]=[];
export const sharedAccess=reactive<Record<string,SharedTripRecord>>({});
export const sharedStatus=reactive({error:''});
export function personalSnapshot(){return clone(privateData);}
function rebuild(){state.data=mergeSharedTrips(privateData,sharedTrips);for(const id of Object.keys(sharedAccess))delete sharedAccess[id];for(const record of sharedTrips)sharedAccess[record.trip.id]=record;}
export function canEditTrip(id:string){return !state.readOnly&&sharedAccess[id]?.role!=='viewer';}
function cache(mode=state.mode){return new RemoteCache({get:k=>uni.getStorageSync(k),set:(k,v)=>uni.setStorageSync(k,v)},mode+':'+(mode==='cloud'?import.meta.env.VITE_CLOUD_ENV:import.meta.env.VITE_API_URL));}
function remember(data:AppData){if(state.mode!=='local'){try{cache().remember(data);}catch{/* Successful remote persistence must not be reported as a failed save. */}}}
let loading:Promise<void>|undefined;
export async function initialize():Promise<void>{if(state.ready)return;if(loading)return loading;loading=(async()=>{try{const d=await repository().load();validateData(d);privateData=d;sharedTrips=[];sharedStatus.error='';rebuild();state.ready=true;state.readOnly=false;state.error='';remember(d);if(state.mode==='cloud')void refreshSharedTrips().catch(()=>{});}catch(e){state.error=message(e);}finally{loading=undefined;}})();return loading;}
export function openCached(){try{const d=cache().read();if(!d)throw new Error('当前服务没有已缓存的数据');privateData=d;sharedTrips=[];rebuild();state.ready=true;state.readOnly=true;state.error='当前查看上次成功连接账户的缓存，只读；重新连接后再编辑';}catch(e){notify(e);}}
export function hasCachedData(){try{return state.mode!=='local'&&Boolean(cache().read());}catch{return false;}}
export async function switchBackend(mode:BackendMode){if(state.busy)throw new Error('正在保存，请稍候');if(loading)await loading;setBackend(mode);state.mode=mode;privateData={version:0,trips:[]};sharedTrips=[];rebuild();state.ready=false;state.error='';await initialize();}
export async function reload(){state.ready=false;await initialize();}
let refreshingShared:Promise<void>|undefined;
export async function refreshSharedTrips(){if(state.mode!=='cloud'||!state.ready||state.busy)return;if(refreshingShared)return refreshingShared;refreshingShared=(async()=>{try{const records=await listShared();if(state.mode!=='cloud')return;const changed=records.length!==sharedTrips.length||records.some(record=>{const previous=sharedTrips.find(old=>old.shareId===record.shareId);return !previous||previous.version!==record.version||previous.role!==record.role||previous.pendingEdit!==record.pendingEdit;});sharedStatus.error='';if(changed){sharedTrips=records;rebuild();}}catch(e){if(state.mode==='cloud')sharedStatus.error=message(e);throw e;}})();try{await refreshingShared;}finally{refreshingShared=undefined;}}
export async function changeToken(token:string){
  if(state.busy)throw new Error('正在保存，请稍候');
  if(loading)await loading;
  cache('selfhost').clear();
  // Invalidate the previous identity before changing credentials. A failed login
  // must never leave old account data available for a write to the new account.
  if(state.mode==='selfhost'){privateData={version:0,trips:[]};sharedTrips=[];rebuild();state.ready=false;state.readOnly=false;state.error='';}
  saveToken(token);
  if(state.mode==='selfhost')await initialize();
}
export function message(e:unknown):string{return e instanceof Error?e.message:'操作失败，请重试';}
export function notify(e:unknown){uni.showToast({title:typeof e==='string'?e:message(e),icon:'none',duration:3000});}
export async function commit(change:(data:AppData)=>void):Promise<void>{await initialize();if(!state.ready||state.readOnly)throw new Error(state.error);if(state.busy)throw new Error('正在保存，请稍候');state.busy=true;try{const next=clone(privateData);change(next);validateData(next);privateData=await repository().save(next);rebuild();remember(privateData);}finally{state.busy=false;}}
export async function saveTrip(trip:Trip){validateTrip(trip);await initialize();if(state.mode==='cloud'){if(refreshingShared)await refreshingShared;if(sharedStatus.error)throw Error('共享状态未确认，请重新加载后再编辑');}const shared=sharedAccess[trip.id];if(shared){if(!canEditTrip(trip.id))throw Error('这趟旅行需要发起人批准编辑');if(state.busy)throw Error('正在保存，请稍候');state.busy=true;try{const updated=await saveShared(shared.shareId,shared.version,trip);sharedTrips=sharedTrips.map(record=>record.shareId===updated.shareId?updated:record);rebuild();}finally{state.busy=false;}return;}await commit(d=>{const index=d.trips.findIndex(t=>t.id===trip.id);if(index<0)d.trips.unshift(trip);else d.trips[index]=trip;});}
export function findTrip(id:string){return state.data.trips.find(t=>t.id===id);}
export function go(page:string,query:Record<string,string>={}){uni.navigateTo({url:`/pages/${page}/index?${Object.entries(query).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&')}`});}
export function confirm(title:string,content:string):Promise<boolean>{return new Promise(resolve=>uni.showModal({title,content,success:r=>resolve(r.confirm),fail:()=>resolve(false)}));}
