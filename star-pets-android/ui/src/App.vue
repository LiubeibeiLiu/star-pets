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
import IntegerStepper from './IntegerStepper.vue';
import ChatPanel from './ChatPanel.vue';
import SettingsPage from './SettingsPage.vue';
import { preferences } from './companion.js';
import { NAV_TABS, TITLES, TOP_VIEWS } from './navigation';
import { usePreviewView } from './preview-view';
import { findHabitForGoal, goalDisplayName as displayGoalName } from './goal-library.js';
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
  scoreSearch = ref<InstanceType<typeof SearchField>>(),
  scoreReason = ref(''),
  profileDraft = ref<any>({}),
  newRule = ref({ name: '', points: 3 }),
  newRuleError = computed(() => {
    const p = newRule.value.points as any;
    if (p === '' || p === null || !Number.isFinite(+p)) return '请填写分值';
    if (!Number.isInteger(+p)) return '分值需要是整数';
    if (+p === 0) return '分值不能为 0';
    if (Math.abs(+p) > 1000) return '分值范围是 -1000 到 1000';
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
  newRule.value = { name: '', points: sign < 0 ? -3 : 3 };
  void open('ruleAdd');
}
async function saveNewRule() {
  const name = newRule.value.name.trim();
  if (!name) {
    notify('请填写具体表现');
    return;
  }
  await run(async () => {
    const rule = { id: uid(), name, points: Number(newRule.value.points) };
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
  scoreSearch.value?.focus();
  document.getElementById('habit-search-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
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
  view = usePreviewView(isNative ? undefined : sessionStorage),
  detailId = ref(''),
  detailLevel = ref(1),
  toast = ref(''),
  emotion = ref(''),
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
const habitMode = ref<'list' | 'goalLibrary' | 'habitEdit'>('list');
const habitEditReturn = ref<'list' | 'goalLibrary'>('list');
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
const goalPage = ref(1),
  goalQuery = ref(''),
  goalDraftOnly = ref(false),
  goalTemplateId = ref(''),
  goalList = computed<any[]>(() => [
    ...builtInGoals,
    ...(state.value.goalTemplates || []).map((g: any) => ({
      ...g,
      icon: 'star',
      hint: g.criteria || g.category,
    })),
  ]),
  filteredGoals = computed(() =>
    goalList.value.filter((g) =>
      (g.name + ' ' + (addedHabitForGoal(g)?.name || '') + ' ' + (g.hint || '') + ' ' + (g.category || ''))
        .toLocaleLowerCase()
        .includes(goalQuery.value.trim().toLocaleLowerCase()),
    ),
  ),
  goalPages = computed(() =>
    Math.max(1, Math.ceil(filteredGoals.value.length / 6)),
  ),
  visibleGoals = computed(() =>
    filteredGoals.value.slice((goalPage.value - 1) * 6, goalPage.value * 6),
  );
watch(
  () => goalList.value.length,
  () => (goalPage.value = Math.min(goalPage.value, goalPages.value)),
);
watch(goalQuery, () => (goalPage.value = 1));
watch(
  () => state.value.habits.length,
  () => (planPage.value = Math.min(planPage.value, planPages.value)),
);
function selectHabitTab(tab: 'score' | 'plans') {
  habitTab.value = tab;
  habitMode.value = 'list';
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
  );
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
}
const titles = TITLES;
const topViews = TOP_VIEWS;
const screen = computed(() =>
  view.value === 'habits' && habitMode.value !== 'list'
    ? habitMode.value === 'habitEdit' && goalDraftOnly.value
      ? 'goalDraft'
      : habitMode.value
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
  if (host.scrollTop > top) scrollPageTo(top);
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
  if (['goalLibrary', 'habitEdit'].includes(v)) {
    habitMode.value = v as typeof habitMode.value;
    habitTab.value = v === 'goalLibrary' || v === 'habitEdit' ? 'plans' : 'score';
    v = 'habits';
  } else {
    habitMode.value = 'list';
  }
  if (v === 'habits' && habitMode.value === 'list')
    habitTab.value = 'plans';
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
    if (habitMode.value === 'habitEdit' && goalDraftOnly.value)
      habitMode.value = 'goalLibrary';
    else if (habitMode.value === 'habitEdit')
      habitMode.value = habitEditReturn.value;
    else habitMode.value = 'list';
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
    notify('请输入家长密码');
    shakePassword();
    return;
  }
  busy.value = true;
  try {
    if (mode === 'bio') await native('bio');
    else if (saved) await native('rememberLogin');
    else {
      await native('login', { password: password.value, remember: true });
      status.value.remembered = true;
    }
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
}
function petDetail(id: string) {
  priorView = view.value === 'detail' ? 'pets' : view.value;
  detailId.value = id;
  const p = state.value.pets.find((p: any) => p.species === id);
  detailLevel.value = p ? levelOf(p) : 1;
  nav('detail');
}
function score(sign = 1, h?: any) {
  if (h && habitCount(state.value, h, dayKey()) >= h.target) return;
  form.value = {
    points: h ? h.points : sign * 3,
    reason: h ? h.name : '',
    note: '',
    habitId: h?.id || '',
    date: dayKey(),
    completion: '独立完成',
    token: uid(),
    sign,
  };
  if (h) {
    completeFrom = view.value === 'home' ? 'home' : 'habits';
    void open('habitComplete', form.value);
  }
  else void goScore();
}
async function saveScore() {
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
    animate(level.value > old ? 'upgrade' : result.emotion);
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
function habitEdit(h?: any, returnTo: 'list' | 'goalLibrary' = 'list') {
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
function editAddedGoal(goal: any) {
  const habit = addedHabitForGoal(goal);
  if (habit) habitEdit({ ...habit, goalId: goal.id }, 'goalLibrary');
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
      notify(status === 'active' ? '培养计划已启用' : '培养计划已停用');
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
    notify('培养计划已启用');
  });
}
function deleteHabit() {
  const id = form.value.id,
    name = form.value.name;
  if (!id) return;
  ask(
    '要删除培养计划「' + name + '」吗？已经记下的分数与回忆会继续保留。',
    () =>
      void run(async () => {
        await commit({ type: 'habitDelete', id });
        nav(habitEditReturn.value === 'goalLibrary' ? 'goalLibrary' : 'habits');
        habitTab.value = 'plans';
        notify('培养计划已删除');
      }),
  );
}
function confirmDeleteHabit(h: any) {
  ask(
    '要删除培养计划「' + h.name + '」吗？已经记下的分数与回忆会继续保留。',
    () =>
      void run(async () => {
        await commit({ type: 'habitDelete', id: h.id });
        planPage.value = Math.min(planPage.value, planPages.value);
        notify('培养计划已删除');
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
      nav('goalLibrary');
      habitSubmitted.value = false;
      notify('已保存到目标列表');
      return;
    }
    if (v.remind && isNative && !status.value.notifications) {
      await native('notifications');
      status.value = await native('status');
    }
    await commit({ type: 'habit', value: v });
    nav(habitEditReturn.value === 'goalLibrary' ? 'goalLibrary' : 'habits');
    habitSubmitted.value = false;
    notify('培养计划已保存');
  });
}
async function setHabitStatus(h: any, status: string) {
  await run(async () => {
    await commit({ type: 'habit', value: { ...h, status } });
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
      <section class="card login-card" aria-labelledby="login-title">
        <div class="brand-icon" aria-hidden="true"><BrandMark /></div
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
                  : '请输入家长密码'
              "
              autocomplete="off"
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
      :class="{ 'home-shell': view === 'home', 'sub-shell': subScreen }"
      ><header v-if="view !== 'home'" class="app-header"
        ><span class="app-header-side"
          ><button
            v-if="subScreen"
            class="icon-button"
            aria-label="返回"
            @click="back"
            ><Icon name="back" /></button></span
        ><h1>{{ titles[screen] }}</h1
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
        <section :class="['home-world', { hungry: hungry.stage > 0 }]">
          <div v-if="current" class="home-summary"
              ><div class="summary-message" aria-live="polite"
                ><p v-for="line in homeMessage" :key="line">{{ line }}</p></div
              ><div class="summary-metrics"
                ><div class="summary-stat" aria-label="伙伴等级"
                  ><b class="num">{{ homeLevel }}</b><span>等级</span></div
                ><button
                  class="summary-stat"
                  @click="previewNextForm"
                  aria-label="点按预览下一等级形态"
                  ><b class="num">{{ pct(current) }}%</b><span>进度</span></button
                ><div class="summary-stat" :title="String(total.earned)"
                  ><b class="num">{{ short(total.earned) }}</b><span>累计</span></div
                ><div class="summary-stat" :title="String(total.net)"
                  ><b class="num">{{ short(total.net) }}</b><span>当前</span></div
                ></div
              ><button
                class="summary-progress"
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
                  ><Icon name="map-pin" class="travel-icon" />
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
                      }}</dd></div
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
                  @click="randomInteraction"
                /><p v-if="homeLevel !== level" class="form-preview"
                  >形态预览中 · 当前 Lv.{{ level }}</p
                ></div
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
                  :class="{ active: dockOpen }"
                  :aria-expanded="dockOpen"
                  :aria-label="dockOpen ? '收起伙伴互动' : '展开伙伴互动'"
                  title="伙伴互动"
                  @click="dockOpen = !dockOpen"
                  ><Icon name="star" /></button
                ><div v-if="dockOpen" class="dock-actions"
                  ><div v-if="!away" class="dock-group" aria-label="日常互动"
                    ><button
                      class="dock-item"
                      :disabled="busy"
                      aria-label="喂食"
                      title="喂食"
                      @click="
                        care('feed');
                      "
                      ><Icon name="food" /></button
                    ><button
                      class="dock-item"
                      aria-label="玩耍"
                      title="玩耍"
                      :disabled="busy"
                      @click="
                        randomInteraction();
                      "
                      ><Icon name="heart" /></button
                    ></div
                  ><div v-if="!away" class="dock-group" aria-label="陪伴功能"
                    ><button
                      class="dock-item"
                      :class="{ active: photoOpen }"
                      :aria-pressed="photoOpen"
                      aria-label="合影"
                      title="合影"
                      @click="
                        togglePhoto();
                      "
                      ><Icon name="camera" /></button
                    ><button
                      class="dock-item"
                      :class="{ active: chatOpen }"
                      :aria-pressed="chatOpen"
                      aria-label="聊天"
                      title="聊天"
                      @click="
                        toggleChat();
                      "
                      ><Icon name="chat" /></button
                    ></div
                  ><div v-if="!away" class="dock-group" aria-label="扩展工具"
                    ><button
                      class="dock-item"
                      :class="{ active: memoryInline }"
                      :aria-pressed="memoryInline"
                      aria-label="录一段声音"
                      title="录一段声音"
                      @click="
                        memoryOpen();
                      "
                      ><Icon name="mic" /></button
                    ><button
                      class="dock-item"
                      :disabled="
                        busy || state.settings.travelEnabled === false || !!trip
                      "
                      aria-label="出去探索"
                      title="出去探索"
                      @click="
                        startTravel();
                      "
                      ><Icon name="map-pin" /></button
                    ><button
                      class="dock-item"
                      :class="{ active: renameOpen }"
                      :aria-pressed="renameOpen"
                      aria-label="改个名字"
                      title="改个名字"
                      @click="
                        toggleRename();
                      "
                      ><Icon name="edit" /></button
                    ><button
                      class="dock-item"
                      :disabled="state.pets.length <= 1"
                      aria-label="换个伙伴"
                      title="换个伙伴"
                      @click="
                        cycleCompanion();
                      "
                      ><Icon name="pet" /></button
                    ></div
                  ><div class="dock-group" aria-label="今日约定"
                    ><button
                      class="dock-item"
                      :class="{ active: todayOpen }"
                      :aria-pressed="todayOpen"
                      aria-label="今日约定"
                      title="今日约定"
                      @click="
                        toggleToday();
                      "
                      ><Icon name="habit" /></button
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
                  ><input
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
                  ><input
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
                    ><b>今日约定</b
                    ><small v-if="tasks.length" class="num"
                      >{{ done }}/{{ tasks.length }}</small
                    ><button class="icon-button" aria-label="关闭今日约定" @click="todayOpen = false"><Icon name="close" /></button></div
                  ><div v-if="todayGoals.length" class="today-list"
                    ><button
                      v-for="h in todayGoals"
                      :key="h.id"
                      class="today-goal"
                      :disabled="busy"
                      :aria-label="'完成' + h.name + '，加' + h.points + '分'"
                      @click="score(1, h)"
                      ><span class="goal-check" aria-hidden="true"><Icon name="check" /></span
                      ><span class="today-name">{{ h.name }}</span
                      ><b class="num">+{{ h.points }}</b></button
                    ></div
                  ><button
                    v-else-if="!tasks.length"
                    class="today-empty"
                    @click="nav('goalLibrary')"
                    ><Icon name="plus" /><span>挑一个今天想完成的计划</span></button
                  ><p v-else class="today-empty done"
                    ><Icon name="check" /><span
                      >今天的约定都完成了，每一次认真都值得被看见。</span
                    ></p
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
            ><textarea
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
        ><SearchField
          v-if="memoryTab === 'gallery'"
          v-model="memoryQuery"
          placeholder="搜索精彩回忆"
          label="搜索精彩回忆"
          @input="galleryPage = 1"
          @clear="galleryPage = 1"
        /><SearchField
          v-else
          v-model="filter.query"
          placeholder="搜索成长足迹"
          label="搜索成长足迹"
          @input="filter.page = 1"
          @clear="filter.page = 1"
        /><section
          v-if="memoryTab === 'footprints'"
          id="habit-footprints"
          class="photo-gallery footprints-gallery"
          ><div id="footprint-filters" class="filter-row"
            ><div class="chip-group equal-filter-chips" role="radiogroup" aria-label="记录类型"
              ><button
                v-for="[value, text] in [
                  ['all', '全部'],
                  ['plus', '加分'],
                  ['minus', '减分'],
                ]"
                :key="value"
                type="button"
                role="radio"
                class="chip"
                :class="{ active: filter.kind === value }"
                :aria-checked="filter.kind === value"
                @click="
                  filter.kind = value;
                  filter.page = 1;
                "
                >{{ text }}</button
              ></div
            ><UiSelect
              class="compact"
              :model-value="dateRange"
              label="时间范围"
              :options="[
                { value: 'day', label: '最近一天' },
                { value: 'week', label: '最近一周' },
                { value: 'month', label: '最近一月' },
                { value: 'quarter', label: '最近季度' },
                { value: 'year', label: '最近一年' },
              ]"
              @change="
                dateRange = String($event);
                filter.page = 1;
              " /></div
          ><div class="record-list"
            ><SwipeRow
              v-for="e in list.items"
              :key="e.id"
              label="撤销"
              :disabled="!canUndo(e) || busy"
              @action="
                ask(
                  '确认撤销「' +
                    e.reason +
                    '」吗？积分、当前伙伴经验及关联回忆会同步调整。',
                  () => undoInline(e),
                )
              "
              ><div :class="['record', { rev: isReversed(state, e.id) }]"
                ><span
                  class="record-mark"
                  :class="{ neg: e.kind === 'minus' }"
                  aria-hidden="true"
                  ><Icon :name="e.kind === 'minus' ? 'minus' : 'star'" /></span
                ><div class="grow"
                  ><b>{{ e.reason }}</b
                  ><small class="record-meta"
                    ><span class="num"
                      >{{ e.day }} {{ fmt(e.occurredAt || e.at).split(' ')[1] }}</span
                    ><span v-if="isReversed(state, e.id)" class="tag">已撤销</span></small
                  ><small v-if="e.note" class="record-note">{{
                    e.note
                  }}</small></div
                ><span
                  v-if="e.points"
                  class="score num"
                  :class="{ neg: e.kind === 'minus' }"
                  >{{ e.kind === 'plus' ? '+' : e.kind === 'minus' ? '−' : '↶'
                  }}{{ e.points }}</span
                ></div
              ></SwipeRow
            ><EmptyState
              v-if="!list.total && footprintFiltering"
              variant="card"
              icon="search"
              title="没有符合条件的记录"
              hint="换个关键词或时间范围试试"
              action="清除筛选"
              @action="clearFootprintFilter" /><EmptyState
              v-else-if="!list.total"
              variant="card"
              icon="history"
              title="第一步，正等着被记下"
              hint="完成培养计划或记录日常表现后，成长会在这里留下足迹"
          /></div
          ><Pager
            label="成长足迹翻页"
            :page="list.page"
            :pages="list.pages"
            @change="
              filter.page = $event;
              keepInView('habit-footprints');
            " /></section
          ><section
          v-else
          id="memory-gallery"
          class="photo-gallery"
          ><div class="chip-group equal-chips" role="radiogroup" aria-label="回忆类型"
            ><button
              v-for="[value, text] in [
                ['all', '全部'],
                ['photo', '照片'],
                ['audio', '声音'],
                ['note', '文字'],
                ['exploration', '探索'],
              ]"
              :key="value"
              type="button"
              role="radio"
              class="chip"
              :class="{ active: memoryKind === value }"
              :aria-checked="memoryKind === value"
              @click="
                memoryKind = value;
                galleryPage = 1;
              "
              >{{ text }}</button
            ></div
          ><EmptyState
            v-if="!gallery.length && galleryTotal"
            variant="card"
            icon="search"
            title="没有找到这样的回忆"
            hint="换个关键词或类型试试"
            action="清除筛选"
            @action="clearMemoryFilter" /><EmptyState
            v-else-if="!gallery.length"
            variant="card"
            icon="photo"
            title="第一颗回忆星星还在路上"
            hint="领养伙伴、收藏声音或留下合影后，会在这里慢慢亮起来"
          /><div v-else class="memory-list"
            ><article
              v-for="m in galleryItems"
              :key="m.id"
              class="card gallery-card"
              :class="{ 'habit-memory': m.source === 'habit' }"
              ><header class="memory-date"
                ><b>{{ memoryDate(m.at) }}</b
                ><button
                  class="icon-button card-corner-action"
                  type="button"
                  :aria-label="
                    String(m.id).startsWith('demo-')
                      ? '隐藏示例回忆'
                      : '删除' + (m.name || '这条') + '回忆'
                  "
                  @click="
                    ask(
                      String(m.id).startsWith('demo-')
                        ? '要从预览中隐藏这条示例回忆吗？'
                        : '要删除这条回忆吗？删除后无法恢复。',
                      () => deleteMemory(m),
                    )
                  "
                  ><Icon name="trash" /></button></header
              ><div class="memory-body"
                ><AudioPlayer
                  v-if="m.kind === 'audio'"
                  :src="media(m.file)"
                  download
                  @download="downloadAudio(m)"
                /><button
                  v-else-if="
                    m.kind === 'note' && (m.text || '').trim().length > 80
                  "
                  class="list-link"
                  @click="showMemory(m)"
                  aria-label="查看文字回忆"
                  ><Icon name="sparkles" /><span>文字纪念</span
                  ><Icon name="chevron" /></button
                ><div v-else-if="m.kind === 'note'" class="memory-note-inline">{{
                  memoryDisplayText(m)
                }}</div
                ><button
                  v-else
                  class="gallery-image"
                  @click="openPhotoMemory(m)"
                  @pointerdown="memoryPhotoDown(m, $event)"
                  @pointermove="memoryPhotoMove"
                  @pointerup="memoryPhotoUp"
                  @pointercancel="memoryPhotoUp"
                  @contextmenu.prevent="savePhotoFromMemory(m)"
                  :aria-label="'查看与' + m.name + '的合照，长按保存到相册'"
                  ><GalleryImage
                    :src="media(m.file)"
                    :alt="'与' + m.name + '的合照'"
                    lazy /></button
                ><div class="gallery-caption"
                  ><b v-if="m.kind !== 'note'">{{ m.name || nameOf(m.petId) }}</b
                  ><small v-if="m.kind !== 'note'" class="num"
                    >Lv.{{ m.level }}</small
                  ><span v-if="String(m.id).startsWith('demo-')" class="tag">示例</span
                  ><div v-if="m.reversedAt" class="memory-reversed"
                    ><Icon name="history" /><span
                      ><b>已撤销对应加分</b
                      ><small v-if="m.reverseReason">{{ m.reverseReason }}</small></span
                    ></div
                  ><p
                    v-if="
                      m.text && !(m.kind === 'note' && m.text.trim().length <= 80)
                    "
                    class="gallery-note"
                    >{{
                      m.source === 'exploration' && !m.diary
                        ? '今天去探索了新的风景，带着满满的好心情回家啦！'
                        : memoryDisplayText(m)
                    }}</p
                  ><small v-if="m.departAt" class="record-meta"
                    ><span class="tag"><Icon name="time" />{{
                      (+m.travelHours || 0).toFixed(1)
                    }} 小时</span
                    ><span class="num">{{
                      new Date(m.departAt).toLocaleString('zh-CN', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    }}</span></small
                  ></div
                ></div
              ></article
            ></div
          ><Pager
            v-if="galleryPages > 1"
            label="回忆翻页"
            :page="galleryPage"
            :pages="galleryPages"
            @change="
              galleryPage = $event;
              keepInView('memory-gallery');
            "
        /></section
      ></template>
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
          title="没有找到这位伙伴"
          hint="换一个名字或特征试试"
          action="清除搜索"
          @action="petQuery = ''"
        /><div v-else id="pet-grid" class="tile-grid pet-grid"
          ><article
            v-for="p in visiblePets"
            :key="p.id"
            class="pet-card"
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
        ><Pager
          label="伙伴图鉴翻页"
          :page="petPage"
          :pages="petPages"
          @change="
            petPage = $event;
            keepInView('pet-grid');
          "
      /></template>
      <template v-if="view === 'detail' && detail"
        ><section class="card detail-hero"
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
            ><p>{{ detail.description }}</p
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
              :class="{
                active: detailLevel === n,
                unlocked: owned && n <= levelOf(owned),
              }"
              :aria-label="'查看第 ' + n + ' 级形态'"
              :aria-pressed="detailLevel === n"
              @click="stageSelect(n)"
              ><span></span></button
          ></div>
          <details class="detail-story" :key="detail.id"
            ><summary
              ><span>认识{{ detail.name }}</span
              ><Icon name="chevron" /></summary
            ><p>{{ detail.introduction || detail.description }}</p
            ><span class="story-label">伙伴小故事</span
            ><h3>{{ detail.name }}的星光来信</h3
            ><p
              v-for="(paragraph, index) in detail.story || [
                '它的故事，正从与你相遇的这一天开始。',
              ]"
              :key="index"
              >{{ paragraph }}</p
            ><small>星星宠物原创幻想故事</small></details
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
            >培养计划</button
          ><button
            role="tab"
            :aria-selected="habitTab === 'score'"
            :class="{ active: habitTab === 'score' }"
            @click="selectHabitTab('score')"
            >日常表现</button
          ></div
        ><SearchField
          v-if="habitMode === 'list' && habitTab === 'plans'"
          v-model="planQuery"
          placeholder="搜索培养计划"
          label="搜索培养计划"
          @input="planPage = 1"
          @clear="planPage = 1"
        /><SearchField
          v-if="habitMode === 'list' && habitTab === 'score'"
          id="habit-search-anchor"
          ref="scoreSearch"
          v-model="scoreReason"
          placeholder="搜索日常表现"
          label="搜索日常表现"
        /><SearchField
          v-if="habitMode === 'goalLibrary'"
          v-model="goalQuery"
          placeholder="搜索培养计划"
          label="搜索培养计划"
        /><section
          v-show="habitTab === 'score' && habitMode === 'list'"
          id="habit-score"
          class="card score-card"
          ><QuickScore
            ref="quickScore"
            v-model:reason="scoreReason"
            :rules="state.rules"
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
          id="habit-plans"
          class="card plans-card"
          ><div class="section-head"
            ><div class="section-title"><h2>今天的计划</h2></div
            ><span v-if="tasks.length" class="section-stat"
              ><b class="num">{{ done }}/{{ tasks.length }}</b></span
            ><button
              class="icon-button"
              @click="nav('goalLibrary')"
              aria-label="添加培养计划"
              title="添加培养计划"
              ><Icon name="plus" /></button></div
          ><EmptyState
            v-if="planQuery.trim() && !filteredPlans.length"
            icon="search"
            :title="'没有找到「' + planQuery.trim() + '」'"
            hint="试试别的关键词，或新增一个计划"
            action="清除搜索"
            @action="
              planQuery = '';
              planPage = 1;
            " /><EmptyState
            v-else-if="!filteredPlans.length"
            icon="sparkles"
            title="从第一个小目标开始"
            hint="挑一件愿意每天练习的小事，和伙伴一起慢慢做到。"
            action="挑选培养计划"
            @action="nav('goalLibrary')" /><div v-else class="tile-grid plan-grid"
            ><article
              v-for="h in visiblePlans"
              :key="h.id"
              class="plan-card"
              :class="{
                paused: h.status !== 'active',
                done: habitCount(state, h, dayKey()) >= h.target,
              }"
              ><header class="plan-head"
                ><h3>{{ h.name }}</h3
                ><button
                  class="icon-button plan-more card-corner-action"
                  type="button"
                  :aria-label="'更多操作：' + h.name"
                  aria-haspopup="menu"
                  :aria-expanded="planMenu === h.id"
                  @click="planMenu = planMenu === h.id ? '' : h.id"
                  ><Icon name="more" /></button
                ><div v-if="planMenu === h.id" class="plan-menu" role="menu"
                  ><button
                    role="menuitem"
                    type="button"
                    @click="
                      planMenu = '';
                      habitEdit(h);
                    "
                    ><Icon name="edit" />编辑设置</button
                  ><button
                    role="menuitem"
                    type="button"
                    @click="
                      planMenu = '';
                      setHabitStatus(
                        h,
                        h.status === 'active' ? 'paused' : 'active',
                      );
                    "
                    ><Icon :name="h.status === 'active' ? 'pause' : 'play'" />{{
                      h.status === 'active' ? '暂停计划' : '继续计划'
                    }}</button
                  ><button
                    role="menuitem"
                    type="button"
                    class="danger"
                    @click="
                      planMenu = '';
                      confirmDeleteHabit(h);
                    "
                    ><Icon name="trash" />删除计划</button
                  ></div
                ></header
              ><p class="plan-meta"
                ><span class="plan-category">{{ h.category }}</span
                ><span class="plan-count" :aria-label="'已完成 ' + habitCount(state, h, dayKey()) + ' 次，目标 ' + h.target + ' 次'"
                  >{{ habitCount(state, h, dayKey()) }}/{{ h.target }}</span
                ></p
              ><div class="plan-detail-row"
                ><p
                  class="plan-criteria"
                  :class="{ 'plan-criteria-empty': !h.criteria || h.criteria === h.category }"
                  >{{ h.criteria && h.criteria !== h.category ? h.criteria : '完成标准待补充' }}</p
                ><span class="plan-time"
                  >{{ h.times.join('、') || '全天' }}</span
                ></div
              ><button
                class="primary small wide"
                :disabled="
                  busy ||
                  h.status !== 'active' ||
                  habitCount(state, h, dayKey()) >= h.target
                "
                @click="score(1, h)"
                ><Icon
                  :name="
                    habitCount(state, h, dayKey()) >= h.target ? 'check' : 'star'
                  " />{{
                  h.status !== 'active'
                    ? '已暂停'
                    : habitCount(state, h, dayKey()) >= h.target
                      ? '今日已完成'
                      : '完成 +' + h.points
                }}</button
              ></article
            ><template
              v-for="n in fill(visiblePlans, 4, planPage, planPages)"
              :key="'plan-gap' + n"
              ><button
                v-if="n === 1"
                class="tile-add"
                @click="nav('goalLibrary')"
                aria-label="选择已有培养计划"
                ><Icon name="plus" /><span>新增计划</span></button
              ><span v-else class="tile-gap" aria-hidden="true"></span></template
          ></div
          ><Pager
            label="培养计划翻页"
            :page="planPage"
            :pages="planPages"
            @change="planPage = $event" /></section
        ><section
          v-if="habitMode === 'goalLibrary'"
          class="card goals-card"
          ><div class="section-head"
            ><div class="section-title"
            ><h2>挑选培养计划</h2
              ><small>点按卡片启用或停用；已添加的计划可单独编辑</small></div
            ><button
              class="icon-button"
              type="button"
              aria-label="自定义习惯"
              title="自定义习惯"
              @click="editGoalTemplate()"
              ><Icon name="plus" /></button></div
          ><EmptyState
            v-if="!filteredGoals.length"
            icon="search"
            title="没有匹配的习惯"
            hint="换个关键词，或者自己写一个"
            action="自定义习惯"
            @action="editGoalTemplate()"
          /><div v-else class="tile-grid goal-grid"
            ><article
              v-for="goal in visibleGoals"
              :key="goal.id"
              class="goal-card"
              :class="{
                active: addedHabitForGoal(goal)?.status === 'active',
              }"
              ><button
                class="goal-card-main"
                type="button"
                :disabled="busy"
                :aria-label="'启用或停用' + goalDisplayName(goal)"
                @click="activateGoal(goal)"
                ><span class="tile-icon"><Icon :name="goal.icon" /></span
                ><b>{{ goalDisplayName(goal) }}</b
                ><small>{{
                  addedHabitForGoal(goal)?.status === 'active'
                  ? '已启用 · 点按停用'
                  : addedHabitForGoal(goal)
                    ? '已停用 · 点按启用'
                  : goal.hint
                }}</small></button
              ><button
                v-if="addedHabitForGoal(goal)"
                class="goal-card-edit"
                type="button"
                :disabled="busy"
                :aria-label="'编辑' + goalDisplayName(goal) + '培养计划'"
                :title="'编辑' + goalDisplayName(goal)"
                @click="editAddedGoal(goal)"
                ><Icon name="edit" /></button
            ></article
            ><span
              v-for="n in fill(visibleGoals, 6, goalPage, goalPages)"
              :key="'goal-gap' + n"
              class="tile-gap"
              aria-hidden="true"
            ></span
          ></div
          ><Pager
            label="目标翻页"
            :page="goalPage"
            :pages="goalPages"
            @change="goalPage = $event" /></section
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
          ><input
            v-model="profileDraft.name"
            :maxlength="NAME_LIMITS.child"
            placeholder="小朋友怎么称呼" /></label
        ><label class="field"
          ><span>出生日期（选填）</span
          ><UiDate v-model="profileDraft.birthDate" :max="dayKey()" /></label
        ><label class="field"
          ><span>想让伙伴了解的事（选填）</span
          ><textarea
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
          ><span>培养计划名称</span
          ><input v-model="form.name" maxlength="40" /></label
        ><label class="field"
          ><span>完成标准</span
          ><textarea
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
            ><input type="checkbox" :value="i" v-model="form.days" />周{{
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
          ><input v-model="form.timeText" placeholder="07:30,19:00" /></label
        ><div class="setting"
          ><label
            ><span>开启本地提醒</span
            ><input
              class="ios-switch"
              type="checkbox"
              v-model="form.remind" /></label></div
        ><p v-if="habitSubmitted && habitError" class="form-hint error"
          ><Icon name="warning" />{{ habitError }}</p
        ><button
          class="primary wide"
          :disabled="busy"
          @click="saveHabit"
          >{{
          goalDraftOnly ? '保存到目标列表' : '保存计划'
        }}</button
        ><button
          v-if="form.id && !goalDraftOnly"
          class="ghost wide danger"
          :disabled="busy"
          @click="deleteHabit"
          >删除培养计划</button
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
              habitComplete: '快速完成培养计划',
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
          ><textarea
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
          ><input
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
          ><input
            v-model="form.name"
            :maxlength="NAME_LIMITS.pet"
            placeholder="给新伙伴取个名字"
            autofocus /></label
        ><label class="field"
          ><span>给伙伴的第一句寄语（选填）</span
          ><textarea
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
