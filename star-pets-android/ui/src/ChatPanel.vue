<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue';
import { native, isNative } from './platform';
import { sanitizeReply, builtinReply } from './companion.js';
import Icon from './Icon.vue';
const props = defineProps<{
    context: any;
    preferences: any;
    voiceEnabled?: boolean;
  }>(),
  emit = defineEmits<{
    action: [value: string];
    speech: [value: any];
    close: [];
  }>();
const draft = ref(''),
  stage = ref('idle'),
  notice = ref(''),
  messages = ref<any[]>([]);
const session = crypto.randomUUID();
let generation = 0,
  timers: ReturnType<typeof setTimeout>[] = [];
const holding = ref(false),
  cancelGesture = ref(false);
let holdSequence = 0,
  holdPointer: number | null = null,
  holdY = 0;
const draftArea = ref<HTMLTextAreaElement>();
watch(draft, async () => {
  await nextTick();
  if (draftArea.value) {
    draftArea.value.style.height = 'auto';
    draftArea.value.style.height =
      Math.max(52, draftArea.value.scrollHeight) + 'px';
  }
});
const visibleMessages = ref<any[]>([]);
let expiry: ReturnType<typeof setTimeout>;
watch(
  () => messages.value.at(-1),
  () => {
    visibleMessages.value = messages.value.slice(
      messages.value.at(-1)?.role === 'assistant' ? -2 : -1,
    );
    clearTimeout(expiry);
    expiry = setTimeout(() => (visibleMessages.value = []), 15000);
  },
);
let idleTimer: ReturnType<typeof setTimeout>;
let disposed = false;
function touch() {
  clearTimeout(idleTimer);
  if (!disposed && stage.value === 'idle')
    idleTimer = setTimeout(() => emit('close'), 60000);
}
watch(stage, touch);
watch(draft, touch);
function clear() {
  for (const t of timers) clearTimeout(t);
  timers = [];
  emit('speech', {});
  emit('action', '');
}
async function cancel() {
  generation++;
  clear();
  stage.value = 'idle';
  if (isNative) await native('voiceCancel').catch(() => {});
}
async function listen(sequence: number) {
  if (!isNative) {
    notice.value = '浏览器预览可使用文字输入；语音识别请在手机 App 中体验。';
    return;
  }
  await cancel();
  if (disposed || !holding.value || sequence !== holdSequence) return;
  const turn = ++generation;
  stage.value = 'listening';
  notice.value = '';
  emit('action', 'listen');
  try {
    const r = await native('voiceListen', {
      language: props.preferences.language,
    });
    if (turn !== generation) return;
    draft.value = r.text;
    stage.value = 'idle';
    notice.value = '';
    emit('action', '');
  } catch (e: any) {
    if (turn !== generation) return;
    stage.value = 'idle';
    notice.value = e.message;
    emit('action', '');
  }
}
async function stop() {
  stage.value = 'transcribing';
  await native('voiceStop').catch((e: any) => {
    stage.value = 'idle';
    notice.value = e.message;
  });
}
async function send() {
  const text = draft.value.trim();
  if (!text || !['idle', 'speaking'].includes(stage.value)) return;
  await cancel();
  const turn = ++generation;
  draft.value = '';
  messages.value.push({ role: 'user', text });
  stage.value = 'thinking';
  emit('action', 'think');
  notice.value = '';
  let r = builtinReply(text, props.context, props.preferences.language),
    cloud = false;
  try {
    if (props.preferences.chatEnabled && isNative) {
      const answer = await native('chat', {
        text,
        language: props.preferences.language,
        context: props.context,
        history: messages.value
          .slice(-6, -1)
          .map((m) => ({ role: m.role, content: m.text })),
        actionMode: props.preferences.actionMode,
      });
      if (turn !== generation) return;
      r = sanitizeReply(answer, props.preferences.language);
      if (!r.text) throw Error('回复为空');
      cloud = true;
    }
  } catch {
    notice.value = '';
  }
  if (turn !== generation) return;
  messages.value.push({
    role: 'assistant',
    text: r.text,
    source: cloud ? '智能陪伴' : '本地陪伴',
  });
  messages.value = messages.value.slice(-12);
  await nextTick();
  const plan =
    props.preferences.actionMode === 'ai' && cloud
      ? r.actions
      : builtinReply(text, props.context, props.preferences.language).actions;
  clear();
  for (const a of plan)
    timers.push(setTimeout(() => emit('action', a.id), a.at));
  timers.push(
    setTimeout(
      () => emit('action', ''),
      Math.max(...plan.map((a) => a.at + a.duration)),
    ),
  );
  stage.value = 'idle';
  if (props.voiceEnabled !== false && props.preferences.voice && isNative) {
    stage.value = 'speaking';
    try {
      await native('voiceSpeak', {
        text: r.text,
        language: props.preferences.language,
        turn: session + String(turn),
      });
    } catch (e: any) {
      notice.value = e.message;
    } finally {
      if (turn === generation) {
        stage.value = 'idle';
        emit('speech', {});
      }
    }
  }
}
function onVoice(event: Event) {
  const v = (event as CustomEvent).detail;
  if (v.turn !== session + String(generation)) return;
  emit('speech', v);
}
function beginHold(event: PointerEvent) {
  if (
    event.button !== 0 ||
    holding.value ||
    !['idle', 'speaking'].includes(stage.value)
  )
    return;
  event.preventDefault();
  holdPointer = event.pointerId;
  holdY = event.clientY;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  startHold();
}
function startHold() {
  holding.value = true;
  cancelGesture.value = false;
  void listen(++holdSequence);
}
function moveHold(event: PointerEvent) {
  if (event.pointerId === holdPointer && holding.value)
    cancelGesture.value = holdY - event.clientY > 48;
}
function endHold(abort = false) {
  if (!holding.value) return;
  holding.value = false;
  holdPointer = null;
  holdSequence++;
  if (abort || cancelGesture.value) {
    notice.value = '已取消本次录音';
    void cancel();
  } else if (stage.value === 'listening') void stop();
  cancelGesture.value = false;
}
function releaseHold(event: PointerEvent) {
  if (event.pointerId === holdPointer) endHold();
}
function keyHold(event: KeyboardEvent) {
  if (![' ', 'Enter'].includes(event.key)) return;
  event.preventDefault();
  if (
    !event.repeat &&
    !holding.value &&
    ['idle', 'speaking'].includes(stage.value)
  )
    startHold();
}
function keyRelease(event: KeyboardEvent) {
  if ([' ', 'Enter'].includes(event.key)) {
    event.preventDefault();
    endHold();
  }
}
function hidden() {
  if (document.hidden) {
    endHold(true);
    void cancel();
  }
}
function lostWindow() {
  endHold(true);
}

