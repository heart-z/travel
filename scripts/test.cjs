const fs=require('node:fs');const path=require('node:path');const {spawnSync}=require('node:child_process');const esbuild=require('esbuild');
require('./build-cloud.cjs');
const outputs=fs.readdirSync('tests').filter(f=>f.endsWith('.test.ts')).map(file=>{const outfile=path.join('.preview','tests',file.replace(/\.ts$/,'.cjs'));esbuild.buildSync({entryPoints:['tests/'+file],bundle:true,platform:'node',format:'cjs',outfile});return outfile;});
const result=spawnSync(process.execPath,['--test',...outputs],{stdio:'inherit'});process.exit(result.status??1);
