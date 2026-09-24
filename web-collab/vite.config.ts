import {defineConfig} from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({root:'client',plugins:[vue()],server:{host:'127.0.0.1',port:5174,strictPort:true,proxy:{'/api':'http://127.0.0.1:8788'}},build:{outDir:'../dist',emptyOutDir:true}});
