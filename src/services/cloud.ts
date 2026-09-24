declare const wx:any;
const env=import.meta.env.VITE_CLOUD_ENV?.trim();
export function cloudEnabled():boolean {return Boolean(env)&&typeof wx!=='undefined'&&Boolean(wx.cloud);}
let initialized=false;
const CLOUD_TIMEOUT_MS=20000;
function withDeadline<T>(request:Promise<T>,action:string):Promise<T>{
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error(action==='save'?'云端保存超时，结果尚未确认；请重新加载核对后再修改':'连接云端超时，请检查网络后重试')),CLOUD_TIMEOUT_MS);
  request.then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});
 });
}
export async function callCloud<T>(action:string,payload:Record<string,unknown>={}):Promise<T>{
  if(!cloudEnabled())throw new Error('尚未连接微信云环境，请先配置环境 ID');
  if(!initialized){wx.cloud.init({env,traceUser:false});initialized=true;}
  let response:any;
  try{response=await withDeadline<any>(wx.cloud.callFunction({name:'travel',data:{action,...payload}}),action);}
  catch(error){
   const detail=error instanceof Error?error.message:String(error);
   if(/-404005|exceed max poll retry/i.test(detail))throw new Error(action==='save'?'微信云端连接中断，保存结果尚未确认；请重新加载核对':'微信云端连接失败（-404005），请切换网络后重试');
   throw error;
  }
  if(!response.result?.ok)throw new Error(response.result?.error||'云端请求失败，请重试');return response.result.data as T;
}
