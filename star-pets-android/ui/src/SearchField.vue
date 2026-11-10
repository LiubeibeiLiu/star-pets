<script setup lang="ts">
import { ref } from 'vue';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder: string;
    label?: string;
    maxlength?: number;
  }>(),
  { label: '', maxlength: 120 },
);
const emit = defineEmits<{
  'update:modelValue': [value: string];
  input: [];
  clear: [];
}>();
const input = ref<HTMLInputElement>();
function update(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value);
  emit('input');
}
function clear() {
  emit('update:modelValue', '');
  emit('clear');
  input.value?.focus({ preventScroll: true });
}
function focus() {
  input.value?.focus({ preventScroll: true });
}
defineExpose({ focus });
</script>

<template>
  <label class="search-field" :aria-label="label || placeholder">
    <button
      v-if="props.modelValue"
      type="button"
      class="search-clear"
      :aria-label="'清除“' + (label || placeholder) + '”'"
      @click="clear"
    >
      <Icon name="close" />
    </button>
    <Icon v-else class="search-leading-icon" name="search" />
    <input
      ref="input"
      :value="props.modelValue"
      :placeholder="placeholder"
      :aria-label="label || placeholder"
      :maxlength="maxlength"
      autocomplete="off"
      @input="update"
    />
  </label>
</template>
