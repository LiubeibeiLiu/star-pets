<script setup lang="ts">
import { serialQueue } from './transactions.js';
import { settleLoginMaintenance } from './login-maintenance.js';
import { confirmClear } from './confirm';
import destinations from './destinations.json';
import {
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
  nextTick,
  defineAsyncComponent,
} from 'vue';
import Icon from './Icon.vue';
import Pager from './Pager.vue';
import AudioPlayer from './AudioPlayer.vue';
import BrandMark from './BrandMark.vue';
import TweenNumber from './TweenNumber.vue';
import SwipeRow from './SwipeRow.vue';
import UiDate from './UiDate.vue';
import Avatar from './Avatar.vue';
import EmptyState from './EmptyState.vue';
import GalleryImage from './GalleryImage.vue';
const LivePet = defineAsyncComponent(() => import('./LivePet.vue'));
import CompanionSettings from './CompanionSettings.vue';
import VoiceSettings from './VoiceSettings.vue';
import QuickScore from './QuickScore.vue';
import UiSelect from './UiSelect.vue';
import SearchField from './SearchField.vue';
import CatalogToolbar from './CatalogToolbar.vue';
import IntegerStepper from './IntegerStepper.vue';
import ChatPanel from './ChatPanel.vue';
import SettingsPage from './SettingsPage.vue';
import MemoriesGallery from './MemoriesGallery.vue';
import GrowthFootprints from './GrowthFootprints.vue';
import { preferences } from './companion.js';
import { NAV_TABS, TITLES, TOP_VIEWS } from './navigation';
import { usePreviewView } from './preview-view';
import { findHabitForGoal, goalDisplayName as displayGoalName } from './goal-library.js';
import {
  computeGoalLayout,
  GOAL_FALLBACK,
  GOAL_ROW_GAP,
} from './goal-layout.js';
import { ruleIconFile } from './rule-icons.js';
const Pet = defineAsyncComponent(() => import('./Pet.vue'));
const PhotoEditor = defineAsyncComponent(() => import('./PhotoEditor.vue'));
import { native, isNative, type PlatformStatus } from './platform';
import { migrateThemeState } from './theme-config.js';
import { useTheme } from './theme';
import { placePetSelfie } from './exploration-photo';
import { createFirstMeetingPhoto } from './adoption-photo';
import {
  initialState,
  apply,
  validate,
  catalog,
  activePet,
  totals,
  records,
  dayKey,
  habitDue,
  habitCount,
  isReversed,
  uid,
  hunger,
  memoryDisplayText,
  meetingWishParts,
  NAME_LIMITS,
} from './model.js';
import { levelOf, thresholds } from './catalog.js';
const confirmation = ref<{ text: string; action: () => void } | null>(null);
function ask(text: string, action: () => void) {
  confirmation.value = { text, action };
  void open('confirmAction');
}
function confirmAction() {
  const action = confirmation.value?.action;
  close();
  confirmation.value = null;
  action?.();
}
const canUndo = (e: any) =>
  ['plus', 'minus'].includes(e.kind) &&
  !isReversed(state.value, e.id) &&
  e.day?.slice(0, 7) === dayKey().slice(0, 7);
async function undoInline(e: any) {
  await run(async () => {
    await commit({
      type: 'reverse',
      id: e.id,
      reason: '本月记录纠错',
      targetPetId: current.value?.id,
    });
    notify(
      e.kind === 'plus' ? '已撤销加分并扣回对应经验' : '已撤销减分并恢复积分',
    );
  });
}
const dockOpen = ref(false),
  dateRange = ref('month');
const greeting = ref(''),
  headBubbles = ref<{ id: number; text: string }[]>([]);
const attentionDismissed = ref(false);
const liveFailed = ref(false);
let openedAt = Date.now();
const memoryInline = ref(false),
  memoryText = ref(''),
  todayOpen = ref(false);
const launchMessageIndex = Math.floor(Math.random() * 3);
function closeMemoryInline() {
  if (recording.value) {
    notify('请先停止录音');
    return false;
  }
  memoryInline.value = false;
  return true;
}
function toggleChat() {
  if (!closeMemoryInline()) return;
  todayOpen.value = false;
  closePhoto();
  renameOpen.value = false;
  chatOpen.value = !chatOpen.value;
}
const renameOpen = ref(false),
  renameText = ref(''),
  quickScore = ref<any>(),
  scoreReason = ref(''),
  profileDraft = ref<any>({}),
  newRule = ref({ name: '', points: 3, icon: '' }),
  newRuleError = computed(() => {
    const p = newRule.value.points as any;
    if (p === '' || p === null || !Number.isFinite(+p)) return '请填写分值';
    if (!Number.isInteger(+p)) return '分值需要是整数';
    if (+p === 0) return '分值不能为 0';
    if (Math.abs(+p) > 1000) return '分值范围是 -1000 到 1000';
    return '';
  }),
  // 选择器里已选图标的中文名（展示用）；没选时为空，走自动匹配。
  newRuleIconLabel = computed(() => {
    if (!newRule.value.icon) return '';
    for (const g of RULE_ICON_PICKER) {
      const hit = g.items.find((i) => i.file === newRule.value.icon);
      if (hit) return hit.label;
    }
    return '';
  }),
  avatarChoices = [
    ['⭐', 'star', '星星'],
    ['🌙', 'moon', '月亮'],
    ['🌈', 'rainbow', '彩虹'],
    ['🐱', 'cat', '小猫'],
    ['🐼', 'bear', '小熊'],
    ['🦋', 'butterfly', '蝴蝶'],
    ['🌻', 'flower', '小花'],
    ['🚀', 'rocket', '火箭'],
  ] as const;
function toggleRename() {
  if (!closeMemoryInline()) return;
  todayOpen.value = false;
  if (renameOpen.value) {
    renameOpen.value = false;
    return;
  }
  closePhoto();
  chatOpen.value = false;
  renameText.value = current.value.name;
  renameOpen.value = true;
}
async function saveRename() {
  if (!renameText.value.trim()) {
    notify('请输入伙伴名字');
    return;
  }
  if (renameText.value.trim().length > NAME_LIMITS.pet) {
    notify(`伙伴名字最多 ${NAME_LIMITS.pet} 个字`);
    return;
  }
  await run(async () => {
    await commit({
      type: 'rename',
      id: current.value.id,
      name: renameText.value.trim(),
    });
    renameOpen.value = false;
    notify('伙伴名字已更新');
  });
}
function cycleCompanion() {
  if (!closeMemoryInline()) return;
  if (state.value.pets.length < 2) {
    notify('还没有其他已领养伙伴');
    return;
  }
  const i = state.value.pets.findIndex((p: any) => p.id === current.value?.id);
  selectedPet.value = state.value.pets[(i + 1) % state.value.pets.length].id;
}
async function switchProfile(id: string, stay = false) {
  await run(async () => {
    await commit({ type: 'profileSwitch', id });
    selectedPet.value = '';
    galleryPage.value = 1;
    filter.value.page = 1;
    planPage.value = 1;
    detailId.value = '';
    restoreHomeForm();
    chatOpen.value = false;
    memoryInline.value = false;
    todayOpen.value = false;
    if (!stay) nav('home');
    notify('已切换到' + state.value.child);
  });
}
async function cycleChild() {
  if (profiles.value.length < 2) {
    notify('请先在设置里添加小朋友');
    return;
  }
  const i = profiles.value.findIndex(
    (p: any) => p.id === state.value.activeProfileId,
  );
  await switchProfile(profiles.value[(i + 1) % profiles.value.length].id);
}
function editProfile(p?: any) {
  profileDraft.value = p
    ? {
        id: p.id,
        name: p.name,
        avatar: p.avatar || '⭐',
        avatarFile: p.avatarFile || '',
        birthDate: p.birthDate || '',
        note: p.note || '',
      }
    : {
        id: '',
        name: '',
        avatar: '⭐',
        avatarFile: '',
        birthDate: '',
        note: '',
      };
  nav('childEdit');
}
async function saveProfile() {
  if (String(profileDraft.value.name ?? '').trim().length > NAME_LIMITS.child) {
    notify(`小朋友名字最多 ${NAME_LIMITS.child} 个字`);
    return;
  }
  await run(async () => {
    const d = profileDraft.value;
    await commit({ type: d.id ? 'profileUpdate' : 'profileAdd', ...d });
    nav('children');
    notify('小朋友资料已保存');
  });
}
async function deleteProfile() {
  const d = profileDraft.value;
  if (!d.id || profiles.value.length <= 1) return;
  if (
    !(await confirmClear(
      `要删除「${d.name}」的档案吗？应用内的积分、计划和回忆将无法恢复；设备相册中的照片不会受影响。`,
    ))
  )
    return;
  await run(async () => {
    await commit({ type: 'profileDelete', id: d.id });
    selectedPet.value = '';
    galleryPage.value = 1;
    filter.value.page = 1;
    planPage.value = 1;
    detailId.value = '';
    restoreHomeForm();
    nav('children');
    notify('已删除小朋友档案');
  });
}
async function pickProfileAvatar() {
  await run(async () => {
    const d = await native('pickPhoto');
    profileDraft.value.avatarFile = d.file;
  });
}
function addRule(sign: number) {
  newRule.value = { name: '', points: sign < 0 ? -3 : 3, icon: '' };
  void open('ruleAdd');
}
async function saveNewRule() {
  const name = newRule.value.name.trim();
  if (!name) {
    notify('请填写具体表现');
    return;
  }
  await run(async () => {
    const rule = {
      id: uid(),
      name,
      points: Number(newRule.value.points),
      ...(newRule.value.icon ? { icon: newRule.value.icon } : {}),
    };
    await commit({
      type: 'rules',
      rules: [...state.value.rules, rule],
    });
    close();
    await nextTick();
    quickScore.value?.showRule(rule);
    notify(`已添加到${newRule.value.points > 0 ? '加分' : '减分'}表现`);
  });
}
function removeRule(rule: any) {
  ask(
    '要删除常用表现「' + (rule.name || '未命名表现') + '」吗？删除后将不再出现在快捷选择中。',
    () =>
      void run(async () => {
        await commit({
          type: 'rules',
          rules: state.value.rules.filter((r: any) => r.id !== rule.id),
        });
        notify('常用表现已删除');
      }),
  );
}

async function goScore() {
  nav('habits');
  habitTab.value = 'score';
  await nextTick();
  quickScore.value?.openSearch?.();
}
// 足迹空态：去习惯页的计划 tab 完成今日计划；习惯页挂载时内容自带 rise 入场。
function goFootprintPlans() {
  habitTab.value = 'plans';
  nav('habits');
}
// 日常表现抽屉的最近记录：按表现名精确匹配最近 5 条加减分事件（新在前）。
// 注意不用 records() 的子串查询，避免别条表现的备注把记录串进来。
const scoreRuleHistory = computed(() => {
  const name = scoreReason.value.trim();
  if (!name) return [];
  return state.value.events
    .filter(
      (e: any) =>
        (e.kind === 'plus' || e.kind === 'minus') && e.reason === name,
    )
    .slice(-5)
    .reverse();
});
async function saveCustomScore(value: any) {
  await run(async () => {
    await commit({
      type: 'score',
      ...value,
      habitId: '',
      completion: '独立完成',
    });
    quickScore.value?.reset();
    notify('这次' + (value.points > 0 ? '加分' : '减分') + '已记下');
  });
}
let previewTimer: ReturnType<typeof setTimeout>;
const photoOpen = ref(false);
function restoreHomeForm() {
  clearTimeout(previewTimer);
  homeLevel.value = level.value;
}
function previewNextForm() {
  clearTimeout(previewTimer);
  homeLevel.value = homeLevel.value >= 10 ? 1 : homeLevel.value + 1;
  previewTimer = setTimeout(restoreHomeForm, 8000);
}
function closePhoto() {
  photoOpen.value = false;
  photoFile.value = '';
}
function togglePhoto() {
  if (!closeMemoryInline()) return;
  todayOpen.value = false;
  if (photoOpen.value) {
    closePhoto();
    return;
  }
  renameOpen.value = false;
  chatOpen.value = false;
  photoOpen.value = true;
  restoreHomeForm();
}
const selectedPet = ref(''),
  homeLevel = ref(1),
  chatOpen = ref(false),
  speech = ref<any>({}),
  chatAction = ref(''),
  memoryPetId = ref('');
const state = ref<any>(initialState()),
  auth = ref(false),
  status = ref<PlatformStatus>({
    authenticated: false,
    biometric: false,
    bioAvailable: false,
    version: '1.1.0',
    notifications: false,
  }),
  busy = ref(false),
  password = ref(''),
  showPassword = ref(false),
  loginShake = ref(false),
  unlockPop = ref(false),
  view = usePreviewView(isNative ? undefined : sessionStorage),
  detailId = ref(''),
  detailLevel = ref(1),
  toast = ref(''),
  emotion = ref(''),
  celebrate = ref(false),
  celebrateKey = ref(0),
  playing = ref(false),
  previewAll = ref(false),
  preview = ref<Record<string, boolean>>({}),
  modal = ref(''),
  dialog = ref<HTMLDialogElement>(),
  error = ref(''),
  form = ref<any>({}),
  recording = ref(false),
  recordFile = ref(''),
  recordSeconds = ref(0),
  photoFile = ref(''),
  photoPetId = ref(''),
  stagedBackup = ref<any>(null),
  stagedPet = ref<any>(null),
  filter = ref({
    query: '',
    kind: 'all',
    from: '',
    to: '',
    petId: '',
    page: 1,
    size: 6,
  }),
  refreshClock = ref(Date.now());
const footprintFiltering = computed(
  () =>
    filter.value.kind !== 'all' ||
    !!filter.value.query.trim() ||
    dateRange.value !== 'month',
);
const habitError = computed(() => {
  const f = form.value,
    int = (v: any, lo: number, hi: number) =>
      Number.isInteger(+v) && +v >= lo && +v <= hi && v !== '';
  if (!String(f.name || '').trim()) return '请填写习惯名称';
  if (!int(f.target, 1, 20)) return '次数需要是 1 到 20 的整数';
  if (f.frequency === 'interval' && !int(f.interval, 1, 365))
    return '间隔天数需要是 1 到 365 的整数';
  if (f.frequency === 'days' && !(f.days || []).length) return '请至少选择一天';
  if (!int(f.points, 1, 1000)) return '奖励分数需要是 1 到 1000 的整数';
  if (f.start && f.end && f.end < f.start) return '结束日期不能早于开始日期';
  if (
    String(f.timeText || '')
      .split(/[,，\s]+/)
      .filter(Boolean)
      .some((t) => !/^([01]?\d|2[0-3]):[0-5]\d$/.test(t))
  )
    return '执行时间格式示例：07:30,19:00';
  return '';
});
function clearFootprintFilter() {
  Object.assign(filter.value, { query: '', kind: 'all', from: '', to: '', page: 1 });
  dateRange.value = 'month';
}
const habitMode = ref<'list' | 'habitEdit'>('list');
const habitEditReturn = ref<'list'>('list');
const memoryTab = ref<'gallery' | 'footprints'>('gallery');
const storedHabitTab = !isNative
  ? sessionStorage.getItem('star-pets-habit-tab')
  : null;
const habitTab = ref<'score' | 'plans'>(
  storedHabitTab === 'score' ? 'score' : 'plans',
);
watch(habitTab, (tab) => {
  if (!isNative) sessionStorage.setItem('star-pets-habit-tab', tab);
});
const planPage = ref(1),
  planQuery = ref(''),
  habitSubmitted = ref(false),
  filteredPlans = computed(() =>
    state.value.habits.filter((h: any) =>
      (h.name + ' ' + h.category + ' ' + (h.criteria || ''))
        .toLocaleLowerCase()
        .includes(planQuery.value.trim().toLocaleLowerCase()),
    ),
  ),
  planPages = computed(() =>
    Math.max(1, Math.ceil(filteredPlans.value.length / 4)),
  ),
  visiblePlans = computed(() =>
    filteredPlans.value.slice((planPage.value - 1) * 4, planPage.value * 4),
  );
