<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";

interface TocItem {
  title: string;
  url: string;
  depth: number;
}

const props = defineProps<{
  items?: TocItem[];
  tocStyle?: "default" | "directional";
}>();

const items = computed(() => props.items ?? []);
const isDirectional = computed(() => props.tocStyle === "directional");
const activeId = ref("");
const activeIds = ref<string[]>([]);
const tocListRef = ref<HTMLElement | null>(null);
const thumbTop = ref(0);
const thumbHeight = ref(0);

let observer: IntersectionObserver | null = null;

function observeHeadings() {
  if (!observer) return;
  observer.disconnect();
  for (const item of items.value) {
    const el = document.querySelector(item.url);
    if (el) observer.observe(el);
  }
}

function updateThumb() {
  if (!isDirectional.value || !tocListRef.value || activeIds.value.length === 0) {
    thumbTop.value = 0;
    thumbHeight.value = 0;
    return;
  }

  const container = tocListRef.value;
  let upper = Number.MAX_VALUE;
  let lower = 0;

  for (const id of activeIds.value) {
    const link = container.querySelector<HTMLElement>(`a[href="#${id}"]`);
    if (!link) continue;
    const styles = getComputedStyle(link);
    upper = Math.min(upper, link.offsetTop + parseFloat(styles.paddingTop));
    lower = Math.max(
      lower,
      link.offsetTop + link.clientHeight - parseFloat(styles.paddingBottom)
    );
  }

  if (upper === Number.MAX_VALUE) {
    thumbTop.value = 0;
    thumbHeight.value = 0;
  } else {
    thumbTop.value = upper;
    thumbHeight.value = lower - upper;
  }
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeId.value = entry.target.id;
          if (!activeIds.value.includes(entry.target.id)) {
            activeIds.value = [entry.target.id];
          }
        }
      }
      nextTick(updateThumb);
    },
    { rootMargin: "-80px 0px -80% 0px" }
  );
  observeHeadings();
});

watch(items, () => {
  observeHeadings();
  nextTick(updateThumb);
}, { flush: "post" });

watch(activeIds, () => nextTick(updateThumb));

onUnmounted(() => {
  observer?.disconnect();
});
</script>

<template>
  <div class="fd-toc-inner" :class="{ 'fd-toc-directional': isDirectional }">
    <h3 class="fd-toc-title">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="15" y2="12" />
        <line x1="3" y1="18" x2="18" y2="18" />
      </svg>
      On this page
    </h3>
    <p v-if="items.length === 0" class="fd-toc-empty">No Headings</p>
    <div v-else class="fd-toc-thumb-container">
      <div
        v-if="isDirectional"
        class="fd-toc-thumb"
        :style="{ '--fd-top': thumbTop + 'px', '--fd-height': thumbHeight + 'px' }"
      />
      <ul ref="tocListRef" class="fd-toc-list">
        <li v-for="item in items" :key="item.url" class="fd-toc-item">
          <a
            :href="item.url"
            class="fd-toc-link"
            :class="{ 'fd-toc-link-active': activeId === item.url.slice(1) }"
            :style="{ paddingLeft: `${12 + (item.depth - 2) * 12}px` }"
          >
            {{ item.title }}
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>
