<script setup lang="ts">
import AudioPlayer from './AudioPlayer.vue';
import CatalogToolbar from './CatalogToolbar.vue';
import EmptyState from './EmptyState.vue';
import GalleryImage from './GalleryImage.vue';
import Icon from './Icon.vue';
import Pager from './Pager.vue';
import { memoryDisplayText, meetingWishParts } from './model.js';

export type MemoryFilterOption = { value: string; label: string; icon?: string };

defineProps<{
  query: string;
  kind: string;
  options: MemoryFilterOption[];
  items: any[];
  page: number;
  pages: number;
  filteredCount: number;
  totalCount: number;
  emptyIcon: string;
  searchIcon: string;
  media: (file: string) => string;
  kindIcon: (kind: string) => string;
  noteIcon: (memory: any) => string;
  petName: (id: string) => string;
  dateLabel: (at: number) => string;
}>();

const emit = defineEmits<{
  'update:query': [value: string];
  'update:kind': [value: string];
  page: [value: number];
  clear: [];
  home: [];
  remove: [memory: any];
  open: [memory: any];
  download: [memory: any];
  savePhoto: [memory: any];
  photoDown: [memory: any, event: PointerEvent];
  photoMove: [event: PointerEvent];
  photoUp: [];
}>();

function wish(memory: any) {
  return meetingWishParts(memoryDisplayText(memory));
}
function textOf(memory: any) {
  return memoryDisplayText(memory);
}
</script>

<template>
  <section id="memory-gallery" class="photo-gallery catalog-stack">
    <div class="card catalog-strip">
      <CatalogToolbar
        :options="options"
        :filter="kind"
        :query="query"
        filter-label="回忆类型"
        search-label="搜索精彩回忆"
        search-placeholder="搜索精彩回忆"
        @update:filter="emit('update:kind', $event)"
        @update:query="emit('update:query', $event)"
      />
      <EmptyState
        v-if="!filteredCount && totalCount"
        icon="search"
        :icon3d="searchIcon"
        title="没有找到这样的回忆"
        hint="换个关键词或类型试试"
        action="清除筛选"
        @action="emit('clear')"
      />
      <EmptyState
        v-else-if="!filteredCount"
        icon="photo"
        :icon3d="emptyIcon"
        title="第一颗回忆星星还在路上"
        hint="领养伙伴、收藏声音或留下合影后，会在这里慢慢亮起来"
        action="去小窝留下合影"
        @action="emit('home')"
      />
    </div>
    <Pager
      v-if="filteredCount"
      label="回忆翻页"
      :page="page"
      :pages="pages"
      @change="emit('page', $event)"
    >
      <div class="memory-list">
        <article
          v-for="m in items"
          :key="m.id"
          class="card gallery-card"
          :class="{ 'habit-memory': m.source === 'habit' }"
        >
          <header class="memory-date">
            <b>{{ dateLabel(m.at) }}</b>
            <button
              class="icon-button card-corner-action"
              type="button"
              :aria-label="
                String(m.id).startsWith('demo-')
                  ? '隐藏示例回忆'
                  : '删除' + (m.name || '这条') + '回忆'
              "
              @click="emit('remove', m)"
            >
              <Icon name="trash" />
            </button>
          </header>
          <div class="memory-body">
            <AudioPlayer
              v-if="m.kind === 'audio'"
              :src="media(m.file)"
              download
              @download="emit('download', m)"
            />
            <button
              v-else-if="m.kind === 'note' && (m.text || '').trim().length > 80"
              class="list-link"
              type="button"
              aria-label="查看文字回忆"
              @click="emit('open', m)"
            >
              <img class="list-link-3d" :src="noteIcon(m)" alt="" />
              <span>文字纪念</span>
              <Icon name="chevron" />
            </button>
            <div
              v-else-if="m.kind === 'note' && wish(m)"
              class="memory-note-inline meeting-wish"
            >
              <span class="meeting-wish-line">
                <strong>{{ wish(m)?.title }}</strong>
                <span class="meeting-wish-dot"> · </span>
                {{ wish(m)?.line1 }}
              </span>
              <span v-if="wish(m)?.line2" class="meeting-wish-line">{{
                wish(m)?.line2
              }}</span>
            </div>
            <div v-else-if="m.kind === 'note'" class="memory-note-inline">
              <img class="memory-note-mark" :src="noteIcon(m)" alt="" />
              <span>{{ textOf(m) }}</span>
            </div>
            <button
              v-else
              class="gallery-image"
              type="button"
              :aria-label="'查看与' + m.name + '的合照，长按保存到相册'"
              @click="emit('open', m)"
              @pointerdown="emit('photoDown', m, $event)"
              @pointermove="emit('photoMove', $event)"
              @pointerup="emit('photoUp')"
              @pointercancel="emit('photoUp')"
              @contextmenu.prevent="emit('savePhoto', m)"
            >
              <GalleryImage
                :src="media(m.file)"
                :alt="'与' + m.name + '的合照'"
                lazy
              />
            </button>
            <div class="gallery-caption">
              <span
                v-if="m.kind !== 'note'"
                class="kind-icon"
                :class="'kind-' + m.kind"
                aria-hidden="true"
                ><img :src="kindIcon(m.kind)" alt=""
              /></span>
              <b v-if="m.kind !== 'note'">{{ m.name || petName(m.petId) }}</b>
              <small v-if="m.kind !== 'note'" class="num">Lv.{{ m.level }}</small>
              <span v-if="String(m.id).startsWith('demo-')" class="tag">示例</span>
              <div v-if="m.reversedAt" class="memory-reversed">
                <Icon name="history" />
                <span>
                  <b>已撤销对应加分</b>
                  <small v-if="m.reverseReason">{{ m.reverseReason }}</small>
                </span>
              </div>
              <p
                v-if="
                  m.text &&
                  !(m.kind === 'note' && m.text.trim().length <= 80) &&
                  !(m.source === 'exploration' && !m.diary) &&
                  wish(m)
                "
                class="gallery-note meeting-wish"
              >
                <span class="meeting-wish-line">
                  <strong>{{ wish(m)?.title }}</strong>
                  <span class="meeting-wish-dot"> · </span>
                  {{ wish(m)?.line1 }}
                </span>
                <span v-if="wish(m)?.line2" class="meeting-wish-line">{{
                  wish(m)?.line2
                }}</span>
              </p>
              <p
                v-else-if="
                  m.text && !(m.kind === 'note' && m.text.trim().length <= 80)
                "
                class="gallery-note"
              >
                {{
                  m.source === 'exploration' && !m.diary
                    ? '今天去探索了新的风景，带着满满的好心情回家啦！'
                    : textOf(m)
                }}
              </p>
              <small v-if="m.departAt" class="record-meta">
                <span class="tag">
                  <Icon name="time" />{{ (+m.travelHours || 0).toFixed(1) }} 小时
                </span>
                <span class="num">{{
                  new Date(m.departAt).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                }}</span>
              </small>
            </div>
          </div>
        </article>
      </div>
    </Pager>
  </section>
</template>