const builtInGoals = [
  {
    id: 'builtin-brush',
    name: '自己刷牙',
    icon: 'heart',
    category: '日常自理',
    hint: '照顾好自己',
  },
  {
    id: 'builtin-bag',
    name: '整理书包',
    icon: 'habit',
    category: '日常自理',
    hint: '为明天做准备',
  },
  {
    id: 'builtin-read',
    name: '阅读15分钟',
    icon: 'history',
    category: '学习阅读',
    hint: '发现新世界',
  },
  {
    id: 'builtin-help',
    name: '帮助做家务',
    icon: 'home',
    category: '家庭责任',
    hint: '我是家庭小帮手',
  },
  {
    id: 'builtin-sport',
    name: '运动20分钟',
    icon: 'play',
    category: '运动健康',
    hint: '让身体动起来',
  },
  {
    id: 'builtin-thanks',
    name: '主动表达感谢',
    icon: 'star',
    category: '友善表达',
    hint: '传递一点温暖',
  },
  {
    id: 'builtin-water',
    name: '主动喝水',
    icon: 'heart',
    category: '运动健康',
    hint: '照顾身体的小信号',
  },
  {
    id: 'builtin-sleep',
    name: '按时准备睡觉',
    icon: 'moon',
    category: '日常自理',
    hint: '给明天补充能量',
  },
  {
    id: 'builtin-greet',
    name: '主动问好',
    icon: 'sun',
    category: '友善表达',
    hint: '让温暖从问候开始',
  },
  {
    id: 'builtin-homework',
    name: '独立完成作业',
    icon: 'habit',
    category: '学习阅读',
    hint: '专心完成今天的任务',
  },
  {
    id: 'builtin-toys',
    name: '收好玩具',
    icon: 'home',
    category: '家庭责任',
    hint: '让空间恢复整洁',
  },
  {
    id: 'builtin-share',
    name: '分享一件开心事',
    icon: 'sparkles',
    category: '友善表达',
    hint: '把快乐说给家人听',
  },
];
// 分类配色：五个分类各取一个柔和色相，未知分类默认 cat-1（只换颜色，不动布局）。
const CATEGORY_HUES: Record<string, string> = {
  '日常自理': 'cat-1',
  '学习阅读': 'cat-5',
  '家庭责任': 'cat-2',
  '运动健康': 'cat-4',
  '友善表达': 'cat-3',
};
function categoryHue(category: string): string {
  return CATEGORY_HUES[category] || 'cat-1';
}
// 图鉴卡 / 详情页配色：按宠物 id 散列取五个分类色之一，只换颜色，不动布局。
const PET_HUES = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5'];
function petHue(p: any): string {
  const id = String(p?.id || '');
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return PET_HUES[h % PET_HUES.length];
}
// 3D 图标（Microsoft Fluent Emoji，MIT 协议）：按目标模板 id 取计划图标，
// 自定义模板按分类取图标；找不到时回退到线形图标。
const ICON_3D = import.meta.glob('./assets/icons-3d/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const icon3d = (file: string) => (file ? ICON_3D[`./assets/icons-3d/${file}`] || '' : '');
const GOAL_3D_ICON: Record<string, string> = {
  'builtin-brush': 'brush-toothbrush.png',
  'builtin-bag': 'bag-backpack.png',
  'builtin-read': 'read-book.png',
  'builtin-help': 'help-broom.png',
  'builtin-sport': 'pick-shoe.png',
  'builtin-thanks': 'pick-heart-hands.png',
  'builtin-water': 'water-cup.png',
  'builtin-sleep': 'sleep-moon.png',
  'builtin-greet': 'greet-hand.png',
  'builtin-homework': 'homework-pencil.png',
  'builtin-toys': 'toys-teddy.png',
  'builtin-share': 'pick-gift.png',
};
const CATEGORY_3D_ICON: Record<string, string> = {
  '日常自理': 'cat-selfcare-soap.png',
  '学习阅读': 'cat-study-books.png',
  '家庭责任': 'cat-home-house.png',
  '运动健康': 'cat-sport-runner.png',
  '友善表达': 'cat-kind-heart.png',
};
const CATEGORY_LINE_ICON: Record<string, string> = {
  '日常自理': 'heart',
  '学习阅读': 'habit',
  '家庭责任': 'home',
  '运动健康': 'play',
  '友善表达': 'star',
};
function planIcon3d(h: any): string {
  return icon3d(GOAL_3D_ICON[h.goalId] || CATEGORY_3D_ICON[h.category] || '');
}
// 目标库卡片复用同一套映射：按目标模板 id 取计划图标，自定义模板按分类取。
function goalIcon3d(g: any): string {
  return icon3d(GOAL_3D_ICON[g.id] || CATEGORY_3D_ICON[g.category] || '');
}
// 记分事件图标：与日常表现列表走同一套映射（rule-icons.js），不另起关键词猜测。
// 计划完成类事件（带 habitId）取计划图标；撤销类取被撤销原事件的图标；
// 规则已被删除、计划已被删除的孤儿事件不猜图标，返回 ''，调用方保留原来的
// 星星/减号，避免再出现“没有礼貌地回应家人”被关键词命中扫帚的情况。
function eventIcon3d(e: any): string {
  if (!e) return '';
  if (e.kind === 'reverse' && e.ref) {
    const orig = state.value.events.find((x: any) => x.id === e.ref);
    return orig ? eventIcon3d(orig) : '';
  }
  if (e.habitId) {
    const h = state.value.habits.find((x: any) => x.id === e.habitId);
    if (h) return planIcon3d(h);
  }
  const sign = e.kind === 'minus' ? -1 : 1;
  const rule = state.value.rules.find(
    (r: any) => r.name === e.reason && Math.sign(r.points) === sign,
  );
  return rule ? icon3d(ruleIconFile(rule)) : '';
}
// 习惯来源的文字回忆（计划完成时记下的）：用该计划的图标，不用通用备忘录图。
function memoryNoteIcon3d(m: any): string {
  if (m.source === 'habit' && m.habitId) {
    const h = state.value.habits.find((x: any) => x.id === m.habitId);
    if (h) return planIcon3d(h);
  }
  return icon3d('memory-memo.png');
}
function memoryWish(m: any) {
  return meetingWishParts(memoryDisplayText(m));
}
// 新建日常表现的图标选择器：扩充后的图库（109 张）按类分组；不选则保存时
// 按表现名自动匹配（规则映射表）。分组只影响选择器里的排布，不影响映射。
const RULE_ICON_PICKER: { label: string; items: { file: string; label: string }[] }[] = [
  { label: '情绪表情', items: [
    { file: 'pick-smile.png', label: '开心大笑' },
    { file: 'pick-happy.png', label: '愉快微笑' },
    { file: 'pick-hug.png', label: '拥抱安慰' },
    { file: 'pick-think.png', label: '思考' },
    { file: 'pick-excited.png', label: '兴奋期待' },
    { file: 'pick-calm.png', label: '平静放松' },
    { file: 'pick-pleading.png', label: '委屈请求' },
    { file: 'pick-sad.png', label: '难过' },
    { file: 'pick-halo.png', label: '诚实乖巧' },
    { file: 'pick-steam-face.png', label: '发脾气' },
    { file: 'pick-angry-face.png', label: '生气顶嘴' },
  ] },
  { label: '日常习惯', items: [
    { file: 'pick-apple.png', label: '吃苹果' },
    { file: 'pick-milk.png', label: '喝牛奶' },
    { file: 'pick-plate.png', label: '好好吃饭' },
    { file: 'pick-shower.png', label: '洗澡' },
    { file: 'pick-sponge.png', label: '擦洗打扫' },
    { file: 'pick-tshirt.png', label: '自己穿衣' },
    { file: 'pick-shoe.png', label: '运动跑步' },
    { file: 'pick-basketball.png', label: '打篮球' },
    { file: 'pick-bike.png', label: '骑车' },
    { file: 'pick-alarm.png', label: '守时起床' },
    { file: 'pick-hourglass.png', label: '等待耐心' },
    { file: 'pick-bell.png', label: '提醒' },
  ] },
  { label: '学习专注', items: [
    { file: 'pick-palette.png', label: '画画' },
    { file: 'pick-music.png', label: '唱歌音乐' },
    { file: 'pick-scissors.png', label: '手工剪纸' },
    { file: 'pick-puzzle.png', label: '拼图专注' },
    { file: 'pick-brain.png', label: '动脑思考' },
    { file: 'pick-eyes.png', label: '认真看' },
    { file: 'pick-ear.png', label: '认真倾听' },
    { file: 'pick-speaking.png', label: '大胆表达' },
  ] },
  { label: '交往品格', items: [
    { file: 'pick-gift.png', label: '分享礼物' },
    { file: 'pick-handshake.png', label: '合作和好' },
    { file: 'pick-bow.png', label: '鞠躬道谢' },
    { file: 'pick-muscle.png', label: '勇敢坚持' },
    { file: 'pick-heart-hands.png', label: '关爱' },
    { file: 'pick-seedling.png', label: '爱护植物' },
    { file: 'pick-rainbow.png', label: '彩虹' },
    { file: 'pick-sun.png', label: '晴天早起' },
    { file: 'pick-key.png', label: '保管物品' },
    { file: 'pick-moneybag.png', label: '存钱节约' },
    { file: 'pick-shield.png', label: '遵守安全' },
  ] },
  { label: '动物食物', items: [
    { file: 'pick-dog.png', label: '小狗' },
    { file: 'pick-cat.png', label: '小猫' },
    { file: 'pick-rabbit.png', label: '小兔子' },
    { file: 'pick-lion.png', label: '狮子勇敢' },
    { file: 'pick-turtle.png', label: '乌龟耐心' },
    { file: 'pick-butterfly.png', label: '蝴蝶' },
    { file: 'pick-strawberry.png', label: '草莓' },
    { file: 'pick-cookie.png', label: '饼干分享' },
    { file: 'pick-carrot.png', label: '吃胡萝卜' },
    { file: 'pick-droplet.png', label: '喝水节约' },
  ] },
  { label: '加分常用', items: [
    { file: 'brush-toothbrush.png', label: '刷牙' },
    { file: 'bag-backpack.png', label: '整理书包' },
    { file: 'read-book.png', label: '阅读' },
    { file: 'help-broom.png', label: '做家务' },
    { file: 'sport-ball.png', label: '运动' },
    { file: 'thanks-hands.png', label: '感谢' },
    { file: 'water-cup.png', label: '喝水' },
    { file: 'sleep-moon.png', label: '睡觉' },
    { file: 'greet-hand.png', label: '问好' },
    { file: 'homework-pencil.png', label: '写作业' },
    { file: 'toys-teddy.png', label: '玩具' },
    { file: 'share-sparkles.png', label: '分享' },
  ] },
  { label: '减分常用', items: [
    { file: 'minus-stop-sign.png', label: '推搡制止' },
    { file: 'minus-hammer.png', label: '损坏' },
    { file: 'minus-anger.png', label: '伤人的话' },
    { file: 'minus-scroll.png', label: '违反约定' },
    { file: 'minus-warning.png', label: '危险行为' },
    { file: 'minus-basket.png', label: '拒绝收拾' },
    { file: 'minus-zipper-mouth.png', label: '隐瞒说谎' },
    { file: 'minus-megaphone.png', label: '打断讲话' },
    { file: 'minus-snail.png', label: '拖延' },
    { file: 'minus-mobile.png', label: '超时用电子设备' },
    { file: 'minus-wastebasket.png', label: '浪费' },
    { file: 'minus-rolling-eyes.png', label: '没礼貌回应' },
    { file: 'minus-notebook.png', label: '拒绝写作业' },
    { file: 'minus-bed.png', label: '不准备睡觉' },
    { file: 'minus-raised-hand.png', label: '拿走他人物品' },
    { file: 'minus-see-no-evil.png', label: '无视安全提醒' },
    // 新减分规则的图标：不洗手（肥皂）。赖床（闹钟）在“日常习惯”组、
    // 哭闹（难过脸）在“情绪表情”组已可挑，不重复放。
    { file: 'cat-selfcare-soap.png', label: '不洗手' },
  ] },
];
// 回忆类型 3D 图标：照片 / 声音 / 文字 / 探索各一张，找不到回退到线形图标。
const MEMORY_KIND_3D: Record<string, string> = {
  photo: 'memory-camera.png',
  audio: 'memory-microphone.png',
  note: 'memory-memo.png',
  exploration: 'travel-compass.png',
};
function memoryKind3d(kind: string): string {
  return icon3d(MEMORY_KIND_3D[kind] || '');
}
const memoryFilterOptions = computed(() => [
  { value: 'all', label: '全部' },
  { value: 'photo', label: '照片', icon: memoryKind3d('photo') },
  { value: 'audio', label: '声音', icon: memoryKind3d('audio') },
  { value: 'note', label: '文字', icon: memoryKind3d('note') },
  { value: 'exploration', label: '探索', icon: memoryKind3d('exploration') },
]);
function planIcon(h: any): string {
  return CATEGORY_LINE_ICON[h.category] || 'star';
}
// 照料操作（小窝 dock）：每个操作一个 3D 图标 + 分类色淡色圆底，
// 与计划卡同一套语言；找不到时回退到线形图标。圆底色只取 --cat-1..5。
const DOCK_3D_ICON: Record<string, { file: string; hue: string; line: string }> = {
  trigger: { file: 'share-sparkles.png', hue: 'cat-1', line: 'star' },
  feed: { file: 'care-feed-bowl.png', hue: 'cat-2', line: 'food' },
  play: { file: 'cat-kind-heart.png', hue: 'cat-3', line: 'heart' },
  photo: { file: 'care-photo-camera.png', hue: 'cat-1', line: 'camera' },
  chat: { file: 'care-chat-balloon.png', hue: 'cat-5', line: 'chat' },
  mic: { file: 'mic-microphone.png', hue: 'cat-4', line: 'mic' },
  travel: { file: 'travel-compass.png', hue: 'cat-2', line: 'map-pin' },
  rename: { file: 'homework-pencil.png', hue: 'cat-5', line: 'edit' },
  pet: { file: 'pet-paw-prints.png', hue: 'cat-3', line: 'pet' },
  today: { file: 'today-calendar.png', hue: 'cat-4', line: 'habit' },
};
function dockIcon3d(key: string): string {
  return icon3d(DOCK_3D_ICON[key]?.file || '');
}
function dockHue(key: string): string {
  return DOCK_3D_ICON[key]?.hue || 'cat-1';
}
const goalPage = ref(1),
  goalQuery = ref(''),
  goalFilter = ref<'all' | 'active' | 'inactive'>('all'),
  goalDraftOnly = ref(false),
  goalFilterOptions = [
    { value: 'all', label: '全部' },
    { value: 'active', label: '启用' },
    { value: 'inactive', label: '未启用' },
  ],
  goalTemplateId = ref(''),
  // 每页卡片数按可用高度动态倒推（见 goal-layout.js），量不到时回退 3×2。
  goalPageSize = ref(GOAL_FALLBACK.pageSize),
  goalRows = ref(GOAL_FALLBACK.rows),
  goalRowHeight = ref(GOAL_FALLBACK.rowHeight),
  goalGridRef = ref<HTMLElement | null>(null),
  goalList = computed<any[]>(() => [
    ...builtInGoals,
    ...(state.value.goalTemplates || []).map((g: any) => ({
      ...g,
      icon: 'star',
      hint: g.criteria || g.category,
    })),
  ]),
  filteredGoals = computed(() => {
    const q = goalQuery.value.trim().toLocaleLowerCase();
    return goalList.value.filter((g) => {
      const active = addedHabitForGoal(g)?.status === 'active';
      if (goalFilter.value === 'active' && !active) return false;
      if (goalFilter.value === 'inactive' && active) return false;
      if (!q) return true;
      return (g.name + ' ' + (addedHabitForGoal(g)?.name || '') + ' ' + (g.hint || '') + ' ' + (g.category || ''))
        .toLocaleLowerCase()
        .includes(q);
    });
  }),
  goalPages = computed(() =>
    Math.max(1, Math.ceil(filteredGoals.value.length / goalPageSize.value)),
  ),
  visibleGoals = computed(() =>
    filteredGoals.value.slice(
      (goalPage.value - 1) * goalPageSize.value,
      goalPage.value * goalPageSize.value,
    ),
  ),
  goalGridStyle = computed(() => ({
    '--goal-rows': String(goalRows.value),
    '--goal-row-height': `${goalRowHeight.value}px`,
    height: `${
      goalRows.value * goalRowHeight.value +
      Math.max(0, goalRows.value - 1) * GOAL_ROW_GAP
    }px`,
  }));
let goalLayoutTimer: ReturnType<typeof setTimeout> | undefined,
  goalShellObserver: ResizeObserver | null = null,
  goalThemeObserver: MutationObserver | null = null;
function plansCatalogVisible() {
  return (
    view.value === 'habits' &&
    habitMode.value === 'list' &&
    habitTab.value === 'plans'
  );
}
function measureGoalLayout() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!plansCatalogVisible()) return;
  const shell = document.querySelector<HTMLElement>('.shell');
  const gridEl = goalGridRef.value;
  if (!shell || !gridEl) return;
  const shellRect = shell.getBoundingClientRect();
  const gridRect = gridEl.getBoundingClientRect();
  if (!gridRect.width || !shellRect.height) return;
  const gridTop = gridRect.top - shellRect.top + shell.scrollTop;
  let safeBottom = 0;
  const homeRect = document
    .querySelector<HTMLElement>('.tabbar button.home-tab .tab-icon')
    ?.getBoundingClientRect();
  if (homeRect?.height) safeBottom = homeRect.top - shellRect.top;
  else {
    const tabRect = document
      .querySelector<HTMLElement>('.tabbar')
      ?.getBoundingClientRect();
    if (tabRect?.height) safeBottom = tabRect.top - shellRect.top - 36;
    else safeBottom = window.innerHeight - shellRect.top - 132;
  }
  if (safeBottom <= 0) return;
  const dotsEl = document.querySelector<HTMLElement>(
    '.goals-card .pagination-dots',
  );
  const dotsH = dotsEl?.offsetHeight || 28;
  const dotsStyle = dotsEl ? getComputedStyle(dotsEl) : null;
  const dotsGap =
    (dotsStyle ? Number.parseFloat(dotsStyle.marginTop) || 0 : 8) +
    (dotsStyle ? Number.parseFloat(dotsStyle.marginBottom) || 0 : 8);
  const { rows, rowHeight, pageSize } = computeGoalLayout({
    chipsTop: gridTop,
    safeBottom,
    dotsReserve: dotsH + dotsGap + 4,
  });
  if (pageSize !== goalPageSize.value) {
    goalPageSize.value = pageSize;
    goalPage.value = Math.min(goalPage.value, Math.max(1, Math.ceil(filteredGoals.value.length / pageSize)));
  }
  if (rows !== goalRows.value) goalRows.value = rows;
  if (Math.abs(rowHeight - goalRowHeight.value) > 0.5)
    goalRowHeight.value = rowHeight;
}
function scheduleGoalLayout() {
  clearTimeout(goalLayoutTimer);
  goalLayoutTimer = setTimeout(measureGoalLayout, 120);
}
function bindGoalLayoutObservers() {
  if (typeof window === 'undefined') return;
  window.addEventListener('resize', scheduleGoalLayout);
  if (typeof ResizeObserver !== 'undefined') {
    const shell = document.querySelector('.shell');
    if (shell) {
      goalShellObserver?.disconnect();
      goalShellObserver = new ResizeObserver(() => scheduleGoalLayout());
      goalShellObserver.observe(shell);
    }
  }
  if (typeof MutationObserver !== 'undefined') {
    goalThemeObserver?.disconnect();
    goalThemeObserver = new MutationObserver(() => scheduleGoalLayout());
    goalThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }
}
function unbindGoalLayoutObservers() {
  clearTimeout(goalLayoutTimer);
  window.removeEventListener('resize', scheduleGoalLayout);
  goalShellObserver?.disconnect();
  goalShellObserver = null;
  goalThemeObserver?.disconnect();
  goalThemeObserver = null;
}
watch(
  () => goalList.value.length,
  () => (goalPage.value = Math.min(goalPage.value, goalPages.value)),
);
watch(goalQuery, () => (goalPage.value = 1));
watch(goalFilter, () => {
  goalPage.value = 1;
});
watch([habitMode, habitTab, view], async () => {
  if (!plansCatalogVisible()) return;
  await nextTick();
  requestAnimationFrame(() => measureGoalLayout());
  setTimeout(measureGoalLayout, 500);
});
watch(goalPages, () => {
  if (plansCatalogVisible()) scheduleGoalLayout();
});
watch(goalGridRef, (el) => {
  if (el) scheduleGoalLayout();
});
watch(
  () => state.value.habits.length,
  () => (planPage.value = Math.min(planPage.value, planPages.value)),
);
function selectHabitTab(tab: 'score' | 'plans') {
  habitTab.value = tab;
  habitMode.value = 'list';
  if (tab === 'plans') scheduleGoalLayout();
}
let previewStartX = 0,
  previewStartY = 0,
  previewSwiped = false;
