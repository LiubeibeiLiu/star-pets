<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import Icon from './Icon.vue';

const props = defineProps<{ src: string; download?: boolean }>();
const emit = defineEmits<{ download: [] }>();
const audio = ref<HTMLAudioElement>();
const playing = ref(false),
  current = ref(0),
  duration = ref(0),
  speed = ref(1),
  failed = ref(false);
const speeds = [1, 1.25, 1.5, 2, 0.75];
async function toggle() {
  const el = audio.value;
  if (!el) return;
  if (el.paused) {
    try {
      await el.play();
    } catch {
      playing.value = false;
    }
  } else el.pause();
}
function seek(event: Event) {
  const el = audio.value;
  if (!el || !Number.isFinite(el.duration)) return;
  el.currentTime = Number((event.target as HTMLInputElement).value);
  current.value = el.currentTime;
}
function nextSpeed() {
  speed.value = speeds[(speeds.indexOf(speed.value) + 1) % speeds.length];
  if (audio.value) audio.value.playbackRate = speed.value;
}
function metadata(event: Event) {
  const el = event.target as HTMLAudioElement;
  duration.value = Number.isFinite(el.duration) ? el.duration : 0;
  failed.value = false;
  el.playbackRate = speed.value;
}
function progress(event: Event) {
  current.value = (event.target as HTMLAudioElement).currentTime;
}
watch(
  () => props.src,
  () => {
    audio.value?.pause();
    playing.value = false;
    current.value = 0;
    duration.value = 0;
    speed.value = 1;
    failed.value = false;
  },
);
onBeforeUnmount(() => audio.value?.pause());
</script>

<template>
  <div class="audio-player" aria-label="语音播放控件">
    <audio
      ref="audio"
      :src="src"
      preload="metadata"
      @loadedmetadata="metadata"
      @durationchange="metadata"
      @timeupdate="progress"
      @play="playing = true"
      @pause="playing = false"
      @ended="playing = false"
      @error="failed = true"
    />
    <div class="audio-controls">
      <button
        class="audio-play"
        type="button"
        :disabled="failed"
        :aria-label="playing ? '暂停语音' : '播放语音'"
        @click="toggle"
        ><Icon :name="failed ? 'warning' : playing ? 'pause' : 'play'"
      /></button>
      <div class="audio-track" :class="{ playing, failed }"
        ><span class="audio-wave" aria-hidden="true"
          ><i
            v-for="n in 36"
            :key="n"
            :class="{ heard: duration > 0 && n / 36 <= current / duration }"
            :style="{ '--wave-index': n }"
          ></i></span
        ><input name="input"
          class="audio-seek"
          type="range"
          min="0"
          :max="duration || 1"
          step="0.1"
          :value="current"
          :disabled="!duration || failed"
          aria-label="播放位置"
          @input="seek"
      /></div>
      <button
        class="audio-speed"
        type="button"
        :aria-label="'播放速度 ' + speed + ' 倍，点按切换'"
        :title="'播放速度 ' + speed + ' 倍'"
        :disabled="failed"
        @click="nextSpeed"
        >{{ speed }}×</button
      >
      <button
        v-if="download"
        class="audio-download"
        type="button"
        aria-label="下载语音"
        @click="emit('download')"
        ><Icon name="download"
      /></button>
    </div>
  </div>
</template>

<style scoped>
.audio-player {
  width: 100%;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  box-shadow: none;
}
.audio-player audio {
  display: none;
}
.audio-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 48px;
}
.audio-controls button {
  flex: none;
}
.audio-play {
  width: var(--control);
  height: var(--control);
  min-height: var(--control);
  padding: 8px;
  border: 1px solid var(--inner-edge);
  border-radius: 50%;
  background: var(--chip);
  color: var(--ink-2);
  box-shadow: none;
}
.audio-play svg {
  width: 20px;
  height: 20px;
}
.audio-play:disabled {
  background: var(--danger-soft);
  color: var(--danger);
  box-shadow: none;
  opacity: 1;
}
.audio-track.failed .audio-wave {
  opacity: 0.35;
}
.audio-track {
  position: relative;
  flex: 1;
  min-width: 0;
  height: var(--control);
  border: 0;
  border-radius: 0;
  background: transparent;
  overflow: hidden;
}
.audio-seek {
  position: absolute;
  z-index: 3;
  inset: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  border: 0;
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  opacity: 0;
  box-shadow: none;
  cursor: pointer;
}
.audio-wave {
  position: absolute;
  inset: 6px 2px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 2px;
  opacity: 1;
  pointer-events: none;
}
.audio-wave i {
  display: block;
  flex: 1;
  min-width: 1px;
  max-width: 2px;
  height: 9px;
  border-radius: 99px;
  background: var(--line-strong);
  transition: background 0.18s ease;
  animation: none;
}
.audio-wave i:nth-child(3n) {
  height: 15px;
}
.audio-wave i:nth-child(4n) {
  height: 6px;
}
.audio-wave i:nth-child(7n) {
  height: 19px;
}
.audio-wave i:nth-child(11n) {
  height: 12px;
}
.audio-wave i.heard {
  background: var(--primary);
}
@media (prefers-reduced-motion: reduce) {
  .audio-wave i {
    animation: none;
  }
}
.audio-seek::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: var(--shadow-card);
}
.audio-seek::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--primary);
}
.audio-seek:disabled {
  opacity: 0.6;
}
.audio-speed,
.audio-download {
  display: grid;
  place-items: center;
  min-width: var(--control);
  width: var(--control);
  height: var(--control);
  min-height: var(--control);
  padding: 8px;
  border: 1px solid var(--inner-edge);
  border-radius: 50%;
  background: var(--chip);
  color: var(--ink-2);
  box-shadow: none;
}
.audio-download svg {
  width: 20px;
  height: 20px;
}
.audio-speed {
  font-family: var(--font-num);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.audio-speed svg,
.audio-download svg {
  width: 18px;
  height: 18px;
}
.audio-speed:active,
.audio-download:active {
  background: var(--well-strong);
}
</style>
