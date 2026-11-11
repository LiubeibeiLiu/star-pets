<script setup lang="ts">
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    icon?: string;
    // 彩色 3D 图标地址（可选）：传入时替代线形图标，只影响本调用处。
    icon3d?: string;
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
    ><span class="empty-icon"><img v-if="props.icon3d" :src="props.icon3d" alt="" /><Icon v-else :name="icon || 'sparkles'" /></span
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
