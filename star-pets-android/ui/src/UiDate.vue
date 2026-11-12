<script setup lang="ts">
import { confirmClear } from './confirm';
import { computed, ref } from 'vue';
const props = defineProps<{
  modelValue?: string;
  max?: string;
  datetime?: boolean;
  compact?: boolean;
  label?: string;
  id?: string;
}>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const dlg = ref<HTMLDialogElement>(),
  year = ref(2026),
  month = ref(1),
  day = ref(1),
  hour = ref(0),
  minute = ref(0);
const pad = (v: number) => String(v).padStart(2, '0');
const date = computed(
  () => `${year.value}-${pad(month.value)}-${pad(day.value)}`,
);
const value = computed(
  () =>
    date.value +
    (props.datetime ? `T${pad(hour.value)}:${pad(minute.value)}` : ''),
);
const days = computed(() => new Date(year.value, month.value, 0).getDate()),
  skip = computed(() => new Date(year.value, month.value - 1, 1).getDay());
const years = Array.from({ length: 151 }, (_, i) => ({
  value: new Date().getFullYear() - 120 + i,
  label: String(new Date().getFullYear() - 120 + i) + '年',
}));
const display = computed(() =>
  props.modelValue
    ? props.compact
      ? props.modelValue.replace(
          /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/,
          (_, _year, month, day, hour, minute) =>
            `${+month}月${+day}日 ${hour}:${minute}`,
        )
      : props.modelValue
          .replace(
            /^(\d+)-(\d+)-(\d+)/,
            (_, y, m, d) => `${y}年${+m}月${+d}日`,
          )
          .replace('T', ' ')
    : '选择日期',
);
function open() {
  const d = props.modelValue ? new Date(props.modelValue) : new Date();
  year.value = d.getFullYear();
  month.value = d.getMonth() + 1;
  day.value = d.getDate();
  hour.value = d.getHours();
  minute.value = d.getMinutes();
  dlg.value?.showModal();
}
function disabled(n: number) {
  return (
    !!props.max &&
    `${year.value}-${pad(month.value)}-${pad(n)}` > props.max.slice(0, 10)
  );
}
async function clearDate() {
  if (await confirmClear('要移除已选日期吗？')) {
    emit('update:modelValue', '');
    dlg.value?.close();
  }
}
function save() {
  if (props.max && value.value > props.max) return;
  emit('update:modelValue', value.value);
  dlg.value?.close();
}
</script>
<template>
  <button
    :id="id"
    type="button"
    class="date-trigger"
    :aria-label="modelValue ? `${label || '选择日期'}：${display}` : label || '选择日期'"
    @click="open"
    >{{ display }}</button
  ><dialog ref="dlg" class="date-dialog"
    ><header
      ><h2 class="card-title">{{ label || '选择日期' }}</h2
      ><button type="button" class="ghost" @click="dlg?.close()"
        >取消</button
      ></header
    ><div class="two-col"
      ><label class="date-select"
        ><span>年份</span
        ><select name="year"
          v-model.number="year"
          aria-label="年份"
          @change="day = Math.min(day, days)"
          ><option
            v-for="item in years"
            :key="item.value"
            :value="item.value"
            >{{ item.label }}</option
          ></select
        ></label
      ><label class="date-select"
        ><span>月份</span
        ><select name="month"
          v-model.number="month"
          aria-label="月份"
          @change="day = Math.min(day, days)"
          ><option v-for="n in 12" :key="n" :value="n"
            >{{ n }}月</option
          ></select
        ></label
      ></div
    ><div class="calendar-grid"
      ><small
        v-for="w in ['日', '一', '二', '三', '四', '五', '六']"
        :key="w"
        >{{ w }}</small
      ><span v-for="n in skip" :key="'blank' + n"></span
      ><button
        v-for="n in days"
        :key="n"
        type="button"
        :disabled="disabled(n)"
        :class="{ selected: day === n }"
        :aria-label="`${year}年${month}月${n}日`"
        @click="day = n"
        >{{ n }}</button
      ></div
    ><div v-if="datetime" class="two-col"
      ><label class="date-select"
        ><span>小时</span
        ><select name="hour" v-model.number="hour" aria-label="小时"
          ><option v-for="n in 24" :key="n" :value="n - 1"
            >{{ pad(n - 1) }}时</option
          ></select
        ></label
      ><label class="date-select"
        ><span>分钟</span
        ><select name="minute" v-model.number="minute" aria-label="分钟"
          ><option v-for="n in 60" :key="n" :value="n - 1"
            >{{ pad(n - 1) }}分</option
          ></select
        ></label
      ></div
    ><footer
      ><button type="button" class="ghost" @click="clearDate">移除日期</button
      ><button
        type="button"
        class="primary"
        :disabled="!!max && value > max"
        @click="save"
        >完成</button
      ></footer
    ></dialog
  >
</template>
