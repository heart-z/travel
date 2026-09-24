import path from 'node:path';
import {createApp} from './app.ts';
const app=await createApp({dbFile:process.env.XJ_DATABASE||path.join(import.meta.dirname,'../data/travel.sqlite'),port:Number(process.env.XJ_PORT||8788),host:process.env.XJ_HOST||'127.0.0.1',publicOrigin:process.env.XJ_ORIGIN||'http://127.0.0.1:5174',secureCookies:process.env.XJ_SECURE==='true',routes:{driving:process.env.XJ_OSRM_DRIVING,walking:process.env.XJ_OSRM_WALKING}});
console.log(`行间 API ${app.url}`);
process.on('SIGINT',()=>app.close().then(()=>process.exit()));process.on('SIGTERM',()=>app.close().then(()=>process.exit()));
