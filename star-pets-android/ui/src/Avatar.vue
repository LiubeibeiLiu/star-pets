<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{ avatar?: string; src?: string; large?: boolean }>();
const legacy: Record<string, string> = {
  '⭐': 'star',
  '🌙': 'moon',
  '🌈': 'rainbow',
  '🐱': 'cat',
  '🐼': 'bear',
  '🦋': 'butterfly',
  '🌻': 'flower',
  '🚀': 'rocket',
};
const broken = ref(false);
watch(
  () => props.src,
  () => (broken.value = false),
);
const kind = computed(
  () => legacy[props.avatar || ''] || props.avatar || 'star',
);
</script>
<template>
  <span class="child-avatar" :class="{ large }"
    ><img
      v-if="src && !broken"
      :src="src"
      alt=""
      decoding="async"
      @error="broken = true"
    />
    <svg
      v-else-if="kind === 'star'"
      class="color-avatar"
      viewBox="0 0 36 36"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="av-star" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFE769" />
          <stop offset="100%" stop-color="#FF9F1C" />
        </linearGradient>
      </defs>
      <path
        d="M18 3.6l4.2 8.7 9.6 1.3-7 6.7 1.7 9.5L18 25.2l-8.5 4.6 1.7-9.5-7-6.7 9.6-1.3L18 3.6z"
        fill="url(#av-star)"
        stroke="#E07A00"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
      <path
        d="M18 6.8l2.7 5.6 6.1.8-4.4 4.2 1 6-5.4-2.9"
        fill="#FFF3A8"
        opacity="0.55"
      />
    </svg>
    <svg
      v-else-if="kind === 'moon'"
      class="color-avatar"
      viewBox="0 0 36 36"
      aria-hidden="true"
    >
      <path
        d="M23.8 5.2c1.8 2.6 2.8 5.8 2.5 9.3-.6 7.5-7 13.1-14.5 12.7-1.5-.1-3-.5-4.3-1.1 2.7 3.7 7.1 6 12.1 5.8 8.3-.3 14.8-7.3 14.5-15.6-.2-5.4-3.1-10.1-7.5-12.7-1-.6-2 .4-1.8 1.6z"
        fill="#FFB72B"
        stroke="#E07A00"
        stroke-width="1.3"
        stroke-linejoin="round"
      />
      <circle cx="24" cy="21" r="1.6" fill="#E8890C" opacity="0.65" />
      <circle cx="20.5" cy="25.5" r="1.2" fill="#E8890C" opacity="0.55" />
    </svg>
    <svg
      v-else-if="kind === 'rainbow'"
      class="color-avatar"
      viewBox="0 0 36 36"
      aria-hidden="true"
    >
      <path
        d="M6 27a15 15 0 0 1 24-12"
        fill="none"
        stroke="#FF4D5E"
        stroke-width="3.2"
        stroke-linecap="round"
      />
      <path
        d="M8.5 27.5a12.2 12.2 0 0 1 19.8-9.8"
        fill="none"
        stroke="#FFA62B"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path
        d="M11 28a9.5 9.5 0 0 1 15.5-7.6"
        fill="none"
        stroke="#FFD93D"
        stroke-width="2.8"
        stroke-linecap="round"
      />
      <path
        d="M13.5 28.4a6.8 6.8 0 0 1 11.2-5.4"
        fill="none"
        stroke="#38C976"
        stroke-width="2.6"
        stroke-linecap="round"
      />
      <path
        d="M16 28.8a4.2 4.2 0 0 1 7-3.3"
        fill="none"
        stroke="#3993FF"
        stroke-width="2.6"
        stroke-linecap="round"
      />
    </svg>
    <svg
      v-else-if="kind === 'cat'"
      class="color-avatar"
      viewBox="0 0 36 36"
      aria-hidden="true"
    >
      <path
        d="M7.5 15.5L6.8 6.8l7.4 4.4c1.2-.3 2.5-.5 3.8-.5s2.6.2 3.8.5l7.4-4.4-.7 8.7c1.4 1.9 2.2 4.2 2.2 6.7 0 6-5.7 9.8-12.7 9.8S5.3 28.2 5.3 22.2c0-2.5.8-4.8 2.2-6.7z"
        fill="#FFC542"
        stroke="#C47400"
        stroke-width="1.3"
        stroke-linejoin="round"
      />
      <path d="M8.6 9.3l-.3 4.3 3.9-2.2zM27.4 9.3l.3 4.3-3.9-2.2z" fill="#FF8FA3" />
      <path
        d="M18 11.2v3.6M15.2 11.7v2.8M20.8 11.7v2.8"
        stroke="#B86400"
        stroke-width="1.4"
        stroke-linecap="round"
      />
      <circle cx="13.2" cy="20.5" r="1.7" fill="#3B2414" />
      <circle cx="22.8" cy="20.5" r="1.7" fill="#3B2414" />
      <polygon points="18,22.2 16.4,24 19.6,24" fill="#FF758F" />
      <path
        d="M15.4 25.2c1 .9 2.2.9 2.6 0 .4.9 1.6.9 2.6 0"
        fill="none"
        stroke="#6B3D12"
        stroke-width="1.3"
        stroke-linecap="round"
      />
    </svg>
    <svg
      v-else-if="kind === 'bear'"
      class="color-avatar"
      viewBox="0 0 36 36"
      aria-hidden="true"
    >
      <circle cx="9.2" cy="10.2" r="4.4" fill="#2B303A" />
      <circle cx="26.8" cy="10.2" r="4.4" fill="#2B303A" />
      <ellipse
        cx="18"
        cy="20.5"
        rx="12.2"
        ry="10.8"
        fill="#FFFFFF"
        stroke="#39404E"
        stroke-width="1.3"
      />
      <ellipse
        cx="13.2"
        cy="19.5"
        rx="3.2"
        ry="4"
        transform="rotate(-16 13.2 19.5)"
        fill="#2B303A"
      />
      <ellipse
        cx="22.8"
        cy="19.5"
        rx="3.2"
        ry="4"
        transform="rotate(16 22.8 19.5)"
        fill="#2B303A"
      />
      <circle cx="13.5" cy="19" r="1.1" fill="#FFF" />
      <circle cx="22.5" cy="19" r="1.1" fill="#FFF" />
      <ellipse cx="18" cy="23.2" rx="2" ry="1.4" fill="#2B303A" />
      <circle cx="9.8" cy="23.5" r="1.8" fill="#FF9EB5" opacity="0.75" />
      <circle cx="26.2" cy="23.5" r="1.8" fill="#FF9EB5" opacity="0.75" />
    </svg>
    <svg
      v-else-if="kind === 'butterfly'"
      class="color-avatar"
      viewBox="0 0 36 36"
      aria-hidden="true"
    >
      <path
        d="M17.2 16.5C14 9 6.2 6.8 5 12.2c-1 4.4 3.4 7.7 9.4 7.8-4.5 1.8-6.4 6.2-3.3 9.2 3.1 3 8.1-.5 6.8-8.2z"
        fill="#28A9FF"
        stroke="#16508E"
        stroke-width="1.3"
        stroke-linejoin="round"
      />
      <path
        d="M18.8 16.5C22 9 29.8 6.8 31 12.2c1 4.4-3.4 7.7-9.4 7.8 4.5 1.8 6.4 6.2 3.3 9.2-3.1 3-8.1-.5-6.8-8.2z"
        fill="#28A9FF"
        stroke="#16508E"
        stroke-width="1.3"
        stroke-linejoin="round"
      />
      <circle cx="10.2" cy="13.6" r="2.2" fill="#9EE6FF" />
      <circle cx="25.8" cy="13.6" r="2.2" fill="#9EE6FF" />
      <rect x="16.9" y="11.5" width="2.2" height="15" rx="1.1" fill="#1F2937" />
      <path
        d="M17.3 11.8c-.8-2.2-2.2-3.4-3.8-3.7M18.7 11.8c.8-2.2 2.2-3.4 3.8-3.7"
        fill="none"
        stroke="#1F2937"
        stroke-width="1.2"
        stroke-linecap="round"
      />
    </svg>
    <svg
      v-else-if="kind === 'flower'"
      class="color-avatar"
      viewBox="0 0 36 36"
      aria-hidden="true"
    >
      <path
        d="M18 21v11"
        stroke="#43A047"
        stroke-width="2.6"
        stroke-linecap="round"
      />
      <path d="M18 27c-3.8-.3-6-2.5-6-5 3.4 0 5.5 1.6 6 5z" fill="#55B959" />
      <path d="M18 28c3.8-.3 6-2.5 6-5-3.4 0-5.5 1.6-6 5z" fill="#55B959" />
      <g fill="#FFC72C" stroke="#E08E00" stroke-width="0.9">
        <circle cx="18" cy="7.5" r="3.2" />
        <circle cx="18" cy="19.5" r="3.2" />
        <circle cx="12" cy="13.5" r="3.2" />
        <circle cx="24" cy="13.5" r="3.2" />
        <circle cx="13.7" cy="9.2" r="3" />
        <circle cx="22.3" cy="9.2" r="3" />
        <circle cx="13.7" cy="17.8" r="3" />
        <circle cx="22.3" cy="17.8" r="3" />
      </g>
      <circle cx="18" cy="13.5" r="4.3" fill="#8D4B20" />
    </svg>
    <svg
      v-else
      class="color-avatar"
      viewBox="0 0 36 36"
      aria-hidden="true"
    >
      <g transform="rotate(45 18 18)">
        <path
          d="M18 33.4c-2.6-2.2-3.2-5-1.9-7h3.8c1.3 2 .7 4.8-1.9 7z"
          fill="#FF9F1C"
        />
        <path
          d="M18 31c-1.3-1.3-1.6-2.9-.9-4.3h1.8c.7 1.4.4 3-.9 4.3z"
          fill="#FFE66D"
        />
        <path
          d="M13.2 20L8.4 24.4l1.2 2.4 4.2-1.6zM22.8 20l4.8 4.4-1.2 2.4-4.2-1.6z"
          fill="#FF4D5E"
          stroke="#C82838"
          stroke-width="1.1"
          stroke-linejoin="round"
        />
        <path
          d="M18 4.2c-4.1 3.7-5.5 9.6-5.1 17.8.1 1.7 1.5 3 3.2 3h3.8c1.7 0 3.1-1.3 3.2-3 .4-8.2-1-14.1-5.1-17.8z"
          fill="#F4F6FB"
          stroke="#5B677D"
          stroke-width="1.3"
          stroke-linejoin="round"
        />
        <path
          d="M18 4.2c-2.4 2.2-4 5.1-4.7 8.6h9.4c-.7-3.5-2.3-6.4-4.7-8.6z"
          fill="#FF4D5E"
          stroke="#C82838"
          stroke-width="1.1"
          stroke-linejoin="round"
        />
        <circle
          cx="18"
          cy="17"
          r="2.8"
          fill="#4CC3FF"
          stroke="#2C6CB0"
          stroke-width="1.3"
        />
      </g>
    </svg>
  </span>
</template>
