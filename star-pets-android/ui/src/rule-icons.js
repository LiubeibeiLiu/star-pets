// 规则图标映射（Microsoft Fluent Emoji 3D，MIT）：日常表现列表、记分抽屉历史、
// 成长足迹、回忆里的记分事件共用同一套，图标必须与列表里显示的完全一致。
// 优先级（与列表渲染顺序一致）：
//   1. 规则自带 icon（新建规则时用户在选择器里挑的，存在 state.rules 里）
//   2. 减分规则按 id 精确匹配 RULE_MINUS_3D
//   3. 按名称关键词 RULE_3D
//   4. 按名称语义落到分类图 RULE_CATEGORY_3D（与 App.vue 的 CATEGORY_3D_ICON 同一套图）
//   5. 无匹配 → ''，调用方回退线形图标。
// 注意：不要在任何一处另起一套关键词/分类猜测——之前「没有礼貌地回应家人」
// 被 `家人` 关键词命中扫帚，就是因为减分表没被优先查。
export const RULE_MINUS_3D = [
  ['rule-push', 'minus-stop-sign.png'],
  ['rule-break', 'minus-hammer.png'],
  ['rule-unkind', 'minus-anger.png'],
  ['rule-agreement', 'minus-scroll.png'],
  ['rule-danger', 'minus-warning.png'],
  ['rule-mess', 'minus-basket.png'],
  ['rule-lie', 'minus-zipper-mouth.png'],
  ['rule-shout', 'minus-megaphone.png'],
  ['rule-delay', 'minus-snail.png'],
  ['rule-screen', 'minus-mobile.png'],
  ['rule-waste', 'minus-wastebasket.png'],
  ['rule-rude', 'minus-rolling-eyes.png'],
  ['rule-homework', 'minus-notebook.png'],
  ['rule-bedtime', 'minus-bed.png'],
  ['rule-grab', 'minus-raised-hand.png'],
  ['rule-ignore', 'minus-see-no-evil.png'],
  // v2 新增减分规则（按 id 精确匹配，与列表/抽屉/历史/足迹共用）。
  ['rule-tantrum', 'pick-steam-face.png'],
  ['rule-wash', 'cat-selfcare-soap.png'],
  ['rule-latebed', 'pick-alarm.png'],
  ['rule-talkback', 'pick-angry-face.png'],
  ['rule-whine', 'pick-sad.png'],
];

export const RULE_3D = [
  [/书包/, 'bag-backpack.png'],
  [/阅读/, 'read-book.png'],
  [/作业/, 'homework-pencil.png'],
  [/家务|家人|餐桌/, 'help-broom.png'],
  [/玩具/, 'toys-teddy.png'],
  [/问好|问候/, 'greet-hand.png'],
  [/开心/, 'share-sparkles.png'],
  [/喝水/, 'water-cup.png'],
  [/睡觉/, 'sleep-moon.png'],
  [/刷牙/, 'brush-toothbrush.png'],
  [/友善|感谢/, 'thanks-hands.png'],
  [/勇敢|尝试/, 'sport-ball.png'],
  // v2 新增加分规则：顺序在末尾，不遮挡上面已有的条目（逐一核对过：
  // 新规则名都不含上面的关键词；减分规则走 id 表，不会落到这里）。
  [/穿衣/, 'pick-tshirt.png'],
  [/吃饭|挑食/, 'pick-apple.png'],
  [/运动|锻炼/, 'pick-shoe.png'],
  [/诚实/, 'pick-halo.png'],
  [/冷静/, 'pick-calm.png'],
  [/道歉/, 'pick-bow.png'],
  [/等待|排队/, 'pick-hourglass.png'],
  [/安全规则/, 'pick-shield.png'],
];

// 分类回退：规则本身没有分类字段，按名称语义映射到 5 个分类 3D 图；
// 顺序上学习、家庭、友善在前，日常自理兜底在后，避免“整理/准备”这类
// 多义表现落错分类。
export const RULE_CATEGORY_3D = [
  [/阅读|书|作业|学习|写字|专注|专心/, 'cat-study-books.png'],
  [/家务|家人|餐桌|帮忙|帮助/, 'cat-home-house.png'],
  [/友善|感谢|问好|问候|开心|分享|礼貌|倾听|讲话|回应/, 'cat-kind-heart.png'],
  [/运动|跑步|锻炼|身体|勇敢|尝试|坚持|困难/, 'cat-sport-runner.png'],
  [/刷牙|洗|穿衣|整理|收拾|准备|用品|睡觉|起床|喝水|吃饭/, 'cat-selfcare-soap.png'],
];

/** 返回规则对应的图标文件名（不含路径），无匹配返回 ''。 */
export function ruleIconFile(rule) {
  if (!rule) return '';
  if (rule.icon) return rule.icon;
  if (rule.points < 0 && rule.id) {
    const minus = RULE_MINUS_3D.find(([id]) => id === rule.id);
    if (minus) return minus[1];
  }
  const name = rule.name || '';
  const hit = RULE_3D.find(([re]) => re.test(name));
  if (hit) return hit[1];
  const cat = RULE_CATEGORY_3D.find(([re]) => re.test(name));
  return cat ? cat[1] : '';
}
