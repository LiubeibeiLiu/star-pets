# 星星宠物

Android 与 iOS 的源码快照。界面唯一源码位于 `star-pets-android/ui`；iOS 构建脚本从该目录生成两端网页资源。

## 本地检查

```sh
cd star-pets-android
npm ci
npm test
npm run typecheck
npm run build:web
```

本仓库不包含 `node_modules`、预编译网页资源、签名密钥或用户数据。当前快照也缺少 Android 原生语音依赖及 iOS `.xcodeproj`，因此不能直接完成原生安装包构建。两端更详细的说明见各自的 `README.txt`。
