<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{
  page: number;
  pages: number;
  label?: string;
  previousLabel?: string;
  nextLabel?: string;
  buttonType?: 'button';
}>();
const emit = defineEmits<{ change: [page: number] }>();
const dotPages = computed(() => {
  if (props.pages <= 7)
    return Array.from({ length: props.pages }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(props.page - 2, props.pages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
});

/* 滑动参数。时长/缓动只用 tokens.css 已有的令牌，不另起曲线：
   出场 --t-fast（140ms），入场/回弹 --t-base（220ms），缓动 --ease。 */
const ENGAGE_DX = 12; // 接管手势的横向位移，与 SwipeRow 同口径
const ENGAGE_RATIO = 1.4; // 横向占主导：|dx| > |dy| × 1.4，否则交给纵向滚动
const PAGE_FRACTION = 0.25; // 翻页阈值：位移超过 1/4 页宽
const FLING_VELOCITY = 0.65; // 快甩阈值 px/ms
const FLING_MIN_DX = 48; // 快甩仍需的最小位移
const EDGE_RESISTANCE = 0.35; // 首/末页到头阻尼
const EXIT_MS = 140; // 出场时长 = --t-fast
const ENTER_MS = 220; // 入场/回弹时长 = --t-base
const CLICK_SUPPRESS_MS = 350; // 滑完后忽略一次误触点按
const PEEK_DELAY_MS = 500; // 挂载后多久做一次露边提示
const PEEK_MS = 720; // 露边提示时长（≈ 2 × --t-slow），位移 18px 见 components.css 的 pager-peek

const viewportRef = ref<HTMLElement | null>(null);
const trackRef = ref<HTMLElement | null>(null);
const phase = ref<'idle' | 'dragging' | 'animating'>('idle');
const trackTransform = ref('');
const trackTransition = ref<'none' | 'fast' | 'base'>('none');
const hint = ref(false);
const hintShown = ref(false);
const interacted = ref(false);
const trackStyle = computed(() => ({
  transform: trackTransform.value || undefined,
  transition:
    trackTransition.value === 'none'
      ? 'none'
      : `transform var(--t-${trackTransition.value}) var(--ease)`,
}));

let runToken = 0;
let pendingPage = 0;
let suppressClickUntil = 0;
let startX = 0;
let startY = 0;
let lastDx = 0;
let activePointerId = -1;
let locked: 'x' | 'y' | null = null;
let samples: { x: number; t: number }[] = [];
let hintTimer: ReturnType<typeof setTimeout> | undefined;

function setTrack(transform: string, transition: 'none' | 'fast' | 'base') {
  trackTransform.value = transform;
  trackTransition.value = transition;
}
function resetTrack() {
  runToken += 1;
  pendingPage = 0;
  phase.value = 'idle';
  hint.value = false;
  // 外部改页时正在进行的拖拽一并取消，避免复位后手势又把轨道拖走。
  locked = null;
  activePointerId = -1;
  removeWindowListeners();
  setTrack('', 'none');
}
function waitTransition(ms: number, token: number) {
  return new Promise<boolean>((resolve) => {
    const el = trackRef.value;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      el?.removeEventListener('transitionend', onEnd);
      resolve(ok);
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName === 'transform') finish(true);
    };
    el?.addEventListener('transitionend', onEnd);
    setTimeout(() => finish(token === runToken), ms + 90);
  });
}
/* 两段式切页：旧页向滑动方向出场（140ms），再发 change 让父级换页，
   新页从另一侧入场（220ms）。方向：左滑进下一页，右滑回上一页。 */
