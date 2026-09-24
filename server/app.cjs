const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createHandler,validateData}=require('../cloudfunctions/travel/handler.js');
const {requestMap}=require('../cloudfunctions/travel/tencent.js');
class FileStore{
  constructor(directory){this.directory=path.resolve(directory);fs.mkdirSync(this.directory,{recursive:true});}
  filename(owner){return path.join(this.directory,crypto.createHash('sha256').update(owner).digest('hex')+'.json');}
  read(owner){const file=this.filename(owner);if(!fs.existsSync(file))return {version:0,trips:[]};const data=JSON.parse(fs.readFileSync(file,'utf8'));validateData(data);return data;}
  async load(owner){return this.read(owner);}
  async save(owner,data){validateData(data);const current=this.read(owner);if(current.version!==data.version)throw Error('数据已更新，请刷新后重试');const next={version:data.version+1,trips:data.trips};const target=this.filename(owner),temp=target+'.tmp';// synchronous critical section, single Node process
    fs.writeFileSync(temp,JSON.stringify(next),{mode:0o600});fs.renameSync(temp,target);return next;}
}
function createServer({dataDir,tokens,mapKey,mapSecret,allowedOrigin=''}){
  if(!tokens||Object.entries(tokens).some(([token,owner])=>token.length<24||typeof owner!=='string'||!owner))throw Error('每个访问令牌至少 24 位，并映射到固定用户标识');
  const store=new FileStore(dataDir);const handler=createHandler({load:id=>store.load(id),save:(id,data)=>store.save(id,data),map:(p,q)=>requestMap(p,q,mapKey,mapSecret)});const rates=new Map();
  return http.createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    if(allowedOrigin&&req.headers.origin===allowedOrigin){res.setHeader('Access-Control-Allow-Origin',allowedOrigin);res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');}
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    const respond=(status,value)=>{res.writeHead(status);res.end(JSON.stringify(value));};
    if(req.url!=='/api'||req.method!=='POST')return respond(404,{ok:false,error:'Not found'});
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');const owner=Object.hasOwn(tokens,token)?tokens[token]:undefined;
    if(!owner)return respond(401,{ok:false,error:'访问令牌无效'});
    const now=Date.now();let rate=rates.get(owner);if(!rate||now-rate.start>60000){rate={start:now,count:0};rates.set(owner,rate);}if(++rate.count>90)return respond(429,{ok:false,error:'请求过于频繁，请稍候'});
    try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1000000)return respond(413,{ok:false,error:'数据过大'});chunks.push(chunk);}const data=await handler(JSON.parse(Buffer.concat(chunks).toString('utf8')),{OPENID:owner});respond(200,{ok:true,data});}catch(e){respond(400,{ok:false,error:e.message||'请求失败'});}
  });
}
module.exports={FileStore,createServer};

