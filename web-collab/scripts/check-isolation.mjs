import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const output=path.resolve(import.meta.dirname,'../docs/isolation-before.json');
const targets=['src','server','cloudfunctions','miniapp','tests','.preview/imports','package.json','package-lock.json','tsconfig.json','vite.config.ts','project.config.json','project.miniapp.json','project.private.config.json'];
async function files(p){try{const rows=await readdir(p,{withFileTypes:true});return (await Promise.all(rows.map(r=>r.isDirectory()?files(path.join(p,r.name)):[path.join(p,r.name)]))).flat()}catch(e){if(e.code==='ENOTDIR')return[p];if(e.code==='ENOENT')return[];throw e}}
const current={};for(const target of targets)for(const file of await files(path.join(root,target)))current[path.relative(root,file)]=createHash('sha256').update(await readFile(file)).digest('hex');
if(process.argv.includes('--record')){await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(current,null,2));console.log(`Baseline saved: ${Object.keys(current).length} files`)}else{const before=JSON.parse(await readFile(output,'utf8'));const changed=[...new Set([...Object.keys(before),...Object.keys(current)])].filter(k=>before[k]!==current[k]);if(changed.length){console.error('Changed protected paths:',changed);process.exitCode=1}else console.log(`Unchanged: ${Object.keys(current).length} protected files`)}
