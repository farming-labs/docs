<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

interface TocItem {
  title: string;
  url: string;
  depth: number;
}

const props = defineProps<{ items?: TocItem[] }>();

const items = computed(() => props.items ?? []);
const activeId = ref("");

let observer: IntersectionObserver | null = null;

function observeHeadings() {
  if (!observer) return;
  observer.disconnect();
  for (const item of items.value) {
    const el = document.querySelector(item.url);
    if (el) observer.observe(el);
  }
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeId.value = entry.target.id;
        }
      }
    },
    { rootMargin: "-80px 0px -80% 0px" }
  );
  observeHeadings();
});

watch(items, observeHeadings, { flush: "post" });

onUnmounted(() => {
  observer?.disconnect();
});
</script>

<template>
  <div class="fd-toc-inner">
    <h3 class="fd-toc-title">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="15" y2="12" />
        <line x1="3" y1="18" x2="18" y2="18" />
      </svg>
      On this page
    </h3>
    <p v-if="items.length === 0" class="fd-toc-empty">No Headings</p>
    <ul v-else class="fd-toc-list">
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
</template>