let stageStartX = 0,
  stageDragUntil = 0;
function stageDown(event: PointerEvent) {
  stageStartX = event.clientX;
}
function stageMove(event: PointerEvent) {
  if (!event.buttons || Math.abs(event.clientX - stageStartX) < 8) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  detailLevel.value = Math.max(
    1,
    Math.min(
      10,
      Math.floor(((event.clientX - rect.left) / rect.width) * 10) + 1,
    ),
  );
  stageDragUntil = Date.now() + 250;
}
function stageUp(event: PointerEvent) {
  if (Math.abs(event.clientX - stageStartX) > 8)
    stageDragUntil = Date.now() + 250;
}
function stageSelect(n: number) {
  if (Date.now() > stageDragUntil) detailLevel.value = n;
}
function previewPointerDown(event: PointerEvent) {
  previewStartX = event.clientX;
  previewStartY = event.clientY;
  previewSwiped = false;
}
function previewPointerUp(event: PointerEvent) {
  const dx = event.clientX - previewStartX,
    dy = event.clientY - previewStartY;
  if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    detailLevel.value = Math.max(
      1,
      Math.min(10, detailLevel.value + (dx < 0 ? 1 : -1)),
    );
    previewSwiped = true;
  }
}
let toastTimer: ReturnType<typeof setTimeout>,
  emotionTimer: ReturnType<typeof setTimeout>,
  celebrateTimer: ReturnType<typeof setTimeout>,
  shakeTimer: ReturnType<typeof setTimeout>,
  recordTimer: ReturnType<typeof setInterval>,
  clockTimer: ReturnType<typeof setInterval>;
let priorView = 'home',
  previewRecord = false;
const pets = computed(() => catalog(state.value)),
  petQuery = ref(''),
  petPage = ref(1),
  filteredPets = computed(() => {
    const query = petQuery.value.trim().toLocaleLowerCase();
    return pets.value.filter((p: any) =>
      `${p.name} ${p.adult} ${p.tag} ${p.description || ''}`
        .toLocaleLowerCase()
        .includes(query),
    );
  }),
  petPages = computed(() => Math.max(1, Math.ceil(filteredPets.value.length / 6))),
  visiblePets = computed(() =>
    filteredPets.value.slice((petPage.value - 1) * 6, petPage.value * 6),
  ),
  current = computed(
    () =>
      state.value.pets.find((p: any) => p.id === selectedPet.value) ||
      activePet(state.value) ||
      state.value.pets[state.value.pets.length - 1],
  ),
  total = computed(() => totals(state.value)),
  detail = computed(() => pets.value.find((p: any) => p.id === detailId.value)),
  owned = computed(() =>
    state.value.pets.find((p: any) => p.species === detailId.value),
  ),
  shownPet = computed(() =>
    current.value
      ? pets.value.find((p: any) => p.id === current.value.species)
      : pets.value[0],
  ),
  level = computed(() => (current.value ? levelOf(current.value) : 1)),
  hungry = computed(() => hunger(state.value, refreshClock.value)),
  tasks = computed(() =>
    state.value.habits.filter((h: any) => habitDue(h, dayKey())),
  ),
  done = computed(
    () =>
      tasks.value.filter(
        (h: any) => habitCount(state.value, h, dayKey()) >= h.target,
      ).length,
  ),
  list = computed(() => {
    const end = new Date(),
      start = new Date();
    if (dateRange.value === 'day') start.setHours(0, 0, 0, 0);
    else if (dateRange.value === 'week') start.setDate(start.getDate() - 6);
    else {
      const day = start.getDate();
      start.setDate(1);
      start.setMonth(
        start.getMonth() -
          (({ month: 1, quarter: 3, year: 12 } as any)[dateRange.value] || 1),
      );
      start.setDate(
        Math.min(
          day,
          new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate(),
        ),
      );
    }
    return records(
      {
        ...state.value,
        events: state.value.events.filter(
          (e: any) => e.kind === 'plus' || e.kind === 'minus',
        ),
      },
      {
        ...filter.value,
        petId: '',
        from: dayKey(start.getTime()),
        to: dayKey(end.getTime()),
      },
    );
  });
watch(
  () => filteredPets.value.length,
  () => (petPage.value = Math.min(petPage.value, petPages.value)),
);
watch(petQuery, () => (petPage.value = 1));
const companion = computed(() => preferences(state.value.settings.companion));
const profiles = computed(
  () =>
    state.value.profiles || [
      {
        id: 'legacy',
        name: state.value.child,
        avatar: '⭐',
        avatarFile: '',
        birthDate: '',
        note: '',
      },
    ],
);
const activeProfile = computed(
  () =>
    profiles.value.find((p: any) => p.id === state.value.activeProfileId) ||
    profiles.value[0],
);
const memoryDetailId = ref(''),
  memoryNote = ref('');
let memoryListScroll = 0;
function pageScrollHost() {
  return document.querySelector<HTMLElement>('.shell');
}
function pageScrollTop() {
  return pageScrollHost()?.scrollTop || 0;
}
function scrollPageTo(top: number, behavior: ScrollBehavior = 'auto') {
  pageScrollHost()?.scrollTo({ top, behavior });
}
const selectedMemory = computed(
  () =>
    state.value.memories.find((m: any) => m.id === memoryDetailId.value) ||
    demoMemories.find((m) => m.id === memoryDetailId.value),
);
function showMemory(m: any) {
  memoryListScroll = pageScrollTop();
  memoryDetailId.value = m.id;
  memoryNote.value = m.text || '';
  nav('memoryDetail');
}
async function returnToMemories() {
  view.value = 'photos';
  await nextTick();
  scrollPageTo(memoryListScroll);
}
const memoryKind = ref('all'),
  memoryQuery = ref('');
const trip = computed(() => state.value.care.trip),
  away = computed(
    () =>
      trip.value?.petId === current.value?.id &&
      refreshClock.value < trip.value.returnAt,
  ),
  // 外出进度环：出发 → 预计回来，refreshClock 每分钟推进一次。
  travelProgress = computed(() => {
    const t = trip.value;
    if (!t) return 0;
    const span = t.returnAt - t.departAt;
    if (span <= 0) return 1;
    return Math.min(1, Math.max(0, (refreshClock.value - t.departAt) / span));
  });
const homeMessage = computed(() => {
  const lines = away.value
    ? [
        ['在路上发现新风景。', '回来就讲给你听。'],
        ['今天也在认真探索。', '下一张合照正赶来。'],
        ['外面的世界真有趣。', '我会记得回家的路。'],
      ]
    : hungry.value.stage > 0
      ? [
          ['我在这里陪着你。', '今天可以一起吃点东西。'],
          ['摸摸我，聊聊今天。', '再记得给我准备食物呀。'],
          ['小窝里见到你真好。', '我们先补充一点能量吧。'],
        ]
      : [
          ['轻轻摸摸我，我在听你说呀。', '今天也一起收集好心情。'],
          ['小窝里又见面啦。', '和我说说今天的新发现。'],
          ['每一点进步都闪闪发光。', '我会一直在这里陪你。'],
        ];
  return lines[launchMessageIndex];
});
function catalogPetStatus(speciesId: string) {
  const adopted = state.value.pets.find((p: any) => p.species === speciesId);
  if (!adopted)
    return { kind: 'unadopted', icon: 'lock', label: '还未领养' };
  if (
    trip.value?.petId === adopted.id &&
    refreshClock.value < trip.value.returnAt
  )
    return { kind: 'exploring', icon: 'map-pin', label: '出去探索' };
  return { kind: 'home', icon: 'home', label: '在家' };
}
let returning = false;
async function startTravel() {
  await run(async () => {
    const used = state.value.care.usedTravel || [];
    const fresh = destinations.filter((d) => !used.includes(d.id));
    const pool = fresh.length ? fresh : destinations;
    const d = pool[Math.floor(Math.random() * pool.length)];
    const max = state.value.settings.travelMaxHours || 5;
    await commit({
      type: 'travelStart',
      destination: d.id,
      name: d.name,
      petId: current.value.id,
      hours: 1 + Math.random() * (max - 1),
    });
    refreshClock.value = Date.now();
    notify('伙伴出发去' + d.name + '探索啦');
  });
}
async function finishTravel() {
  if (
    returning ||
    busy.value ||
    !auth.value ||
    !trip.value ||
    Date.now() < trip.value.returnAt
  )
    return;
  returning = true;
  const t = { ...trip.value },
    profile = state.value.activeProfileId;
  try {
    const p = state.value.pets.find((p: any) => p.id === t.petId),
      d = destinations.find((d) => d.id === t.destination)!,
      species = pets.value.find((x: any) => x.id === p.species);
    const im = new Image();
    im.src = (isNative ? '/web' : '') + '/travel/' + d.id + '.jpg';
    await im.decode();
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = Math.round((1200 * im.height) / im.width);
    const ctx = c.getContext('2d')!;
    ctx.drawImage(im, 0, 0, c.width, c.height);
    const { renderSkinPose } = await import('./pet-skin');
    const pet = await renderSkinPose(species, levelOf(p), 'wave');
    placePetSelfie(ctx, pet, c.width, c.height);
    const saved = await native('savePhoto', {
      photoId: t.id,
      data: c.toDataURL('image/jpeg', 0.9).split(',')[1],
    });
    await commit({
      type: 'travelReturn',
      profileId: profile,
      tripId: t.id,
      file: saved.file,
      albumSaved: saved.albumSaved,
      credit: d.author + ' · ' + d.license + ' · ' + d.source_url,
    });
    notify(
      profile === state.value.activeProfileId
        ? isNative && !saved.albumSaved
          ? '探索合照已收藏；暂未存入系统相册，可在回忆中重试'
          : '伙伴回来啦，探索合照已收藏到回忆'
        : '探索合照已收藏到出发小朋友的回忆',
    );
  } catch (e) {
    fail(e);
  } finally {
    returning = false;
    if (profile !== state.value.activeProfileId) void finishTravel();
  }
}
watch(busy, (value) => {
  if (!value) void finishTravel();
});
watch(refreshClock, () => void finishTravel());
watch(
  () => state.value.activeProfileId,
  () => void finishTravel(),
);
async function deleteMemory(m: any) {
  if (String(m.id).startsWith('demo-')) {
    hiddenDemoMemories.value = [...hiddenDemoMemories.value, m.id];
    localStorage.setItem(
      'star-pets-hidden-demo-memories',
      JSON.stringify(hiddenDemoMemories.value),
    );
  } else
    await run(async () => {
      await commit({ type: 'memoryDelete', id: m.id });
    });
  galleryPage.value = Math.min(galleryPage.value, galleryPages.value);
  notify(String(m.id).startsWith('demo-') ? '示例回忆已隐藏' : '这条回忆已删除');
}
const demoMemories = [
  {
    id: 'demo-photo',
    kind: 'photo',
    file: '/demo/memory.png',
    name: '星纹小猫',
    text: '第一次一起留影',
    at: new Date('2026-10-29T10:00:00').getTime(),
    level: 3,
  },
  {
    id: 'demo-audio',
    kind: 'audio',
    file: '/demo/greeting.wav',
    name: '星纹小猫',
    text: '初遇时的问候（合成语音）',
    at: new Date('2026-10-12T18:30:00').getTime(),
    level: 1,
  },
  {
    id: 'demo-note',
    kind: 'note',
    file: '',
    name: '小蛙',
    text: '今天主动收好了玩具，记下这份小小的进步。',
    at: new Date('2026-09-20T19:00:00').getTime(),
    level: 2,
  },
  {
    id: 'demo-old',
    kind: 'note',
    file: '',
    name: '锦鲤',
    text: '新年愿望：每天都分享一件开心的小事。',
    at: new Date('2025-12-31T18:00:00').getTime(),
    level: 1,
  },
];
const hiddenDemoMemories = ref<string[]>(
  JSON.parse(localStorage.getItem('star-pets-hidden-demo-memories') || '[]'),
);
const visibleDemoMemories = computed(() =>
  !isNative && state.value.revision === 0
    ? demoMemories.filter((m) => !hiddenDemoMemories.value.includes(m.id))
    : [],
);
const galleryPage = ref(1);
const gallery = computed(() =>
  [
    ...state.value.memories,
    ...visibleDemoMemories.value,
  ]
    .filter((m: any) => {
      const kindMatches =
        memoryKind.value === 'all' ||
        (memoryKind.value === 'exploration'
          ? m.source === 'exploration'
          : m.kind === memoryKind.value && m.source !== 'exploration');
      return (
        kindMatches &&
        (!memoryQuery.value ||
          (m.text + ' ' + m.name).includes(memoryQuery.value))
      );
    })
    .slice()
    .sort((a: any, b: any) => b.at - a.at),
);
const galleryTotal = computed(
  () => state.value.memories.length + visibleDemoMemories.value.length,
);
function clearMemoryFilter() {
  memoryKind.value = 'all';
  memoryQuery.value = '';
  galleryPage.value = 1;
}
function requestDeleteMemory(m: any) {
  ask(
    String(m.id).startsWith('demo-')
      ? '要从预览中隐藏这条示例回忆吗？'
      : '要删除这条回忆吗？删除后无法恢复。',
    () => deleteMemory(m),
  );
}
function openGalleryItem(m: any) {
  if (m.kind === 'note') showMemory(m);
  else openPhotoMemory(m);
}
function requestUndo(e: any) {
  ask(
    '确认撤销「' +
      e.reason +
      '」吗？积分、当前伙伴经验及关联回忆会同步调整。',
    () => undoInline(e),
  );
}
const galleryPages = computed(() =>
  Math.max(1, Math.ceil(gallery.value.length / 6)),
);
const galleryItems = computed(() =>
  gallery.value.slice((galleryPage.value - 1) * 6, galleryPage.value * 6),
);
const photoOwned = computed(() =>
  state.value.pets.find((p: any) => p.id === photoPetId.value),
);
const photoSpecies = computed(() =>
  pets.value.find((p: any) => p.id === photoOwned.value?.species),
);
const chatInfo = computed(() => ({
  pet: {
    name: current.value?.name,
    species: shownPet.value?.name,
    level: level.value,
    state: hungry.value.label,
  },
  habits: tasks.value.slice(0, 6).map((h: any) => ({
    name: h.name,
    done: habitCount(state.value, h, dayKey()) >= h.target,
  })),
  attention: companion.value,
}));
watch(
  () => [current.value?.id, level.value],
  () => {
    restoreHomeForm();
    closePhoto();
    renameOpen.value = false;
    chatAction.value = '';
    speech.value = {};
    chatOpen.value = false;
  },
  { immediate: true },
);
async function attention() {
  if (
    !auth.value ||
    view.value !== 'home' ||
    !current.value ||
    document.hidden ||
    chatOpen.value ||
    modal.value ||
    busy.value ||
    attentionDismissed.value ||
    companion.value.proactive === 'quiet' ||
    Date.now() - openedAt < 120000
  )
    return;
  const now = Date.now(),
    hour = new Date().getHours(),
    start = state.value.settings.quietStart,
    end = state.value.settings.quietEnd;
  if (
    start !== end &&
    (start > end ? hour >= start || hour < end : hour >= start && hour < end)
  )
    return;
  const gap = companion.value.proactive === 'lively' ? 1800000 : 3600000;
  if (now - (state.value.care.attentionAt || 0) < gap) return;
  await run(async () => {
    await commit({ type: 'attention' });
    const h =
      companion.value.habitFocus !== 'off'
        ? tasks.value.find(
            (h: any) => habitCount(state.value, h, dayKey()) < h.target,
          )
        : null;
    greeting.value =
      companion.value.language === 'en-US'
        ? 'Hi! Would you like a little chat?'
        : h && companion.value.habitFocus === 'active'
          ? `今天的「${h.name}」，要不要一起想想怎么完成？`
          : '我在这里。想和我说说今天的小事吗？';
    animate('wave');
  });
}
function memoryOpen() {
  if (memoryInline.value) {
    closeMemoryInline();
    return;
  }
  closePhoto();
  todayOpen.value = false;
  renameOpen.value = false;
  chatOpen.value = false;
  memoryPetId.value = current.value.id;
  recordFile.value = '';
  memoryText.value = '';
  memoryInline.value = true;
}
function toggleToday() {
  if (!closeMemoryInline()) return;
  const next = !todayOpen.value;
  closePhoto();
  renameOpen.value = false;
  chatOpen.value = false;
  greeting.value = '';
  todayOpen.value = next;
  // 打开时若今日计划已全部完成，亮一下完成态就自动收起。
  if (next) scheduleQuickDoneClose();
}
const titles = TITLES;
const pageTitle = computed(() => {
  if (view.value === 'photos')
    return memoryTab.value === 'footprints' ? '成长足迹' : '精彩回忆';
  return titles[screen.value] || '星星宠物';
});
const topViews = TOP_VIEWS;
const screen = computed(() =>
  view.value === 'habits' && habitMode.value === 'habitEdit'
    ? goalDraftOnly.value
      ? 'goalDraft'
      : 'habitEdit'
    : view.value,
);
const subScreen = computed(() => !topViews.includes(screen.value));
const navTabs = NAV_TABS;
const { themes, themeId } = useTheme(state, { isNative, native });
const scrollMemory = new Map<string, number>();
const scrollKey = computed(() =>
  screen.value === 'habits'
    ? 'habits:' + habitTab.value
    : screen.value === 'photos'
      ? 'photos:' + memoryTab.value
      : screen.value,
);
watch(scrollKey, async (next, prev) => {
  if (prev) scrollMemory.set(prev, pageScrollTop());
  await nextTick();
  scrollPageTo(subScreen.value ? 0 : scrollMemory.get(next) || 0);
});
function keepInView(id: string) {
  const el = document.getElementById(id),
    host = pageScrollHost();
  if (!el || !host) return;
  const header = host.querySelector<HTMLElement>('.app-header');
  const top =
    el.getBoundingClientRect().top -
    host.getBoundingClientRect().top +
    host.scrollTop -
    (header?.getBoundingClientRect().height || 72);
  if (Math.abs(host.scrollTop - top) > 1) scrollPageTo(top);
}
function fill<T>(items: T[], size: number, page: number, pages: number) {
  return page === pages ? Math.max(0, size - items.length) : 0;
}
const planMenu = ref('');
let dockCollapseTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleDockCollapse() {
  clearTimeout(dockCollapseTimer);
  if (dockOpen.value) {
    dockCollapseTimer = setTimeout(() => {
      dockOpen.value = false;
    }, 8000);
  }
}
watch(dockOpen, scheduleDockCollapse);
function closePlanMenu(event?: Event) {
  const target = event?.target as HTMLElement | undefined;
  if (target?.closest?.('.pet-dock')) scheduleDockCollapse();
  else dockOpen.value = false;
  if (target?.closest?.('.plan-menu, .plan-more')) return;
  planMenu.value = '';
}
const todayGoals = computed(() =>
  tasks.value
    .filter(
      (h: any) =>
        h.status === 'active' &&
        habitCount(state.value, h, dayKey()) < h.target,
    )
    .slice(0, 3),
);
// 小窝「今日计划」卡片堆：快速完成的状态。
// quickLeavingId 正在飞走的卡片；quickBusy 飞行/提交进行中，忽略重复点按；
// quickFly 飞向顶部进度条的 +N 小 chip（null 即不飞）；quickFlash 进度条落点闪光。
const quickLeavingId = ref(''),
  quickBusy = ref(false),
  quickFly = ref<{
    x: number;
    y: number;
    dx: number;
    dy: number;
    points: number;
    key: number;
  } | null>(null),
  quickFlash = ref(false);
