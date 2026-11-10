<script setup lang="ts">
import { ref } from 'vue';
const props = defineProps<{ label: string; disabled?: boolean }>();
const emit = defineEmits<{ action: [] }>();
const offset = ref(0),
  dragging = ref(false);
let startX = 0,
  startY = 0,
  initial = 0;
function start(e: PointerEvent) {
  if (props.disabled) return;
  startX = e.clientX;
  startY = e.clientY;
  initial = offset.value;
  dragging.value = false;
}
function move(e: PointerEvent) {
  if (props.disabled || !e.buttons) return;
  const dx = e.clientX - startX,
    dy = e.clientY - startY;
  if (
    !dragging.value &&
    Math.abs(dx) > 12 &&
    Math.abs(dx) > Math.abs(dy) * 1.4
  ) {
    dragging.value = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  if (dragging.value) {
    e.preventDefault();
    offset.value = Math.max(-88, Math.min(0, initial + dx));
  }
}
function keys(e: KeyboardEvent) {
  if (e.target !== e.currentTarget || props.disabled) return;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    offset.value = e.key === 'ArrowLeft' ? -88 : 0;
  }
}
function end() {
  if (dragging.value) offset.value = offset.value < -36 ? -88 : 0;
  dragging.value = false;
}
</script>
<template>
  <div
    class="swipe-row"
    :class="{ dragging, open: offset < 0 }"
    @pointerdown="start"
    @pointermove="move"
    @pointerup="end"
    @pointercancel="end"
    @keydown="keys"
    :tabindex="disabled ? -1 : 0"
    :aria-label="disabled ? undefined : '左滑' + label"
    ><button
      v-if="!disabled"
      class="swipe-action"
      :tabindex="offset < 0 ? 0 : -1"
      :aria-hidden="offset === 0"
      @click.stop="
        emit('action');
        offset = 0;
      "
      >{{ label }}</button
    ><div
      class="swipe-content"
      :style="{ transform: `translateX(${disabled ? 0 : offset}px)` }"
      ><slot /></div
  ></div>
</template>
