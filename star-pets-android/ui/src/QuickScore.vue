<script setup lang="ts">
import UiDate from './UiDate.vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from './Icon.vue';
import EmptyState from './EmptyState.vue';
import Pager from './Pager.vue';
import CatalogToolbar from './CatalogToolbar.vue';
import { rulePage } from './companion.js';
import { dayKey, uid } from './model.js';
import { computeScoreLayout, SCORE_FALLBACK } from './score-layout.js';

const SCORE_FILTERS = [
  { value: 'plus', label: '加分' },
  { value: 'minus', label: '减分' },
] as const;

const props = defineProps<{
  rules: any[];
  reason: string;
  busy: boolean;
  net: number;
  done: number;
  taskCount: number;
  planCount: number;
  history: any[];
}>();
const emit = defineEmits<{
  save: [
    value: {
      points: number;
      reason: string;
      note: string;
      date: string;
      token: string;
      occurredAt: number;
    },
  ];
  add: [sign: number];
  remove: [rule: any];
  'update:reason': [value: string];
}>();
import { ruleIconFile } from './rule-icons.js';
const localNow = () => dayKey() + 'T' + new Date().toTimeString().slice(0, 5);
// 3D 图标（Microsoft Fluent Emoji，MIT 协议）：映射表在 rule-icons.js，
// 与足迹、回忆、抽屉历史共用同一套；规则自带 icon（新建时用户挑的）优先，
// 减分按 id 精确匹配，关键词未命中时先按语义落到 5 张分类 3D 图，
// 实在无分类时才回退线形星星。
const ICON_3D = import.meta.glob('./assets/icons-3d/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const icon3d = (file: string) => (file ? ICON_3D[`./assets/icons-3d/${file}`] || '' : '');
function ruleIcon3d(rule: any): string {
  return icon3d(ruleIconFile(rule));
}
const reason = computed({
  get: () => props.reason,
  set: (value: string) => emit('update:reason', value),
});
const points = ref(3),
  date = ref(localNow()),
  note = ref(''),
  token = ref(uid());
const sign = computed(() => (points.value < 0 ? -1 : 1));
const signFilter = computed({
  get: () => (points.value < 0 ? 'minus' : 'plus'),
  set: (value: string) => setSign(value === 'minus' ? -1 : 1),
});
const toolbarRef = ref<InstanceType<typeof CatalogToolbar> | null>(null);
const exactRule = computed(() =>
  props.rules.find(
    (r) => r.name === reason.value && Math.sign(r.points) === sign.value,
  ),
);
const ruleIndex = ref(1),
  // 每页条数不再写死：实测页面几何倒推（见 score-layout.js），
  // 量不到时回退 6 条 × 44px（上一轮的固定值）。
  pageSize = ref(SCORE_FALLBACK.rows),
  chipHeight = ref(SCORE_FALLBACK.rowHeight),
  pageRules = computed(() =>
    rulePage(
      props.rules,
      sign.value,
      exactRule.value ? '' : reason.value,
      ruleIndex.value,
      pageSize.value,
    ),
  );
watch([reason, sign], () => {
  if (!exactRule.value) ruleIndex.value = 1;
});
watch(
  () => props.rules,
  () => (ruleIndex.value = pageRules.value.page),
);
// 动态量高：挂载、尺寸变化、主题切换、从 v-show 隐藏恢复显示时都重算。
// 以 scrollTop = 0 为基准（最紧的情形）换算，往下滚只会让圆点更靠上，
// 所以算出来的行数在任何滚动位置都不会被遮住。
let scoreChipsObserver: ResizeObserver | null = null,
  scoreShellObserver: ResizeObserver | null = null,
  scoreThemeObserver: MutationObserver | null = null,
  scoreLayoutTimer: ReturnType<typeof setTimeout> | undefined;
function measureScoreLayout() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const shell = document.querySelector<HTMLElement>('.shell');
  const chipsEl = chipsRef.value;
  if (!shell || !chipsEl) return;
  const shellRect = shell.getBoundingClientRect();
  const chipsRect = chipsEl.getBoundingClientRect();
  if (!chipsRect.width || !shellRect.height) return; // 未显示，量不到
  const chipsTop = chipsRect.top - shellRect.top + shell.scrollTop;
  // 安全底：凸起的小窝键顶部（视口坐标）换算到 .shell 内容坐标。
  // 只躲底栏顶（756px）不够——中间那颗圆点正好落在小窝键横向范围里，
  // 上一轮实测中圆点就被它盖住过。
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
  // 圆点预留：实测圆点高（量不到用 36）+ margin-top（量不到用 4）+ 安全间隙 4。
  const dotsEl = document.querySelector<HTMLElement>(
    '.score-card .pagination-dots',
  );
  const dotsH = dotsEl?.offsetHeight || 36;
  const dotsGap = dotsEl
    ? Number.parseFloat(getComputedStyle(dotsEl).marginTop) || 4
    : 4;
  const { rows, rowHeight } = computeScoreLayout({
    chipsTop,
    safeBottom,
    dotsReserve: dotsH + dotsGap + 4,
  });
  if (rows !== pageSize.value) {
    pageSize.value = rows;
    if (ruleIndex.value > pageRules.value.pages)
      ruleIndex.value = pageRules.value.pages;
  }
  if (Math.abs(rowHeight - chipHeight.value) > 0.5)
    chipHeight.value = rowHeight;
}
function scheduleScoreLayout() {
  clearTimeout(scoreLayoutTimer);
  scoreLayoutTimer = setTimeout(measureScoreLayout, 120);
}
onMounted(() => {
  requestAnimationFrame(() => measureScoreLayout());
  // 字体加载完再量一次，行高/标题折行可能变。
  setTimeout(measureScoreLayout, 500);
  window.addEventListener('resize', scheduleScoreLayout);
  // 本卡是 v-show（切 tab 不卸载）：列表尺寸从 0 恢复时重算。
  if (typeof ResizeObserver !== 'undefined') {
    const shell = document.querySelector('.shell');
    if (shell) {
      scoreShellObserver = new ResizeObserver(() => scheduleScoreLayout());
      scoreShellObserver.observe(shell);
    }
  }
  if (typeof MutationObserver !== 'undefined') {
    scoreThemeObserver = new MutationObserver(() => scheduleScoreLayout());
    scoreThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  }
});
function observeScoreChips() {
  if (typeof ResizeObserver === 'undefined' || !chipsRef.value) return;
  scoreChipsObserver?.disconnect();
  scoreChipsObserver = new ResizeObserver(() => scheduleScoreLayout());
  scoreChipsObserver.observe(chipsRef.value);
}
const chipsRef = ref<HTMLElement | null>(null);
watch(chipsRef, (el) => {
  if (el) observeScoreChips();
});
function onRulePage(page: number) {
  ruleIndex.value = page;
  scrollChipsToTop();
}
// 与 App.vue 的 keepInView 同款算法：切页时把常用表现列表顶到标题栏下方。
function scrollChipsToTop() {
  const el = chipsRef.value,
    host = document.querySelector<HTMLElement>('.shell');
  if (!el || !host) return;
  const header = host.querySelector<HTMLElement>('.app-header');
  const top =
    el.getBoundingClientRect().top -
    host.getBoundingClientRect().top +
    host.scrollTop -
    (header?.getBoundingClientRect().height || 72);
  if (Math.abs(host.scrollTop - top) > 1) host.scrollTo({ top });
}
const valid = computed(
  () =>
    reason.value.trim().length > 0 &&
    Number.isInteger(points.value) &&
    points.value !== 0 &&
    Math.abs(points.value) <= 1000 &&
    !!date.value &&
    date.value <= localNow(),
);
const pointsError = computed(() => {
    const p = points.value as any;
    if (p === '' || p === null || !Number.isFinite(+p)) return '请填写分值';
    if (!Number.isInteger(+p)) return '分值需要是整数';
    if (+p === 0) return '分值不能为 0';
    if (Math.abs(+p) > 1000) return '分值范围是 -1000 到 1000';
    return '';
  }),
  dateError = computed(() =>
    !date.value
      ? '请选择记录时间'
      : date.value > localNow()
        ? '记录时间不能晚于现在'
        : '',
  ),
  hint = computed(
    () =>
      pointsError.value ||
      dateError.value ||
      (!reason.value.trim() ? '选择一条常用表现，或搜索并输入新的表现' : ''),
  );
