# 行间旅行

基于 uni-app、Vue 3 和 TypeScript 的旅行规划小程序，同时支持 H5。仓库还包含一个独立的多人协作网页原型 `web-collab/`。

## 功能

- 按日期整理地点、事项、住宿与交通；地图和行程节点联动。
- 长按排序、跨天移动、逐段调整交通方式与耗时。
- 攻略与地点关联，物品清单、账本及 JSON 备份。
- 可选本机存储、微信云开发或自行部署的服务端。

## 运行小程序

需要 Node.js 和微信开发者工具。复制 `.env.example` 为 `.env.local`，按需填入自己的小程序 AppID 与云环境 ID。密钥只放服务端环境变量，不写入前端构建配置。

```sh
npm ci
npm run type-check
npm test
npm run dev:h5
```

构建微信版本：

```sh
npm run build:mp-weixin
```

在微信开发者工具中导入仓库根目录；`project.config.json` 指向构建产物 `dist/build/mp-weixin/`。首次使用默认本机存储。启用云同步需要自行部署 `cloudfunctions/travel/`，并配置数据库集合和访问权限。

## 多人协作网页

`web-collab/` 是独立原型，使用自己的依赖和数据库。运行方式见 [web-collab/README.md](web-collab/README.md)。

## 数据与配置

此公开仓库只包含程序源码、示例配置和测试。真实旅行记录、订单、个人备份、开发数据库、密钥及本地预览文件均未纳入版本控制。`.env.example` 和 `server/.env.example` 仅为占位模板。

本项目仍在开发中；地图路线、云服务和跨设备同步需按部署环境单独配置与验收。
