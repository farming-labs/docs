<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { mountPixelSnow, type PixelSnowOptions } from "../../shared/pixel-snow";

const props = withDefaults(defineProps<PixelSnowOptions>(), {
  color: "#ffffff",
  flakeSize: 0.003,
  minFlakeSize: 1.25,
  pixelResolution: 210,
  speed: 0.2,
  depthFade: 8,
  farPlane: 20,
  brightness: 1,
  gamma: 0.4545,
  density: 0.3,
  variant: "square",
  direction: 125,
});

const container = ref<HTMLDivElement | null>(null);
let cleanup: (() => void) | undefined;

onMounted(() => {
  if (!container.value) return;
  cleanup = mountPixelSnow(container.value, props);
});

onBeforeUnmount(() => {
  cleanup?.();
});
</script>

<template>
  <div ref="container" class="pixel-snow" />
</template>

<style scoped>
.pixel-snow {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
</style>
