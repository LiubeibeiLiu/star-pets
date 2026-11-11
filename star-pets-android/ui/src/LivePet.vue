<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { SkinRig, skinStudio, skinTexture } from './pet-skin';
import { frameOf } from './catalog.js';
import Pet from './Pet.vue';
import { Quaternion, Vector3, type Texture } from 'three';
const props = withDefaults(
  defineProps<{
    pet: any;
    level: number;
    action?: string;
    speech?: any;
    reduceMotion?: boolean;
    affection?: string;
  }>(),
  { action: '', reduceMotion: false, affection: 'warm' },
);
const canvas = ref<HTMLCanvasElement>(),
  failed = ref(false);
const emit = defineEmits<{ 'live-failed': [value: boolean] }>();
watch(failed, (v) => emit('live-failed', v), { immediate: true });
let rig: SkinRig | undefined,
  s: ReturnType<typeof skinStudio>,
  texture: Texture | undefined,
  raf = 0,
  observer: IntersectionObserver,
  resize: ResizeObserver,
  visible = true,
  start = 0,
  last = 0,
  version = 0,
  alive = true;
let previousPositions: Vector3[] = [],
  previousRotations: Quaternion[] = [],
  previousScales: Vector3[] = [],
  targetPositions: Vector3[] = [],
  targetRotations: Quaternion[] = [],
  targetScales: Vector3[] = [];
function prepareTransforms() {
  if (!rig || previousPositions.length === rig.bones.length) return;
  previousPositions = rig.bones.map((bone) => bone.position.clone());
  previousRotations = rig.bones.map((bone) => bone.quaternion.clone());
  previousScales = rig.bones.map((bone) => bone.scale.clone());
  targetPositions = rig.bones.map((bone) => bone.position.clone());
  targetRotations = rig.bones.map((bone) => bone.quaternion.clone());
  targetScales = rig.bones.map((bone) => bone.scale.clone());
}
function size() {
  if (!s || !canvas.value) return;
  const r = canvas.value.getBoundingClientRect();
  if (r.width && r.height) s.resize(r.width * 1.5, r.height * 1.5, rig?.width);
  s.camera.zoom = 1.12;
  s.camera.updateProjectionMatrix();
}
async function rebuild() {
  const token = ++version;
  try {
    const next = await skinTexture(props.pet, props.level);
    if (!alive || token !== version) {
      next.dispose();
      return;
    }
    if (rig) {
      s.scene.remove(rig.root);
      rig.dispose();
      texture?.dispose();
    }
    texture = next;
    rig = new SkinRig(props.pet.id, frameOf(props.level), texture);
    previousPositions = [];
    prepareTransforms();
    s.scene.add(rig.root);
    size();
  } catch {
    if (alive) failed.value = true;
  }
}
function draw(time: number) {
  raf = requestAnimationFrame(draw);
  if (!rig || document.hidden || !visible || time - last < 33) return;
  const dt = Math.min(0.1, (time - last) / 1000);
  last = time;
  prepareTransforms();
  rig.bones.forEach((bone, index) => {
    previousPositions[index].copy(bone.position);
    previousRotations[index].copy(bone.quaternion);
    previousScales[index].copy(bone.scale);
  });
  const t = (time - start) / 1000;
  let action = props.action || 'idle';
  if (!props.action && !props.reduceMotion) {
    const cycle = t % 28;
    if (cycle > 11 && cycle < 14) action = 'lookAround';
    if (cycle > 22 && cycle < 25)
      action =
        props.affection === 'subtle'
          ? 'nod'
          : props.affection === 'enthusiastic'
            ? 'wave'
            : 'nuzzle';
  }
  const a = props.speech?.active ? props.speech.level || 0 : 0;
  rig.pose(props.reduceMotion ? 'idle' : action, props.reduceMotion ? 0 : t, a);
  if (!props.reduceMotion) {
    const blend = 1 - Math.exp(-dt * 16);
    rig.bones.forEach((b, i) => {
      targetPositions[i].copy(b.position);
      targetRotations[i].copy(b.quaternion);
      targetScales[i].copy(b.scale);
      b.position.lerpVectors(previousPositions[i], targetPositions[i], blend);
      b.quaternion.slerpQuaternions(
        previousRotations[i],
        targetRotations[i],
        blend,
      );
      b.scale.lerpVectors(previousScales[i], targetScales[i], blend);
    });
    rig.root.updateMatrixWorld(true);
  }
  s.renderer.render(s.scene, s.camera);
}
onMounted(() => {
  try {
    s = skinStudio(canvas.value!);
    void rebuild();
    start = performance.now();
    observer = new IntersectionObserver((e) => (visible = e[0].isIntersecting));
    observer.observe(canvas.value!);
    resize = new ResizeObserver(size);
    resize.observe(canvas.value!);
    raf = requestAnimationFrame(draw);
  } catch {
    failed.value = true;
  }
});
watch(() => [props.pet.id, props.level], rebuild);
watch(
  () => props.action,
  () => {
    start = performance.now();
  },
);
onBeforeUnmount(() => {
  alive = false;
  version++;
  cancelAnimationFrame(raf);
  observer?.disconnect();
  resize?.disconnect();
  rig?.dispose();
  texture?.dispose();
  s?.dispose();
});
</script>
<template>
  <div class="live-pet" :class="{ 'is-fallback': failed && !reduceMotion }"
    ><canvas
      v-if="!failed"
      ref="canvas"
      :aria-label="`${pet.name} ${level}级 · 原画骨骼互动`"
      role="img"
    /><template v-else><Pet :pet="pet" :level="level" /></template></div
  >
</template>
