import http from 'node:http';
import {importBackup} from './import.ts';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createService} from './service.ts';
import {digest} from './auth.ts';
import {AppError,check} from '../shared/model.ts';
import {safeObject} from '../shared/validation.ts';
import {road,weather} from './maps.ts';
export interface AppConfig{dbFile:string;port?:number;host?:string;publicOrigin?:string;secureCookies?:boolean;routes?:Record<string,string|undefined>;staticDir?:string}
export async function createApp(config:AppConfig){
 const service=createService(config.dbFile);let origin=config.publicOrigin||'';const streams=new Set<http.ServerResponse>();const rates=new Map<string,{start:number;n:number}>();
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  const json=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data))};
  try{
   const url=new URL(req.url||'/',origin),p=url.pathname,method=req.method||'GET';const cookie=req.headers.cookie?.match(/(?:^|;\s*)xingjian_session=([^;]*)/)?.[1]||'';const user=service.session(cookie);
   if(!p.startsWith('/api/')){if(method!=='GET')return json(404,{message:'不存在'});const root=path.resolve(config.staticDir||path.join(import.meta.dirname,'../dist'));const target=path.resolve(root,'.'+decodeURIComponent(p));check(target===root||target.startsWith(root+path.sep),'路径无效',404);const ext=path.extname(target);const file=ext?target:path.join(root,'index.html');try{const bytes=await readFile(file);const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(bytes)}catch{json(404,{message:'网页尚未构建，请使用开发预览'})}return}
   if(p==='/api/health')return json(200,{ok:true});
   const write=!['GET','HEAD'].includes(method);if(write)check(req.headers.origin===origin,'请求来源不匹配',403);
   const key=`${req.socket.remoteAddress}:${p==='/api/session'||p.includes('/invites/')?'auth':'api'}`;const now=Date.now();if(rates.size>10000)for(const[k,v]of rates)if(now-v.start>60000)rates.delete(k);let rate=rates.get(key);if(!rate||now-rate.start>=60000){rate={start:now,n:0};rates.set(key,rate)}check(++rate.n<=(key.endsWith('auth')?30:300),'操作过于频繁，请稍后',429);
   let body:any={};if(write&&method!=='DELETE'){check(req.headers['content-type']?.startsWith('application/json'),'仅接受 JSON');let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;check(size<=5*1024*1024,'资料超过 5MB',413);chunks.push(chunk)}try{body=JSON.parse(Buffer.concat(chunks).toString())}catch{throw new AppError('JSON 格式无效')}safeObject(body)}
   const setSession=(value:string)=>res.setHeader('Set-Cookie',`xingjian_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${value?604800:0}${config.secureCookies?'; Secure':''}`);
   if(p==='/api/session'&&method==='POST'){const result=service.login(body.username,body.password);setSession(result.token);return json(200,result.user)}
   if(p==='/api/invites/preview'&&method==='POST'){const inv=service.validInvite(body.token);const t=service.db.get('SELECT title FROM trips WHERE id=?',inv.trip_id);return json(200,{title:t.title,role:inv.role})}
   if(p==='/api/invites/accept'&&method==='POST'){const result=service.accept(body.token,body,user?.id);if(!user){const session=service.login(body.username,body.password);setSession(session.token)}service.events.emit(result.tripId);return json(201,result)}
   check(user,'请先登录',401);
   if(p==='/api/me')return json(200,user);
   if(p==='/api/session'&&method==='DELETE'){service.db.run('DELETE FROM sessions WHERE hash=?',digest(cookie));service.events.emit('sessions');setSession('');return json(200,{ok:true})}
   if(p==='/api/imports'&&method==='POST')return json(201,importBackup(service,user.id,body.backup,body.index,body.another===true));
   if(p==='/api/trips'&&method==='GET')return json(200,service.db.all('SELECT t.*,m.role FROM trips t JOIN memberships m ON m.trip_id=t.id WHERE m.user_id=? ORDER BY t.archived,t.start_date',user.id));
   if(p==='/api/trips'&&method==='POST')return json(201,service.createTrip(user.id,body));
   const match=p.match(/^\/api\/trips\/([\w-]+)(?:\/(.*))?$/);check(match,'接口不存在',404);const[,tripId,action='snapshot']=match;service.access(user.id,tripId);
   if(action==='snapshot'&&method==='GET')return json(200,service.snapshot(user.id,tripId));
   if(action==='commands'&&method==='POST')return json(200,service.command(user.id,tripId,body));
   if(action==='invites'&&method==='POST')return json(201,service.invite(user.id,tripId,body.role||'editor'));
   if(action==='invites'&&method==='GET'){service.access(user.id,tripId,'manage');return json(200,service.db.all('SELECT id,role,expires,used,revoked FROM invites WHERE trip_id=?',tripId))}
   if(action.startsWith('invites/')&&method==='DELETE'){service.access(user.id,tripId,'manage');service.db.run('UPDATE invites SET revoked=1 WHERE id=? AND trip_id=?',action.split('/')[1],tripId);return json(200,{ok:true})}
   if(action.startsWith('members/')){const target=action.split('/')[1];if(method==='DELETE'){service.removeMember(user.id,tripId,target);return json(200,{ok:true})}if(method==='PATCH'){service.access(user.id,tripId,'manage');check(['viewer','editor'].includes(body.role),'角色无效');service.db.transaction(()=>{const m=service.db.get('SELECT role FROM memberships WHERE trip_id=? AND user_id=?',tripId,target);check(m&&m.role!=='owner','不能改变拥有者角色');service.db.run('UPDATE memberships SET role=? WHERE trip_id=? AND user_id=?',body.role,tripId,target);service.record(tripId,'membership',[target])});service.events.emit(tripId);return json(200,{ok:true})}}
   if(action==='events'&&method==='GET'){
    res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(': connected\n\n');streams.add(res);let cursor=Number(url.searchParams.get('after')||0);if(!Number.isSafeInteger(cursor)||cursor<0)cursor=0;
    const send=()=>{if(res.destroyed)return;try{check(service.session(cookie),'登录已过期',401);service.access(user.id,tripId);const seq=service.db.get('SELECT seq FROM trips WHERE id=?',tripId).seq;if(cursor>seq||seq-cursor>1000){res.write(`event: reset\ndata: {}\n\n`);cursor=seq;return}for(const e of service.db.all('SELECT * FROM trip_events WHERE trip_id=? AND seq>? ORDER BY seq',tripId,cursor)){res.write(`id: ${e.seq}\ndata: ${JSON.stringify({seq:e.seq,kind:e.kind,ids:JSON.parse(e.ids)})}\n\n`);cursor=e.seq}}catch{res.write('event: revoked\ndata: {}\n\n');res.end()}};
    service.events.on(tripId,send);service.events.on('sessions',send);send();const timer=setInterval(()=>{send();if(!res.destroyed)res.write(': heartbeat\n\n')},15000);res.on('close',()=>{clearInterval(timer);streams.delete(res);service.events.off(tripId,send);service.events.off('sessions',send)});return;
   }
   if(action==='route'&&method==='POST'){const snap=service.snapshot(user.id,tripId),a=snap.entities.find(e=>e.id===body.from&&e.kind==='item'),b=snap.entities.find(e=>e.id===body.to&&e.kind==='item');check(a&&b,'路线两端须为本旅行事项');return json(200,await road(a.data.place,b.data.place,body.mode,config.routes||{}))}
   if(action==='weather'&&method==='GET'){const snap=service.snapshot(user.id,tripId),item=snap.entities.find(e=>e.id===url.searchParams.get('item')&&e.kind==='item');check(item?.data.place,'地点尚未定位');return json(200,await weather(item.data.place,url.searchParams.get('date')||'',snap.timeZone))}
   if(action==='export'&&method==='GET'){service.access(user.id,tripId,'write');return json(200,{format:'xingjian-web-backup',schema:1,exportedAt:new Date().toISOString(),trip:service.snapshot(user.id,tripId),legacyPayload:service.db.get('SELECT payload FROM legacy_payloads WHERE trip_id=?',tripId)?.payload})}
   return json(404,{message:'接口不存在'});
  }catch(e){if(res.headersSent){res.end();return}const err=e as AppError;json(err instanceof AppError?err.status:500,{message:err instanceof AppError?err.message:'服务暂不可用',current:err.current})}
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(config.port??8788,config.host||'127.0.0.1',resolve)});const address=server.address() as {port:number};const url=`http://${config.host||'127.0.0.1'}:${address.port}`;origin=config.publicOrigin||url;
 return{url,service,close:async()=>{for(const s of streams)s.end();await new Promise<void>((r)=>server.close(()=>r()));service.close()}};
}

