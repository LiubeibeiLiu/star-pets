<script setup lang="ts">
import UiDate from './UiDate.vue';
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import Icon from './Icon.vue';
import Pager from './Pager.vue';
import { rulePage } from './companion.js';
import { dayKey, uid } from './model.js';

const props = defineProps<{
  rules: any[];
  reason: string;
  busy: boolean;
  net: number;
  done: number;
  taskCount: number;
  planCount: number;
}>();
const emit = defineEmits<{
  save: [
    value: {
      points: number;
      reason: string;
      note: string;
      date: string;
      token: string;
      occurredAt: number;
    },
  ];
  add: [sign: number];
  remove: [rule: any];
  'update:reason': [value: string];
}>();
const localNow = () => dayKey() + 'T' + new Date().toTimeString().slice(0, 5);
const reason = computed({
  get: () => props.reason,
  set: (value: string) => emit('update:reason', value),
});
const points = ref(3),
  date = ref(localNow()),
  note = ref(''),
  token = ref(uid());
const sign = computed(() => (points.value < 0 ? -1 : 1));
const exactRule = computed(() =>
  props.rules.find(
    (r) => r.name === reason.value && Math.sign(r.points) === sign.value,
  ),
);
const ruleIndex = ref(1),
  pageRules = computed(() =>
    rulePage(
      props.rules,
      sign.value,
      exactRule.value ? '' : reason.value,
      ruleIndex.value,
      8,
    ),
  );
watch([reason, sign], () => {
  if (!exactRule.value) ruleIndex.value = 1;
});
watch(
  () => props.rules,
  () => (ruleIndex.value = pageRules.value.page),
);
const valid = computed(
  () =>
    reason.value.trim().length > 0 &&
    Number.isInteger(points.value) &&
    points.value !== 0 &&
    Math.abs(points.value) <= 1000 &&
    !!date.value &&
    date.value <= localNow(),
);
const pointsError = computed(() => {
    const p = points.value as any;
    if (p === '' || p === null || !Number.isFinite(+p)) return '请填写分值';
    if (!Number.isInteger(+p)) return '分值需要是整数';
    if (+p === 0) return '分值不能为 0';
    if (Math.abs(+p) > 1000) return '分值范围是 -1000 到 1000';
    return '';
  }),
  dateError = computed(() =>
    !date.value
      ? '请选择记录时间'
      : date.value > localNow()
        ? '记录时间不能晚于现在'
        : '',
  ),
  hint = computed(
    () =>
      pointsError.value ||
      dateError.value ||
      (!reason.value.trim() ? '选择一条常用表现，或搜索并输入新的表现' : ''),
  );
function choose(rule: any) {
  if (suppressClick) {
    suppressClick = false;
    return;
  }
  reason.value = rule.name;
  points.value = rule.points;
}
let holdTimer: ReturnType<typeof setTimeout> | undefined;
let holdX = 0;
let holdY = 0;
let suppressClick = false;
function suppressReleaseClick() {
  suppressClick = true;
  setTimeout(() => (suppressClick = false), 700);
}
function cancelHold() {
  clearTimeout(holdTimer);
  holdTimer = undefined;
}
function startHold(rule: any, event: PointerEvent) {
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  cancelHold();
  holdX = event.clientX;
  holdY = event.clientY;
  holdTimer = setTimeout(() => {
    holdTimer = undefined;
    suppressReleaseClick();
    navigator.vibrate?.(20);
    emit('remove', rule);
  }, 550);
}
function moveHold(event: PointerEvent) {
  if (Math.abs(event.clientX - holdX) > 10 || Math.abs(event.clientY - holdY) > 10)
    cancelHold();
}
function showRemove(rule: any) {
  cancelHold();
  if (suppressClick) return;
  suppressReleaseClick();
  emit('remove', rule);
}
function setSign(next: number) {
  if (next === sign.value) return;
  points.value = next * Math.abs(points.value || 1);
  if (exactRule.value === undefined && props.rules.some((r) => r.name === reason.value))
    reason.value = '';
}
function nudge(delta: number) {
  let next = (Number(points.value) || 0) + delta;
  if (next === 0) next = delta > 0 ? 1 : -1;
  points.value = Math.max(-1000, Math.min(1000, next));
}
watch(reason, () => {
  if (exactRule.value) points.value = exactRule.value.points;
});
function submit() {
  if (!valid.value) return;
  emit('save', {
    points: points.value,
    reason: reason.value.trim(),
    note: note.value.trim(),
    date: date.value.slice(0, 10),
    occurredAt: new Date(date.value).getTime(),
    token: token.value,
  });
}
function reset() {
  reason.value = '';
  note.value = '';
  date.value = localNow();
  token.value = uid();
}
function showRule(rule: any) {
  reason.value = rule.name;
  points.value = rule.points;
  const group = props.rules.filter((item) => Math.sign(item.points) === Math.sign(rule.points));
  ruleIndex.value = Math.floor(group.findIndex((item) => item.id === rule.id) / 8) + 1;
}
onBeforeUnmount(cancelHold);
defineExpose({ reset, showRule });
</script>

