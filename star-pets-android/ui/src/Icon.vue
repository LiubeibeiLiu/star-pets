<script setup lang="ts">
import { computed } from 'vue';
import { renderIconBody, type IconDefinition } from '@mingcute/icons';
import Sun from '@mingcute/icons/core-regular/sun';
import Score from '@mingcute/icons/core-regular/add-circle';
import Photo from '@mingcute/icons/core-regular/photo-album';
import Sparkles from '@mingcute/icons/core-regular/sparkles';
import Chat from '@mingcute/icons/core-regular/chat-1';
import Home from '@mingcute/icons/core-regular/home-1';
import Habit from '@mingcute/icons/core-regular/clipboard';
import Pet from '@mingcute/icons/core-regular/paw';
import History from '@mingcute/icons/core-regular/history';
import Settings from '@mingcute/icons/core-regular/settings-3';
import Back from '@mingcute/icons/core-regular/arrow-left';
import Forward from '@mingcute/icons/core-regular/arrow-right';
import Plus from '@mingcute/icons/core-regular/add';
import Minus from '@mingcute/icons/core-regular/minus-circle';
import Close from '@mingcute/icons/core-regular/close';
import Check from '@mingcute/icons/core-regular/check';
import Mic from '@mingcute/icons/core-regular/mic';
import Camera from '@mingcute/icons/core-regular/camera';
import Search from '@mingcute/icons/core-regular/search';
import Eye from '@mingcute/icons/core-regular/eye';
import EyeClose from '@mingcute/icons/core-regular/eye-close';
import Fingerprint from '@mingcute/icons/core-regular/fingerprint';
import Lock from '@mingcute/icons/core-regular/lock';
import Star from '@mingcute/icons/core-regular/star';
import Heart from '@mingcute/icons/core-regular/heart';
import Edit from '@mingcute/icons/core-regular/edit';
import Food from '@mingcute/icons/core-regular/bowl';
import Play from '@mingcute/icons/core-regular/play';
import Pause from '@mingcute/icons/core-regular/pause';
import Download from '@mingcute/icons/core-regular/download';
import Upload from '@mingcute/icons/core-regular/upload';
import Sound from '@mingcute/icons/core-regular/volume';
import Chevron from '@mingcute/icons/core-regular/right';
import Trash from '@mingcute/icons/core-regular/delete-2';
import More from '@mingcute/icons/core-regular/more-1';
import Palette from '@mingcute/icons/core-regular/palette';
import Moon from '@mingcute/icons/core-regular/moon';
import Rainbow from '@mingcute/icons/core-regular/rainbow';
import Cat from '@mingcute/icons/core-regular/cat';
import Bear from '@mingcute/icons/core-regular/bear';
import Butterfly from '@mingcute/icons/core-regular/butterfly';
import Flower from '@mingcute/icons/core-regular/flower-2';
import Rocket from '@mingcute/icons/core-regular/rocket';
import Warning from '@mingcute/icons/core-regular/warning';
import CheckCircle from '@mingcute/icons/core-regular/check-circle';
import Loading from '@mingcute/icons/core-regular/loading';
import Time from '@mingcute/icons/core-regular/time';
import Gift from '@mingcute/icons/core-regular/gift';
import Refresh from '@mingcute/icons/core-regular/refresh-2';
import Stop from '@mingcute/icons/core-regular/stop';
import MapPin from '@mingcute/icons/core-regular/map-pin';
import Calendar from '@mingcute/icons/core-regular/calendar';
import Information from '@mingcute/icons/core-regular/information';

const props = defineProps<{ name: string }>();
const icons: Record<string, IconDefinition> = {
  sun: Sun,
  score: Score,
  photo: Photo,
  sparkles: Sparkles,
  chat: Chat,
  home: Home,
  habit: Habit,
  pet: Pet,
  history: History,
  settings: Settings,
  back: Back,
  forward: Forward,
  plus: Plus,
  minus: Minus,
  close: Close,
  check: Check,
  mic: Mic,
  camera: Camera,
  search: Search,
  eye: Eye,
  'eye-close': EyeClose,
  fingerprint: Fingerprint,
  lock: Lock,
  star: Star,
  heart: Heart,
  edit: Edit,
  food: Food,
  play: Play,
  pause: Pause,
  download: Download,
  upload: Upload,
  sound: Sound,
  chevron: Chevron,
  trash: Trash,
  more: More,
  palette: Palette,
  moon: Moon,
  rainbow: Rainbow,
  cat: Cat,
  bear: Bear,
  butterfly: Butterfly,
  flower: Flower,
  rocket: Rocket,
  warning: Warning,
  'check-circle': CheckCircle,
  loading: Loading,
  time: Time,
  gift: Gift,
  refresh: Refresh,
  stop: Stop,
  'map-pin': MapPin,
  calendar: Calendar,
  information: Information,
};
const icon = computed(() => icons[props.name] || Star);
const body = computed(() => renderIconBody(icon.value));
</script>
<template>
  <svg
    :viewBox="icon.viewBox"
    v-html="body"
    fill="none"
    aria-hidden="true"
    focusable="false"
  ></svg>
</template>
