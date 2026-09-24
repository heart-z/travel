import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {check} from '../shared/model.ts';
export const token=()=>randomBytes(32).toString('base64url');
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function passwordHash(password:string){check(typeof password==='string'&&password.length>=12&&password.length<=128,'密码需为 12 至 128 个字符');const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex')}
export function passwordMatches(password:string,hash:string){if(typeof password!=='string'||password.length>128)return false;const[salt,key]=hash.split(':');const actual=scryptSync(password,salt,64);return timingSafeEqual(actual,Buffer.from(key,'hex'))}
export const username=(value:string)=>{check(typeof value==='string'&&/^[\p{L}\p{N}_-]{2,32}$/u.test(value.trim()),'用户名需为 2 至 32 位文字、数字或下划线');return value.trim().toLowerCase()};