let quickFlyTimer: ReturnType<typeof setTimeout> | undefined,
  quickFlashTimer: ReturnType<typeof setTimeout> | undefined,
  quickDoneTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleQuickDoneClose() {
  clearTimeout(quickDoneTimer);
  if (todayOpen.value && !todayGoals.value.length && tasks.value.length)
    quickDoneTimer = setTimeout(() => {
      todayOpen.value = false;
    }, 1500);
}
// B5 计划卡完成反馈：正在播 pop / 爆星的卡片（null 即无）；
// reduceMotion 时不设，点按直接记分。
const planPop = ref<{ id: string; key: number } | null>(null);
let planPopTimer: ReturnType<typeof setTimeout> | undefined;
watch(todayGoals, scheduleQuickDoneClose);
async function quickComplete(h: any, event?: Event) {
  if (quickBusy.value || busy.value) return;
  if (!h || habitCount(state.value, h, dayKey()) >= h.target) return;
  quickBusy.value = true;
  quickLeavingId.value = h.id;
  const payload = buildScoreForm(1, h);
  form.value = payload;
  const reduceMotion = !!state.value.settings.reduceMotion;
  let flew = false;
  if (!reduceMotion) {
    const from = (
      event?.currentTarget as HTMLElement | null
    )?.getBoundingClientRect();
    const bar = document
      .querySelector('.summary-progress')
      ?.getBoundingClientRect();
    if (from && bar) {
      flew = true;
      quickFly.value = {
        x: from.left + from.width / 2,
        y: from.top + from.height / 2,
        dx: bar.left + bar.width / 2 - (from.left + from.width / 2),
        dy: bar.top + bar.height / 2 - (from.top + from.height / 2),
        points: h.points,
        key: Date.now(),
      };
      // 等 chip 飞到进度条（出场 140ms / 入场 220ms 那套速度）再记分，数字随落点涨上去。
      await new Promise((resolve) => {
        clearTimeout(quickFlyTimer);
        quickFlyTimer = setTimeout(resolve, 240);
      });
      quickFly.value = null;
    }
  }
  if (flew) {
    quickFlash.value = true;
    clearTimeout(quickFlashTimer);
    quickFlashTimer = setTimeout(() => {
      quickFlash.value = false;
    }, 500);
  }
  try {
    // 飞行等待期间若有别的入口改写了表单，记分前恢复成本次载荷。
    form.value = payload;
    // 跳过 habitComplete 确认框，但走 saveScore 同一套提交逻辑；
    // 宠物外出时只飞进度条，不播宠物反应（舞台上没有宠物）。
    await saveScore({ silentPet: away.value });
    navigator.vibrate?.(15);
  } finally {
    quickLeavingId.value = '';
    quickBusy.value = false;
  }
}
let completeFrom = 'habits';
function planMenuKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;
  planMenu.value = '';
  dockOpen.value = false;
}
onMounted(() => {
  document.addEventListener('pointerdown', closePlanMenu);
  document.addEventListener('keydown', planMenuKey);
});
onBeforeUnmount(() => {
  clearTimeout(dockCollapseTimer);
  document.removeEventListener('pointerdown', closePlanMenu);
  document.removeEventListener('keydown', planMenuKey);
});
function petSay(text: string) {
  const id = Date.now() + Math.random();
  headBubbles.value = [...headBubbles.value, { id, text }].slice(-3);
  setTimeout(
    () => (headBubbles.value = headBubbles.value.filter((x) => x.id !== id)),
    8000,
  );
}
let lastInteraction = '';
async function randomInteraction() {
  const actions = [
    'nuzzle',
    'wave',
    'dance',
    'jump',
    'stretch',
    'nod',
    'peek',
    'bow',
    'cheer',
    'hug',
    'sit',
    'groom',
    'sniff',
    'lookAround',
  ].filter((x) => x !== lastInteraction);
  const action = actions[Math.floor(Math.random() * actions.length)];
  await run(async () => {
    await commit({ type: 'care', action: 'play' });
    lastInteraction = action;
    animate(action);
    petSay(
      (
        {
          nuzzle: '蹭蹭你，好舒服！',
          wave: '嗨，看这里！',
          dance: '一起跳支舞呀！',
          jump: '嘿，我跳起来啦！',
          stretch: '伸伸懒腰，真开心！',
          nod: '有你陪着真好！',
          peek: '猜猜我在哪里？',
          bow: '认真向你问好！',
          cheer: '我们一起加油！',
          hug: '给你一个大大的抱抱！',
          sit: '乖乖坐好，陪你一会儿。',
          groom: '整理好自己，精神满满！',
          sniff: '咦，我闻到了什么？',
          lookAround: '看看这边，再看看你！',
        } as any
      )[action],
    );
  });
}
const toastKind = ref<'info' | 'error'>('info');
function notify(s: string, kind: 'info' | 'error' = 'info') {
  toast.value = s;
  toastKind.value = kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ''), kind === 'error' ? 5000 : 3500);
}
function fail(e: any) {
  error.value = e?.message || String(e) || '操作没有完成，请再试一次';
  notify(error.value, 'error');
}
function short(n: number) {
  const v = Number(n) || 0,
    a = Math.abs(v);
  if (a < 10000) return String(v);
  return (v < 0 ? '-' : '') + (a / 10000).toFixed(a < 100000 ? 1 : 0).replace(/\.0$/, '') + '万';
}
const cap = (n: number) => (n > 99 ? '99+' : String(n));
async function run(fn: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  try {
    await fn();
  } catch (e) {
    fail(e);
  } finally {
    busy.value = false;
  }
}
const enqueueCommit = serialQueue();
function commit(command: any) {
  return enqueueCommit(async () => {
    const before = JSON.parse(JSON.stringify(state.value));
    const { state: after, result } = apply(before, command);
    await native('save', { state: after, expected: before.revision });
    state.value = after;
    return result;
  });
}
function nav(v: string) {
  if (!closeMemoryInline()) return;
  dockOpen.value = false;
  todayOpen.value = false;
  if (v === 'records') {
    v = 'photos';
    memoryTab.value = 'footprints';
  } else if (v === 'photos') {
    galleryPage.value = 1;
    memoryTab.value = 'gallery';
  }
  if (v === 'goalLibrary') {
    // 挑选库已并入培养计划 Tab，旧入口统一落到目录页。
    habitMode.value = 'list';
    habitTab.value = 'plans';
    v = 'habits';
  } else if (v === 'habitEdit') {
    habitMode.value = 'habitEdit';
    habitTab.value = 'plans';
    v = 'habits';
  } else {
    habitMode.value = 'list';
  }
  if (v === 'habits' && habitMode.value === 'list') habitTab.value = 'plans';
  restoreHomeForm();
  closePhoto();
  renameOpen.value = false;
  chatOpen.value = false;
  planMenu.value = '';
  view.value = v;
}
function navTop(v: (typeof NAV_TABS)[number][0]) {
  const previous = scrollKey.value;
  nav(v);
  const destination =
    v === 'habits' ? 'habits:plans' : v === 'photos' ? 'photos:gallery' : v;
  if (scrollKey.value !== destination) return;
  scrollMemory.set(destination, 0);
  if (previous === destination) scrollPageTo(0);
}
function back() {
  if (view.value === 'memoryDetail') {
    void returnToMemories();
    return;
  }
  if (memoryInline.value) {
    closeMemoryInline();
    return;
  }
  if (todayOpen.value) {
    todayOpen.value = false;
    return;
  }
  if (renameOpen.value) {
    renameOpen.value = false;
    return;
  }
  if (photoOpen.value) {
    closePhoto();
    return;
  }
  if (modal.value) {
    close();
    return;
  }
  if (view.value === 'habits' && habitMode.value !== 'list') {
    habitMode.value = 'list';
    habitTab.value = 'plans';
    return;
  }
  if (view.value === 'detail') {
    nav(priorView);
    return;
  }
  if (view.value === 'photo') {
    nav('home');
    return;
  }
  if (view.value === 'childEdit') {
    nav('children');
    return;
  }
  if (['children', 'companionSettings', 'voiceSettings'].includes(view.value)) {
    nav('settings');
    return;
  }
  if (view.value === 'habitComplete') {
    nav(completeFrom);
    return;
  }
  nav('home');
}
async function open(name: string, data: any = {}) {
  error.value = '';
  form.value = data;
  modal.value = name;
  await nextTick();
  dialog.value?.showModal();
}
function close() {
  if (recording.value) {
    notify('请先停止录音');
    return;
  }
  dialog.value?.close();
  if (modal.value === 'adopt') recordFile.value = '';
  modal.value = '';
  error.value = '';
}
function openAdoption() {
  if (!detail.value || owned.value || activePet(state.value)) return;
  recordFile.value = '';
  void open('adopt', { name: '', wish: '' });
}
async function load() {
  const s = await native('load');
  if (s) {
    migrateThemeState(s);
    validate(s);
    state.value = s;
  } else {
    const fresh = initialState();
    fresh.revision = 1;
    await native('save', { state: fresh, expected: 0 });
    state.value = fresh;
  }
  auth.value = true;
  password.value = '';
  await settleLoginMaintenance({
    tick: () => commit({ type: 'tick' }),
    reload: async () => {
      const latest = await native('load');
      if (!latest) return;
      migrateThemeState(latest);
      validate(latest);
      state.value = latest;
    },
    onConflict: () => notify('数据已同步到最新状态'),
    onDeferred: () => notify('已登录，后台状态将在稍后更新', 'error'),
  });
  void finishTravel();
}
function shakePassword() {
  loginShake.value = false;
  requestAnimationFrame(() => {
    loginShake.value = true;
    clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => (loginShake.value = false), 450);
  });
}
async function login(mode: 'password' | 'bio' = 'password') {
  if (busy.value) return;
  const saved =
    mode === 'password' && !password.value && status.value.remembered;
  if (mode === 'password' && !password.value && !saved) {
    notify('请输入密码');
    shakePassword();
    return;
  }
  busy.value = true;
  unlockPop.value = false;
  try {
    if (mode === 'bio') await native('bio');
    else if (saved) await native('rememberLogin');
    else {
      await native('login', { password: password.value, remember: true });
      status.value.remembered = true;
    }
    // 解锁成功态：品牌图标先播一次 pop，再切页，全程 220ms 内。
    await nextTick();
    unlockPop.value = true;
    if (!state.value.settings.reduceMotion)
      await new Promise((resolve) => setTimeout(resolve, 220));
    await load();
  } catch (e: any) {
    notify(e?.message || '未能解锁，请重试');
    if (mode === 'password') {
      shakePassword();
      status.value.remembered = false;
    }
  } finally {
    busy.value = false;
  }
}
function animate(name: string) {
  chatAction.value = '';
  emotion.value = name;
  clearTimeout(emotionTimer);
  emotionTimer = setTimeout(() => {
    emotion.value = '';
    playing.value = false;
  }, 3800);
  // 等级提升庆祝：舞台飘星 + 等级数字 pop，星星 900ms 后收起。
  if (name === 'upgrade') {
    celebrateKey.value++;
    celebrate.value = true;
    clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(() => {
      celebrate.value = false;
    }, 900);
  }
}
function petDetail(id: string) {
  priorView = view.value === 'detail' ? 'pets' : view.value;
  detailId.value = id;
  const p = state.value.pets.find((p: any) => p.species === id);
  detailLevel.value = p ? levelOf(p) : 1;
  nav('detail');
}
// 记分表单：确认框路径（score → habitComplete → saveScore）与小窝快速完成
// （quickComplete → saveScore）共用同一份载荷，分值与等级累计完全一致。
function buildScoreForm(sign = 1, h?: any) {
  return {
    points: h ? h.points : sign * 3,
    reason: h ? h.name : '',
    note: '',
    habitId: h?.id || '',
    date: dayKey(),
    completion: '独立完成',
    token: uid(),
    sign,
  };
}
function score(sign = 1, h?: any) {
  if (h && habitCount(state.value, h, dayKey()) >= h.target) return;
  form.value = buildScoreForm(sign, h);
  if (h) {
    completeFrom = view.value === 'home' ? 'home' : 'habits';
    void open('habitComplete', form.value);
  }
  else void goScore();
}
// B5：点计划卡“完成 +N”瞬间卡片播 pop 并爆一颗星星（plan-pop class +
// plan-burst），再走原有 score() 开确认框；reduceMotion 时不播动画，直接记分。
function planComplete(h: any) {
  if (state.value.settings.reduceMotion) {
    score(1, h);
    return;
  }
  planPop.value = { id: h.id, key: Date.now() };
  clearTimeout(planPopTimer);
  planPopTimer = setTimeout(() => {
    planPop.value = null;
  }, 600);
  score(1, h);
}
async function saveScore(opts: any = {}) {
  await run(async () => {
    const old = current.value ? levelOf(current.value) : 0;
    const wasHabit = !!form.value.habitId;
    const result = await commit({
      type: 'score',
      ...form.value,
      points: Number(form.value.points),
    });
    if (modal.value) close();
    if (!wasHabit) nav('home');
    await nextTick();
    // 小窝快速完成且宠物外出时：舞台上没有宠物，只涨进度，不播宠物反应。
    if (!opts?.silentPet) animate(level.value > old ? 'upgrade' : result.emotion);
    if (level.value > old) notify(`升到 Lv.${level.value} 啦`);
    else
      notify(
        result.emotion === 'happy'
          ? '已记录，这份努力会被记住'
          : '已记录减分，可以陪伙伴缓一缓',
      );
  });
}
function adoptWords() {
  return String(form.value.name || '').trim();
}
async function adoptSpecies(species: any, withAudio = false) {
  const name = adoptWords();
  if (!name) {
    notify('请输入文字');
    return;
  }
  if (name.length > NAME_LIMITS.pet) {
    notify(`伙伴名字最多 ${NAME_LIMITS.pet} 个字`);
    return;
  }
  if (withAudio && !recordFile.value) {
    notify('请先完成录音');
    return;
  }
  if (recording.value || !species || activePet(state.value)) return;
  await run(async () => {
    const photo = await createFirstMeetingPhoto(species);
    const saved = await native('savePhoto', { photoId: uid(), data: photo });
    const wish = String(form.value.wish || '').trim() ||
      '愿我们一起，把每一次勇敢和快乐都收藏起来。';
    const r = await commit({
      type: 'adopt',
      species: species.id,
      name,
      firstPhoto: saved.file,
      wish,
    });
    selectedPet.value = r.petId;
    if (withAudio)
      await commit({
        type: 'memory',
        petId: r.petId,
        kind: 'audio',
        file: recordFile.value,
        text: '第一次相遇的欢迎声音',
      });
    if (modal.value === 'adopt') close();
    recordFile.value = '';
    form.value = { name: '', wish: '' };
    nav('home');
    animate('upgrade');
    notify('欢迎新伙伴！第一次相遇已收藏到回忆');
  });
}
async function onRecordAdopt(species: any) {
  if (!species || activePet(state.value)) return;
  if (recording.value) {
    await stopRecord();
    return;
  }
  if (!adoptWords()) {
    notify('请输入文字');
    return;
  }
  if (recordFile.value) {
    await adoptSpecies(species, true);
    return;
  }
  await recordStart(true);
}
async function care(action: string) {
  await run(async () => {
    await commit({ type: 'care', action });
    if (action === 'ration') {
      petSay('口粮领到啦！小碗满满的。');
      return;
    }
    animate(action === 'feed' ? 'feed' : action);
    playing.value = action === 'play';
    petSay(
      (
        {
          feed: '吃饱啦，谢谢你照顾我。',
          pet: '蹭蹭你的手，真舒服呀。',
          play: '好呀，一起玩一会儿！',
        } as any
      )[action],
    );
  });
}
function habitEdit(h?: any, returnTo: 'list' = 'list') {
  habitSubmitted.value = false;
  habitEditReturn.value = returnTo;
  goalDraftOnly.value = false;
  goalTemplateId.value = '';
  form.value = h
    ? JSON.parse(JSON.stringify(h))
    : {
        id: '',
        name: '',
        category: '日常自理',
        criteria: '',
        frequency: 'daily',
        days: [1, 2, 3, 4, 5],
        interval: 2,
        target: 1,
        points: 3,
        start: dayKey(),
        end: '',
        status: 'active',
        times: [],
        timeText: '19:00',
        remind: false,
      };
  if (h) form.value.timeText = h.times.join(',');
  nav('habitEdit');
}
function addedHabitForGoal(goal: any) {
  return findHabitForGoal(state.value.habits, goal);
}
function goalDisplayName(goal: any) {
  return displayGoalName(state.value.habits, goal);
}
// G1 分值：自定义模板自带 points；12 个内置目标没有 points 字段，
// 新建习惯时 activateGoal 用 goal.points || 3 兜底，故 chip 取同一口径：
// 已建习惯的分值 → 模板自带分值 → 默认 3。
function goalPoints(goal: any): number {
  return addedHabitForGoal(goal)?.points || goal.points || 3;
}
// B4 计划卡副文案兜底：习惯自带 criteria → 目标库里该计划的描述
// （内置目标取 hint；自定义模板的 hint 本身就是 criteria || category）
// → 都没有时用已有字段拼“每天一次 · 19:00”。
function goalForHabit(h: any) {
  return (
    goalList.value.find((g: any) => g.id === h.goalId) ||
    goalList.value.find((g: any) => g.name === h.name)
  );
}
function planCriteria(h: any): string {
  if (h.criteria && h.criteria !== h.category) return h.criteria;
  const hint = goalForHabit(h)?.hint;
  if (hint && hint !== h.category) return hint;
  const times = (h.times || []).join('、');
  const count =
    h.target === 1
      ? '一次'
      : h.target === 2
        ? '两次'
        : h.target === 3
          ? '三次'
          : `${h.target}次`;
  return times ? `每天${count} · ${times}` : `每天${count}`;
}
function editAddedGoal(goal: any) {
  const habit = addedHabitForGoal(goal);
  if (habit) habitEdit({ ...habit, goalId: goal.id }, 'list');
}
let lastGoalTap: { id: string; at: number } | null = null;
let goalTapTimer: ReturnType<typeof setTimeout> | undefined;
let goalHoldTimer: ReturnType<typeof setTimeout> | undefined;
let goalHoldX = 0;
let goalHoldY = 0;
let goalSuppressClick = false;
function suppressGoalClick() {
  goalSuppressClick = true;
  setTimeout(() => (goalSuppressClick = false), 700);
}
function cancelGoalHold() {
  clearTimeout(goalHoldTimer);
  goalHoldTimer = undefined;
}
function startGoalHold(goal: any, event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  const habit = addedHabitForGoal(goal);
  if (!habit) return;
  cancelGoalHold();
  goalHoldX = event.clientX;
  goalHoldY = event.clientY;
  goalHoldTimer = setTimeout(() => {
    goalHoldTimer = undefined;
    suppressGoalClick();
    navigator.vibrate?.(20);
    confirmDeleteHabit(habit);
  }, 550);
}
function moveGoalHold(event: PointerEvent) {
  if (
    Math.abs(event.clientX - goalHoldX) > 10 ||
    Math.abs(event.clientY - goalHoldY) > 10
  )
    cancelGoalHold();
}
function onGoalCardDelete(goal: any) {
  const habit = addedHabitForGoal(goal);
  if (habit) confirmDeleteHabit(habit);
}
function onGoalCardActivate(goal: any) {
  if (goalSuppressClick) {
    goalSuppressClick = false;
    return;
  }
  const now = Date.now();
  if (lastGoalTap && lastGoalTap.id === goal.id && now - lastGoalTap.at < 340) {
    clearTimeout(goalTapTimer);
    goalTapTimer = undefined;
    lastGoalTap = null;
    onGoalCardDblClick(goal);
    return;
  }
  lastGoalTap = { id: goal.id, at: now };
  clearTimeout(goalTapTimer);
  // 稍等，避免双击的第一次点击误触发启停。
  goalTapTimer = setTimeout(() => {
    goalTapTimer = undefined;
    if (lastGoalTap?.id === goal.id) void activateGoal(goal);
  }, 280);
}
function onGoalCardDblClick(goal: any) {
  if (goalSuppressClick) {
    goalSuppressClick = false;
    return;
  }
  clearTimeout(goalTapTimer);
  goalTapTimer = undefined;
  lastGoalTap = null;
  const existing = addedHabitForGoal(goal);
  if (existing) editAddedGoal(goal);
  else editGoalTemplate(goal);
}
function editGoalTemplate(goal?: any) {
  habitEdit();
  goalDraftOnly.value = true;
  if (goal) {
    goalTemplateId.value = String(goal.id).startsWith('goal-') ? goal.id : '';
    form.value = {
      ...form.value,
      ...goal,
      id: '',
      start: dayKey(),
      end: '',
      status: 'active',
      timeText: goal.times?.join(',') || '19:00',
    };
  }
}
async function activateGoal(goal: any) {
  const existing = addedHabitForGoal(goal);
  await run(async () => {
    if (existing) {
      const status = existing.status === 'active' ? 'paused' : 'active';
      await commit({ type: 'habit', value: { ...existing, goalId: goal.id, status } });
      notify(status === 'active' ? '习惯已启用' : '习惯已停用');
      return;
    }
    const v = {
      id: '',
      goalId: goal.id,
      name: goal.name,
      category: goal.category,
      criteria: goal.criteria || '',
      frequency: goal.frequency || 'daily',
      days: goal.days || [1, 2, 3, 4, 5],
      interval: goal.interval || 2,
      target: goal.target || 1,
      points: goal.points || 3,
      start: dayKey(),
      end: '',
      status: 'active',
      times: goal.times || ['19:00'],
      remind: !!goal.remind,
    };
    await commit({ type: 'habit', value: v });
    notify('习惯已启用');
  });
}
function deleteHabit() {
  const id = form.value.id,
    name = form.value.name;
  if (!id) return;
  ask(
    '要删除习惯「' + name + '」吗？已经记下的分数与回忆会继续保留。',
    () =>
      void run(async () => {
        await commit({ type: 'habitDelete', id });
        nav('habits');
        habitTab.value = 'plans';
        notify('习惯已删除');
      }),
  );
}
function confirmDeleteHabit(h: any) {
  ask(
    '要删除习惯「' + h.name + '」吗？已经记下的分数与回忆会继续保留。',
    () =>
      void run(async () => {
        await commit({ type: 'habitDelete', id: h.id });
        planPage.value = Math.min(planPage.value, planPages.value);
        notify('习惯已删除');
      }),
  );
}
async function saveHabit() {
  habitSubmitted.value = true;
  if (habitError.value) {
    notify(habitError.value, 'error');
    return;
  }
  await run(async () => {
    const v = {
      ...form.value,
      times: String(form.value.timeText || '')
        .split(/[,，\s]+/)
        .filter(Boolean),
    };
    if (goalDraftOnly.value) {
      await commit({
        type: 'goalTemplateSave',
        id: goalTemplateId.value || undefined,
        value: v,
      });
      goalQuery.value = '';
      goalPage.value = goalPages.value;
      nav('habits');
      habitTab.value = 'plans';
      habitSubmitted.value = false;
      notify('已保存到习惯列表');
      return;
    }
    if (v.remind && isNative && !status.value.notifications) {
      await native('notifications');
      status.value = await native('status');
    }
    await commit({ type: 'habit', value: v });
    nav('habits');
    habitTab.value = 'plans';
    habitSubmitted.value = false;
    notify('习惯已保存');
  });
}
async function setHabitStatus(h: any, status: string) {
  await run(async () => {
    await commit({ type: 'habit', value: { ...h, status } });
    navigator.vibrate?.(15);
  });
}
async function setting(k: string, value: any) {
  await run(async () => {
    await commit({ type: 'settings', value: { [k]: value } });
  });
}
async function recordStart(allowPreview = false) {
  if (!isNative) {
    if (!allowPreview) {
      notify('录音功能请在手机 App 中体验');
      return;
    }
    previewRecord = true;
    recording.value = true;
    recordFile.value = '';
    recordSeconds.value = 0;
    recordTimer = setInterval(() => recordSeconds.value++, 1000);
    return;
  }
  previewRecord = false;
  await run(async () => {
    await native('recordStart');
    recording.value = true;
    recordFile.value = '';
    recordSeconds.value = 0;
    recordTimer = setInterval(() => recordSeconds.value++, 1000);
  });
}
function finished(d: { file: string }) {
  clearInterval(recordTimer);
  recording.value = false;
  recordFile.value = d.file;
}
async function stopRecord() {
  if (previewRecord) {
    clearInterval(recordTimer);
    recording.value = false;
    previewRecord = false;
    recordFile.value = crypto.randomUUID() + '.m4a';
    return;
  }
  await run(async () => {
    try {
      const d = await native('recordStop');
      finished(d);
    } finally {
      clearInterval(recordTimer);
      recording.value = false;
    }
  });
}
async function saveMemory() {
  await run(async () => {
    await commit({
      type: 'memory',
      petId: memoryPetId.value,
      kind: recordFile.value ? 'audio' : 'note',
      file: recordFile.value,
      text: memoryInline.value ? memoryText.value : form.value.text,
    });
    close();
    memoryInline.value = false;
    recordFile.value = '';
    notify('已保存到回忆');
  });
}
async function pickPhoto(camera = false) {
  await run(async () => {
    const d = await native(camera ? 'camera' : 'pickPhoto');
    const petId = current.value.id;
    nav('photo');
    photoFile.value = d.file;
    photoPetId.value = petId;
  });
}
async function savePhotoNote() {
  if (!selectedMemory.value) return;
  await run(async () => {
    await commit({
      type: 'memoryNote',
      id: selectedMemory.value.id,
      text: memoryNote.value,
    });
    notify('照片备注已保存');
  });
}
async function savePhoto(data: string) {
  await run(async () => {
    const r = await native('savePhoto', { data });
    await commit({
      type: 'memory',
      petId: photoPetId.value,
      kind: 'photo',
      file: r.file,
      text: '与伙伴的合照',
    });
    nav('home');
    notify(
      isNative
        ? r.albumSaved
          ? '合照已收藏到回忆和系统相册'
          : '合照已收藏；暂未存入系统相册，可在回忆中重试'
        : '合照已收藏；存入系统相册请在手机 App 中体验',
    );
  });
}
function media(file: string) {
  return file.startsWith('/demo/')
    ? file
    : !isNative && file.endsWith('.m4a')
      ? '/demo/greeting.wav'
      : '/media/' + file;
}
let photoHoldTimer: ReturnType<typeof setTimeout>,
  photoHoldX = 0,
  photoHoldY = 0,
  photoHoldConsumed = 0;
