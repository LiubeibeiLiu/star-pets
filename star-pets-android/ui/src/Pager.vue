<script setup lang="ts">
import { computed } from 'vue';
import Icon from './Icon.vue';

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
</script>

<template>
  <nav v-if="pages > 1" class="pagination-shell memory-pagination" :aria-label="label || '分页'">
    <div class="pagination pagination-stepper">
      <button
        :type="buttonType"
        :disabled="page <= 1"
        :aria-label="previousLabel || '上一页'"
        @click="emit('change', page - 1)"
        ><Icon name="back"
      /></button>
      <span aria-live="polite">第 {{ page }} / {{ pages }} 页</span>
      <button
        :type="buttonType"
        :disabled="page >= pages"
        :aria-label="nextLabel || '下一页'"
        @click="emit('change', page + 1)"
        ><Icon name="forward"
      /></button>
    </div>
    <div class="pagination-dots" role="group" aria-label="选择页面">
      <button
        v-for="item in dotPages"
        :key="item"
        :type="buttonType"
        :class="{ active: item === page }"
        :aria-label="`第 ${item} 页`"
        :aria-current="item === page ? 'page' : undefined"
        @click="emit('change', item)"
      ></button>
    </div>
  </nav>
</template>
