<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { native, isNative } from './platform';
import { preferences } from './companion.js';
import UiSelect from './UiSelect.vue';
import Icon from './Icon.vue';
import { confirmClear } from './confirm';
import {
  DEEPSEEK_ENDPOINT,
  GEMINI_ENDPOINT,
  DEEPSEEK_MODELS,
  GEMINI_MODELS,
  normalizeModel,
} from './cloud-config.js';

const props = defineProps<{ value: any }>(),
  emit = defineEmits<{ save: [value: any] }>();
const local = ref(preferences(props.value));
watch(
  () => props.value,
  (v) => (local.value = preferences(v)),
);
const blank = (slot: number) => ({
  slot,
  name: 'DeepSeek',
  provider: 'deepseek',
  endpoint: DEEPSEEK_ENDPOINT,
  model: 'deepseek-flash',
  hasKey: false,
  key: '',
});
const slots = ref<any[]>([blank(0)]),
  activeSlot = ref(0),
  editSlot = ref(0),
  saving = ref(false),
  message = ref('');
const keyVisible = ref(false),
  previousProvider = ref('deepseek');
const chosen = computed(() => slots.value[editSlot.value]);
function savePreference() {
  emit('save', { ...local.value });
}
async function preset() {
  if (
    chosen.value.key &&
    !(await confirmClear('切换智能服务会清空尚未保存的密钥。要继续吗？'))
  ) {
    chosen.value.provider = previousProvider.value;
    return;
  }
  previousProvider.value = chosen.value.provider;
  keyVisible.value = false;
  const deep = chosen.value.provider === 'deepseek';
  chosen.value.endpoint = deep ? DEEPSEEK_ENDPOINT : GEMINI_ENDPOINT;
  chosen.value.model = deep ? 'deepseek-flash' : 'gemini-3.8-flash';
  chosen.value.key = '';
  chosen.value.hasKey = false;
}
async function refresh() {
  keyVisible.value = false;
  if (!isNative) return;
  const r = await native('aiConfig');
  activeSlot.value = 0;
  slots.value = r.slots.slice(0, 1).map((s: any, i: number) =>
    !['deepseek', 'gemini'].includes(s.provider)
      ? blank(i)
      : {
          ...blank(i),
          ...s,
          model:
            s.provider === 'deepseek' &&
            ['deepseek-chat', 'deepseek-reasoner'].includes(s.model)
              ? 'deepseek-flash'
              : s.model,
          key: '',
        },
  );
  previousProvider.value = chosen.value.provider;
}
async function saveModel(test = false) {
  let config: any;
  try {
    config = normalizeModel(chosen.value);
  } catch (e: any) {
    message.value = e.message;
    return;
  }
  if (!isNative) {
    message.value = 'API Key 只能在手机 App 中设置。';
    return;
  }
  saving.value = true;
  message.value = '';
  try {
    await native('aiConfigSave', config);
    await refresh();
    if (test) {
      await native('aiTest');
      message.value = '设置已保存，连接正常';
    } else message.value = '智能服务已保存，开启云端对话后生效';
  } catch (e: any) {
    message.value = e.message;
  } finally {
    saving.value = false;
  }
}
async function clearKey() {
  if (
    !(await confirmClear(
      chosen.value.hasKey
        ? '确认清除已保存的 API Key？清除后云端对话需要重新配置。'
        : '确认清空当前输入的 API Key？',
    ))
  )
    return;
  if (chosen.value.hasKey) {
    if (!isNative) return;
    try {
      await native('aiKeyClear', { slot: editSlot.value });
      await refresh();
      message.value = '密钥已清除';
    } catch (e: any) {
      message.value = e.message;
      return;
    }
  }
  chosen.value.key = '';
  keyVisible.value = false;
}

onMounted(async () => {
  if (!isNative) return;
  try {
    await refresh();
  } catch (e: any) {
    message.value = e.message;
  }
});
</script>

