<script setup lang="ts">
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    icon?: string;
    title: string;
    hint?: string;
    action?: string;
    variant?: 'plain' | 'card';
  }>(),
  { variant: 'plain' },
);
const emit = defineEmits<{ action: [] }>();
</script>
<template>
  <div
    class="empty-state"
    :class="{ 'empty-state--card': props.variant === 'card' }"
    role="status"
    ><span class="empty-icon"><Icon :name="icon || 'sparkles'" /></span
    ><b>{{ title }}</b
    ><small v-if="hint">{{ hint }}</small
    ><button
      v-if="action"
      type="button"
      class="secondary small"
      @click="emit('action')"
      >{{ action }}</button
    ></div
  >
</template>