async function animateToPage(target: number) {
  const token = ++runToken;
  const dir = target > props.page ? 1 : -1;
  phase.value = 'animating';
  setTrack(`translateX(${dir > 0 ? '-100%' : '100%'})`, 'fast');
  if (!(await waitTransition(EXIT_MS, token))) return;
  if (token !== runToken) return;
  pendingPage = target;
  emit('change', target);
  await nextTick();
  if (token !== runToken) return;
  if (props.page !== target) {
    // 父级未采纳这次翻页（例如页数刚被筛选改小），直接复位。
    pendingPage = 0;
    phase.value = 'idle';
    setTrack('', 'none');
    return;
  }
  setTrack(`translateX(${dir > 0 ? '100%' : '-100%'})`, 'none');
  await nextTick();
  if (token !== runToken) return;
  void trackRef.value?.offsetWidth;
  setTrack('translateX(0)', 'base');
  if (!(await waitTransition(ENTER_MS, token))) return;
  if (token !== runToken) return;
  phase.value = 'idle';
  setTrack('', 'none');
  // 切页成功（父级已采纳新页、入场动画走完）才震一次；回弹 snapBack 不震。
  navigator.vibrate?.(15);
}
async function snapBack() {
  const token = ++runToken;
  phase.value = 'animating';
  setTrack('translateX(0)', 'base');
  if (!(await waitTransition(ENTER_MS, token))) return;
  if (token !== runToken) return;
  phase.value = 'idle';
  setTrack('', 'none');
}
function goTo(target: number) {
  if (phase.value !== 'idle') return;
  if (target === props.page || target < 1 || target > props.pages) return;
  interacted.value = true;
  hint.value = false;
  void animateToPage(target);
}
function showPeekHint() {
  if (hintShown.value || interacted.value) return;
  if (props.pages <= 1 || props.page >= props.pages) return;
  hintShown.value = true;
  hint.value = true;
  hintTimer = setTimeout(() => (hint.value = false), PEEK_MS);
}
function onKeyDown(e: KeyboardEvent) {
  if (e.target !== e.currentTarget) return;
  if (props.pages <= 1 || phase.value !== 'idle') return;
  if (e.key === 'ArrowLeft' && props.page > 1) {
    e.preventDefault();
    goTo(props.page - 1);
  } else if (e.key === 'ArrowRight' && props.page < props.pages) {
    e.preventDefault();
    goTo(props.page + 1);
  }
}
function onClickCapture(e: MouseEvent) {
  if (Date.now() < suppressClickUntil) {
    e.preventDefault();
    e.stopPropagation();
  }
}
function addWindowListeners() {
  window.addEventListener('pointermove', onWindowPointerMove);
  window.addEventListener('pointerup', onWindowPointerUp);
  window.addEventListener('pointercancel', onWindowPointerUp);
  window.addEventListener('blur', onWindowBlur);
}
function removeWindowListeners() {
  window.removeEventListener('pointermove', onWindowPointerMove);
  window.removeEventListener('pointerup', onWindowPointerUp);
  window.removeEventListener('pointercancel', onWindowPointerUp);
  window.removeEventListener('blur', onWindowBlur);
}
function onPointerDown(e: PointerEvent) {
  if (props.pages <= 1 || phase.value !== 'idle') return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  if ((e.target as HTMLElement).closest?.('input, textarea, select')) return;
  // 手势优先级：起点落在行内 SwipeRow（足迹行左滑撤销）内时，Pager 不接管，
  // 行内滑块独占这次横滑；起点在行外区域时 Pager 正常翻页。
  // SwipeRow 自身用同一口径（12px / 横纵比 1.4）判定接管，两者不再同时跟手。
  if ((e.target as HTMLElement).closest?.('.swipe-row')) return;
  hint.value = false;
  startX = e.clientX;
  startY = e.clientY;
  lastDx = 0;
  activePointerId = e.pointerId;
  locked = null;
  samples = [{ x: e.clientX, t: performance.now() }];
  addWindowListeners();
}
function onWindowPointerMove(e: PointerEvent) {
  if (e.pointerId !== activePointerId) return;
  if (e.pointerType === 'mouse' && e.buttons === 0) {
    finishDrag();
    return;
  }
  if (locked === 'y') return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  if (!locked) {
    if (
      Math.abs(dx) > ENGAGE_DX &&
      Math.abs(dx) > Math.abs(dy) * ENGAGE_RATIO
    ) {
      locked = 'x';
      phase.value = 'dragging';
      interacted.value = true;
      hint.value = false;
    } else if (Math.abs(dy) > ENGAGE_DX && Math.abs(dy) >= Math.abs(dx)) {
      // 纵向占主导：不接管，交给页面纵向滚动。
      locked = 'y';
      removeWindowListeners();
      activePointerId = -1;
      return;
    } else {
      return;
    }
  }
  if (locked !== 'x') return;
  const now = performance.now();
  samples.push({ x: e.clientX, t: now });
  while (samples.length > 2 && now - samples[0].t > 120) samples.shift();
  let resisted = dx;
  if ((props.page <= 1 && dx > 0) || (props.page >= props.pages && dx < 0))
    resisted = dx * EDGE_RESISTANCE;
  lastDx = resisted;
  setTrack(`translateX(${resisted}px)`, 'none');
}
function finishDrag() {
  removeWindowListeners();
  activePointerId = -1;
  if (locked !== 'x') {
    locked = null;
    return;
  }
  locked = null;
  const el = viewportRef.value;
  const width = el?.clientWidth || 0;
  const last = samples[samples.length - 1];
  const first = samples[0];
  const dt = last.t - first.t;
  const velocity = dt > 0 ? (last.x - first.x) / dt : 0;
  const dx = lastDx;
  // 滑过就别再触发底下卡片/芯片的点按。
  suppressClickUntil = Date.now() + CLICK_SUPPRESS_MS;
  const dir = dx < 0 ? 1 : -1;
  const canGo = dir > 0 ? props.page < props.pages : props.page > 1;
  const passed =
    Math.abs(dx) > width * PAGE_FRACTION ||
    (Math.abs(velocity) > FLING_VELOCITY && Math.abs(dx) > FLING_MIN_DX);
  if (passed && canGo) void animateToPage(props.page + dir);
  else void snapBack();
}
function onWindowPointerUp(e: PointerEvent) {
  if (e.pointerId !== activePointerId) return;
  finishDrag();
}
function onWindowBlur() {
  if (activePointerId === -1) return;
  finishDrag();
}
watch(
  () => props.page,
  (next) => {
    if (next === pendingPage) {
      pendingPage = 0;
      return;
    }
    // 外部改页（筛选重置等）：不做动画，直接复位。
    resetTrack();
  },
);
watch(
  () => props.pages,
  (next) => {
    if (next <= 1) resetTrack();
    else showPeekHint();
  },
);
onMounted(() => {
  hintTimer = setTimeout(showPeekHint, PEEK_DELAY_MS);
});
onBeforeUnmount(() => {
  clearTimeout(hintTimer);
  removeWindowListeners();
});
</script>