function memoryPhotoDown(m: any, event: PointerEvent) {
  clearTimeout(photoHoldTimer);
  photoHoldX = event.clientX;
  photoHoldY = event.clientY;
  photoHoldTimer = setTimeout(() => {
    photoHoldConsumed = Date.now();
    void savePhotoFromMemory(m);
  }, 650);
}
function memoryPhotoMove(event: PointerEvent) {
  if (
    Math.abs(event.clientX - photoHoldX) > 12 ||
    Math.abs(event.clientY - photoHoldY) > 12
  )
    clearTimeout(photoHoldTimer);
}
function memoryPhotoUp() {
  clearTimeout(photoHoldTimer);
}
function openPhotoMemory(m: any) {
  if (Date.now() - photoHoldConsumed < 800) return;
  showMemory(m);
}
async function savePhotoFromMemory(m: any) {
  if (String(m.id).startsWith('demo-')) {
    notify('演示照片不能保存到相册');
    return;
  }
  await run(async () => {
    await native(isNative ? 'albumPhoto' : 'exportPhoto', { file: m.file });
    notify(isNative ? '已保存到系统相册' : '照片已导出');
  });
}
async function importBackup() {
  await run(async () => {
    const r = await native('importBackup');
    migrateThemeState(r.state);
    validate(r.state);
    stagedBackup.value = r.state;
    await open('restore');
  });
}
async function restore() {
  await run(async () => {
    const s = JSON.parse(JSON.stringify(stagedBackup.value));
    s.revision = state.value.revision + 1;
    validate(s);
    await native('restoreCommit', { state: s, expected: state.value.revision });
    state.value = s;
    close();
    nav('home');
    notify('家庭数据已恢复，恢复前的数据也已安全留存');
  });
}
async function importPet() {
  await run(async () => {
    const r = await native('importPet');
    const old = pets.value.find((p: any) => p.id === r.pet.id);
    if (old && r.pet.version <= old.version)
      throw Error('这位伙伴的当前版本已存在，请选择更高版本');
    stagedPet.value = r.pet;
    await open('importPet');
  });
}
async function confirmPet() {
  await run(async () => {
    const s = JSON.parse(JSON.stringify(state.value));
    const i = s.imports.findIndex((p: any) => p.id === stagedPet.value.id);
    if (i >= 0) s.imports[i] = stagedPet.value;
    else s.imports.push(stagedPet.value);
    s.revision++;
    validate(s);
    await native('save', { state: s, expected: state.value.revision });
    state.value = s;
    close();
    nav('pets');
    notify('伙伴资源已导入');
  });
}
async function toggleBio() {
  await run(async () => {
    await native('enableBio', { enabled: !status.value.biometric });
    status.value = await native('status');
  });
}
function pct(p: any) {
  const l = levelOf(p);
  return l === 10
    ? 100
    : Math.round(
        ((p.xp - p.thresholds[l - 1]) /
          (p.thresholds[l] - p.thresholds[l - 1])) *
          100,
      );
}
async function downloadAudio(m: any) {
  if (isNative) {
    await run(async () => {
      await native('exportAudio', { file: m.file });
      notify('语音已导出');
    });
  } else {
    const a = document.createElement('a');
    a.href = media(m.file);
    a.download = '星星宠物语音' + (a.href.endsWith('.wav') ? '.wav' : '.m4a');
    a.click();
  }
}
function memoryDate(at: number) {
  const d = new Date(at);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}
