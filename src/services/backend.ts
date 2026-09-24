import {callCloud,cloudEnabled} from './cloud';
export type BackendMode='local'|'cloud'|'selfhost';
const apiUrl=import.meta.env.VITE_API_URL?.trim().replace(/\/$/,'')||'';
export function backendMode():BackendMode {const saved=uni.getStorageSync('xingjian-provider');if(['local','cloud','selfhost'].includes(saved))return saved;return 'local';}
export function setBackend(mode:BackendMode){if(mode==='cloud'&&!cloudEnabled())throw new Error('云端模式请在已配置环境的微信小程序中使用');if(mode==='selfhost'&&!apiUrl)throw new Error('请先在构建配置中填写 VITE_API_URL');uni.setStorageSync('xingjian-provider',mode);}
export function backendAvailable():boolean {return backendMode()!=='local';}
export function tokenConfigured():boolean{return Boolean(uni.getStorageSync('xingjian-api-token'));}
export function saveToken(token:string){uni.setStorageSync('xingjian-api-token',token.trim());}
export async function backendCall<T>(action:string,payload:Record<string,unknown>={}):Promise<T>{
  const mode=backendMode();if(mode==='cloud')return callCloud<T>(action,payload);if(mode==='local')throw new Error('本地模式没有地图在线查询服务');
  if(!apiUrl.startsWith('https://')&&!/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(apiUrl))throw new Error('自托管后端必须使用 HTTPS');
  const token=uni.getStorageSync('xingjian-api-token');if(!token)throw new Error('请在“我的”中设置自托管访问令牌');
  return new Promise((resolve,reject)=>uni.request({url:apiUrl+'/api',method:'POST',data:{action,...payload},header:{Authorization:'Bearer '+token,'Content-Type':'application/json'},timeout:20000,success:r=>{const result=r.data as any;if(r.statusCode!==200||!result?.ok)reject(new Error(result?.error||'后端请求失败'));else resolve(result.data);},fail:()=>reject(new Error('连接后端失败，请检查网络和域名配置'))}));
}
