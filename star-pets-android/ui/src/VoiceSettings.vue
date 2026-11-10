<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { native, isNative } from './platform';
const info = ref<any>({}),
  busy = ref(false),
  playing = ref(''),
  message = ref('');
let disposed = false;
async function refresh() {
  if (!isNative || busy.value || playing.value) return;
  busy.value = true;
  message.value = '';
  try {
    info.value = await native('voiceRefresh');
  } catch (e: any) {
    info.value = {};
    message.value = e.message;
  } finally {
    busy.value = false;
  }
}
async function manage(action: string) {
  message.value = '';
  try {
    const result = await native(action);
    if (result.guide) message.value = result.guide;
  } catch (e: any) {
    message.value = e.message;
  }
}
async function sample(language: string) {
  if (playing.value) {
    await native('voiceCancel');
    playing.value = '';
    return;
  }
  playing.value = language;
  message.value = '';
  try {
    await native('voiceSpeak', {
      language,
      text:
        language === 'zh-CN'
          ? '你好，我是你的星星小伙伴。'
          : 'Hello, I am your little companion.',
      turn: crypto.randomUUID(),
    });
    if (!disposed) {
      message.value = '试听完成';
      info.value[(language === 'zh-CN' ? 'zh' : 'en') + 'Status'] =
        '本次合成与播放通过';
    }
  } catch (e: any) {
    if (!disposed) message.value = e.message;
  } finally {
    playing.value = '';
  }
}
function visible() {
  if (!document.hidden) void refresh();
}
onMounted(() => {
  void refresh();
  document.addEventListener('visibilitychange', visible);
});
onBeforeUnmount(() => {
  disposed = true;
  document.removeEventListener('visibilitychange', visible);
  if (playing.value) void native('voiceCancel').catch(() => {});
});
</script>
<template>
  <section class="card voice-pack-card"
    ><h2 class="card-title">听懂你的声音</h2
    ><p>{{
      isNative
        ? info.asr || '正在检测设备语音能力…'
        : '请在手机 App 中检测中文与英文语音能力'
    }}</p></section
  >
  <section class="card voice-pack-card"
    ><h2 class="card-title">伙伴的朗读声音</h2><p v-if="info.engine">当前语音服务：{{ info.engine }}</p>
    <div
      v-for="item in [
        { code: 'zh-CN', key: 'zh', name: '中文' },
        { code: 'en-US', key: 'en', name: '英文' },
      ]"
      :key="item.key"
      class="voice-pack-row"
    >
      <div
        ><strong>{{ item.name }}</strong
        ><small>{{
          !isNative
            ? '请在手机 App 中检测'
            : busy
              ? '正在检测…'
              : !info.ready
                ? '引擎未就绪'
                : info[item.key + 'Status'] ||
                  (info[item.key] ? '可以使用 · 建议先试听' : '暂时无法确认声音状态')
        }}</small></div
      >
      <button
        :disabled="
          !isNative ||
          busy ||
          !info[item.key] ||
          (!!playing && playing !== item.code)
        "
        @click="sample(item.code)"
        >{{ playing === item.code ? '停止试听' : '试听' }}</button
      >
    </div>
    <p>{{
      info.guide ||
      '可在系统中安装或管理中文、英文朗读声音，试听后再选择更安心。'
    }}</p>
    <div class="two-col"
      ><button
        :disabled="!isNative || busy || !!playing"
        @click="manage('voiceInstall')"
        >安装更多声音</button
      ><button
        :disabled="!isNative || busy || !!playing"
        @click="manage('voiceSettings')"
        >打开系统语音设置</button
      ></div
    >
    <button
      class="primary voice-refresh"
      :disabled="!isNative || busy || !!playing"
      @click="refresh"
      >{{ busy ? '正在检测…' : '重新检测声音' }}</button
    >
    <p v-if="message" class="status-message" role="status">{{ message }}</p>
  </section>
</template>
<style scoped>
.voice-pack-card {
  margin-bottom: var(--space-4);
}
.voice-pack-card h2 {
  margin: 0 0 var(--space-3);
}
.voice-pack-card p {
  font-size: var(--fs-sm);
  line-height: 1.7;
  overflow-wrap: anywhere;
  color: var(--ink-2);
}
.voice-pack-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--line);
}
.voice-pack-row small {
  display: block;
  margin-top: var(--space-1);
  font-size: 12px;
  color: var(--ink-3);
}
.voice-pack-row button {
  min-width: 88px;
}
.voice-refresh {
  width: 100%;
  margin-top: var(--space-3);
}
</style>
