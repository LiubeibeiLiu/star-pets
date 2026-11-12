<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from './Icon.vue';
type Item = { value: string | number; label: string; short?: string };
const props = defineProps<{
  modelValue: string | number;
  options: Item[];
  label: string;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  change: [value: string | number];
}>();
const host = ref<HTMLElement>(),
  open = ref(false),
  id = 'select-' + Math.random().toString(36).slice(2);
const menu = ref<HTMLElement>(),
  target = ref<HTMLElement | string>('body'),
  position = ref({});
function toggle() {
  if (open.value) {
    open.value = false;
    return;
  }
  const rect = host.value!.getBoundingClientRect(),
    height = window.visualViewport?.height || window.innerHeight;
  target.value = host.value?.closest('dialog') || 'body';
  const below = height - rect.bottom - 12;
  const menuWidth = Math.max(rect.width, 168);
  const left = Math.max(
    8,
    Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8),
  );
  position.value = {
    position: 'fixed',
    left: left + 'px',
    width: menuWidth + 'px',
    maxHeight:
      Math.max(100, Math.min(280, below < 180 ? rect.top - 12 : below)) + 'px',
    top: below < 180 ? 'auto' : rect.bottom + 6 + 'px',
    bottom: below < 180 ? window.innerHeight - rect.top + 6 + 'px' : 'auto',
  };
  open.value = true;
}
function onScroll(e: Event) {
  if (open.value && !menu.value?.contains(e.target as Node)) open.value = false;
}
function dismiss() {
  open.value = false;
}
const current = computed(() =>
  props.options.find((x) => x.value === props.modelValue),
);
const selected = computed(
  () => current.value?.short || current.value?.label || '请选择',
);
const selectedFull = computed(() => current.value?.label || '请选择');
function choose(item: Item) {
  emit('update:modelValue', item.value);
  emit('change', item.value);
  open.value = false;
}
function outside(e: PointerEvent) {
  if (
    host.value &&
    !host.value.contains(e.target as Node) &&
    !menu.value?.contains(e.target as Node)
  )
    open.value = false;
}
function keydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    open.value = false;
    return;
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    toggle();
    return;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const i = props.options.findIndex((x) => x.value === props.modelValue),
      step = e.key === 'ArrowDown' ? 1 : -1;
    choose(
      props.options[(i + step + props.options.length) % props.options.length],
    );
  }
}
onMounted(() => {
  document.addEventListener('pointerdown', outside);
  window.addEventListener('resize', dismiss);
  document.addEventListener('scroll', onScroll, true);
});
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside);
  window.removeEventListener('resize', dismiss);
  document.removeEventListener('scroll', onScroll, true);
});
</script>
<template>
  <div ref="host" class="ui-select"
    ><button
      type="button"
      class="ui-select-trigger"
      role="combobox"
      :aria-label="label + '，' + selectedFull"
      :aria-controls="id"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click="toggle"
      @keydown="keydown"
      ><span>{{ selected }}</span
      ><Icon name="chevron" /></button
    ><Teleport :to="target"
      ><div
        v-if="open"
        ref="menu"
        :style="position"
        :id="id"
        class="ui-select-menu"
        role="listbox"
        :aria-label="label"
        ><button
          v-for="item in options"
          :key="item.value"
          type="button"
          role="option"
          :aria-selected="item.value === modelValue"
          @click="choose(item)"
          >{{ item.label
          }}<Icon
            v-if="item.value === modelValue"
            name="check" /></button></div></Teleport
  ></div>
</template>
