<script setup lang="ts">
/**
 * Omni command palette — same behavior as website/components/ui/omni-command-palette.tsx
 * and Astro SearchDialog: recents when empty, /api/docs search, keyboard nav, click to navigate.
 */
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { navigateTo } from "#app";

const STORAGE_KEY = "fd:omni:recents";
const MAX_RECENTS = 8;
const DEBOUNCE_MS = 150;

const emit = defineEmits<{ (e: "close"): void }>();

const query = ref("");
const currentResults = ref<{ content: string; url: string; description?: string }[]>([]);
const loading = ref(false);
const activeIndex = ref(0);
const inputEl = ref<HTMLInputElement | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

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

const allItems = computed(() => {
  const q = query.value.trim();
  if (q && currentResults.value.length) return currentResults.value.map((r) => ({ id: r.url, label: r.content, url: r.url, subtitle: r.description ?? "Page" }));
  return recentsList.value.map((r) => ({ id: r.id, label: r.label, url: r.url, subtitle: "Recently viewed" }));
});

const showRecents = computed(() => !query.value.trim());
const showDocs = computed(() => !!query.value.trim() && currentResults.value.length > 0);
const showEmpty = computed(() => {
  if (query.value.trim()) return currentResults.value.length === 0 && !loading.value;
  return recentsList.value.length === 0;
});
const emptyText = computed(() =>
  query.value.trim() ? "No results found. Try a different query." : "Type to search the docs, or browse recent items.",
);

function loadRecents() {
  recentsList.value = getRecents();
}

function close() {
  if (typeof document !== "undefined") document.body.style.overflow = "";
  emit("close");
}

function executeItem(item: { url: string; label?: string; content?: string }) {
  const label = item.label ?? item.content ?? item.url;
  saveRecent({ id: item.url, label, url: item.url });
  if (item.url.startsWith("http")) {
    window.open(item.url, "_blank", "noopener,noreferrer");
  } else {
    navigateTo(item.url);
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
  if (!q) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    loading.value = true;
    try {
      const res = await fetch(`/api/docs?query=${encodeURIComponent(q)}`);
      const data = res.ok ? await res.json() : [];
      currentResults.value = Array.isArray(data) ? data : [];
      activeIndex.value = 0;
    } catch {
      currentResults.value = [];
    } finally {
      loading.value = false;
    }
  }, DEBOUNCE_MS);
}

watch(query, onInput);

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

function onExternalClick(e: Event, url: string) {
  e.preventDefault();
  e.stopPropagation();
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.location.href = url;
  }
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
            placeholder="Search documentation…"
            autocomplete="off"
            @keydown="handleKeydown"
          />
          <kbd class="omni-kbd">⌘K</kbd>
          <button type="button" aria-label="Close" class="omni-close-btn" @click="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
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
              <div class="omni-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                  <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                </svg>
              </div>
              <div class="omni-item-text">
                <div class="omni-item-label">{{ r.label }}</div>
                <div class="omni-item-subtitle">Recently viewed</div>
              </div>
              <a
                :href="r.url"
                class="omni-item-ext"
                title="Open in new tab"
                target="_blank"
                rel="noopener noreferrer"
                @click.prevent="onExternalClick($event, r.url)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
              <span class="omni-item-chevron" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
            </div>
          </div>
        </div>

        <div v-if="showDocs" id="fd-omni-docs-group" class="omni-group">
          <div class="omni-group-label">Documentation</div>
          <div id="fd-omni-docs-items" class="omni-group-items">
            <div
              v-for="(r, i) in currentResults"
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
              <div class="omni-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                  <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                </svg>
              </div>
              <div class="omni-item-text">
                <div class="omni-item-label">{{ r.content }}</div>
                <div class="omni-item-subtitle">{{ r.description ?? "Page" }}</div>
              </div>
              <a
                :href="r.url"
                class="omni-item-ext"
                title="Open in new tab"
                target="_blank"
                rel="noopener noreferrer"
                @click.prevent="onExternalClick($event, r.url)"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
              <span class="omni-item-chevron" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
              to select
            </span>
            <span class="omni-footer-hint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 15l-6-6-6 6" />
              </svg>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
              to navigate
            </span>
            <span class="omni-footer-hint omni-footer-hint-desktop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              to close
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
