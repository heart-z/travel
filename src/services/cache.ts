import {validateData} from './repository';import type {AppData} from '../domain/types';
export class RemoteCache {
  constructor(private storage:{get:(key:string)=>string;set:(key:string,value:string)=>void},private scope:string){}
  remember(data:AppData){validateData(data);if(!data.accountId)return;this.storage.set(`xingjian-cache:${this.scope}:${data.accountId}`,JSON.stringify(data));this.storage.set(`xingjian-cache-account:${this.scope}`,data.accountId);}
  clear(){const key=`xingjian-cache-account:${this.scope}`,account=this.storage.get(key);this.storage.set(key,'');if(account)this.storage.set(`xingjian-cache:${this.scope}:${account}`,'');}
  read():AppData|undefined {const account=this.storage.get(`xingjian-cache-account:${this.scope}`);if(!account)return;const raw=this.storage.get(`xingjian-cache:${this.scope}:${account}`);if(!raw)return;const data=JSON.parse(raw);validateData(data);return data;}
}
