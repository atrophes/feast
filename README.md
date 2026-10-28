# 爆堡厨房

一款面向桌面浏览器与 iPhone/iPad 的快节奏汉堡制作游戏。包括煎制火候、订单耐心、精确配方、连单倍率、逐日难度、配方解锁、自动存档和成就系统。

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

推送到 GitHub 的 `main` 分支后，`.github/workflows/deploy-pages.yml` 会自动构建并发布到 GitHub Pages。

## iOS

用 Safari 打开部署后的 HTTPS 地址，选择“分享” -> “添加到主屏幕”。游戏会以独立 PWA 运行，进度保存在当前设备的浏览器存储中。
