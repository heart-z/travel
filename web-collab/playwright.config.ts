import {defineConfig} from '@playwright/test';
process.env.NO_PROXY=[process.env.NO_PROXY,'localhost','127.0.0.1'].filter(Boolean).join(',');
process.env.no_proxy=process.env.NO_PROXY;
export default defineConfig({testDir:'tests/e2e',workers:1,use:{baseURL:'http://127.0.0.1:5190',headless:true,launchOptions:{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'},screenshot:'only-on-failure'},webServer:{command:'node --experimental-strip-types tests/e2e-server.ts',url:'http://127.0.0.1:5190/api/health',reuseExistingServer:false,timeout:20000}});
