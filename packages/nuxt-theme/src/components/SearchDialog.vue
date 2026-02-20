<script setup lang="ts">
import { ref, watch, onMounted } from "vue";

const emit = defineEmits<{ (e: "close"): void }>();

const query = ref("");
const results = ref<{ content: string; url?: string; description?: string }[]>([]);
const loading = ref(false);
const inputEl = ref<HTMLInputElement | null>(null);

let debounceTimer: ReturnType<typeof setTimeout>;

watch(query, (q) => {
  clearTimeout(debounceTimer);
  if (!q.trim()) {
    results.value = [];
    return;
  }
  loading.value = true;
  debounceTimer = setTimeout(async () => {
    try {
      const res = await fetch(`/api/docs?query=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        results.value = data ?? [];
      }
    } catch {
      results.value = [];
    } finally {
      loading.value = false;
    }
  }, 200);
});

onMounted(() => {
  inputEl.value?.focus();
});

function navigate(url: string) {
  emit("close");
  if (typeof navigateTo === "function") {
    navigateTo(url);
  } else {
    window.location.href = url;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") emit("close");
}
</script>

<template>
  <div
    class="fd-search-overlay"
    role="dialog"
    @click.self="emit('close')"
    @keydown="handleKeydown"
  >
    <div class="fd-search-dialog" role="document" @click.stop>
      <div class="fd-search-input-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref="inputEl"
          v-model="query"
          class="fd-search-input"
          placeholder="Search documentation..."
          type="text"
        />
        <kbd class="fd-search-kbd">ESC</kbd>
      </div>

      <div class="fd-search-results">
        <div v-if="loading" class="fd-search-empty">Searching...</div>
        <div v-else-if="query && results.length === 0" class="fd-search-empty">
          No results found for "{{ query }}"
        </div>
        <button
          v-for="result in results"
          v-else
          :key="result.url ?? result.content"
          class="fd-search-result"
          @click="result.url && navigate(result.url)"
        >
          <span class="fd-search-result-title">{{ result.content }}</span>
          <span v-if="result.url" class="fd-search-result-url">{{ result.url }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