<template>
  <div class="pager">
    <div
      ref="viewportRef"
      class="pager-viewport"
      :class="{
        swipeable: pages > 1,
        dragging: phase === 'dragging',
        clipped: phase !== 'idle' || hint,
      }"
      :tabindex="pages > 1 ? 0 : -1"
      role="region"
      :aria-label="
        (label || '分页') +
        '，左滑到' +
        (nextLabel || '下一页') +
        '，右滑到' +
        (previousLabel || '上一页') +
        '，或按方向键翻页'
      "
      @pointerdown="onPointerDown"
      @keydown="onKeyDown"
      @click.capture="onClickCapture"
    >
      <div
        ref="trackRef"
        class="pager-track"
        :class="{ 'peek-hint': hint }"
        :style="trackStyle"
      >
        <slot />
      </div>
    </div>
    <div
      v-if="pages > 1"
      class="pagination-dots"
      role="group"
      :aria-label="(label || '分页') + '：选择页面'"
    >
      <span class="sr-only" aria-live="polite"
        >第 {{ page }} / {{ pages }} 页</span
      >
      <button
        v-for="item in dotPages"
        :key="item"
        :type="buttonType"
        :class="{ active: item === page }"
        :aria-label="`第 ${item} 页，共 ${pages} 页`"
        :aria-current="item === page ? 'page' : undefined"
        @click="goTo(item)"
      ></button>
    </div>
  </div>
</template>
