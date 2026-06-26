<script setup lang="ts">
/**
 * Omni command palette — same behavior as website/components/ui/omni-command-palette.tsx
 * and Astro SearchDialog: recents when empty, /api/docs search, keyboard nav, click to navigate.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { navigateTo } from "#app";
import { useRoute } from "vue-router";

const STORAGE_KEY = "fd:omni:recents";
const MAX_RECENTS = 8;
const DEBOUNCE_MS = 150;
const FILTER_LABELS = {
  all: "All",
  pages: "Pages",
  inside: "Inside pages",
} as const;
const FILTER_OPTIONS = ["all", "pages", "inside"] as const;

const emit = defineEmits<{ (e: "close"): void }>();
const route = useRoute();

type SearchFilter = keyof typeof FILTER_LABELS;

const query = ref("");
const currentResults = ref<
  { content: string; url: string; description?: string; section?: string; type?: string }[]
>([]);
const loading = ref(false);
const activeIndex = ref(0);
const filter = ref<SearchFilter>("all");
const filterOpen = ref(false);
const inputEl = ref<HTMLInputElement | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let abortController: AbortController | null = null;
const searchCache = new Map<
  string,
  { content: string; url: string; description?: string; section?: string; type?: string }[]
>();

interface RecentEntry {
  id: string;
  label: string;
  url: string;
}

function getRecents(): RecentEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(entry: RecentEntry) {
  try {
    const recents = getRecents();
    const next = [entry, ...recents.filter((r) => r.id !== entry.id)].slice(0, MAX_RECENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

const recentsList = ref<RecentEntry[]>([]);

function withLang(url: string): string {
  if (!url || url.startsWith("#")) return url;
  try {
    const parsed = new URL(url, "https://farming-labs.local");
    const locale = (route.query.lang as string | undefined) ?? (route.query.locale as string | undefined);
    if (locale) parsed.searchParams.set("lang", locale);
    else parsed.searchParams.delete("lang");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

function breadcrumbForUrl(url: string): string {
  try {
    const parsed = new URL(url, "https://farming-labs.local");
    const parts = parsed.pathname
      .split("/")
      .filter(Boolean)
      .map((part) =>
        decodeURIComponent(part)
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (char) => char.toUpperCase()),
      );
    return parts.length ? parts.join(" > ") : "Docs";
  } catch {
    return "Docs";
  }
}

function displayLabelForResult(result: { content: string; section?: string; type?: string }): string {
  if (result.section) return result.section;
  const parts = result.content.split(/\s+[—–]\s+/).map((part) => part.trim()).filter(Boolean);
  return result.type === "heading" && parts.length > 1 ? (parts[parts.length - 1] ?? result.content) : result.content;
}

const visibleResults = computed(() => {
  if (filter.value === "pages") return currentResults.value.filter((result) => result.type === "page");
  if (filter.value === "inside") return currentResults.value.filter((result) => result.type !== "page");
  return currentResults.value;
});

const allItems = computed(() => {
  const q = query.value.trim();
  if (q && visibleResults.value.length) {
    return visibleResults.value.map((r) => ({
      id: r.url,
      label: displayLabelForResult(r),
      url: r.url,
      subtitle: breadcrumbForUrl(r.url),
      description: r.description,
    }));
  }
  return recentsList.value.map((r) => ({ id: r.id, label: r.label, url: r.url, subtitle: "Recently viewed" }));
});

const showRecents = computed(() => !query.value.trim());
const showDocs = computed(() => !!query.value.trim() && visibleResults.value.length > 0);
const showEmpty = computed(() => {
  if (query.value.trim()) return visibleResults.value.length === 0 && !loading.value;
  return recentsList.value.length === 0;
});
const emptyText = computed(() =>
  query.value.trim()
    ? currentResults.value.length > 0
      ? `No ${FILTER_LABELS[filter.value].toLowerCase()} results found.`
      : "No results found. Try a different query."
    : "Type to search the docs, or browse recent items.",
);

function loadRecents() {
  recentsList.value = getRecents();
}

function close() {
  if (typeof document !== "undefined") document.body.style.overflow = "";
  emit("close");
}

function updateFilter(nextFilter: SearchFilter) {
  filter.value = nextFilter;
  filterOpen.value = false;
  activeIndex.value = 0;
}

function executeItem(item: { url: string; label?: string; content?: string }) {
  const label = item.label ?? item.content ?? item.url;
  const localizedUrl = withLang(item.url);
  saveRecent({ id: localizedUrl, label, url: localizedUrl });
  if (localizedUrl.startsWith("http")) {
    window.open(localizedUrl, "_blank", "noopener,noreferrer");
  } else {
    navigateTo(localizedUrl);
  }
  close();
}

function moveActive(delta: number) {
  const items = allItems.value;
  if (!items.length) return;
  activeIndex.value = activeIndex.value + delta;
  if (activeIndex.value < 0) activeIndex.value = items.length - 1;
  if (activeIndex.value >= items.length) activeIndex.value = 0;
  scrollActiveIntoView();
}

function executeActive() {
  const items = allItems.value;
  const item = items[activeIndex.value];
  if (item) executeItem(item);
}

function scrollActiveIntoView() {
  nextTick(() => {
    const listbox = document.getElementById("fd-omni-listbox");
    if (!listbox) return;
    const q = query.value.trim();
    const container = q ? document.getElementById("fd-omni-docs-items") : document.getElementById("fd-omni-recent-items");
    if (!container) return;
    const items = container.querySelectorAll(".omni-item[data-url]");
    if (items[activeIndex.value]) (items[activeIndex.value] as HTMLElement).scrollIntoView({ block: "nearest" });
  });
}

function onInput() {
  loadRecents();
  const q = query.value.trim();
  loading.value = false;
  currentResults.value = [];
  activeIndex.value = 0;
  filterOpen.value = false;
  abortController?.abort();
  if (!q) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  const requestUrl = withLang(`/api/docs?query=${encodeURIComponent(q)}`);
  const cached = searchCache.get(requestUrl);
  if (cached) {
    currentResults.value = cached;
    return;
  }
  debounceTimer = setTimeout(async () => {
    const controller = new AbortController();
    abortController = controller;
    loading.value = true;
    try {
      const res = await fetch(requestUrl, { signal: controller.signal });
      const data = res.ok ? await res.json() : [];
      if (controller.signal.aborted) return;
      const nextResults = Array.isArray(data) ? data : [];
      if (searchCache.size >= 20) {
        const firstKey = searchCache.keys().next().value;
        if (firstKey) searchCache.delete(firstKey);
      }
      searchCache.set(requestUrl, nextResults);
      currentResults.value = nextResults;
      activeIndex.value = 0;
    } catch {
      if (controller.signal.aborted) return;
      currentResults.value = [];
    } finally {
      if (abortController === controller) {
        abortController = null;
        loading.value = false;
      }
    }
  }, DEBOUNCE_MS);
}

watch(query, onInput);
watch(filter, () => {
  activeIndex.value = 0;
});
watch(visibleResults, () => {
  if (activeIndex.value >= visibleResults.value.length) activeIndex.value = 0;
});

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    close();
    return;
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    moveActive(1);
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    moveActive(-1);
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    executeActive();
  }
}

function onOverlayClick() {
  close();
}

function onContentClick(e: MouseEvent) {
  e.stopPropagation();
}

function onRowClick(item: { url: string; label?: string; content?: string }) {
  executeItem(item);
}

function onRowMouseEnter(container: "recent" | "docs", index: number) {
  activeIndex.value = index;
}

onMounted(() => {
  loadRecents();
  if (typeof document !== "undefined") document.body.style.overflow = "hidden";
  nextTick(() => {
    inputEl.value?.focus();
  });
});

onBeforeUnmount(() => {
  if (typeof document !== "undefined") document.body.style.overflow = "";
  if (debounceTimer) clearTimeout(debounceTimer);
  abortController?.abort();
});
</script>

<template>
  <div class="omni-overlay" aria-hidden="true" @click="onOverlayClick" @keydown="handleKeydown">
    <div
      class="omni-content"
      role="dialog"
      aria-label="Search documentation"
      @click="onContentClick"
    >
      <div class="omni-header">
        <div class="omni-search-row">
          <span class="omni-search-icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            ref="inputEl"
            v-model="query"
            type="text"
            class="omni-search-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="fd-omni-listbox"
            placeholder="Search"
            autocomplete="off"
            @keydown="handleKeydown"
          />
          <button type="button" aria-label="Close" class="omni-close-btn" @click="close">
            ESC
          </button>
        </div>
      </div>

      <div id="fd-omni-listbox" class="omni-body" role="listbox" aria-label="Search results">
        <div v-if="loading" class="omni-loading">
          <svg class="omni-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Searching…
        </div>

        <div v-else-if="showRecents && recentsList.length" id="fd-omni-recent-group" class="omni-group">
          <div class="omni-group-label">Recent</div>
          <div id="fd-omni-recent-items" class="omni-group-items">
            <div
              v-for="(r, i) in recentsList"
              :key="r.id"
              class="omni-item"
              :class="{ 'omni-item-active': showRecents && i === activeIndex }"
              :data-url="r.url"
              role="option"
              :aria-selected="showRecents && i === activeIndex"
              tabindex="-1"
              @click="onRowClick(r)"
              @mouseenter="onRowMouseEnter('recent', i)"
            >
              <div class="omni-item-text">
                <div class="omni-item-subtitle">Recently viewed</div>
                <div class="omni-item-label">{{ r.label }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="showDocs" id="fd-omni-docs-group" class="omni-group">
          <div class="omni-group-label">Documentation</div>
          <div id="fd-omni-docs-items" class="omni-group-items">
            <div
              v-for="(r, i) in visibleResults"
              :key="r.url"
              class="omni-item"
              :class="{ 'omni-item-active': showDocs && i === activeIndex }"
              :data-url="r.url"
              role="option"
              :aria-selected="showDocs && i === activeIndex"
              tabindex="-1"
              @click="onRowClick(r)"
              @mouseenter="onRowMouseEnter('docs', i)"
            >
              <div class="omni-item-text">
                <div class="omni-item-subtitle">{{ breadcrumbForUrl(r.url) }}</div>
                <div class="omni-item-label">{{ displayLabelForResult(r) }}</div>
                <div v-if="r.description" class="omni-item-description">{{ r.description }}</div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="showEmpty" class="omni-empty">
          <div class="omni-empty-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <span>{{ emptyText }}</span>
        </div>
      </div>

      <div class="omni-footer">
        <div class="omni-footer-inner">
          <div class="omni-footer-hints">
            <span class="omni-footer-hint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="m9 10-5 5 5 5" />
                <path d="M20 4v7a4 4 0 0 1-4 4H4" />
              </svg>
              to select
            </span>
            <span class="omni-footer-hint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="m18 15-6-6-6 6" />
              </svg>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
              to navigate
            </span>
            <span class="omni-footer-hint omni-footer-hint-desktop">
              <span class="omni-kbd-sm">ESC</span>
              to close
            </span>
          </div>
          <div class="omni-footer-filter">
            <span class="omni-filter-label">Filter</span>
            <button
              type="button"
              class="omni-filter-button"
              aria-haspopup="menu"
              :aria-expanded="filterOpen"
              @click="filterOpen = !filterOpen"
            >
              {{ FILTER_LABELS[filter] }}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div v-if="filterOpen" class="omni-filter-menu" role="menu" aria-label="Search filter">
              <button
                v-for="option in FILTER_OPTIONS"
                :key="option"
                type="button"
                role="menuitemradio"
                :aria-checked="filter === option"
                class="omni-filter-option"
                :class="{ 'omni-filter-option-active': filter === option }"
                @click="updateFilter(option)"
              >
                {{ FILTER_LABELS[option] }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
