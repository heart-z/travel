import {backendAvailable,backendCall} from './backend';
const mapUrl=import.meta.env.VITE_MAP_API_URL?.trim().replace(/\/$/,'')||'';
export function separateMapConfigured(){return Boolean(mapUrl);}
export function saveMapToken(token:string){uni.setStorageSync('xingjian-map-token',token.trim());}
export function mapAvailable(){return import.meta.env.VITE_MAP_ONLINE==='true'&&(Boolean(mapUrl)||backendAvailable());}
export async function mapCall<T>(action:'search'|'route',payload:Record<string,unknown>={}):Promise<T>{
 if(action!=='search'&&action!=='route')throw new Error('地图连接只支持地点查询和路线规划');
 if(import.meta.env.VITE_MAP_ONLINE!=='true')throw new Error('在线地图查询已关闭，请使用已有位置或手动选点');
 if(!mapUrl)return backendCall<T>(action,payload);
 if(!/^https:\/\/[^/@?#]+(?::\d+)?(?:\/[^?#]*)?$/.test(mapUrl)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/[^?#]*)?$/.test(mapUrl))throw new Error('地图服务必须使用 HTTPS');
 const token=uni.getStorageSync('xingjian-map-token');
 if(!token)throw new Error('请在“我的”中设置地图服务访问令牌');
 return new Promise((resolve,reject)=>uni.request({url:mapUrl+'/api',method:'POST',data:{...payload,action},header:{Authorization:'Bearer '+token,'Content-Type':'application/json'},timeout:20000,success:r=>{const result=r.data as any;if(r.statusCode!==200||!result?.ok)reject(new Error(result?.error||'地图服务请求失败'));else resolve(result.data);},fail:()=>reject(new Error('连接地图服务失败，请检查网络和服务配置'))}));
}
