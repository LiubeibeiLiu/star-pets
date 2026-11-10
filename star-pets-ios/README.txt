界面开发

Android 和 iOS 共用同级 star-pets-android/ui 目录。修改组件、样式或资源时只编辑这份源码。
在 Mac 执行 bash scripts/build-web.sh，会从共享源码分别构建两端 Web 资源并校验一致性。
本目录是源码快照：StarPets/web 预编译资源、shared-ui 旧副本及依赖缓存均已清理。需要在 Mac 上从同级 star-pets-android/ui 源码重新生成 Web 资源。

星星宠物 iOS 原生源码与构建脚本

当前检出目录没有 StarPets.xcodeproj。下列原生编译步骤是历史交付说明；补齐 Xcode 工程文件并生成 StarPets/web 后才能执行。旧验证记录不代表本源码快照已通过原生编译。

先阅读 docs/Mac编译与安装说明.html 或同名.txt。
Mac终端：bash scripts/doctor.sh
模拟器：bash scripts/build-simulator.sh
SideStore未签名IPA：bash scripts/package-sidestore.sh
Personal Team：Xcode打开StarPets.xcodeproj，选择自己的Team与iPhone，Run。
也可双击 Mac编译助手.command。

共享前端源码仅保留在同级 star-pets-android/ui；重新构建 Web 资源需要 Node.js 和该 Android 源码目录。首次 SwiftPM 解析需要网络。
实际编译与设备验收状态见 docs/mac-validation.txt；资源一致不代表原生功能真机已通过。

2026-10-30 更新：1.1.1（2）已通过 Mac 真机架构 Release 与模拟器 Debug 编译；共享界面 51 项测试通过。iPhone 15 Pro/Pro Max 安全区域布局已做浏览器验证。用户已确认 SideStore 安装、启动与刷新成功；devicectl 已确认手机安装版本 1.1.1（2），标识 app.starpets.local.3YT2G4KWY6。

2026-10-30 追加：1.1.2（3）将照片、声音、文字回忆详情改为子界面，右上角返回，保留筛选、分页和滚动位置。类型检查、网页构建、Mac iphoneos Release 编译通过；浏览器照片/声音详情与筛选返回验证通过。1.1.1 的安装、启动、续期已由用户确认。1.1.2 传输时 iPhone 已断开 USB，尚未安装验证。
