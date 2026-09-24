const {createServer}=require('./app.cjs');
const tokens=JSON.parse(process.env.TRAVEL_API_TOKENS||'{}');
if(!Object.keys(tokens).length)throw Error('Configure TRAVEL_API_TOKENS before starting');
const server=createServer({dataDir:process.env.DATA_DIR||'./server/data',tokens,mapKey:process.env.TENCENT_MAP_KEY,mapSecret:process.env.TENCENT_MAP_SK,allowedOrigin:process.env.ALLOWED_ORIGIN});
server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('Travel API started. Put HTTPS reverse proxy in front before public use.'));