<template>
  <form
    class="quick-score"
    :class="{ deduction: points < 0 }"
    @submit.prevent="submit"
  >
    <div class="section-head"
      ><div class="section-title"><h2>记下这次表现</h2><small>说清发生了什么，比评价更有帮助</small></div
      ><button
        type="button"
        class="icon-button"
        aria-label="添加日常表现"
        title="添加日常表现"
        @click="emit('add', sign)"
        ><Icon name="plus" /></button
    ></div>
    <div class="segmented sign-toggle" role="radiogroup" aria-label="记录类型"
      ><button
        type="button"
        role="radio"
        :aria-checked="points > 0"
        :class="{ active: points > 0 }"
        @click="setSign(1)"
        >加分</button
      ><button
        type="button"
        role="radio"
        :aria-checked="points < 0"
        :class="{ active: points < 0 }"
        @click="setSign(-1)"
        >减分</button
      ></div
    >
    <div class="rule-chips" role="listbox" aria-label="常用表现"
      ><button
        v-for="r in pageRules.items"
        :key="r.id"
        type="button"
        role="option"
        class="rule-chip"
        :class="{ active: exactRule?.id === r.id }"
        :aria-selected="exactRule?.id === r.id"
        :aria-label="`${r.name}，${r.points > 0 ? '加' : '减'}${Math.abs(r.points)}分；长按删除`"
        @pointerdown="startHold(r, $event)"
        @pointermove="moveHold"
        @pointerup="cancelHold"
        @pointercancel="cancelHold"
        @pointerleave="cancelHold"
        @contextmenu.prevent="showRemove(r)"
        @keydown.delete.prevent="showRemove(r)"
        @keydown.backspace.prevent="showRemove(r)"
        @click="choose(r)"
        ><span>{{ r.name }}</span
        ><b class="num">{{ r.points > 0 ? '+' : '' }}{{ r.points }}</b></button
      ><p v-if="!pageRules.items.length" class="rule-chips-empty"
        ><Icon name="information" />{{
          reason.trim()
            ? '没有匹配项，将按你输入的内容记录'
            : points < 0
              ? '还没有减分的常用表现'
              : '还没有加分的常用表现'
        }}</p
      ></div
    >
    <Pager
      label="常用表现分页"
      previous-label="常用表现上一页"
      next-label="常用表现下一页"
      button-type="button"
      :page="pageRules.page"
      :pages="pageRules.pages"
      @change="ruleIndex = $event"
    />
    <div class="two-col quick-entry-controls"
      ><div class="field"
        ><UiDate
          id="quick-date"
          v-model="date"
          datetime
          compact
          label="记录时间"
          :max="localNow()" /></div
      ><div class="field"
        ><div class="stepper"
          ><button
            type="button"
            aria-label="减少分值"
            :disabled="points <= -1000"
            @click="nudge(-1)"
            ><Icon name="minus" /></button
          ><input
            id="quick-points"
            v-model.number="points"
            class="num"
            type="number"
            inputmode="numeric"
            min="-1000"
            max="1000"
            step="1"
            :aria-invalid="!!pointsError"
            aria-label="分数" /><button
            type="button"
            aria-label="增加分值"
            :disabled="points >= 1000"
            @click="nudge(1)"
            ><Icon name="plus" /></button></div></div
    ></div>
    <label class="field"
      ><span>补充一句（选填）</span
      ><textarea
        id="quick-note"
        v-model="note"
        maxlength="300"
        rows="2"
        placeholder="例如：主动收好玩具，还帮助了妹妹"
      ></textarea>
    </label>
    <button
      class="primary wide"
      :class="{ 'danger-fill': points < 0 }"
      :disabled="busy || !valid"
      type="submit"
      ><Icon :name="points < 0 ? 'minus' : 'plus'" />记下{{
        points < 0 ? '减分' : '加分'
      }}<b class="num submit-points">{{ Math.abs(points) || 0 }}</b></button
    >
  </form>
</template>
