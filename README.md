# 爆堡厨房

一款面向桌面浏览器与 iPhone/iPad 的快节奏汉堡制作游戏。现在采用 12 个固定关卡和 3 个章节：从煎肉与叠堡开始，逐步加入精确接饮料、批量炸薯条、顾客定制、库存补货、清洁压力、急客和多工位高峰。

每关按完成订单数过关，完成目标即可获得一星；完美套餐数量与零漏单、错单、浪费分别带来额外星级。关卡支持标准、热辣、主厨三档难度，以及四种会改变操作策略的开局能力。进行中的营业会自动保存，切换页面会暂停，刷新后可继续。

## 本地运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

推送到 GitHub 的 `main` 分支会由 `.github/workflows/deploy-pages.yml` 自动执行测试、构建并发布到 GitHub Pages。工作流使用公开 npm registry，不依赖本机的内网依赖源。

## 开通跨设备云存档

当前没有配置云端时，游戏会以游客模式运行，进度保存在浏览器本机，并可以从“主厨档案”下载 JSON 备份。要开启账号登录和跨设备同步：

1. 在 [Supabase](https://supabase.com) 创建项目。
2. 打开 SQL Editor，执行 [`supabase/schema.sql`](supabase/schema.sql)。
3. 在 GitHub 仓库的 Settings → Secrets and variables → Actions → Variables 中添加：`VITE_SUPABASE_URL` 和 `VITE_SUPABASE_PUBLISHABLE_KEY`。两者都是前端公开配置，不要使用 `service_role` 密钥。
4. 重新推送 `main`，或在 Actions 页面手动运行部署工作流。

Supabase Auth 默认需要邮箱确认。登录后，游戏会按账号同步关卡星级、成就、金币和进行中的营业；两台设备同时修改时会显示冲突选择，不会静默覆盖。

## iOS

用 Safari 打开部署后的 HTTPS 地址，选择“分享” -> “添加到主屏幕”。游戏会以独立 PWA 运行，进度保存在当前设备的浏览器存储中。
