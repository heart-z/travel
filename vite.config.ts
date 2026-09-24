import { defineConfig, loadEnv } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
export default defineConfig(({mode}) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), 'VITE_'));
  return { plugins: [uni()], server: {host:'127.0.0.1',port:5173,strictPort:true} };
});
