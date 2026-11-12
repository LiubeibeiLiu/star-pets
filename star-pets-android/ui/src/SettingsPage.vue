<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Avatar from './Avatar.vue';
import Icon from './Icon.vue';
import UiSelect from './UiSelect.vue';

const props = defineProps<{
  state: any;
  themes: readonly any[];
  themeId: string;
  activeProfile: any;
  profileCount: number;
  status: any;
  busy: boolean;
}>();

const emit = defineEmits<{
  selectTheme: [id: string];
  navigate: [view: string];
  setting: [change: { key: string; value: unknown }];
  toggleBio: [];
  exportBackup: [];
  importBackup: [];
  importPet: [];
  logout: [];
}>();

// 轻震反馈（15ms）：模板内不能直接写 navigator（vue-tsc 会当作成员属性），
// 与 QuickScore.vue 的 navigator.vibrate?.(20) 同一写法，只是包一层。
function buzz() {
  navigator.vibrate?.(15);
}

const lockOptions = [
  { value: 0, label: '立即' },
  { value: 1, label: '1 分钟' },
  { value: 5, label: '5 分钟' },
  { value: 15, label: '15 分钟' },
];
const travelOptions = [1, 2, 3, 4, 5, 8, 12, 24].map((value) => ({
  value,
  label: value + '小时',
}));
// 设置行 3D 图标（Microsoft Fluent Emoji，MIT 协议）：按行取图标，找不到回退不显示。
const ICON_3D = import.meta.glob('./assets/icons-3d/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>;
const icon3d = (file: string) => (file ? ICON_3D[`./assets/icons-3d/${file}`] || '' : '');
const SETTING_3D_ICON: Record<string, string> = {
  profile: 'setting-child.png',
  bio: 'setting-locked.png',
  lock: 'setting-timer.png',
  travel: 'setting-map.png',
  travelTime: 'setting-stopwatch.png',
  voice: 'setting-mic.png',
  chat: 'setting-chat.png',
  speaker: 'setting-speaker.png',
  backup: 'setting-floppy.png',
  restore: 'setting-inbox.png',
  importPet: 'setting-package.png',
};
function settingIcon(key: string): string {
  return icon3d(SETTING_3D_ICON[key] || '');
}
const THEME_LOOP_COPIES = 5;
const themeTrack = ref<HTMLElement | null>(null);
const middleCopy = Math.floor(THEME_LOOP_COPIES / 2);
const focusedCopy = ref(middleCopy);
const loopedThemes = computed(() => {
  const items: {
    theme: any;
    index: number;
    copy: number;
    key: string;
  }[] = [];
  for (let copy = 0; copy < THEME_LOOP_COPIES; copy++) {
    props.themes.forEach((theme, index) => {
      items.push({
        theme,
        index,
        copy,
        key: `${copy}-${theme.id}`,
      });
    });
  }
  return items;
});
function circularDistance(index: number) {
  const count = props.themes.length;
  if (!count) return 0;
  const active = props.themes.findIndex((theme) => theme.id === props.themeId);
  const from = Math.max(0, active);
  const delta = Math.abs(index - from);
  return Math.min(delta, count - delta);
}
function themeDepth(item: { index: number; copy: number; theme: { id: string } }) {
  if (item.theme.id === props.themeId && item.copy === focusedCopy.value) return 50;
  const distance = circularDistance(item.index);
  return Math.max(8, 36 - distance * 8);
}
function syncFocusedCopy(option?: HTMLElement | null) {
  const target = option || nearestThemeOption(props.themeId);
  if (!target) return;
  const copy = Number(target.dataset.themeCopy);
  if (Number.isFinite(copy)) focusedCopy.value = copy;
}
function cycleWidth() {
  const track = themeTrack.value;
  if (!track || props.themes.length < 1) return 0;
  const first = track.querySelector<HTMLElement>('[data-theme-copy="0"]');
  const next = track.querySelector<HTMLElement>('[data-theme-copy="1"]');
  if (!first || !next) return 0;
  return next.offsetLeft - first.offsetLeft;
}
function optionCenter(option: HTMLElement) {
  return option.offsetLeft + option.offsetWidth / 2;
}
function nearestThemeOption(id: string) {
  const track = themeTrack.value;
  if (!track) return null;
  const center = track.scrollLeft + track.clientWidth / 2;
  let best: HTMLElement | null = null;
  let bestDist = Infinity;
  track
    .querySelectorAll<HTMLElement>(`.theme-option[data-theme-id="${id}"]`)
    .forEach((option) => {
      const dist = Math.abs(optionCenter(option) - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = option;
      }
    });
  return best;
}
function centerOption(option: HTMLElement, behavior: ScrollBehavior = 'auto') {
  const track = themeTrack.value;
  if (!track) return;
  syncFocusedCopy(option);
  const left = optionCenter(option) - track.clientWidth / 2;
  scrollingProgrammatically = behavior === 'smooth';
  track.scrollTo({ left, behavior });
  if (behavior === 'smooth') armScrollSettle();
  else {
    scrollingProgrammatically = false;
    normalizeThemeLoop(true);
  }
}
function showTheme(id: string, behavior: ScrollBehavior = 'auto') {
  const option = nearestThemeOption(id);
  if (!option) return;
  centerOption(option, behavior);
}
let loopRaf = 0;
let settleTimer = 0;
let scrollingProgrammatically = false;
function normalizeThemeLoop(force = false) {
  const track = themeTrack.value;
  const width = cycleWidth();
  if (!track || width <= 0) return;
  if (scrollingProgrammatically && !force) return;
  // Keep the viewport inside the middle copies so left/right can wrap forever.
  // Only jump when clearly outside the safe band to avoid fighting flings.
  const min = width * (middleCopy - 0.35);
  const max = width * (middleCopy + 1.35);
  if (track.scrollLeft < min) track.scrollLeft += width;
  else if (track.scrollLeft > max) track.scrollLeft -= width;
}
function armScrollSettle() {
  window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => {
    scrollingProgrammatically = false;
    syncFocusedCopy();
    normalizeThemeLoop(true);
    // After settle, silently re-home to the middle copy without a visible jump.
    const home = themeTrack.value?.querySelector<HTMLElement>(
      `.theme-option[data-theme-id="${props.themeId}"][data-theme-copy="${middleCopy}"]`,
    );
    const current = nearestThemeOption(props.themeId);
    if (!home || !current) return;
    if (home === current) {
      focusedCopy.value = middleCopy;
      return;
    }
    const delta = optionCenter(current) - optionCenter(home);
    const track = themeTrack.value;
    if (!track) return;
    track.scrollLeft -= delta;
    focusedCopy.value = middleCopy;
  }, 160);
}
function onThemeScroll() {
  if (loopRaf) return;
  loopRaf = requestAnimationFrame(() => {
    loopRaf = 0;
    normalizeThemeLoop();
    armScrollSettle();
  });
}
onMounted(() => {
  showTheme(props.themeId);
  normalizeThemeLoop(true);
  themeTrack.value?.addEventListener('scroll', onThemeScroll, { passive: true });
});
onBeforeUnmount(() => {
  themeTrack.value?.removeEventListener('scroll', onThemeScroll);
  if (loopRaf) cancelAnimationFrame(loopRaf);
  window.clearTimeout(settleTimer);
});
let ignoreThemeWatch = false;
watch(
  () => props.themeId,
  (id) => {
    if (ignoreThemeWatch) {
      syncFocusedCopy(nearestThemeOption(id));
      return;
    }
    showTheme(id, 'smooth');
  },
);
function pickTheme(id: string, copy = middleCopy) {
  focusedCopy.value = copy;
  const track = themeTrack.value;
  const option =
    track?.querySelector<HTMLElement>(
      `.theme-option[data-theme-id="${id}"][data-theme-copy="${copy}"]`,
    ) || nearestThemeOption(id);
  if (option) centerOption(option, 'smooth');
  if (id === props.themeId) return;
  ignoreThemeWatch = true;
  emit('selectTheme', id);
  queueMicrotask(() => {
    ignoreThemeWatch = false;
  });
}
</script>

