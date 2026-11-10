<script setup lang="ts">
import { onMounted, ref } from 'vue';
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
const themeTrack = ref<HTMLElement | null>(null);
function showTheme(id: string, behavior: ScrollBehavior = 'auto') {
  const track = themeTrack.value;
  const option = Array.from(track?.querySelectorAll<HTMLElement>('.theme-option') || []).find(
    (item) => item.dataset.themeId === id,
  );
  if (!track || !option) return;
  const left =
    track.scrollLeft +
    option.getBoundingClientRect().left -
    track.getBoundingClientRect().left -
    (track.clientWidth - option.clientWidth) / 2;
  track.scrollTo({ left, behavior });
}
onMounted(() => showTheme(props.themeId));
function pickTheme(id: string) {
  emit('selectTheme', id);
  showTheme(id, 'smooth');
}
</script>

<template>
  <div class="settings-stack">
    <section class="card settings-card theme-settings">
      <div class="theme-heading">
        <div>
          <h2 class="card-title">星光外观</h2>
          <p>挑选全家都看得舒服的界面色彩。</p>
        </div>
      </div>
      <div
        ref="themeTrack"
        class="theme-grid"
        role="radiogroup"
        aria-label="界面主题"
      >
        <button
          v-for="theme in themes"
          :key="theme.id"
          type="button"
          role="radio"
          class="theme-option"
          :data-theme-id="theme.id"
          :class="{ active: themeId === theme.id }"
          :aria-checked="themeId === theme.id"
          :style="{
            '--swatch-primary': theme.colors[0],
            '--swatch-secondary': theme.colors[1],
            '--swatch-tertiary': theme.colors[2],
          }"
          @click="pickTheme(theme.id)"
        >
          <span class="theme-preview" aria-hidden="true">
            <span class="theme-preview-bar"></span>
            <span class="theme-preview-content"><i></i><i></i><i></i></span>
            <span class="theme-preview-action"></span>
          </span>
          <span class="theme-option-copy">
            <span><b>{{ theme.name }}</b><Icon name="check" /></span>
            <small>{{ theme.description }}</small>
            <span class="theme-palette" aria-hidden="true">
              <i
                v-for="color in theme.colors"
                :key="color"
                :style="{ background: color }"
              ></i>
            </span>
          </span>
        </button>
      </div>
    </section>

    <section class="card settings-card">
      <h2 class="card-title">家庭与安全</h2>
      <div class="setting">
        <button @click="emit('navigate', 'children')">
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
        <label>
          <span>指纹或面容解锁</span>
          <input
            class="ios-switch"
            type="checkbox"
            :checked="status.biometric"
            :disabled="!status.bioAvailable || busy"
            @change="emit('toggleBio')"
          />
        </label>
      </div>
      <div class="setting">
        <span>离开后自动锁定</span>
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
        <label>
          <span>允许伙伴外出探索</span>
          <input
            class="ios-switch"
            type="checkbox"
            :checked="state.settings.travelEnabled !== false"
            @change="
              emit('setting', {
                key: 'travelEnabled',
                value: ($event.target as HTMLInputElement).checked,
              })
            "
          />
        </label>
      </div>
      <div class="setting">
        <span>最长探索时间</span>
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
        <label>
          <span>允许语音互动</span>
          <input
            class="ios-switch"
            type="checkbox"
            :checked="state.settings.voiceEnabled !== false"
            @change="
              emit('setting', {
                key: 'voiceEnabled',
                value: ($event.target as HTMLInputElement).checked,
              })
            "
          />
        </label>
      </div>
      <div class="setting">
        <button @click="emit('navigate', 'companionSettings')">
          <span>伙伴对话偏好</span><Icon name="chevron" />
        </button>
      </div>
      <div class="setting">
        <button @click="emit('navigate', 'voiceSettings')">
          <span>设备语音与朗读</span><Icon name="chevron" />
        </button>
      </div>
    </section>

    <section class="card settings-card">
      <h2 class="card-title">数据与扩展</h2>
      <div class="setting">
        <button @click="emit('exportBackup')">
          <span>备份家庭数据</span><Icon name="chevron" />
        </button>
      </div>
      <div class="setting">
        <button @click="emit('importBackup')">
          <span>恢复家庭数据</span><Icon name="chevron" />
        </button>
      </div>
      <div class="setting">
        <button @click="emit('importPet')">
          <span>导入伙伴包</span><Icon name="chevron" />
        </button>
      </div>
    </section>

    <button class="secondary wide" @click="emit('logout')">
      <Icon name="lock" />锁定应用
    </button>
  </div>
</template>
