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
