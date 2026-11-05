<script setup lang="ts">
import { ref, shallowRef, computed, onMounted, onUnmounted } from "vue";

const props = withDefaults(
  defineProps<{
    api?: string;
    suggestedQuestions?: string[];
    aiLabel?: string;
    position?: string;
    floatingStyle?: "panel" | "modal" | "popover" | "full-modal";
    triggerComponent?: object | null;
  }>(),
  {
    api: "/api/docs",
    suggestedQuestions: () => [],
    aiLabel: "AI",
    position: "bottom-right",
    floatingStyle: "panel",
    triggerComponent: null,
  },
);

const mounted = ref(false);
const Content = shallowRef();
const requestedOpen = ref(false);
let loading: Promise<typeof import("./FloatingAIChatContent.vue")> | undefined;
let disposed = false;
const label = computed(() => props.aiLabel || "AI");
const isFullModal = computed(() => props.floatingStyle === "full-modal");
const positions: Record<string, string> = {
  "bottom-right": "bottom:24px;right:24px",
  "bottom-left": "bottom:24px;left:24px",
  "bottom-center": "bottom:24px;left:50%;transform:translateX(-50%)",
};
const btnStyle = computed(() => positions[props.position] ?? positions["bottom-right"]);
function cancelPending(event: KeyboardEvent) {
  if (!Content.value && event.key === "Escape") requestedOpen.value = false;
}
onMounted(() => {
  mounted.value = true;
  window.addEventListener("keydown", cancelPending);
});
onUnmounted(() => {
  disposed = true;
  window.removeEventListener("keydown", cancelPending);
});
async function open() {
  requestedOpen.value = true;
  try {
    loading ??= import("./FloatingAIChatContent.vue");
    const module = await loading;
    if (!disposed) Content.value = module.default;
  } catch (error) {
    // Leave the existing trigger usable so a failed chunk can be retried.
    loading = undefined;
    console.error("Unable to load Ask AI", error);
  }
}
</script>

<template>
  <component :is="Content" v-if="Content" v-bind="props" :initial-open="requestedOpen" />
  <Teleport to="body" v-if="mounted && !Content && isFullModal">
    <div
      class="fd-ai-fm-input-bar fd-ai-fm-input-bar--closed"
      :style="btnStyle"
    >
      <div
        v-if="triggerComponent"
        class="fd-ai-floating-trigger"
        :style="btnStyle"
        @click="open"
      >
        <component :is="triggerComponent" :ai-label="label" />
      </div>
      <button
        v-else
        class="fd-ai-fm-trigger-btn"
        type="button"
        :aria-label="`Ask ${label}`"
        @click="open"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
          />
          <path d="M20 3v4" />
          <path d="M22 5h-4" />
        </svg>
        <span>Ask {{ label }}</span>
      </button>

    </div>
  </Teleport>
  <!-- ═══ PANEL/MODAL/POPOVER: icon trigger (only when NOT full-modal AND NOT open) ═══ -->
  <Teleport to="body" v-if="mounted && !Content && !isFullModal">
    <div
      v-if="triggerComponent"
      class="fd-ai-floating-trigger"
      :style="btnStyle"
      @click="open"
    >
      <component :is="triggerComponent" :ai-label="label" />
    </div>
    <button
      v-else
      type="button"
      class="fd-ai-floating-btn"
      :style="btnStyle"
      :aria-label="`Ask ${label}`"
      @click="open"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path
          d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
        />
        <path d="M20 3v4" />
        <path d="M22 5h-4" />
      </svg>
      <span>Ask {{ label }}</span>
    </button>
  </Teleport>
</template>
