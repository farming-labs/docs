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
const activeIds = ref(new Set<string>());

const listRef = ref<HTMLUListElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const thumbTop = ref(0);
const thumbHeight = ref(0);
const svgPath = ref("");

let observer: IntersectionObserver | null = null;

function getItemOffset(depth: number): number {
  if (depth <= 2) return 14;
  if (depth === 3) return 26;
  return 36;
}

function getLineOffset(depth: number): number {
  return depth >= 3 ? 10 : 0;
}

function observeHeadings() {
  if (!observer) return;
  observer.disconnect();
  for (const item of items.value) {
    const el = document.querySelector(item.url);
    if (el) observer.observe(el);
  }
}

function isActive(item: TocItem): boolean {
  return activeIds.value.has(item.url.slice(1));
}

function defaultLinkStyle(item: TocItem) {
  const indent = (item.depth - 2) * 12;
  return { paddingLeft: `${12 + indent}px` };
}

function clerkLinkStyle(item: TocItem) {
  return {
    position: "relative" as const,
    paddingLeft: `${getItemOffset(item.depth)}px`,
    paddingTop: "6px",
    paddingBottom: "6px",
    fontSize: item.depth <= 2 ? "14px" : "13px",
  };
}

function verticalLineStyle(item: TocItem, index: number) {
  const list = items.value;
  const prevDepth = index > 0 ? list[index - 1].depth : item.depth;
  const nextDepth = index < list.length - 1 ? list[index + 1].depth : item.depth;
  const depthChanged = prevDepth !== item.depth;
  const depthChangesNext = nextDepth !== item.depth;

  return {
    position: "absolute" as const,
    left: `${getLineOffset(item.depth)}px`,
    top: depthChanged ? "6px" : "0",
    bottom: depthChangesNext ? "6px" : "0",
    width: "1px",
    background: "hsla(0, 0%, 50%, 0.1)",
  };
}

function hasDiagonal(index: number): boolean {
  if (index === 0) return false;
  const list = items.value;
  return list[index - 1].depth !== list[index].depth;
}

function diagonalSvg(index: number) {
  const list = items.value;
  const prevDepth = list[index - 1].depth;
  const currDepth = list[index].depth;
  const upperOffset = getLineOffset(prevDepth);
  const currentOffset = getLineOffset(currDepth);
  return { upperOffset, currentOffset };
}

function buildSvgPath() {
  if (!listRef.value) return;
  const links = listRef.value.querySelectorAll<HTMLAnchorElement>(".fd-toc-clerk-link");
  if (links.length === 0) {
    svgPath.value = "";
    return;
  }

  const containerTop = listRef.value.offsetTop;
  let d = "";
  const list = items.value;

  links.forEach((el, i) => {
    if (i >= list.length) return;
    const depth = list[i].depth;
    const x = getLineOffset(depth) + 1;
    const top = el.offsetTop - containerTop;
    const bottom = top + el.clientHeight;
    const cmd = i === 0 ? "M" : "L";
    d += `${cmd}${x} ${top} L${x} ${bottom} `;
  });

  svgPath.value = d.trim();
}

function calcThumb() {
  if (!listRef.value || activeIds.value.size === 0) {
    thumbTop.value = 0;
    thumbHeight.value = 0;
    return;
  }

  const containerTop = listRef.value.offsetTop;
  let upper = Infinity;
  let lower = 0;

  for (const id of activeIds.value) {
    const el = listRef.value.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`);
    if (!el) continue;
    const styles = getComputedStyle(el);
    const elTop = el.offsetTop - containerTop;
    upper = Math.min(upper, elTop + parseFloat(styles.paddingTop));
    lower = Math.max(lower, elTop + el.clientHeight - parseFloat(styles.paddingBottom));
  }

  if (upper === Infinity) {
    thumbTop.value = 0;
    thumbHeight.value = 0;
    return;
  }

  thumbTop.value = upper;
  thumbHeight.value = lower - upper;
}

function maskSvgUrl(): string {
  if (!svgPath.value) return "none";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><path d="${svgPath.value}" stroke="white" stroke-width="2" fill="none"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      const next = new Set(activeIds.value);
      for (const entry of entries) {
        if (entry.isIntersecting) {
          next.add(entry.target.id);
        } else {
          next.delete(entry.target.id);
        }
      }
      activeIds.value = next;
    },
    { rootMargin: "-80px 0px -80% 0px" },
  );
  observeHeadings();

  if (isDirectional.value) {
    nextTick(() => {
      buildSvgPath();
      calcThumb();
    });
  }
});

watch(
  items,
  () => {
    observeHeadings();
    if (isDirectional.value) {
      nextTick(() => {
        buildSvgPath();
        calcThumb();
      });
    }
  },
  { flush: "post" },
);

watch(
  activeIds,
  () => {
    if (isDirectional.value) {
      calcThumb();
    }
  },
  { deep: true },
);

watch(isDirectional, (val) => {
  if (val) {
    nextTick(() => {
      buildSvgPath();
      calcThumb();
    });
  }
});

onUnmounted(() => {
  observer?.disconnect();
});
</script>

<template>
  <div ref="containerRef" class="fd-toc-inner" :class="{ 'fd-toc-directional': isDirectional }">
    <h3 class="fd-toc-title">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="15" y2="12" />
        <line x1="3" y1="18" x2="18" y2="18" />
      </svg>
      On this page
    </h3>
    <p v-if="items.length === 0" class="fd-toc-empty">No Headings</p>

    <!-- Default style -->
    <ul v-else-if="!isDirectional" class="fd-toc-list">
      <li v-for="item in items" :key="item.url" class="fd-toc-item">
        <a
          :href="item.url"
          class="fd-toc-link"
          :class="{ 'fd-toc-link-active': isActive(item) }"
          :style="defaultLinkStyle(item)"
        >
          {{ item.title }}
        </a>
      </li>
    </ul>

    <!-- Clerk / directional style -->
    <ul v-else ref="listRef" class="fd-toc-list fd-toc-clerk" style="position: relative">
      <li v-for="(item, index) in items" :key="item.url" class="fd-toc-item">
        <a
          :href="item.url"
          class="fd-toc-link fd-toc-clerk-link"
          :style="clerkLinkStyle(item)"
          :data-active="isActive(item) || undefined"
        >
          <!-- Vertical line segment -->
          <div :style="verticalLineStyle(item, index)" />

          <!-- Diagonal SVG connector when depth changes -->
          <svg
            v-if="hasDiagonal(index)"
            viewBox="0 0 16 16"
            width="16"
            height="16"
            style="position: absolute; top: -6px; left: 0"
          >
            <line
              :x1="diagonalSvg(index).upperOffset"
              y1="0"
              :x2="diagonalSvg(index).currentOffset"
              y2="12"
              stroke="hsla(0, 0%, 50%, 0.1)"
              stroke-width="1"
            />
          </svg>

          {{ item.title }}
        </a>
      </li>

      <!-- Mask container with thumb for active highlight -->
      <div
        v-if="svgPath"
        class="fd-toc-clerk-mask"
        :style="{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          maskImage: maskSvgUrl(),
          WebkitMaskImage: maskSvgUrl(),
          maskRepeat: 'no-repeat',
          WebkitMaskRepeat: 'no-repeat',
        }"
      >
        <div
          class="fd-toc-clerk-thumb"
          :style="{
            marginTop: `${thumbTop}px`,
            height: `${thumbHeight}px`,
            background: 'var(--color-fd-primary)',
            transition: 'all 0.15s',
          }"
        />
      </div>
    </ul>
  </div>
</template>
