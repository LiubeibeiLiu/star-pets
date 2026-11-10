# 培养计划挑选页交接

## 代码归属

- 唯一界面源码：`ui/src/App.vue` 与 `ui/src/styles/pages.css`。Android WebView 和 iOS WebView 均从此目录构建；不要复制一份界面到 iOS 修改。
- 计划数据及校验：`ui/src/model.js`。目标与已添加计划的关联：`ui/src/goal-library.js`。
- 回归测试：`tests/model.test.mjs`。

## 用户路径

`习惯 → 培养计划 → 添加培养计划 → 挑选培养计划`。点卡片主体可启用或停用；已添加卡片右上角的编辑图标打开同一条计划的编辑表单。保存或点返回，都回到挑选页。计划列表原有的编辑入口仍回到列表。

## 数据约束

- `goalTemplates` 是目标库的自定义模板；`habits` 是小朋友实际添加、可修改的计划。修改已添加计划时，不应覆写模板，也不应新增第二条习惯。
- `habit.goalId` 保存内置目标或自定义模板的稳定 ID。查找时先按 `goalId`，再为旧数据中的无 `goalId` 计划按原名称匹配。旧计划在首次编辑或启停时补上 `goalId`；改名后仍按 ID 匹配。已添加卡片显示实际计划名称，搜索同时匹配模板名和实际名称。
- 旧数据允许缺少 `goalId`。不要把同名匹配用于已带 `goalId` 的计划；这会把改名计划错误关联到另一目标。
- 每个小朋友的计划按现有状态分开保存。预览数据位于 `work/preview/state.json`；界面测试后应恢复原始数据。

## 修改与验收

在 `work/star-pets-android` 执行：

```text
npm test
npm run typecheck
npm run build:web
npm run build:web:ios
```

在 `work/star-pets-ios` 执行 `python scripts/verify-delivery.py --update-web-manifest`，核对双端 Web 产物。手工验收采用 393×852 视口：添加目标 → 编辑名称、完成标准与提醒时间 → 保存 → 返回挑选页 → 确认仍是同一张已添加卡片，并验证返回键。浏览器验证不等于 Android/iOS 真机验收；通知与原生能力仍需分别在设备上测。
