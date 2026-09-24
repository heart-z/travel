import {createApp} from '../server/app.ts';
const app=await createApp({dbFile:':memory:',port:5190});
app.service.createUser('alice','test-password-123');
console.log('E2E ready');process.on('SIGTERM',()=>app.close().then(()=>process.exit()));