function choose(rule: any) {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  reason.value = rule.name;
  points.value = rule.points;
  openSheet();
}
let holdTimer: ReturnType<typeof setTimeout> | undefined;
let holdX = 0;
let holdY = 0;
let suppressClick = false;
function suppressReleaseClick() {
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 700);
}
function cancelHold() {
  clearTimeout(holdTimer);
  holdTimer = undefined;
}
function startHold(rule: any, event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  cancelHold();
  holdX = event.clientX;
  holdY = event.clientY;
  holdTimer = setTimeout(() => {
    holdTimer = undefined;
    suppressReleaseClick();
    navigator.vibrate?.(20);
    emit('remove', rule);
  }, 550);
}
function moveHold(event: PointerEvent) {
  if (Math.abs(event.clientX - holdX) > 10 || Math.abs(event.clientY - holdY) > 10)
    cancelHold();
}
function showRemove(rule: any) {
  cancelHold();
  if (suppressClick) return;
  suppressReleaseClick();
  emit('remove', rule);
}
function setSign(next: number) {
  if (next === sign.value) return;
  points.value = next * Math.abs(points.value || 1);
  if (exactRule.value === undefined && props.rules.some((r) => r.name === reason.value))
    reason.value = '';
}
function nudge(delta: number) {
  let next = (Number(points.value) || 0) + delta;
  if (next === 0) next = delta > 0 ? 1 : -1;
  points.value = Math.max(-1000, Math.min(1000, next));
}
watch(reason, () => {
  if (exactRule.value) points.value = exactRule.value.points;
});
function submit() {
  if (!valid.value) return;
  navigator.vibrate?.(15);
  emit('save', {
    points: points.value,
    reason: reason.value.trim(),
    note: note.value.trim(),
    date: date.value.slice(0, 10),
    occurredAt: new Date(date.value).getTime(),
    token: token.value,
  });
}
function reset() {
  closeSheet();
  reason.value = '';
  note.value = '';
  date.value = localNow();
  token.value = uid();
}
function showRule(rule: any) {
  reason.value = rule.name;
  points.value = rule.points;
  const group = props.rules.filter((item) => Math.sign(item.points) === Math.sign(rule.points));
  ruleIndex.value = Math.floor(group.findIndex((item) => item.id === rule.id) / pageSize.value) + 1;
}
onBeforeUnmount(() => {
  cancelHold();
  clearTimeout(scoreLayoutTimer);
  window.removeEventListener('resize', scheduleScoreLayout);
  scoreChipsObserver?.disconnect();
  scoreShellObserver?.disconnect();
  scoreThemeObserver?.disconnect();
});
// 底部抽屉：点 chip（或自定义表现按钮）弹出，日期 / 分值步进组 / 最近记录 /
// 确认都在里面；保存成功后 App.vue 调 reset()，抽屉随之关闭。
const sheetRef = ref<HTMLDialogElement | null>(null);
const historyItems = computed(() => props.history || []);
const sheetIcon = computed(() =>
  ruleIcon3d((exactRule.value || { name: reason.value }) as any),
);
function openSheet() {
  sheetRef.value?.showModal();
}
function closeSheet() {
  sheetRef.value?.close();
}
function onSheetBackdrop(event: MouseEvent) {
  if (event.target === sheetRef.value) closeSheet();
}
function fmtDay(day: string) {
  if (!day) return '';
  const parts = day.split('-');
  return parts.length === 3
    ? `${Number(parts[1])}月${Number(parts[2])}日`
    : day;
}
function fmtTime(e: any) {
  if (!e?.occurredAt) return '';
  const t = new Date(e.occurredAt);
  if (Number.isNaN(t.getTime())) return '';
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}
function openSearch() {
  toolbarRef.value?.openSearch();
}
defineExpose({ reset, showRule, openSearch, focus: openSearch });
</script>

