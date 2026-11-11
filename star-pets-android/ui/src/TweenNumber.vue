<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
// 小窝顶部数字补间：整数逐帧滚动，340ms（--t-slow）+ --ease 同款曲线。
// reduceMotion 或系统 prefers-reduced-motion 时直接跳变，不做动画。
const props = withDefaults(
  defineProps<{
    value: number;
    format?: (n: number) => string;
    suffix?: string;
    reduceMotion?: boolean;
  }>(),
  { format: undefined, suffix: '', reduceMotion: false },
);
const displayed = ref(props.value);
const text = computed(
  () =>
    (props.format ? props.format(displayed.value) : String(displayed.value)) +
    props.suffix,
);
let raf = 0;
// cubic-bezier(0.2, 0.8, 0.2, 1)，与 tokens.css 的 --ease 同款。
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number) {
  const cx = 3 * p1x,
    bx = 3 * (p2x - p1x) - cx,
    ax = 1 - cx - bx,
    cy = 3 * p1y,
    by = 3 * (p2y - p1y) - cy,
    ay = 1 - cy - by,
    sampleX = (t: number) => ((ax * t + bx) * t + cx) * t,
    sampleY = (t: number) => ((ay * t + by) * t + cy) * t,
    sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 4; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-6) break;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    return sampleY(t);
  };
}
const ease = cubicBezier(0.2, 0.8, 0.2, 1);
watch(
  () => props.value,
  (next) => {
    cancelAnimationFrame(raf);
    const from = displayed.value;
    if (
      next === from ||
      props.reduceMotion ||
      (typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    ) {
      displayed.value = next;
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 340);
      displayed.value = Math.round(from + (next - from) * ease(p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  },
);
onBeforeUnmount(() => cancelAnimationFrame(raf));
</script>
<template>
  <span class="tween-number">{{ text }}</span>
</template>
