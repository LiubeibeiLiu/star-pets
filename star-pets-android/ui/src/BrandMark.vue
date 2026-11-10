<script setup lang="ts">
const id = 'paw-' + Math.random().toString(36).slice(2, 8);
const star =
  'M80 76 90.6 95.4 112.3 99.5 97.1 115.6 100 137.5 80 128 60 137.5 62.9 115.6 47.7 99.5 69.4 95.4Z';
</script>
<template>
  <svg
    class="star-paw-mark"
    viewBox="0 0 160 160"
    aria-hidden="true"
    focusable="false"
    ><defs
      ><linearGradient :id="id + 'bg'" x1="0" y1="0" x2="0.6" y2="1"
        ><stop offset="0" style="stop-color: var(--primary)" /><stop
          offset="1"
          style="stop-color: var(--primary-deep)" /></linearGradient
      ><radialGradient :id="id + 'shine'" cx="0.3" cy="0.2" r="0.8"
        ><stop offset="0" stop-color="#fff" stop-opacity="0.32" /><stop
          offset="1"
          stop-color="#fff"
          stop-opacity="0" /></radialGradient></defs
    ><rect width="160" height="160" rx="40" :fill="`url(#${id}bg)`" /><rect
      width="160"
      height="160"
      rx="40"
      :fill="`url(#${id}shine)`" /><g fill="#000" style="opacity: var(--logo-shadow, 0.16)"
      ><path
        :d="star"
        transform="translate(0 5)"
        stroke="#000"
        stroke-width="14"
        stroke-linejoin="round" /><ellipse
        cx="44"
        cy="77"
        rx="11"
        ry="14"
        transform="rotate(-24 44 77)" /><ellipse
        cx="66"
        cy="57"
        rx="11"
        ry="14"
        transform="rotate(-8 66 57)" /><ellipse
        cx="94"
        cy="57"
        rx="11"
        ry="14"
        transform="rotate(8 94 57)" /><ellipse
        cx="116"
        cy="77"
        rx="11"
        ry="14"
        transform="rotate(24 116 77)" /></g
    ><path
      :d="star"
      style="fill: var(--logo-star, #fff); stroke: var(--logo-star, #fff)"
      stroke-width="14"
      stroke-linejoin="round" /><path
      d="M70 101c5-5 11-7 18-6"
      fill="none"
      stroke="#fff"
      stroke-opacity="0.75"
      stroke-width="5"
      stroke-linecap="round" /><g fill="#fff"
      ><ellipse cx="44" cy="72" rx="11" ry="14" transform="rotate(-24 44 72)" /><ellipse
        cx="66"
        cy="52"
        rx="11"
        ry="14"
        transform="rotate(-8 66 52)" /><ellipse
        cx="94"
        cy="52"
        rx="11"
        ry="14"
        transform="rotate(8 94 52)" /><ellipse
        cx="116"
        cy="72"
        rx="11"
        ry="14"
        transform="rotate(24 116 72)" /></g
    ><path
      d="M128 18l3.6 9.4L141 31l-9.4 3.6L128 44l-3.6-9.4L115 31l9.4-3.6Z"
      fill="#fff"
  /></svg>
</template>
<style scoped>
.star-paw-mark {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