<template>
  <section class="card companion-settings"
    ><h2 class="card-title">互动偏好</h2>
    <div class="setting"
      ><label
        ><span>云端智能对话</span
        ><input
          class="ios-switch"
          type="checkbox"
          v-model="local.chatEnabled"
          @change="savePreference" /></label
    ></div>
    <div class="setting"
      ><label
        ><span>朗读伙伴回复</span
        ><input
          class="ios-switch"
          type="checkbox"
          v-model="local.voice"
          @change="savePreference" /></label
    ></div>
    <div class="setting"
      ><span>对话语言</span
      ><UiSelect
        v-model="local.language"
        label="对话语言"
        :options="[
          { value: 'zh-CN', label: '中文' },
          { value: 'en-US', label: '英文' },
        ]"
        @change="savePreference"
    /></div>
    <div class="setting"
      ><span>动作风格</span
      ><UiSelect
        v-model="local.actionMode"
        label="动作风格"
        :options="[
          { value: 'builtin', label: '系统内置' },
          { value: 'ai', label: 'AI 选择动作' },
        ]"
        @change="savePreference"
    /></div>
    <div class="setting"
      ><span>主动问候</span
      ><UiSelect
        v-model="local.proactive"
        label="主动问候频率"
        :options="[
          { value: 'quiet', label: '安静' },
          { value: 'moderate', label: '适中' },
          { value: 'lively', label: '活泼' },
        ]"
        @change="savePreference"
    /></div>
    <div class="setting"
      ><span>习惯陪伴</span
      ><UiSelect
        v-model="local.habitFocus"
        label="习惯陪伴方式"
        :options="[
          { value: 'off', label: '不主动提起' },
          { value: 'gentle', label: '温和鼓励' },
          { value: 'active', label: '积极关注' },
        ]"
        @change="savePreference"
    /></div>
    <div class="setting"
      ><span>表达亲密度</span
      ><UiSelect
        v-model="local.affection"
        label="表达亲密度"
        :options="[
          { value: 'subtle', label: '含蓄' },
          { value: 'warm', label: '温暖' },
          { value: 'enthusiastic', label: '热情' },
        ]"
        @change="savePreference"
    /></div>
  </section>
  <section class="card model-settings"
    ><h2 class="card-title">智能服务</h2>
    <p class="card-hint">密钥只保存在这台设备上，用于连接你选择的服务。</p>
    <div class="field"
      ><span>服务提供方</span
      ><UiSelect
        v-model="chosen.provider"
        label="服务提供方"
        :options="[
          { value: 'deepseek', label: 'DeepSeek' },
          { value: 'gemini', label: 'Gemini' },
        ]"
        @change="preset"
    /></div>
    <div class="field"
      ><span>对话模型</span
      ><UiSelect
        v-model="chosen.model"
        label="对话模型"
        :options="
          chosen.provider === 'deepseek' ? DEEPSEEK_MODELS : GEMINI_MODELS
        "
    /></div>
    <div class="field"
      ><label for="model-api-key"
        >API Key {{ chosen.hasKey ? '· 已保存' : '' }}</label
      ><div class="api-key-control"
        ><input
          id="model-api-key"
          :value="chosen.hasKey ? '••••••••••••' : chosen.key"
          @input="chosen.key = ($event.target as HTMLInputElement).value"
          :type="!chosen.hasKey && keyVisible ? 'text' : 'password'"
          :readonly="chosen.hasKey"
          autocomplete="off"
          maxlength="512"
          :placeholder="chosen.hasKey ? '密钥已保存' : '输入 API Key'" /><button
          v-if="!chosen.hasKey && chosen.key"
          type="button"
          :aria-label="keyVisible ? '隐藏输入密钥' : '查看输入密钥'"
          :aria-pressed="keyVisible"
          @click="keyVisible = !keyVisible"
          ><Icon :name="keyVisible ? 'lock' : 'eye'" /></button
        ><button
          v-if="chosen.hasKey || chosen.key"
          type="button"
          aria-label="清空 API Key"
          :disabled="saving"
          @click="clearKey"
          ><Icon name="close" /></button></div
    ></div>
    <div class="two-col model-actions"
      ><button :disabled="saving || !isNative" @click="saveModel(false)"
        >保存配置</button
      ><button
        class="primary"
        :disabled="saving || !isNative"
        @click="saveModel(true)"
        >{{ saving ? '连接中…' : '保存并测试' }}</button
      ></div
    >
    <p class="status-message" role="status">{{ message }}</p>
  </section>
</template>
