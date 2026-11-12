<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import Icon from './Icon.vue';

export type CatalogFilterOption = {
  value: string;
  label: string;
  /** 3D 图片图标，窄屏只留图。 */
  icon?: string;
  /** 线形图标名，窄屏只留图，桌面仍显示文字。 */
  glyph?: string;
};

const props = withDefaults(
  defineProps<{
    options: CatalogFilterOption[];
    filter: string;
    query: string;
    filterLabel: string;
    searchLabel: string;
    searchPlaceholder?: string;
    /** 有关键词时是否保持展开（习惯目录需要；日常表现选中条目后不强制展开）。 */
    stickyQuery?: boolean;
    /** 搜索前面再占几列（例如成长足迹的时间范围）。 */
    extraCount?: number;
  }>(),
  { searchPlaceholder: '', stickyQuery: true, extraCount: 0 },
);

const emit = defineEmits<{
  'update:filter': [value: string];
  'update:query': [value: string];
  toggle: [open: boolean];
}>();

const searchOpen = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const searchId = `catalog-search-${Math.random().toString(36).slice(2, 8)}`;
const expanded = computed(
  () => searchOpen.value || (props.stickyQuery && !!props.query.trim()),
);
const filterCols = computed(() => Math.max(1, props.options.length));
const toolbarCols = computed(
  () => filterCols.value + Math.max(0, props.extraCount) + 1,
);

watch(expanded, (open) => emit('toggle', open));

async function openSearch() {
  searchOpen.value = true;
  await nextTick();
  inputRef.value?.focus({ preventScroll: true });
}
function onInput(event: Event) {
  emit('update:query', (event.target as HTMLInputElement).value);
}
function clearOrClose() {
  if (props.query) {
    emit('update:query', '');
    inputRef.value?.focus({ preventScroll: true });
    return;
  }
  searchOpen.value = false;
}
function onBlur() {
  if (!props.query.trim()) searchOpen.value = false;
}
function focus() {
  void openSearch();
}
defineExpose({ openSearch, focus });
</script>

<template>
  <div
    class="catalog-toolbar"
    :class="{
      searching: expanded,
      'has-extra': extraCount > 0,
      'icon-search': toolbarCols >= 5,
    }"
    :style="{
      '--filter-cols': String(filterCols),
      '--toolbar-cols': String(toolbarCols),
    }"
  >
    <div class="catalog-toolbar-row" :aria-hidden="expanded">
      <div
        class="chip-group equal-filter-chips catalog-filter"
        role="radiogroup"
        :aria-label="filterLabel"
      >
        <button
          v-for="option in options"
          :key="option.value"
          type="button"
          role="radio"
          class="chip"
          :class="[
            { active: filter === option.value },
            'chip-kind-' + option.value,
          ]"
          :aria-checked="filter === option.value"
          :tabindex="expanded ? -1 : 0"
          @click="emit('update:filter', option.value)"
        >
          <img
            v-if="option.icon"
            class="chip-3d"
            :src="option.icon"
            alt=""
          />
          <Icon
            v-else-if="option.glyph"
            class="chip-glyph"
            :name="option.glyph"
          />
          <span class="chip-label">{{ option.label }}</span>
        </button>
      </div>
      <div v-if="extraCount > 0" class="catalog-extra">
        <slot name="extra" />
      </div>
      <button
        class="catalog-search-toggle"
        type="button"
        :aria-label="searchLabel"
        :title="searchLabel"
        :tabindex="expanded ? -1 : 0"
        @click="openSearch"
      >
        <Icon name="search" />
        <span class="catalog-search-label">搜索</span>
      </button>
    </div>
    <label
      class="search-field catalog-search-expanded"
      :aria-label="searchLabel"
      :aria-hidden="!expanded"
      :for="searchId"
    >
      <Icon class="search-leading-icon" name="search" />
      <input
        :id="searchId"
        :name="searchId"
        ref="inputRef"
        :value="query"
        :placeholder="searchPlaceholder || searchLabel"
        :aria-label="searchLabel"
        maxlength="120"
        autocomplete="off"
        :tabindex="expanded ? 0 : -1"
        @input="onInput"
        @keydown.escape.prevent="clearOrClose"
        @blur="onBlur"
      />
      <button
        type="button"
        class="search-clear"
        :aria-label="query ? '清除搜索' : '关闭搜索'"
        :tabindex="expanded ? 0 : -1"
        @mousedown.prevent
        @click="clearOrClose"
      >
        <Icon name="close" />
      </button>
    </label>
  </div>
</template>
