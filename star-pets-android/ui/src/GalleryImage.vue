<script setup lang="ts">
import { ref, watch } from 'vue';
import Icon from './Icon.vue';

const props = defineProps<{ src: string; alt: string; lazy?: boolean }>();
const broken = ref(false),
  loaded = ref(false);
watch(
  () => props.src,
  () => {
    broken.value = false;
    loaded.value = false;
  },
);
</script>
<template>
  <span class="media-frame" :class="{ loaded, broken }"
    ><img
      v-if="!broken"
      :src="src"
      :alt="alt"
      :loading="lazy ? 'lazy' : undefined"
      decoding="async"
      @load="loaded = true"
      @error="broken = true" /><span v-else class="media-broken"
      ><Icon name="photo" /><small>照片暂时无法显示</small></span
    ></span
  >
</template>