<template>
  <form
    class="quick-score"
    :class="{ deduction: points < 0 }"
    @submit.prevent="submit"
  >
    <div class="section-head"
      ><div class="section-title"><small>单击记录，长按删除；可自定义添加</small></div
      ><button
        type="button"
        class="icon-button"
        aria-label="自定义日常表现"
        title="自定义日常表现"
        @click="emit('add', sign)"
        ><Icon name="plus" /></button
    ></div>
    <CatalogToolbar
      ref="toolbarRef"
      :options="[...SCORE_FILTERS]"
      v-model:filter="signFilter"
      v-model:query="reason"
      filter-label="记录类型"
      search-label="搜索日常表现"
      search-placeholder="搜索日常表现"
      :sticky-query="false"
    />
    <EmptyState
      v-if="!pageRules.items.length"
      :icon="reason.trim() ? 'search' : 'star'"
      :icon3d="
        reason.trim()
          ? icon3d('pick-search.png')
          : icon3d(points < 0 ? 'minus-warning.png' : 'record-star.png')
      "
      :title="
        reason.trim()
          ? '没有匹配的表现'
          : points < 0
            ? '还没有减分的常用表现'
            : '还没有加分的常用表现'
      "
      :hint="
        reason.trim()
          ? '换个关键词，或记下这次输入'
          : '先加一条，之后点一下就能记下'
      "
      :action="reason.trim() ? '' : '自定义添加'"
      @action="emit('add', sign)"
    />
    <Pager
      v-else
      label="常用表现分页"
      previous-label="常用表现上一页"
      next-label="常用表现下一页"
      button-type="button"
      :page="pageRules.page"
      :pages="pageRules.pages"
      @change="onRulePage"
    ><div ref="chipsRef" class="rule-chips" role="listbox" aria-label="常用表现" :style="{ '--chip-h': chipHeight + 'px' }"
      ><button
        v-for="r in pageRules.items"
        :key="r.id"
        type="button"
        role="option"
        class="rule-chip"
        :class="{ active: exactRule?.id === r.id }"
        :aria-selected="exactRule?.id === r.id"
        :aria-label="`${r.name}，${r.points > 0 ? '加' : '减'}${Math.abs(r.points)}分；长按删除`"
        @pointerdown="startHold(r, $event)"
        @pointermove="moveHold"
        @pointerup="cancelHold"
        @pointercancel="cancelHold"
        @pointerleave="cancelHold"
        @contextmenu.prevent="showRemove(r)"
        @keydown.delete.prevent="showRemove(r)"
        @keydown.backspace.prevent="showRemove(r)"
        @click="choose(r)"
        ><span class="tile-icon rule-icon" :class="r.points > 0 ? 'rule-plus' : 'rule-minus'"
          ><img v-if="ruleIcon3d(r)" :src="ruleIcon3d(r)" alt="" /><Icon v-else name="star" /></span
        ><span>{{ r.name }}</span
        ><b class="num">{{ r.points > 0 ? '+' : '' }}{{ r.points }}</b></button
      ></div
    ></Pager>
    <button
      v-if="reason.trim() && !exactRule"
      type="button"
      class="secondary wide"
      @click="openSheet"
      ><Icon name="plus" />记下「{{ reason.trim() }}」</button
    >
    <dialog
      ref="sheetRef"
      class="score-sheet"
      aria-label="记下这次表现"
      @click="onSheetBackdrop"
      @cancel.prevent="closeSheet"
    >
      <div class="score-sheet-handle" aria-hidden="true"></div>
      <header class="score-sheet-head"
        ><span
          class="tile-icon rule-icon"
          :class="points > 0 ? 'rule-plus' : 'rule-minus'"
          ><img v-if="sheetIcon" :src="sheetIcon" alt="" /><Icon v-else name="star" /></span
        ><h3>{{ reason.trim() || '记下这次表现' }}</h3
        ><span class="sign-pill" :class="points > 0 ? 'plus' : 'minus'">{{
          points > 0 ? '加分' : '减分'
        }}</span
        ><button
          type="button"
          class="icon-button"
          aria-label="关闭"
          @click="closeSheet"
          ><Icon name="close" /></button
      ></header>
      <div class="field"
        ><UiDate
          id="quick-date"
          v-model="date"
          datetime
          compact
          label="记录时间"
          :max="localNow()" /></div
      >
      <div class="field"
        ><span>分值</span>
        <div
          class="score-stepper"
          :class="points > 0 ? 'plus' : 'minus'"
          role="group"
          aria-label="分值加减"
          ><button
            type="button"
            aria-label="减少分值"
            :disabled="points <= -1000"
            @click="nudge(-1)"
            ><Icon name="minus" /></button
          ><input
            id="quick-points"
            name="points"
            v-model.number="points"
            class="num"
            type="number"
            inputmode="numeric"
            min="-1000"
            max="1000"
            step="1"
            :aria-invalid="!!pointsError"
            aria-label="分数" /><button
            type="button"
            aria-label="增加分值"
            :disabled="points >= 1000"
            @click="nudge(1)"
            ><Icon name="plus" /></button></div
      ></div>
      <div class="field"
        ><span>最近记录</span>
        <ul v-if="historyItems.length" class="score-history"
          ><li
            v-for="e in historyItems"
            :key="e.id || e.token"
            class="score-history-row"
            ><span
              class="tile-icon rule-icon score-history-icon"
              :class="e.kind === 'minus' ? 'rule-minus' : 'rule-plus'"
              aria-hidden="true"
              ><img v-if="sheetIcon" :src="sheetIcon" alt="" /><Icon v-else name="star" /></span
            ><time>{{ fmtDay(e.day) + (fmtTime(e) ? ' · ' + fmtTime(e) : '') }}</time
            ><b :class="e.kind === 'minus' ? 'minus' : 'plus'"
              >{{ e.kind === 'minus' ? '−' : '+' }}{{ e.points }}</b
            ></li
          ></ul
        ><p v-else class="score-history-empty">还没有记录，记下一次后这里会显示最近的记录</p
      ></div>
      <label class="field"
        ><span>补充一句（选填）</span
        ><textarea
          id="quick-note"
          name="note"
          v-model="note"
          maxlength="300"
          rows="2"
          placeholder="例如：主动收好玩具，还帮助了妹妹"
        ></textarea>
      </label>
      <p v-if="hint" class="score-sheet-hint">{{ hint }}</p>
      <button
        class="primary wide"
        :class="{ 'danger-fill': points < 0 }"
        :disabled="busy || !valid"
        type="submit"
        ><Icon :name="points < 0 ? 'minus' : 'plus'" />记下{{
          points < 0 ? '减分' : '加分'
        }}<b class="num submit-points">{{ Math.abs(points) || 0 }}</b></button
      >
    </dialog>
  </form>
</template>