<template>
  <div class="settings-stack">
    <section class="card settings-card theme-settings">
      <div class="theme-heading">
        <h2 class="card-title">星光外观</h2>
      </div>
      <div
        ref="themeTrack"
        class="theme-grid"
        role="radiogroup"
        aria-label="界面主题"
      >
        <button
          v-for="item in loopedThemes"
          :key="item.key"
          type="button"
          role="radio"
          class="theme-option"
          :data-theme-id="item.theme.id"
          :data-theme-copy="item.copy"
          :class="{
            active: themeId === item.theme.id && item.copy === focusedCopy,
          }"
          :aria-checked="themeId === item.theme.id && item.copy === focusedCopy"
          :tabindex="themeId === item.theme.id && item.copy === focusedCopy ? 0 : -1"
          :style="{
            '--swatch-primary': item.theme.colors[0],
            '--swatch-secondary': item.theme.colors[1],
            '--swatch-tertiary': item.theme.colors[2],
            '--theme-depth': themeDepth(item),
          }"
          @click="pickTheme(item.theme.id, item.copy)"
        >
          <span class="theme-option-copy">
            <span><b>{{ item.theme.name }}</b><Icon name="check" /></span>
          </span>
          <span class="theme-preview" aria-hidden="true">
            <span class="theme-preview-bar"></span>
            <span class="theme-preview-content"><i></i><i></i><i></i></span>
            <span class="theme-preview-action"></span>
          </span>
        </button>
      </div>
    </section>

    <section class="card settings-card">
      <h2 class="card-title">家庭与安全</h2>
      <div class="setting">
        <span class="setting-icon cat-3"
          ><img v-if="settingIcon('profile')" :src="settingIcon('profile')" alt="" /></span
        ><button @click="emit('navigate', 'children')">
          <span>小朋友档案</span>
          <span class="setting-value">
            <Avatar
              :avatar="activeProfile.avatar"
              :src="activeProfile.avatarFile ? '/media/' + activeProfile.avatarFile : ''"
            />
            <span class="setting-name">{{ activeProfile.name }}</span>
            <Icon name="chevron" />
          </span>
        </button>
      </div>
      <div class="setting">
        <span class="setting-icon cat-1"
          ><img v-if="settingIcon('bio')" :src="settingIcon('bio')" alt="" /></span
        ><span class="setting-label">指纹或面容解锁</span>
        <button
          type="button"
          class="plan-toggle"
          :class="{ off: !status.biometric }"
          :disabled="!status.bioAvailable || busy"
          :aria-pressed="status.biometric"
          aria-label="指纹或面容解锁"
          @click="
            buzz();
            emit('toggleBio');
          "
        >
          <Icon name="power" />
        </button>
      </div>
      <div class="setting">
        <span class="setting-icon cat-2"
          ><img v-if="settingIcon('lock')" :src="settingIcon('lock')" alt="" /></span
        ><span class="setting-label">离开后自动锁定</span>
        <UiSelect
          class="compact"
          :model-value="state.settings.lockMinutes"
          label="离开应用后自动锁定"
          :options="lockOptions"
          @change="
            emit('setting', { key: 'lockMinutes', value: Number($event) })
          "
        />
      </div>
    </section>

    <section class="card settings-card">
      <h2 class="card-title">伙伴探索</h2>
      <div class="setting">
        <span class="setting-icon cat-4"
          ><img v-if="settingIcon('travel')" :src="settingIcon('travel')" alt="" /></span
        ><span class="setting-label">允许伙伴外出探索</span>
        <button
          type="button"
          class="plan-toggle"
          :class="{ off: state.settings.travelEnabled === false }"
          :aria-pressed="state.settings.travelEnabled !== false"
          aria-label="允许伙伴外出探索"
          @click="
            buzz();
            emit('setting', {
              key: 'travelEnabled',
              value: state.settings.travelEnabled === false,
            })
          "
        >
          <Icon name="power" />
        </button>
      </div>
      <div class="setting">
        <span class="setting-icon cat-5"
          ><img v-if="settingIcon('travelTime')" :src="settingIcon('travelTime')" alt="" /></span
        ><span class="setting-label">最长探索时间</span>
        <UiSelect
          class="compact"
          :model-value="state.settings.travelMaxHours || 5"
          label="最长探索时间"
          :options="travelOptions"
          @change="
            emit('setting', { key: 'travelMaxHours', value: Number($event) })
          "
        />
      </div>
    </section>

    <section class="card settings-card">
      <h2 class="card-title">陪伴与对话</h2>
      <div class="setting">
        <span class="setting-icon cat-1"
          ><img v-if="settingIcon('voice')" :src="settingIcon('voice')" alt="" /></span
        ><span class="setting-label">允许语音互动</span>
        <button
          type="button"
          class="plan-toggle"
          :class="{ off: state.settings.voiceEnabled === false }"
          :aria-pressed="state.settings.voiceEnabled !== false"
          aria-label="允许语音互动"
          @click="
            buzz();
            emit('setting', {
              key: 'voiceEnabled',
              value: state.settings.voiceEnabled === false,
            })
          "
        >
          <Icon name="power" />
        </button>
      </div>
      <div class="setting">
        <span class="setting-icon cat-3"
          ><img v-if="settingIcon('chat')" :src="settingIcon('chat')" alt="" /></span
        ><button @click="emit('navigate', 'companionSettings')">
          <span>伙伴对话偏好</span><Icon name="chevron" />
        </button>
      </div>
      <div class="setting">
        <span class="setting-icon cat-5"
          ><img v-if="settingIcon('speaker')" :src="settingIcon('speaker')" alt="" /></span
        ><button @click="emit('navigate', 'voiceSettings')">
          <span>设备语音与朗读</span><Icon name="chevron" />
        </button>
      </div>
    </section>

    <section class="card settings-card">
      <h2 class="card-title">数据与扩展</h2>
      <div class="setting">
        <span class="setting-icon cat-2"
          ><img v-if="settingIcon('backup')" :src="settingIcon('backup')" alt="" /></span
        ><button @click="emit('exportBackup')">
          <span>备份家庭数据</span><Icon name="chevron" />
        </button>
      </div>
      <div class="setting">
        <span class="setting-icon cat-4"
          ><img v-if="settingIcon('restore')" :src="settingIcon('restore')" alt="" /></span
        ><button @click="emit('importBackup')">
          <span>恢复家庭数据</span><Icon name="chevron" />
        </button>
      </div>
      <div class="setting">
        <span class="setting-icon cat-1"
          ><img v-if="settingIcon('importPet')" :src="settingIcon('importPet')" alt="" /></span
        ><button @click="emit('importPet')">
          <span>导入伙伴包</span><Icon name="chevron" />
        </button>
      </div>
    </section>

    <button class="secondary wide" @click="emit('logout')">
      <Icon name="lock" />锁定应用
    </button>
  </div>
</template>
