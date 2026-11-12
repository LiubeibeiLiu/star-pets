<script setup lang="ts">
import CatalogToolbar from './CatalogToolbar.vue';
import EmptyState from './EmptyState.vue';
import Icon from './Icon.vue';
import Pager from './Pager.vue';
import SwipeRow from './SwipeRow.vue';
import UiSelect from './UiSelect.vue';

const kindOptions = [
  { value: 'all', label: '全部', glyph: 'grid' },
  { value: 'plus', label: '加分', glyph: 'plus' },
  { value: 'minus', label: '减分', glyph: 'minus' },
];
const rangeOptions = [
  { value: 'day', short: '今天', label: '最近一天' },
  { value: 'week', short: '本周', label: '最近一周' },
  { value: 'month', short: '本月', label: '最近一月' },
  { value: 'quarter', short: '本季', label: '最近季度' },
  { value: 'year', short: '今年', label: '最近一年' },
];

defineProps<{
  query: string;
  kind: string;
  dateRange: string;
  items: any[];
  page: number;
  pages: number;
  total: number;
  filtering: boolean;
  busy: boolean;
  searchIcon: string;
  emptyIcon: string;
  starIcon: string;
  eventIcon: (event: any) => string;
  reversed: (event: any) => boolean;
  undoable: (event: any) => boolean;
  clock: (at: number) => string;
}>();

const emit = defineEmits<{
  'update:query': [value: string];
  'update:kind': [value: string];
  'update:dateRange': [value: string];
  page: [value: number];
  clear: [];
  plans: [];
  undo: [event: any];
}>();
</script>

<template>
  <section id="habit-footprints" class="photo-gallery footprints-gallery catalog-stack">
    <div class="card catalog-strip">
      <CatalogToolbar
        :options="kindOptions"
        :filter="kind"
        :query="query"
        :extra-count="1"
        filter-label="记录类型"
        search-label="搜索成长足迹"
        search-placeholder="搜索成长足迹"
        @update:filter="emit('update:kind', $event)"
        @update:query="emit('update:query', $event)"
      >
        <template #extra>
          <UiSelect
            class="compact"
            :model-value="dateRange"
            label="时间范围"
            :options="rangeOptions"
            @change="emit('update:dateRange', String($event))"
          />
        </template>
      </CatalogToolbar>
      <EmptyState
        v-if="!total && filtering"
        icon="search"
        :icon3d="searchIcon"
        title="没有符合条件的记录"
        hint="换个关键词或时间范围试试"
        action="清除筛选"
        @action="emit('clear')"
      />
      <EmptyState
        v-else-if="!total"
        icon="history"
        :icon3d="emptyIcon"
        title="第一步，正等着被记下"
        hint="完成习惯或记录日常表现后，成长会在这里留下足迹"
        action="去完成今日习惯"
        @action="emit('plans')"
      />
    </div>
    <Pager
      v-if="total"
      label="成长足迹翻页"
      :page="page"
      :pages="pages"
      @change="emit('page', $event)"
    >
      <div class="record-list">
        <SwipeRow
          v-for="e in items"
          :key="e.id"
          label="撤销"
          :disabled="!undoable(e) || busy"
          @action="emit('undo', e)"
        >
          <div :class="['record', { rev: reversed(e) }]">
            <span
              class="record-mark"
              :class="{ neg: e.kind === 'minus' }"
              aria-hidden="true"
            >
              <img v-if="eventIcon(e)" :src="eventIcon(e)" alt="" />
              <img v-else-if="e.kind !== 'minus'" :src="starIcon" alt="" />
              <Icon v-else name="minus" />
            </span>
            <div class="grow">
              <b>{{ e.reason }}</b>
              <small class="record-meta">
                <span class="num">{{ e.day }} {{ clock(e.occurredAt || e.at).split(' ')[1] }}</span>
                <span v-if="reversed(e)" class="tag">已撤销</span>
              </small>
              <small v-if="e.note" class="record-note">{{ e.note }}</small>
            </div>
            <span
              v-if="e.points"
              class="score num"
              :class="{ neg: e.kind === 'minus' }"
            >{{ e.kind === 'plus' ? '+' : e.kind === 'minus' ? '−' : '↶' }}{{ e.points }}</span>
          </div>
        </SwipeRow>
      </div>
    </Pager>
  </section>
</template>
