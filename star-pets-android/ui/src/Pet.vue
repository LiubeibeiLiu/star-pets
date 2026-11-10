<script setup lang="ts">
import { onMounted, ref, watch, onBeforeUnmount } from 'vue';
import rects from './rects.json';
import { frameOf, rankOf } from './catalog.js';
const props = withDefaults(
  defineProps<{
    pet: any;
    level?: number;
    emotion?: string;
    grow?: boolean;
    showRank?: boolean;
  }>(),
  { level: 1, emotion: '', grow: false, showRank: true },
);
const canvas = ref<HTMLCanvasElement>();
let alive = true,
  visible = false,
  observer: IntersectionObserver | undefined;
const cache = new Map<string, Promise<HTMLImageElement>>();
async function draw() {
  if (!canvas.value) return;
  const url = props.pet.sheet.startsWith('/')
    ? props.pet.sheet
    : new URL(props.pet.sheet, document.baseURI).href;
  let promise = cache.get(url);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = url;
    });
    cache.set(url, promise);
  }
  try {
    const im = await promise;
    if (!alive || !canvas.value) return;
    const c = canvas.value;
    c.width = 600;
    c.height = 500;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 600, 500);
    const frame = frameOf(props.level);
    const rs = (rects as Record<string, number[][]>)[props.pet.id];
    const r = rs?.[frame] || [
      (im.width / 5) * frame,
      0,
      im.width / 5,
      im.height,
    ];
    const scale =
      Math.min(540 / r[2], 410 / r[3]) *
      (props.grow ? 0.83 + (props.level / 10) * 0.17 : 1);
    const w = r[2] * scale,
      h = r[3] * scale;
    ctx.drawImage(im, r[0], r[1], r[2], r[3], (600 - w) / 2, 485 - h, w, h);
    // One shared rank rule for all ten preview levels; centered, fixed-size symbols.
    if (props.showRank) {
      const badge = rankOf(props.level);
      ctx.fillStyle = '#c49b49';
      ctx.strokeStyle = '#a77d32';
      ctx.lineWidth = 1.5;
      if (badge.kind === 'star') {
        for (let i = 0; i < badge.count; i++) {
          const x = 300 + (i - (badge.count - 1) / 2) * 32;
          ctx.beginPath();
          for (let j = 0; j < 10; j++) {
            const angle = (j * Math.PI) / 5 - Math.PI / 2,
              radius = j % 2 ? 5 : 12;
            ctx.lineTo(
              x + Math.cos(angle) * radius,
              30 + Math.sin(angle) * radius,
            );
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(300, 30, 9, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          ctx.beginPath();
          ctx.moveTo(300 + Math.cos(a) * 13, 30 + Math.sin(a) * 13);
          ctx.lineTo(300 + Math.cos(a) * 18, 30 + Math.sin(a) * 18);
          ctx.stroke();
        }
      }
    }
  } catch {
    if (canvas.value) {
      const c = canvas.value;
      c.width = 600;
      c.height = 500;
      const cx = c.getContext('2d')!;
      cx.font = '22px sans-serif';
      cx.fillStyle = '#89749f';
      cx.textAlign = 'center';
      cx.fillText('素材暂未加载，请重新打开', 300, 250);
    }
  }
}
onMounted(() => {
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      visible = true;
      observer?.disconnect();
      void draw();
    },
    { rootMargin: '160px' },
  );
  observer.observe(canvas.value!);
});
watch(
  () => [props.pet.id, props.pet.sheet, props.level],
  () => visible && void draw(),
);
onBeforeUnmount(() => {
  alive = false;
  observer?.disconnect();
});
</script>
<template>
  <canvas
    ref="canvas"
    :class="['pet', emotion]"
    :aria-label="`${pet.name} ${level}级形态${showRank ? ' · ' + (rankOf(level).kind === 'sun' ? '太阳' : rankOf(level).count + '颗星') : ''}`"
    role="img"
  />
</template>