onMounted(() => {
  touch();
  window.addEventListener('pet-voice', onVoice);
  window.addEventListener('blur', lostWindow);
  document.addEventListener('visibilitychange', hidden);
});
onBeforeUnmount(() => {
  disposed = true;
  endHold(true);
  clearTimeout(idleTimer);
  clearTimeout(expiry);
  void cancel();
  window.removeEventListener('pet-voice', onVoice);
  window.removeEventListener('blur', lostWindow);
  document.removeEventListener('visibilitychange', hidden);
});
</script>
<template>
  <section
    class="chat-panel pet-inline-chat"
    @pointerdown="touch"
    @keydown="touch"
    @input="touch"
  >
    <div v-if="visibleMessages.length" class="chat-messages" aria-live="polite">
      <div
        v-for="(m, i) in visibleMessages"
        :key="i"
        :class="['chat-bubble', m.role]"
        @click="visibleMessages = visibleMessages.filter((x) => x !== m)"
      >
        <p>{{ m.text }}</p
        ><small v-if="m.source">{{ m.source }}</small>
      </div>
    </div>
    <div class="field">
      <textarea
        ref="draftArea"
        v-model="draft"
        :aria-label="
          preferences.language === 'en-US'
            ? 'Message to my companion'
            : '想和伙伴说的话'
        "
        maxlength="240"
        :disabled="['listening', 'transcribing', 'thinking'].includes(stage)"
        :placeholder="
          preferences.language === 'en-US'
            ? 'Tell me a little thing…'
            : '和伙伴说说今天的小事…'
        "
        rows="2"
      />
    </div>
    <div class="chat-buttons" :class="{ 'voice-off': voiceEnabled === false }">
      <button
        v-if="voiceEnabled !== false"
        class="primary hold-to-talk"
        :class="{ 'is-recording': holding, 'is-cancelling': cancelGesture }"
        :disabled="['thinking', 'transcribing'].includes(stage)"
        :aria-pressed="holding"
        aria-label="按住说话，松开结束，上滑取消"
        @pointerdown="beginHold"
        @pointermove="moveHold"
        @pointerup="releaseHold"
        @pointercancel="endHold(true)"
        @lostpointercapture="endHold(true)"
        @keydown="keyHold"
        @keyup="keyRelease"
        @blur="endHold(true)"
        @contextmenu.prevent
        ><Icon name="mic" />{{
          cancelGesture
            ? '松开取消'
            : holding
              ? '松开结束'
              : stage === 'transcribing'
                ? '识别中…'
                : '按住说话'
        }}</button
      >
      <button
        class="primary"
        :disabled="
          holding || !draft.trim() || !['idle', 'speaking'].includes(stage)
        "
        @click="send"
        >发送</button
      >
    </div>
    <p v-if="notice" class="status-message" role="status">{{ notice }}</p>
  </section>
</template>
