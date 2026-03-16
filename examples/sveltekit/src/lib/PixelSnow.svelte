<script lang="ts">
  import { onMount } from "svelte";
  import { mountPixelSnow, type PixelSnowOptions } from "../../../shared/pixel-snow";

  let {
    color = "#ffffff",
    flakeSize = 0.003,
    minFlakeSize = 1.25,
    pixelResolution = 210,
    speed = 0.2,
    depthFade = 8,
    farPlane = 20,
    brightness = 1,
    gamma = 0.4545,
    density = 0.3,
    variant = "square",
    direction = 125,
  }: PixelSnowOptions = $props();

  let container: HTMLDivElement;

  onMount(() => {
    return mountPixelSnow(container, {
      color,
      flakeSize,
      minFlakeSize,
      pixelResolution,
      speed,
      depthFade,
      farPlane,
      brightness,
      gamma,
      density,
      variant,
      direction,
    });
  });
</script>

<div bind:this={container} class="pixel-snow"></div>

<style>
  .pixel-snow {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