function fmt(at: number) {
  return new Date(at).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function nameOf(id: string) {
  return state.value.pets.find((p: any) => p.id === id)?.name || '成长记录';
}
function recordOpen(e: any) {
  if (!e) return;
  nav('photos');
  memoryTab.value = 'footprints';
  filter.value.query = e.reason;
  filter.value.kind = 'all';
  filter.value.page = 1;
  dateRange.value = 'month';
}
async function logout() {
  await run(async () => {
    await native('logout');
    auth.value = false;
    view.value = 'home';
    password.value = '';
    showPassword.value = false;
  });
}
function visible() {
  if (document.hidden) restoreHomeForm();
  document.body.classList.toggle('background', document.hidden);
  if (!document.hidden) {
    refreshClock.value = Date.now();
    void finishTravel();
  }
}
onMounted(async () => {
  window.recordFinished = finished;
  window.lockApp = () => {
    auth.value = false;
    password.value = '';
    showPassword.value = false;
    if (modal.value) close();
  };
  window.appBack = back;
  document.addEventListener('visibilitychange', visible);
  bindGoalLayoutObservers();
  clockTimer = setInterval(() => {
    if (!document.hidden) {
      refreshClock.value = Date.now();
      void attention();
    }
  }, 60000);
  try {
    status.value = await native('status');
    if (status.value.authenticated) await load();
  } catch (e) {
    fail(e);
  }
});
onBeforeUnmount(() => {
  clearTimeout(previewTimer);
  clearTimeout(shakeTimer);
  clearInterval(clockTimer);
  clearInterval(recordTimer);
  unbindGoalLayoutObservers();
  document.removeEventListener('visibilitychange', visible);
});
</script>

<template>
  <div
    :class="{
      'no-motion': state.settings.reduceMotion,
      'no-glass': state.settings.reduceGlass,
    }"
  >
    <div v-if="!isNative" class="preview-badge"
      >界面预览</div
    >
    <main v-if="!auth" class="login-shell">
      <span class="login-star" aria-hidden="true">✦</span>
      <span class="login-star" aria-hidden="true">✦</span>
      <span class="login-star" aria-hidden="true">✦</span>
      <section class="card login-card" aria-labelledby="login-title">
        <div class="brand-icon" :class="{ 'unlock-pop': unlockPop }" aria-hidden="true"><BrandMark /></div
        ><h1 id="login-title">星星宠物</h1
        ><p class="tagline">把每一次认真，都变成成长的星光</p>
        <form @submit.prevent="login('password')">
          <div class="field login-password" :class="{ shake: loginShake }"
            ><input
              id="login-password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              :disabled="busy"
              aria-label="登录密码"
              :placeholder="
                status.remembered
                  ? '已保存密码，可直接解锁'
                  : '请输入密码'
              "
              name="password"
              autocomplete="current-password"
              maxlength="128" /><button
              type="button"
              class="eye"
              :aria-label="showPassword ? '隐藏密码' : '显示密码'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
              ><Icon :name="showPassword ? 'eye-close' : 'eye'" /></button
          ></div>
          <div class="login-actions">
            <button class="primary login-submit" type="submit" :disabled="busy"
              ><Icon name="lock" />{{ busy ? '正在解锁…' : '解锁小窝' }}</button
            >
            <button
              class="login-biometric"
              type="button"
              :disabled="busy"
              @click="login('bio')"
              ><Icon name="fingerprint" />指纹或面容解锁</button
            >
          </div>
        </form>
      </section>
    </main>
    <div
      v-else
      class="shell"
      :class="{
        'home-shell': view === 'home',
        'sub-shell': subScreen,
        'catalog-shell':
          (view === 'habits' || view === 'photos') && !subScreen,
      }"
      ><header v-if="view !== 'home'" class="app-header"
        ><span class="app-header-side"
          ><button
            v-if="subScreen"
            class="icon-button"
            aria-label="返回"
            @click="back"
            ><Icon name="back" /></button></span
        ><h1>{{ pageTitle }}</h1
        ><span class="app-header-side end"></span></header
      >
      <div v-if="state.care.clockWarning" class="notice"
        >检测到设备时间变化，伙伴照料计时已暂停。<button
          class="small"
          @click="
            run(async () => {
              await commit({ type: 'clock' });
            })
          "
          >时间无误，恢复计时</button
        ></div
      >
      <template v-if="view === 'home'">
        <section :class="['home-world', { hungry: hungry.stage > 0, 'dock-open': dockOpen }]">
          <div v-if="current" class="home-summary"
              ><div class="summary-message" aria-live="polite"
                ><p v-for="line in homeMessage" :key="line">{{ line }}</p></div
              ><div class="summary-metrics"
                ><div class="summary-stat" aria-label="伙伴等级"
                  ><b class="num" :class="{ 'level-pop': celebrate }"><TweenNumber :value="homeLevel" :reduce-motion="state.settings.reduceMotion" /></b><span>等级</span></div
                ><button
                  class="summary-stat"
                  @click="previewNextForm"
                  aria-label="点按预览下一等级形态"
                  ><b class="num"><TweenNumber :value="pct(current)" suffix="%" :reduce-motion="state.settings.reduceMotion" /></b><span>进度</span></button
                ><div class="summary-stat" :title="String(total.earned)"
                  ><b class="num"><TweenNumber :value="total.earned" :format="short" :reduce-motion="state.settings.reduceMotion" /></b><span>累计</span></div
                ><div class="summary-stat" :title="String(total.net)"
                  ><b class="num"><TweenNumber :value="total.net" :format="short" :reduce-motion="state.settings.reduceMotion" /></b><span>当前</span></div
                ></div
              ><button
                class="summary-progress"
                :class="{ flash: quickFlash }"
                @click="previewNextForm"
                aria-label="点按成长进度预览下一形态"
                ><svg
                  viewBox="0 0 1000 20"
                  preserveAspectRatio="none"
                  role="progressbar"
                  aria-label="当前等级成长进度"
                  :aria-valuenow="pct(current)"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  >
                  <defs>
                    <path id="home-growth-shape" d="M8 9 C170 8.8 286 3.2 500 3.2 C714 3.2 830 8.8 992 9 Q997 10 992 11 C830 11.2 714 16.8 500 16.8 C286 16.8 170 11.2 8 11 Q3 10 8 9Z" />
                    <linearGradient id="home-growth-track" x1="0" y1="0" x2="1" y2="0">
                      <stop class="progress-track-edge" offset="0%" />
                      <stop class="progress-track-core" offset="50%" />
                      <stop class="progress-track-edge" offset="100%" />
                    </linearGradient>
                    <linearGradient id="home-growth-gradient" x1="0" y1="0" x2="1" y2="0">
                      <stop class="progress-start" offset="0%" />
                      <stop class="progress-end" offset="100%" />
                    </linearGradient>
                    <clipPath id="home-growth-clip">
                      <rect x="0" y="0" height="20" :style="{ width: pct(current) + '%' }" />
                    </clipPath>
                  </defs>
                  <use class="progress-track" href="#home-growth-shape" />
                  <use class="progress-fill" href="#home-growth-shape" clip-path="url(#home-growth-clip)" />
                </svg></button
            ></div>
          <template v-if="current">
            <div
              class="pet-playground"
              :class="{
                'chat-active': chatOpen,
                'dock-open': dockOpen,
                'inline-active':
                  chatOpen || renameOpen || memoryInline || photoOpen || todayOpen,
              }"
              ><div class="head-bubbles" aria-live="polite"
                  ><button
                    v-for="bubble in (away ? [] : headBubbles).slice(-2)"
                    :key="bubble.id"
                    class="head-bubble"
                    @click="
                      headBubbles = headBubbles.filter(
                        (x) => x.id !== bubble.id,
                      )
                    "
                    aria-label="关闭互动气泡"
                    >{{ bubble.text }}</button
                  ><button
                    v-if="
                      !away &&
                      !headBubbles.length &&
                      state.care.rationDay !== dayKey()
                    "
                    class="head-bubble ration-bubble"
                    @click="care('ration')"
                    :disabled="busy"
                    aria-label="领取每日口粮"
                    ><Icon name="food" />今天的口粮准备好了</button
                  ></div
              ><div class="pet-stage home-orbit"
                ><div v-if="away" class="travel-empty"
                  ><span class="travel-icon" aria-hidden="true"><img v-if="dockIcon3d('travel')" :src="dockIcon3d('travel')" alt="" /><Icon v-else name="map-pin" /></span>
                  <h3>{{ current.name }}去探索啦</h3
                  ><p class="travel-dest"><Icon name="map-pin" />{{ trip.name }}</p
                  ><dl class="travel-times"
                    ><div
                      ><dt>出发</dt
                      ><dd class="num">{{
                        new Date(trip.departAt).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }}</dd></div
                    ><div
                      ><dt>预计回来</dt
                      ><dd class="num">{{
                        new Date(trip.returnAt).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }}<span
                        class="travel-ring"
                        role="img"
                        :aria-label="
                          '已出发 ' + Math.round(travelProgress * 100) + '%'
                        "
                        ><svg viewBox="0 0 24 24" aria-hidden="true"
                          ><circle class="travel-ring-track" cx="12" cy="12" r="10" /><circle
                            class="travel-ring-fill"
                            cx="12"
                            cy="12"
                            r="10"
                            pathLength="100"
                            stroke-dasharray="100"
                            :stroke-dashoffset="100 - travelProgress * 100" /></svg></span
                      ></dd></div
                    ></dl
                  ></div
                ><LivePet
                  v-else
                  :pet="shownPet"
                  :level="homeLevel"
                  :action="chatAction || emotion"
                  :speech="speech"
                  :reduce-motion="state.settings.reduceMotion"
                  :affection="companion.affection"
                  @live-failed="liveFailed = $event"
                  @click="randomInteraction"
                /><div
                  v-if="celebrate && !state.settings.reduceMotion"
                  class="celebrate-stars"
                  aria-hidden="true"
                  ><span
                    v-for="n in 7"
                    :key="celebrateKey + '-' + n"
                    class="celebrate-star"
                    :style="{ '--i': n - 1 }"
                    ><i>★</i></span
                  ></div
                ><p v-if="homeLevel !== level" class="form-preview"
                  >形态预览中 · 当前 Lv.{{ level }}</p
                ></div
              ><small
                  v-if="liveFailed && !away"
                  class="static-art-note"
                  >当前设备显示静态原画</small
                ><div class="home-identity"
                ><button
                  class="summary-child-name"
                  @click="cycleChild"
                  :aria-label="'切换小朋友，当前' + activeProfile.name"
                  >{{ activeProfile.name }}的</button
                ><h2>{{ current.name }}</h2
              ></div
              ><aside
                class="pet-dock"
                aria-label="伙伴互动"
                ><button
                  class="dock-item dock-trigger"
                  :class="[{ active: dockOpen }, dockHue('trigger')]"
                  :aria-expanded="dockOpen"
                  :aria-label="dockOpen ? '收起伙伴互动' : '展开伙伴互动'"
                  title="伙伴互动"
                  @click="dockOpen = !dockOpen"
                  ><img v-if="dockIcon3d('trigger')" :src="dockIcon3d('trigger')" alt="" /><Icon v-else name="star" /><span class="dock-label">互动</span></button
                ><div v-if="dockOpen" class="dock-actions"
                  ><div v-if="!away" class="dock-group" aria-label="日常互动"
                    ><button
                      class="dock-item"
                      :class="dockHue('feed')"
                      :style="{ '--dock-i': 0 }"
                      :disabled="busy"
                      aria-label="喂食"
                      title="喂食"
                      @click="
                        care('feed');
                      "
                      ><img v-if="dockIcon3d('feed')" :src="dockIcon3d('feed')" alt="" /><Icon v-else name="food" /><span class="dock-label">喂食</span></button
                    ><button
                      class="dock-item"
                      :class="dockHue('play')"
                      :style="{ '--dock-i': 1 }"
                      aria-label="玩耍"
                      title="玩耍"
                      :disabled="busy"
                      @click="
                        randomInteraction();
                      "
                      ><img v-if="dockIcon3d('play')" :src="dockIcon3d('play')" alt="" /><Icon v-else name="heart" /><span class="dock-label">玩耍</span></button
                    ></div
                  ><div v-if="!away" class="dock-group" aria-label="陪伴功能"
                    ><button
                      class="dock-item"
                      :class="[{ active: photoOpen }, dockHue('photo')]"
                      :style="{ '--dock-i': 2 }"
                      :aria-pressed="photoOpen"
                      aria-label="合影"
                      title="合影"
                      @click="
                        togglePhoto();
                      "
                      ><img v-if="dockIcon3d('photo')" :src="dockIcon3d('photo')" alt="" /><Icon v-else name="camera" /><span class="dock-label">合影</span></button
                    ><button
                      class="dock-item"
                      :class="[{ active: chatOpen }, dockHue('chat')]"
                      :style="{ '--dock-i': 3 }"
                      :aria-pressed="chatOpen"
                      aria-label="聊天"
                      title="聊天"
                      @click="
                        toggleChat();
                      "
                      ><img v-if="dockIcon3d('chat')" :src="dockIcon3d('chat')" alt="" /><Icon v-else name="chat" /><span class="dock-label">聊天</span></button
                    ></div
                  ><div v-if="!away" class="dock-group" aria-label="扩展工具"
                    ><button
                      class="dock-item"
                      :class="[{ active: memoryInline }, dockHue('mic')]"
                      :style="{ '--dock-i': 4 }"
                      :aria-pressed="memoryInline"
                      aria-label="录一段声音"
                      title="录一段声音"
                      @click="
                        memoryOpen();
                      "
                      ><img v-if="dockIcon3d('mic')" :src="dockIcon3d('mic')" alt="" /><Icon v-else name="mic" /><span class="dock-label">录音</span></button
                    ><button
                      class="dock-item"
                      :class="dockHue('travel')"
                      :style="{ '--dock-i': 5 }"
                      :disabled="
                        busy || state.settings.travelEnabled === false || !!trip
                      "
                      aria-label="出去探索"
                      title="出去探索"
                      @click="
                        startTravel();
                      "
                      ><img v-if="dockIcon3d('travel')" :src="dockIcon3d('travel')" alt="" /><Icon v-else name="map-pin" /><span class="dock-label">探索</span></button
                    ><button
                      class="dock-item"
                      :class="[{ active: renameOpen }, dockHue('rename')]"
                      :style="{ '--dock-i': 6 }"
                      :aria-pressed="renameOpen"
                      aria-label="改个名字"
                      title="改个名字"
                      @click="
                        toggleRename();
                      "
                      ><img v-if="dockIcon3d('rename')" :src="dockIcon3d('rename')" alt="" /><Icon v-else name="edit" /><span class="dock-label">改名</span></button
                    ><button
                      class="dock-item"
                      :class="dockHue('pet')"
                      :style="{ '--dock-i': 7 }"
                      :disabled="state.pets.length <= 1"
                      aria-label="换个伙伴"
                      title="换个伙伴"
                      @click="
                        cycleCompanion();
                      "
                      ><img v-if="dockIcon3d('pet')" :src="dockIcon3d('pet')" alt="" /><Icon v-else name="pet" /><span class="dock-label">伙伴</span></button
                    ></div
                  ><div v-if="current" class="dock-group" aria-label="今日习惯"
                    ><button
                      class="dock-item"
                      :class="[{ active: todayOpen }, dockHue('today')]"
                      :style="{ '--dock-i': 8 }"
                      :aria-pressed="todayOpen"
                      :aria-label="todayGoals.length ? '今日习惯，还有 ' + todayGoals.length + ' 个未完成' : '今日习惯'"
                      title="今日习惯"
                      @click="
                        toggleToday();
                      "
                      ><img v-if="dockIcon3d('today')" :src="dockIcon3d('today')" alt="" /><Icon v-else name="habit" /><span class="dock-label">习惯</span><span v-if="todayGoals.length" class="dock-badge num" aria-hidden="true">{{ cap(todayGoals.length) }}</span></button
                    ></div
                ></div
                ></aside
              ><div v-if="chatOpen || memoryInline || renameOpen || photoOpen || greeting || todayOpen" class="home-zone"
                ><ChatPanel
                  v-if="chatOpen"
                  :key="current.id"
                  :context="chatInfo"
                  :preferences="companion"
                  :voice-enabled="state.settings.voiceEnabled !== false"
                  @action="chatAction = $event"
                  @speech="speech = $event"
                  @close="chatOpen = false" /><div
                  v-else-if="memoryInline"
                  class="zone-card inline-memory"
                  aria-label="首页录音"
                  ><div class="zone-head"
                    ><b>收藏一段声音</b
                    ><button
                      class="icon-button"
                      aria-label="关闭录音"
                      @click="memoryOpen"
                      ><Icon name="close" /></button></div
                  ><input name="memoryText"
                    v-model="memoryText"
                    maxlength="500"
                    aria-label="录音留言"
                    placeholder="为这段声音写一句话（选填）" /><AudioPlayer
                    v-if="recordFile"
                    :src="media(recordFile)" /><div class="zone-actions"
                    ><button
                      v-if="!recording"
                      :disabled="busy"
                      @click="recordStart()"
                      ><Icon name="mic" />{{
                        recordFile ? '重新录制' : '开始录音'
                      }}</button
                    ><button
                      v-else
                      class="danger recording"
                      :disabled="busy"
                      @click="stopRecord"
                      ><Icon name="stop" />停止<span class="num rec-time"
                        >{{ recordSeconds }}/60s</span
                      ></button
                    ><button
                      class="primary"
                      :disabled="busy || recording || !recordFile"
                      @click="saveMemory"
                      >保存录音</button
                    ></div
                  ></div
                ><form
                  v-else-if="renameOpen"
                  class="zone-card inline-rename"
                  @submit.prevent="saveRename"
                  ><div class="zone-head"
                    ><b>给伙伴换个名字</b
                    ><button
                      type="button"
                      class="icon-button"
                      aria-label="关闭改名"
                      @click="toggleRename"
                      ><Icon name="close" /></button></div
                  ><input name="renameText"
                    v-model="renameText"
                    aria-label="伙伴名字"
                    :maxlength="NAME_LIMITS.pet"
                    placeholder="输入伙伴的新名字" /><div class="zone-actions"
                    ><button
                      class="primary"
                      :disabled="busy || !renameText.trim() || renameText.trim().length > NAME_LIMITS.pet"
                      type="submit"
                      >保存名字</button
                    ></div
                  ></form
                ><div
                  v-else-if="photoOpen && !photoFile"
                  class="zone-card inline-photo-choice"
                  aria-label="合照操作"
                  ><div class="zone-head"
                    ><b>和{{ current.name }}留下合影</b
                    ><button
                      class="icon-button"
                      aria-label="关闭拍照"
                      @click="togglePhoto"
                      ><Icon name="close" /></button></div
                  ><p class="zone-hint">拍摄新照片，或从相册选择一张喜欢的照片。</p
                  ><div class="zone-actions"
                    ><button :disabled="busy" @click="pickPhoto(false)"
                      ><Icon name="photo" />从相册选择</button
                    ><button
                      class="primary"
                      :disabled="busy"
                      @click="pickPhoto(true)"
                      ><Icon name="camera" />拍摄照片</button
                    ></div
                  ></div
                ><div v-else-if="greeting" class="zone-card greeting"
                  ><div class="zone-head"
                    ><b>{{ current.name }}想和你说话</b></div
                  ><p class="zone-hint">{{ greeting }}</p
                  ><div class="zone-actions"
                    ><button
                      @click="
                        greeting = '';
                        attentionDismissed = true;
                      "
                      >稍后</button
                    ><button
                      class="primary"
                      @click="
                        chatOpen = true;
                        greeting = '';
                      "
                      >聊一会儿</button
                    ></div
                  ></div
                ><div v-else-if="todayOpen" class="zone-card today-card"
                  ><div class="zone-head"
                    ><b>今日习惯</b
                    ><small v-if="tasks.length" class="num"
                      >{{ done }}/{{ tasks.length }}</small
                    ><button class="icon-button" aria-label="关闭今日习惯" @click="todayOpen = false"><Icon name="close" /></button></div
                  ><div v-if="todayGoals.length" class="today-stack" role="list" aria-label="今日未完成习惯"
                    ><article
                      v-for="(h, i) in todayGoals"
                      :key="h.id"
                      class="today-plan"
                      :class="{ leaving: quickLeavingId === h.id }"
                      :style="{ '--stack-i': i }"
                      role="listitem"
                      ><span class="tile-icon today-icon" :class="categoryHue(h.category)" aria-hidden="true"><img v-if="planIcon3d(h)" :src="planIcon3d(h)" :alt="h.name + '图标'" /><Icon v-else :name="planIcon(h)" /></span
                      ><span class="today-plan-main"
                        ><b class="today-name">{{ h.name }}</b
                        ><small class="today-sub">{{ h.category }} · 今日 {{ habitCount(state, h, dayKey()) }}/{{ h.target }} 次</small></span
                      ><button
                        class="primary small today-complete"
                        type="button"
                        :disabled="i !== 0 || quickBusy || busy"
                        :aria-label="'完成' + h.name + '，加' + h.points + '分'"
                        @click="quickComplete(h, $event)"
                        >完成 +{{ h.points }}</button
                      ></article
                    ></div
                  ><button
                    v-else-if="!tasks.length"
                    class="today-empty"
                    @click="nav('goalLibrary')"
                    ><Icon name="plus" /><span>挑一个今天想完成的习惯</span></button
                  ><p v-else class="today-empty done"
                    ><Icon name="check" /><span>今日习惯都完成啦</span></p
                  ></div
                ></div
              ></div
            >
          </template>
          <template v-else
            ><div class="home-summary-space" aria-hidden="true"></div
            ><div class="pet-playground home-empty"
              ><button
                class="home-empty-orbit home-orbit"
                @click="nav('pets')"
                aria-label="遇见第一位伙伴，前往伙伴图鉴"
                ><span class="brand-tile" aria-hidden="true"><BrandMark /></span
                ><strong>遇见你的第一位星星伙伴</strong
                ><span
                  >选一个喜欢的伙伴，为它取名。<br />往后的每一点进步，都有人陪你收藏。</span
                  ><span class="home-empty-action">挑选第一位伙伴<Icon name="forward" /></span></button
              ><div class="home-identity"
                ><button
                  class="summary-child-name"
                  @click="cycleChild"
                  :aria-label="'切换小朋友，当前' + activeProfile.name"
                  >{{ activeProfile.name }}</button
                ></div
              ></div
            ></template
          >
          <span
            v-if="quickFly"
            :key="quickFly.key"
            class="quick-fly-chip num"
            aria-hidden="true"
            :style="{
              left: quickFly.x + 'px',
              top: quickFly.y + 'px',
              '--fly-dx': quickFly.dx + 'px',
              '--fly-dy': quickFly.dy + 'px',
            }"
            >+{{ quickFly.points }}</span
          >
        </section>
      </template>
      <section v-if="view === 'photo' && photoOwned" class="card photo-subpage"
        ><PhotoEditor
          :key="photoFile"
          :photo="media(photoFile)"
          :pet="photoSpecies"
          :max-level="levelOf(photoOwned)"
          :name="photoOwned.name"
          @save="savePhoto"
          @cancel="nav('home')"
      /></section>
      <section
        v-if="view === 'memoryDetail' && selectedMemory"
        class="card memory-detail-page"
        aria-label="回忆详情"
      >
        <div class="memory-detail-meta"
          ><span class="kind-icon" :class="'kind-' + selectedMemory.kind" aria-hidden="true"><img v-if="memoryKind3d(selectedMemory.kind)" :src="memoryKind3d(selectedMemory.kind)" alt="" /></span
          ><span class="badge">{{
            ({ photo: '照片', audio: '声音', note: '文字' } as any)[
              selectedMemory.kind
            ]
          }}</span
          ><time>{{ memoryDate(selectedMemory.at) }}</time></div
        >
        <GalleryImage
          v-if="selectedMemory.kind === 'photo'"
          class="memory-detail-photo"
          :src="media(selectedMemory.file)"
          :alt="'与' + selectedMemory.name + '的合照'"
          @pointerdown="memoryPhotoDown(selectedMemory, $event)"
          @pointermove="memoryPhotoMove"
          @pointerup="memoryPhotoUp"
          @pointercancel="memoryPhotoUp"
          @contextmenu.prevent="savePhotoFromMemory(selectedMemory)"
        />
        <AudioPlayer
          v-if="selectedMemory.kind === 'audio'"
          :src="media(selectedMemory.file)"
          download
          @download="downloadAudio(selectedMemory)"
        />
        <h2>{{ selectedMemory.name || nameOf(selectedMemory.petId) }}</h2>
        <p
          v-if="
            (selectedMemory.kind !== 'photo' ||
              selectedMemory.id.startsWith('demo-') ||
              selectedMemory.source === 'adoption') &&
            memoryWish(selectedMemory)
          "
          class="gallery-note meeting-wish"
          ><span class="meeting-wish-line"
            ><strong>{{ memoryWish(selectedMemory)?.title }}</strong
            ><span class="meeting-wish-dot"> · </span
            >{{ memoryWish(selectedMemory)?.line1 }}</span
          ><span
            v-if="memoryWish(selectedMemory)?.line2"
            class="meeting-wish-line"
            >{{ memoryWish(selectedMemory)?.line2 }}</span
          ></p
        ><p
          v-else-if="
            selectedMemory.kind !== 'photo' ||
            selectedMemory.id.startsWith('demo-') ||
            selectedMemory.source === 'adoption'
          "
          class="gallery-note"
          >{{ memoryDisplayText(selectedMemory) }}</p
        >
        <div v-if="selectedMemory.reversedAt" class="memory-reversed"
          ><Icon name="history" /><span
            ><b>已撤销对应加分</b
            ><small v-if="selectedMemory.reverseReason">{{
              selectedMemory.reverseReason
            }}</small></span
          ></div
        >
        <dl v-if="selectedMemory.departAt" class="meta-list"
          ><div
            ><dt>出发时间</dt
            ><dd class="num">{{
              new Date(selectedMemory.departAt).toLocaleString('zh-CN', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            }}</dd></div
          ><div
            ><dt>旅行时长</dt
            ><dd class="num"
              >{{ (+selectedMemory.travelHours || 0).toFixed(1) }} 小时</dd
            ></div
          ></dl
        >

        <template
          v-if="
            selectedMemory.kind === 'photo' &&
            !selectedMemory.id.startsWith('demo-')
          "
          ><label class="field"
            ><span>照片备注</span
            ><textarea name="memoryNote"
              v-model="memoryNote"
              maxlength="500"
              placeholder="记下这张合照的小故事"
            ></textarea></label
          ><div class="memory-detail-actions"
            ><button
              class="primary"
              :disabled="busy || memoryNote === selectedMemory.text"
              @click="savePhotoNote"
              >保存备注</button
            ></div
          ></template
        >

        <button
          v-if="selectedMemory.eventId"
          class="small ghost"
          @click="
            recordOpen(
              state.events.find((e: any) => e.id === selectedMemory.eventId),
            )
          "
          >查看关联记录</button
        >
      </section>
      <template v-if="view === 'photos'"
        ><div class="segmented page-tabs" role="tablist" aria-label="回忆页面"
          ><button
            role="tab"
            :aria-selected="memoryTab === 'gallery'"
            :class="{ active: memoryTab === 'gallery' }"
            @click="memoryTab = 'gallery'"
            >精彩回忆</button
          ><button
            role="tab"
            :aria-selected="memoryTab === 'footprints'"
            :class="{ active: memoryTab === 'footprints' }"
            @click="memoryTab = 'footprints'"
            >成长足迹</button
          ></div
        ><MemoriesGallery
          v-if="memoryTab === 'gallery'"
          v-model:query="memoryQuery"
          v-model:kind="memoryKind"
          :options="memoryFilterOptions"
          :items="galleryItems"
          :page="galleryPage"
          :pages="galleryPages"
          :filtered-count="gallery.length"
          :total-count="galleryTotal"
          :empty-icon="icon3d('memory-camera.png')"
          :search-icon="icon3d('pick-search.png')"
          :media="media"
          :kind-icon="memoryKind3d"
          :note-icon="memoryNoteIcon3d"
          :pet-name="nameOf"
          :date-label="memoryDate"
          @update:query="galleryPage = 1"
          @update:kind="galleryPage = 1"
          @page="
            galleryPage = $event;
            keepInView('memory-gallery');
          "
          @clear="clearMemoryFilter"
          @home="nav('home')"
          @remove="requestDeleteMemory"
          @open="openGalleryItem"
          @download="downloadAudio"
          @save-photo="savePhotoFromMemory"
          @photo-down="memoryPhotoDown"
          @photo-move="memoryPhotoMove"
          @photo-up="memoryPhotoUp"
        /><GrowthFootprints
          v-else
          :query="filter.query"
          :kind="filter.kind"
          :date-range="dateRange"
          :items="list.items"
          :page="list.page"
          :pages="list.pages"
          :total="list.total"
          :filtering="footprintFiltering"
          :busy="busy"
          :search-icon="icon3d('pick-search.png')"
          :empty-icon="icon3d('footprints-paw.png')"
          :star-icon="icon3d('record-star.png')"
          :event-icon="eventIcon3d"
          :reversed="(e) => isReversed(state, e.id)"
          :undoable="canUndo"
          :clock="fmt"
          @update:query="
            filter.query = $event;
            filter.page = 1;
          "
          @update:kind="
            filter.kind = $event;
            filter.page = 1;
          "
          @update:date-range="
            dateRange = $event;
            filter.page = 1;
          "
          @page="
            filter.page = $event;
            keepInView('habit-footprints');
          "
          @clear="clearFootprintFilter"
          @plans="goFootprintPlans"
          @undo="requestUndo"
        />
      </template>
      <template v-if="view === 'pets'"
        ><div class="segmented page-tabs" role="tablist" aria-label="伙伴形态筛选"
          ><button
            role="tab"
            :aria-selected="!previewAll"
            :class="{ active: !previewAll }"
            @click="
              previewAll = false;
              preview = {};
            "
            >初始形态</button
          ><button
            role="tab"
            :aria-selected="previewAll"
            :class="{ active: previewAll }"
            @click="
              previewAll = true;
              preview = {};
            "
            >满级形态</button
          ></div
        ><SearchField
          v-model="petQuery"
          placeholder="搜索星星伙伴"
          label="搜索星星伙伴"
          @input="petPage = 1"
          @clear="petPage = 1"
        /><EmptyState
          v-if="!visiblePets.length"
          icon="search"
          :icon3d="icon3d('pick-search.png')"
          title="没有找到这位伙伴"
          hint="换一个名字或特征试试"
          action="清除搜索"
          @action="petQuery = ''"
        /><Pager
          v-else
          class="pets-pager"
          label="伙伴图鉴翻页"
          :page="petPage"
          :pages="petPages"
          :peek-hint="false"
          @change="petPage = $event"
        ><div id="pet-grid" class="tile-grid pet-grid"
          ><article
            v-for="p in visiblePets"
            :key="p.id"
            class="pet-card"
            :class="petHue(p)"
            role="link"
            tabindex="0"
            :aria-label="
              '查看' + (previewAll ? p.adult : p.name) + '的伙伴档案'
            "
            @click="petDetail(p.id)"
            @keydown.enter="petDetail(p.id)"
            @keydown.space.prevent="petDetail(p.id)"
            ><div class="pet-card-top"
              ><span class="tag">{{ p.tag }}</span
              ><span
                class="pet-status"
                :class="catalogPetStatus(p.id).kind"
                :aria-label="catalogPetStatus(p.id).label"
                :title="catalogPetStatus(p.id).label"
                ><Icon :name="catalogPetStatus(p.id).icon" /></span
              ></div
            ><Pet
              :pet="p"
              :level="previewAll ? 10 : 1"
              :show-rank="false"
            /><h3>{{ previewAll ? p.adult : p.name }}</h3></article
          ><span
            v-for="n in fill(visiblePets, 6, petPage, petPages)"
            :key="'pet-gap' + n"
            class="tile-gap"
            aria-hidden="true"
          ></span
        ></div
        ></Pager></template>
      <template v-if="view === 'detail' && detail"
        ><section class="card detail-hero" :class="petHue(detail)"
          ><div class="detail-top"
            ><span class="tag">{{ detail.tag }}</span
            ><div class="detail-level-meta"
              ><strong class="num">Lv.{{ detailLevel }}</strong
              ><small v-if="owned">{{
                detailLevel <= levelOf(owned)
                  ? '已解锁'
                  : '实际 Lv.' + levelOf(owned)
              }}</small></div
            ></div
          ><div
            class="pet-stage detail-swipe-stage"
            tabindex="0"
            role="slider"
            aria-label="左右滑动预览伙伴形态"
            aria-valuemin="1"
            aria-valuemax="10"
            :aria-valuenow="detailLevel"
            @pointerdown="previewPointerDown"
            @pointerup="previewPointerUp"
            @keydown.left.prevent="detailLevel = Math.max(1, detailLevel - 1)"
            @keydown.right.prevent="detailLevel = Math.min(10, detailLevel + 1)"
            ><Pet
              :pet="detail"
              :level="detailLevel"
              :show-rank="false"
              :emotion="emotion"
              @click="
                previewSwiped ? (previewSwiped = false) : animate('happy')
              " /></div
          ><h2>{{ owned?.name || detail.name }}</h2
          ><div class="detail-stage-copy"
            ><dl v-if="owned" class="meta-list three"
              ><div
                ><dt>相遇</dt
                ><dd class="num">{{
                  new Date(owned.adoptedAt).toLocaleDateString('zh-CN', {
                    year: '2-digit',
                    month: 'numeric',
                    day: 'numeric',
                  })
                }}</dd></div
              ><div
                ><dt>伙伴序号</dt><dd class="num">第 {{ owned.order }} 个</dd></div
              ><div
                ><dt>经验</dt
                ><dd class="num"
                  >{{ short(owned.xp) }}<small>/{{ short(owned.thresholds[9]) }}</small></dd
                ></div
              ></dl
            ><dl v-else class="meta-list"
              ><div
                ><dt>伙伴序号</dt
                ><dd class="num">第 {{ state.pets.length + 1 }} 个</dd></div
              ><div
                ><dt>满级需要</dt
                ><dd class="num"
                  >{{ short(thresholds(state.pets.length + 1)[9]) }} 经验</dd
                ></div
              ></dl
            ></div
          ><div class="detail-stage-nav"
            ><p class="detail-swipe-hint">← 左右滑，看不同等级的样子 →</p
            ><div
              class="stage-stepper"
              role="group"
              aria-label="左右滑动选择伙伴成长形态"
              @pointerdown="stageDown"
              @pointermove="stageMove"
              @pointerup="stageUp"
              @pointercancel="stageUp"
              ><button
                v-for="n in 10"
                :key="n"
                type="button"
                :style="{ '--step-i': n - 1 }"
                :class="{
                  active: detailLevel === n,
                  unlocked: owned && n <= levelOf(owned),
                }"
                :aria-label="'查看第 ' + n + ' 级形态'"
                :aria-pressed="detailLevel === n"
                @click="stageSelect(n)"
                ><span></span></button
            ></div
          ></div>
          <details class="detail-story" :key="detail.id"
            ><summary
              ><span>伙伴小故事</span
              ><Icon name="chevron" /></summary
            ><div class="detail-story-body"
              ><p class="detail-story-lead">{{ detail.description }}</p
              ><p
                v-if="
                  detail.introduction &&
                  detail.introduction !== detail.description
                "
                >{{ detail.introduction }}</p
              ><p
                v-for="(paragraph, index) in detail.story || [
                  '它的故事，正从与你相遇的这一天开始。',
                ]"
                :key="index"
                >{{ paragraph }}</p
              ></div
            ></details
          ></section
        >
        <div class="page-actions"
          ><button
            v-if="!owned && !activePet(state)"
            class="primary wide"
            @click="openAdoption"
            ><Icon name="pet" />领养这个伙伴</button
          ><p v-else-if="!owned" class="notice-line"
            ><Icon name="lock" />当前伙伴满级后开放领养</p
          ></div
        >
      </template>
      <template v-if="view === 'habits'"
        ><div
          v-if="habitMode === 'list'"
          class="segmented page-tabs"
          role="tablist"
          aria-label="习惯页面"
          ><button
            role="tab"
            :aria-selected="habitTab === 'plans'"
            :class="{ active: habitTab === 'plans' }"
            @click="selectHabitTab('plans')"
            >习惯培养</button
          ><button
            role="tab"
            :aria-selected="habitTab === 'score'"
            :class="{ active: habitTab === 'score' }"
            @click="selectHabitTab('score')"
            >日常表现</button
          ></div
        ><section
          v-show="habitTab === 'score' && habitMode === 'list'"
          id="habit-score"
          class="card habit-catalog score-card"
          ><QuickScore
            ref="quickScore"
            v-model:reason="scoreReason"
            :rules="state.rules"
            :history="scoreRuleHistory"
            :busy="busy"
            :net="total.net"
            :done="done"
            :task-count="tasks.length"
            :plan-count="state.habits.length"
            @save="saveCustomScore"
            @add="addRule"
            @remove="removeRule" /></section
        ><section
          v-if="habitTab === 'plans' && habitMode === 'list'"
          id="goal-library"
          class="card habit-catalog goals-card"
          ><div class="habit-panel"
            ><div class="section-head"
            ><div class="section-title"
            ><small>单击启停，点右下角编辑，长按删除</small></div
            ><button
              class="icon-button"
              type="button"
              aria-label="自定义习惯"
              title="自定义习惯"
              @click="editGoalTemplate()"
              ><Icon name="plus" /></button></div
          ><CatalogToolbar
            :options="goalFilterOptions"
            v-model:filter="goalFilter"
            v-model:query="goalQuery"
            filter-label="习惯筛选"
            search-label="搜索习惯"
            search-placeholder="搜索习惯"
          /><EmptyState
            v-if="!filteredGoals.length"
            icon="search"
            :icon3d="icon3d('pick-search.png')"
            title="没有匹配的习惯"
            hint="换个关键词，或者自己写一个"
            action="自定义习惯"
            @action="editGoalTemplate()"
          /><Pager
            v-else
            class="goals-pager"
            label="习惯翻页"
            :page="goalPage"
            :pages="goalPages"
            :peek-hint="false"
            @change="goalPage = $event"
          ><div
            ref="goalGridRef"
            class="tile-grid goal-grid"
            :style="goalGridStyle"
            ><article
              v-for="goal in visibleGoals"
              :key="goal.id"
              class="goal-card"
              ><span
                v-if="addedHabitForGoal(goal)?.status === 'active'"
                class="goal-enabled-badge"
                >已启用</span
              ><button
                class="goal-card-main"
                type="button"
                :disabled="busy"
                :aria-label="
                  goalDisplayName(goal) +
                  (addedHabitForGoal(goal)?.status === 'active'
                    ? '，已启用，单击暂停，双击编辑，长按删除'
                    : addedHabitForGoal(goal)
                      ? '，已暂停，单击启用，双击编辑，长按删除'
                      : '，单击启用，双击编辑')
                "
                :aria-pressed="addedHabitForGoal(goal)?.status === 'active'"
                @pointerdown="startGoalHold(goal, $event)"
                @pointermove="moveGoalHold"
                @pointerup="cancelGoalHold"
                @pointercancel="cancelGoalHold"
                @pointerleave="cancelGoalHold"
                @contextmenu.prevent="onGoalCardDelete(goal)"
                @click="onGoalCardActivate(goal)"
                @dblclick.prevent="onGoalCardDblClick(goal)"
                ><span class="goal-card-icon"
                  ><span class="tile-icon" :class="categoryHue(goal.category || '')"><img v-if="goalIcon3d(goal)" :src="goalIcon3d(goal)" :alt="goalDisplayName(goal) + '图标'" /><Icon v-else :name="goal.icon" /></span
                  ><span
                    class="goal-points num"
                    :aria-label="'分值 +' + goalPoints(goal)"
                    >+{{ goalPoints(goal) }}</span
                  ></span
                ><span class="goal-card-text"
                  ><b>{{ goalDisplayName(goal) }}</b
                  ><small>{{ goal.hint }}</small></span
                ></button
              ><button
                class="goal-edit secondary"
                type="button"
                :aria-label="'编辑' + goalDisplayName(goal)"
                @click="onGoalCardDblClick(goal)"
                >编辑</button
            ></article
            ><span
              v-for="n in fill(visibleGoals, goalPageSize, goalPage, goalPages)"
              :key="'goal-gap' + n"
              class="tile-gap"
              aria-hidden="true"
            ></span
          ></div
          ></Pager></div
          ></section
      ></template>
      <SettingsPage
        v-if="view === 'settings'"
        :state="state"
        :themes="themes"
        :theme-id="themeId"
        :active-profile="activeProfile"
        :profile-count="profiles.length"
        :status="status"
        :busy="busy"
        @select-theme="setting('theme', $event)"
        @navigate="nav"
        @setting="setting($event.key, $event.value)"
        @toggle-bio="toggleBio"
        @export-backup="
          run(async () => {
            await native('exportBackup');
            notify('完整备份已导出');
          })
        "
        @import-backup="importBackup"
        @import-pet="importPet"
        @logout="logout"
      />
      <section v-if="view === 'children'" class="card child-list"
        ><div
          class="child-row"
          v-for="p in profiles"
          :key="p.id"
          :class="{ active: p.id === state.activeProfileId }"
          ><button
            class="child-pick"
            type="button"
            :aria-label="
              p.id === state.activeProfileId
                ? p.name + '，当前使用'
                : '切换到' + p.name
            "
            :aria-current="p.id === state.activeProfileId ? 'true' : undefined"
            :disabled="busy"
            @click="p.id !== state.activeProfileId && switchProfile(p.id)"
            ><Avatar
              :avatar="p.avatar"
              :src="p.avatarFile ? media(p.avatarFile) : ''"
            /><span class="grow"
              ><b>{{ p.name }}</b
              ><small>{{
                p.id === state.activeProfileId ? '当前使用' : '点击切换小朋友'
              }}</small></span
            ></button
          ><button
            class="child-settings-button icon-button"
            type="button"
            :aria-label="'设置' + p.name + '档案'"
            :title="'设置' + p.name + '档案'"
            :disabled="busy"
            @click="editProfile(p)"
            ><Icon name="settings" /></button></div
        ><button
          class="primary wide"
          :disabled="profiles.length >= 10"
          @click="editProfile()"
          ><Icon name="plus" />添加小朋友</button
        ></section
      >
      <section v-if="view === 'childEdit'" class="card child-editor"
        ><Avatar
          large
          :avatar="profileDraft.avatar"
          :src="profileDraft.avatarFile ? media(profileDraft.avatarFile) : ''"
        /><div class="avatar-choices" role="radiogroup" aria-label="选择头像"
          ><button
            v-for="[icon, name, label] in avatarChoices"
            :key="icon"
            type="button"
            role="radio"
            :aria-label="label"
            :aria-checked="profileDraft.avatar === icon && !profileDraft.avatarFile"
            :class="{
              active: profileDraft.avatar === icon && !profileDraft.avatarFile,
            }"
            @click="
              profileDraft.avatar = icon;
              profileDraft.avatarFile = '';
            "
            ><Avatar :avatar="icon" /></button
          ></div
        ><button class="secondary wide" @click="pickProfileAvatar"
          ><Icon name="camera" />从相册选择头像</button
        ><label class="field"
          ><span>名字<small class="count num"
            >{{ (profileDraft.name || '').length }}/{{ NAME_LIMITS.child }}</small
          ></span
          ><input name="name"
            v-model="profileDraft.name"
            :maxlength="NAME_LIMITS.child"
            placeholder="小朋友怎么称呼" /></label
        ><label class="field"
          ><span>出生日期（选填）</span
          ><UiDate v-model="profileDraft.birthDate" :max="dayKey()" /></label
        ><label class="field"
          ><span>想让伙伴了解的事（选填）</span
          ><textarea name="note"
            v-model="profileDraft.note"
            maxlength="200"
            placeholder="例如：喜欢的称呼、兴趣和最近在努力的事"
          ></textarea></label
        ><p v-if="!profileDraft.name?.trim()" class="form-hint"
          ><Icon name="information" />先填写名字，就可以保存档案</p
        ><button
          class="primary wide"
          :disabled="busy || !profileDraft.name?.trim() || profileDraft.name.trim().length > NAME_LIMITS.child"
          @click="saveProfile"
          >保存资料</button
        ><button
          v-if="profileDraft.id && profiles.length > 1"
          class="ghost wide danger"
          :disabled="busy"
          @click="deleteProfile"
          >删除这位小朋友</button
        ></section
      >
      <VoiceSettings v-if="view === 'voiceSettings'" />
      <CompanionSettings
        v-if="view === 'companionSettings'"
        :value="companion"
        @save="setting('companion', $event)"
      />
      <section v-if="view === 'habits' && habitMode === 'habitEdit'" class="card habit-editor"
        ><label class="field"
          ><span>习惯名称</span
          ><input name="name-2" v-model="form.name" maxlength="40" /></label
        ><label class="field"
          ><span>完成标准</span
          ><textarea name="criteria"
            v-model="form.criteria"
            maxlength="200"
            placeholder="例如：按清单整理好书包"
          ></textarea></label
        ><div class="field"
          ><span>分类</span
          ><UiSelect
            v-model="form.category"
            label="习惯分类"
            :options="
              [
                '日常自理',
                '学习阅读',
                '运动健康',
                '家庭责任',
                '友善表达',
                '其他',
              ].map((x) => ({ value: x, label: x }))
            " /></div
        ><div class="two-col"
          ><div class="field"
            ><span>频率</span
            ><UiSelect
              v-model="form.frequency"
              label="习惯频率"
              :options="[
                { value: 'daily', label: '每天' },
                { value: 'days', label: '指定星期' },
                { value: 'interval', label: '每隔几天' },
                { value: 'weekly', label: '每周几次' },
              ]" /></div
          ><div class="field"
            ><span>{{
              form.frequency === 'weekly' ? '每周次数' : '当天次数上限'
            }}</span
            ><IntegerStepper
              v-model="form.target"
              :min="1"
              :max="20"
              :label="form.frequency === 'weekly' ? '每周次数' : '当天次数上限'"
            /></div></div
        ><div v-if="form.frequency === 'days'" class="days"
          ><label v-for="(d, i) in ['日', '一', '二', '三', '四', '五', '六']"
            ><input name="days" type="checkbox" :value="i" v-model="form.days" />周{{
              d
            }}</label
          ></div
        ><div v-if="form.frequency === 'interval'" class="field"
          ><span>每隔几天</span
          ><IntegerStepper
            v-model="form.interval"
            :min="1"
            :max="365"
            label="间隔天数"
          /></div
        ><div class="two-col"
          ><div class="field"
            ><span>每次奖励分数</span
            ><IntegerStepper
              v-model="form.points"
              :min="1"
              :max="1000"
              label="奖励分数"
            /></div
          ><div class="field"
            ><span>培养状态</span
            ><UiSelect
              v-model="form.status"
              label="培养状态"
              :options="[
                { value: 'active', label: '开始培养' },
                { value: 'paused', label: '暂停' },
                { value: 'mastered', label: '已掌握' },
                { value: 'archived', label: '归档' },
              ]" /></div></div
        ><div class="two-col"
          ><label class="field"
            ><span>开始日期</span><UiDate v-model="form.start" /></label
          ><label class="field"
            ><span>结束日期（选填）</span
            ><UiDate v-model="form.end" /></label></div
        ><label class="field"
          ><span>提醒时间（多个时间用逗号分隔）</span
          ><input name="timeText" v-model="form.timeText" placeholder="07:30,19:00" /></label
        ><div class="setting"
          ><label
            ><span>开启本地提醒</span
            ><button
              type="button"
              class="plan-toggle"
              :class="{ off: !form.remind }"
              :aria-pressed="form.remind"
              aria-label="开启本地提醒"
              @click="form.remind = !form.remind"
              ><Icon name="power" /></button></label></div
        ><p v-if="habitSubmitted && habitError" class="form-hint error"
          ><Icon name="warning" />{{ habitError }}</p
        ><button
          class="primary wide"
          :disabled="busy"
          @click="saveHabit"
          >{{
          goalDraftOnly ? '保存到习惯列表' : '保存习惯'
        }}</button
        ><button
          v-if="form.id && !goalDraftOnly"
          class="ghost wide danger"
          :disabled="busy"
          @click="deleteHabit"
          >删除习惯</button
        ></section
      >
    </div>
    <nav v-if="auth && !subScreen" class="tabbar" aria-label="主导航"
      ><button
        v-for="[id, label, icon] in navTabs"
        :key="id"
        :class="{ active: view === id || (view === 'detail' && id === 'pets'), 'home-tab': id === 'home' }"
        :aria-current="view === id ? 'page' : undefined"
        @click="navTop(id)"
        ><span class="tab-icon"><Icon :name="icon" /></span
        ><span>{{ label }}</span></button
      ></nav
    >
    <div
      id="toast"
      class="toast"
      :class="{ show: toast, error: toastKind === 'error', raised: auth && !subScreen }"
      :role="toastKind === 'error' ? 'alert' : 'status'"
      ><Icon v-if="toast" :name="toastKind === 'error' ? 'warning' : 'check-circle'" /><span>{{
        toast
      }}</span></div
    >
    <dialog
      ref="dialog"
      :class="{
        'confirm-dialog': modal === 'confirmAction',
        'adopt-dialog': modal === 'adopt',
        'quick-action-dialog': modal === 'habitComplete' || modal === 'ruleAdd',
      }"
      @cancel.prevent="close"
      ><header
        ><h2>{{
          (
            {
              confirmAction: '请确认这项操作',
              adopt: '领养这个伙伴',
              habitComplete: '快速完成习惯',
              ruleAdd: '添加日常表现',
              restore: '恢复备份预览',
              importPet: '导入伙伴预览',
            } as any
          )[modal]
        }}</h2
        ><button class="icon-button" aria-label="关闭" @click="close"
          ><Icon name="close" /></button
      ></header>
      <template v-if="modal === 'confirmAction'"
        ><p>{{ confirmation?.text }}</p
        ><footer
          ><button
            @click="
              close();
              confirmation = null;
            "
            >取消</button
          ><button class="danger-fill" :disabled="busy" @click="confirmAction"
            >确认操作</button
          ></footer
        ></template
      >

      <template v-if="modal === 'habitComplete'"
        ><div class="section-title"
          ><h2>{{ form.reason }}</h2
          ><small>完成一次，获得 <b class="num">+{{ form.points }}</b> 分</small></div
        ><label class="field"
          ><span>完成日期</span
          ><UiDate v-model="form.date" :max="dayKey()" /></label
        ><div class="field"
          ><span>完成方式</span
          ><UiSelect
            v-model="form.completion"
            label="完成方式"
            :options="[
              { value: '独立完成', label: '独立完成' },
              { value: '提醒后完成', label: '提醒后完成' },
              { value: '共同完成', label: '共同完成' },
            ]" /></div
        ><label class="field"
          ><span>给这次努力留句话（选填）</span
          ><textarea name="note-2"
            v-model="form.note"
            maxlength="300"
            placeholder="例如：今天没有提醒也记得完成"
          ></textarea></label
        ><footer
          ><button type="button" @click="close">取消</button
          ><button class="primary" :disabled="busy" @click="saveScore"
            >记下完成</button
          ></footer
        ></template
      >
      <template v-if="modal === 'ruleAdd'"
        ><p class="card-hint">保存后，在「日常表现」中点选这条规则。</p
        ><label class="field"
          ><span>具体表现</span
          ><input name="name-3"
            v-model="newRule.name"
            maxlength="40"
            placeholder="例如：主动整理书包"
            autofocus /></label
        ><div class="field"
          ><span>分值</span
          ><IntegerStepper
            v-model="newRule.points"
            :min="-1000"
            :max="1000"
            :allow-zero="false"
            label="日常表现分值"
          /></div
        ><div class="field"
          ><span>图标（选填，不选按表现名自动匹配）</span
          ><div class="icon-picker" role="radiogroup" aria-label="选择图标"
            ><button
              type="button"
              class="icon-pick auto"
              :class="{ selected: !newRule.icon }"
              :aria-checked="!newRule.icon"
              role="radio"
              @click="newRule.icon = ''"
              >自动</button
            ><div
              v-for="group in RULE_ICON_PICKER"
              :key="group.label"
              class="icon-pick-group"
              ><p>{{ group.label }}</p
              ><div class="icon-pick-grid"
                ><button
                  v-for="opt in group.items"
                  :key="opt.file"
                  type="button"
                  class="icon-pick"
                  :class="{ selected: newRule.icon === opt.file }"
                  :aria-checked="newRule.icon === opt.file"
                  role="radio"
                  :aria-label="'选择图标：' + opt.label"
                  :title="opt.label"
                  @click="newRule.icon = opt.file"
                  ><img :src="icon3d(opt.file)" :alt="opt.label" loading="lazy" /></button
              ></div
            ></div
          ></div
          ><p class="form-hint"
            ><template v-if="newRule.icon"
              ><img class="hint-3d" :src="icon3d(newRule.icon)" alt="" />已选图标：{{
                newRuleIconLabel
              }}</template
            ><template v-else>未选图标，保存后按表现名自动匹配</template></p
          ></div
        ><p v-if="newRuleError" class="form-hint error"
          ><Icon name="warning" />{{ newRuleError }}</p
        ><footer
          ><button type="button" @click="close">取消</button
          ><button
            class="primary"
            :disabled="busy || !newRule.name.trim() || !!newRuleError"
            @click="saveNewRule"
            >保存</button
          ></footer
        ></template
      >

      <template v-if="modal === 'adopt' && detail"
        ><label class="field"
          ><span>伙伴的名字</span
          ><input name="name-4"
            v-model="form.name"
            :maxlength="NAME_LIMITS.pet"
            placeholder="给新伙伴取个名字"
            autofocus /></label
        ><label class="field"
          ><span>给伙伴的第一句寄语（选填）</span
          ><textarea name="wish"
            v-model="form.wish"
            maxlength="160"
            placeholder="例如：以后我们一起发现更多快乐。"
          ></textarea></label
        ><div class="adopt-actions"
          ><button
            type="button"
            class="primary"
            :disabled="busy || recording || !adoptWords() || adoptWords().length > NAME_LIMITS.pet"
            @click="adoptSpecies(detail, false)"
            >确认领养</button
          ><button
            type="button"
            class="record-live"
            :class="{ recording }"
            :disabled="busy || (!recording && (!adoptWords() || adoptWords().length > NAME_LIMITS.pet))"
            @click="onRecordAdopt(detail)"
            >{{
              recording
                ? '停止录音 ' + recordSeconds + 's'
                : recordFile
                  ? '用这段声音欢迎它'
                  : '录一段欢迎声音'
            }}</button
          ></div
        ><AudioPlayer v-if="recordFile && !recording" :src="media(recordFile)"
      /></template>

      <template v-if="modal === 'restore'"
        ><p
          >备份包含 {{ stagedBackup.pets.length }} 只伙伴、{{
            stagedBackup.events.length
          }}
          条足迹、{{ stagedBackup.memories.length }} 条回忆。</p
        ><div class="hint warn"
          >恢复后，当前家庭数据会被备份内容替换；现有数据将先安全留存，家长密码不会改变。请确认备份来自可信设备。</div
        ><footer
          ><button @click="close">取消</button
          ><button class="primary" :disabled="busy" @click="restore"
            >确认恢复</button
          ></footer
        ></template
      >
      <template v-if="modal === 'importPet'"
        ><h3>{{ stagedPet.name }} → {{ stagedPet.adult }}</h3
        ><p>{{ stagedPet.description }}</p
        ><p class="record-meta"
          ><span class="tag num">v{{ stagedPet.version }}</span
          ><span class="tag">五阶段形态</span><span class="tag">十级成长</span></p
        ><footer
          ><button @click="close">取消</button
          ><button class="primary" :disabled="busy" @click="confirmPet"
            >确认导入</button
          ></footer
        ></template
      >
      <p class="error" role="alert">{{ error }}</p>
    </dialog>
  </div>
</template>
