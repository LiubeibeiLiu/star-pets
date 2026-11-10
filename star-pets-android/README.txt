星星宠物 Android 源码快照

本目录仅保留当前源码、设计资源、构建脚本与依赖锁定文件。node_modules 和 assets/web 已清理；本快照不包含可直接安装的 APK。历史构建与设备验证记录仅描述当时版本，不等于本快照已完成原生构建或真机验收。

完成范围
· 小窝以原画宠物为主体，右侧无文字互动按钮组，伙伴切换、改名、照料、加减分、录音、合照和聊天。
· 长期状态与点击关闭的宠物消息气泡；累计积分、当前净积分及前后等级形态预览。
· 习惯页上下两个卡片：培养计划、成长足迹。预设目标与自定义习惯合并；搜索筛选默认收起，默认全部类型记录，20条一页。
· 默认减分条款、正负规则搜索分页；宠物卡片入口右上角，锦鲤、小蛙优先，小龟后是熊猫；档案介绍与故事在形态展示之前。
· 中文/英文内置短回复，Android 内置 SenseVoice 本地语音识别，系统离线 TTS，实际音频能量驱动嘴部关节。
· DeepSeek / HTTPS兼容接口设置，Android Keystore 加密密钥，密钥不进入备份。Gemini连接停用。
· 关注度、习惯关注、亲昵程度；系统内置或AI可选动作编排，AI只能选择动作白名单，不能修改积分。
· 原画二维网格骨骼变形：头、嘴、眼、四肢、尾、翅膀；8种合照关节姿态。没有使用替代角色模型，原始图片文件未改动。

边界与未验收项
本源码快照未编译签名，尚未完成 Android 真机验收。麦克风、离线TTS声音、相机、生物识别、通知、低内存机型性能待验证。
当前检出的目录缺少 assets/voice、libs、jniLibs 等原生语音依赖；恢复这些依赖后才能尝试完整原生构建。设备仍需安装中文/英文离线系统声音；不内置通用大语言模型或神经TTS模型。
没有提供实际API Key，云端请求、真实回答与AI动作闭环未进行联网验收。
当前动画为二维原画蒙皮，不是完整三维角色，也不是音素级口型同步；90个原画绑定已通过权重测试，尚未逐个形态完成视觉验收。遮挡肢体、转身和复杂舞蹈需要额外分层原画或专用动作资源。

运行
Android 9（API28）或更高，需当前 Android System WebView。初始密码 Admin123。
数据保存在应用私有目录；开启云端聊天后，仅发送确认后的文字与有限状态/习惯上下文，不上传照片和原始录音。
浏览器预览需先 npm ci、npm run build:web，再启动预览服务；原生能力在浏览器中不可验收。

源码入口
ui/src/App.vue / style.css：页面与交互。
ui/src/model.js / companion.js：本地业务、短回复与动作约束。
ui/src/pet-skin.ts / LivePet.vue / PhotoEditor.vue：原画蒙皮、展示、合照。
ui/src/ChatPanel.vue / CompanionSettings.vue：对话与设置。
src/app/starpets/local/CompanionVoice.java / CompanionCloud.java：Android 本地语音与云端接口。
assets/web：由 npm run build:web 生成，源码快照中不包含；assets/voice、libs、jniLibs：当前检出目录中缺失，完整原生构建前须恢复。

检查与构建
npm ci
npm test
npm run typecheck
npm run build:web
npm run preview
设置 STAR_STORE_PASSWORD 后运行 build.ps1，指定 BuildTools、AndroidJar、SigningKey、Jdk。
build.ps1 不自动构建前端，请先执行 build:web。升级必须使用原签名密钥。
源码包不包含签名密钥、API Key、用户数据、node_modules、build中间文件。

证据
详见 docs/verification-v1.1.txt、docs/android-build-v1.1.txt、docs/voice-host-validation.json、docs/package-validation.json。
第三方依赖和来源见 licenses/、docs/voice-provenance.json。
