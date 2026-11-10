<script setup lang="ts">
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min: number;
    max: number;
    label: string;
    allowZero?: boolean;
  }>(),
  { allowZero: true },
);
const emit = defineEmits<{ 'update:modelValue': [value: number] }>();
function set(value: number) {
  let next = Math.max(props.min, Math.min(props.max, Math.round(value || 0)));
  if (!props.allowZero && next === 0)
    next = value >= props.modelValue ? Math.min(props.max, 1) : Math.max(props.min, -1);
  emit('update:modelValue', next);
}
function input(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (Number.isFinite(value)) set(value);
}
</script>

<template>
  <div class="stepper" role="group" :aria-label="label">
    <button
      type="button"
      :aria-label="'减少' + label"
      :disabled="modelValue <= min"
      @click="set(modelValue - 1)"
    >
      <Icon name="minus" />
    </button>
    <input
      class="num"
      type="number"
      inputmode="numeric"
      :value="modelValue"
      :min="min"
      :max="max"
      step="1"
      :aria-label="label"
      @change="input"
    />
    <button
      type="button"
      :aria-label="'增加' + label"
      :disabled="modelValue >= max"
      @click="set(modelValue + 1)"
    >
      <Icon name="plus" />
    </button>
  </div>
</template>
