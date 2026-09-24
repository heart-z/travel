import {createInterface} from 'node:readline/promises';
import {createService} from './service.ts';
import {passwordHash} from './auth.ts';
import path from 'node:path';
const s=createService(process.env.XJ_DATABASE||path.join(import.meta.dirname,'../data/travel.sqlite'));
const rl=createInterface({input:process.stdin,output:process.stdout});
try{
 const reset=process.argv.includes('--reset');
 if(!reset&&s.db.get('SELECT count(*) n FROM users').n)throw Error('工作区已有账号。添加同行人请使用邀请；重置使用 --reset。');
 const name=await rl.question(reset?'要重置的用户名：':'创建工作区拥有者用户名：');rl.close();
 process.stdout.write('密码（至少 12 字符，不回显）：');
 const password=await new Promise<string>((resolve,reject)=>{if(!process.stdin.isTTY)return reject(Error('请在交互终端运行，不通过参数传密码'));process.stdin.setRawMode(true);process.stdin.resume();let input='';const handler=(chunk:Buffer)=>{const v=chunk.toString();if(v==='\u0003'){cleanup();reject(Error('已取消'));return}if(v.includes('\r')||v.includes('\n')){cleanup();resolve(input);return}if(v==='\u007f'||v==='\b')input=input.slice(0,-1);else input+=v};function cleanup(){process.stdin.off('data',handler);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n')}process.stdin.on('data',handler)});
 if(reset){const user=s.db.get('SELECT id FROM users WHERE username=?',name.trim().toLowerCase());if(!user)throw Error('账号不存在');s.db.transaction(()=>{s.db.run('UPDATE users SET password_hash=? WHERE id=?',passwordHash(password),user.id);s.db.run('DELETE FROM sessions WHERE user_id=?',user.id)});console.log('密码已重置，旧登录已撤销。')}else{s.createUser(name,password);console.log('账号已创建。运行 npm run dev 后登录。')}
}catch(e){console.error((e as Error).message);process.exitCode=1}finally{rl.close();s.close()}
