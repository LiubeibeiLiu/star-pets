<script setup lang="ts">
import UiSelect from './UiSelect.vue';
import Icon from './Icon.vue';
import { ref, onMounted, watch } from 'vue';
import { renderSkinPose } from './pet-skin';
import { POSES, choosePhotoPose } from './companion.js';
const props = defineProps<{
  photo: string;
  pet: any;
  maxLevel: number;
  name: string;
}>();
const emit = defineEmits<{ save: [data: string]; cancel: [] }>();
const canvas = ref<HTMLCanvasElement>();
const rendering = ref(true),
  photoError = ref('');
let renderVersion = 0;
const x = ref(0.68),
  y = ref(0.7),
  scale = ref(0.38),
  flip = ref(false),
  level = ref(props.maxLevel),
  pose = ref(choosePhotoPose()),
  caption = ref(props.name),
  frame = ref(true);
let photo: HTMLImageElement,
  pet: HTMLCanvasElement,
  drag = false;
// 轻震反馈（15ms）：模板内不能直接写 navigator（vue-tsc 会当作成员属性），
// 与 QuickScore.vue 的 navigator.vibrate?.(20) 同一写法，只是包一层。
function buzz() {
  navigator.vibrate?.(15);
}
function image(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}
async function init() {
  try {
    photo = await image(props.photo);
    await updatePet();
  } catch {
    photoError.value = '照片加载失败，请重新选择照片。';
    rendering.value = false;
  }
}
function draw() {
  if (!photo || !pet || !canvas.value) return;
  const c = canvas.value;
  c.width = 1080;
  c.height = Math.round((1080 * photo.height) / photo.width);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(photo, 0, 0, c.width, c.height);
  const w = c.width * scale.value,
    h = w;
  ctx.save();
  ctx.translate(c.width * x.value, c.height * y.value);
  ctx.scale(flip.value ? -1 : 1, 1);
  ctx.shadowColor = '#40304540';
  ctx.shadowBlur = 12;
  ctx.drawImage(pet, -w / 2, -h / 2, w, h);
  ctx.restore();
  if (frame.value) {
    ctx.strokeStyle = '#fff8';
    ctx.lineWidth = 22;
    ctx.strokeRect(11, 11, c.width - 22, c.height - 22);
  }
  ctx.fillStyle = '#ffffffde';
  ctx.fillRect(20, c.height - 90, c.width - 40, 70);
  ctx.fillStyle = '#6e5587';
  ctx.font = '26px sans-serif';
  ctx.fillText(caption.value.slice(0, 30), 42, c.height - 46);
  ctx.font = '17px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    '星星宠物 · ' + new Date().toLocaleDateString('zh-CN'),
    c.width - 42,
    c.height - 46,
  );
  ctx.textAlign = 'left';
}
function point(e: PointerEvent) {
  if (!drag || !canvas.value) return;
  const r = canvas.value.getBoundingClientRect();
  x.value = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  y.value = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
}
function startDrag(event: PointerEvent) {
  drag = true;
  (event.target as HTMLElement).setPointerCapture(event.pointerId);
  point(event);
}
function stopDrag() {
  drag = false;
}
async function updatePet() {
  const v = ++renderVersion;
  rendering.value = true;
  photoError.value = '';
  try {
    const next = await renderSkinPose(props.pet, level.value, pose.value);
    if (v !== renderVersion) return;
    pet = next;
    draw();
  } catch {
    if (v === renderVersion)
      photoError.value = '伙伴姿态加载失败，请重试或重新进入合照。';
  } finally {
    if (v === renderVersion) rendering.value = false;
  }
}
function shuffle() {
  pose.value = choosePhotoPose();
}
watch([x, y, scale, flip, caption, frame], draw);
watch([level, pose], updatePet);
onMounted(init);
</script>
<template>
  <div class="photo-editor"
    ><canvas
      ref="canvas"
      @pointerdown="startDrag"
      @pointermove="point"
      @pointerup="stopDrag"
      aria-label="拖动调整伙伴位置" /></div
  ><p v-if="photoError" role="alert">{{ photoError }}</p
  ><p class="subtext">拖动画面调整伙伴位置；保存后会生成新照片，不会覆盖原图。</p
  ><label class="field"
    ><span>伙伴大小</span
    ><input
      type="range"
      min="0.15"
      max="0.9"
      step="0.01"
      v-model.number="scale" /></label
  ><div class="two-col"
    ><label class="field"
      ><span>已解锁形态</span
      ><UiSelect
        v-model="level"
        label="已解锁形态"
        :options="
          Array.from({ length: maxLevel }, (_, i) => ({
            value: i + 1,
            label: 'Lv.' + (i + 1),
          }))
        " /></label
    ><label class="field"
      ><span>姿态</span
      ><UiSelect
        v-model="pose"
        label="姿态"
        :options="
          POSES.map(([value, label]) => ({ value, label }))
        " /></label></div
  ><button class="ghost wide" @click="shuffle">换一个姿势</button
  ><div class="field inline"
    ><span>左右翻转</span
    ><button
      type="button"
      class="plan-toggle"
      :class="{ off: !flip }"
      :aria-pressed="flip"
      aria-label="左右翻转"
      @click="
        buzz();
        flip = !flip;
      "
      ><Icon name="power" /></button
  ></div
  ><div class="field inline"
    ><span>纪念相框</span
    ><button
      type="button"
      class="plan-toggle"
      :class="{ off: !frame }"
      :aria-pressed="frame"
      aria-label="纪念相框"
      @click="
        buzz();
        frame = !frame;
      "
      ><Icon name="power" /></button
  ></div
  ><label class="field"
    ><span>合照标题</span><input v-model="caption" maxlength="30" placeholder="写下这一刻" /></label
  ><footer
    ><button @click="emit('cancel')">取消</button
    ><button
      class="primary"
      :disabled="rendering || !!photoError"
      @click="emit('save', canvas!.toDataURL('image/jpeg', 0.9).split(',')[1])"
      >保存合照</button
    ></footer
  >
</template>
