<script>
  /**
   * Omni command palette — pixel-perfect default for SvelteKit, aligned with
   * website/components/ui/omni-command-palette.tsx. Recents when empty,
   * /api/docs search, keyboard nav, same copy and structure.
   */
  import { onMount, onDestroy, tick } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";

  const STORAGE_KEY = "fd:omni:recents";
  const MAX_RECENTS = 8;
  const DEBOUNCE_MS = 120;
  const BREADCRUMB_SEPARATOR = "\u00a0\u00a0>\u00a0\u00a0";
  const FILTER_LABELS = {
    all: "All",
    pages: "Pages",
    inside: "Inside pages",
  };
  const FILTER_OPTIONS = ["all", "pages", "inside"];

  let { onclose } = $props();

  let query = $state("");
  let currentResults = $state([]);
  let loading = $state(false);
  let activeId = $state(null);
  let recentsList = $state([]);
  let filter = $state("all");
  let filterOpen = $state(false);
  let inputEl = $state(null);
  let listRef = $state(null);
  let debounceTimer = null;
  let abortController = null;
  const searchCache = new Map();

  function withLang(url) {
    if (!url || url.startsWith("#")) return url;
    try {
      const parsed = new URL(url, "https://farming-labs.local");
      const locale = $page.url.searchParams.get("lang") ?? $page.url.searchParams.get("locale");
      if (locale) parsed.searchParams.set("lang", locale);
      else parsed.searchParams.delete("lang");
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return url;
    }
  }

  function breadcrumbForUrl(url) {
    try {
      const parsed = new URL(url, "https://farming-labs.local");
      const parts = parsed.pathname
        .split("/")
        .filter(Boolean)
        .map((part) =>
          decodeURIComponent(part)
            .replace(/[-_]+/g, " ")
            .replace(/\b\w/g, (char) => char.toUpperCase())
        );
      return parts.length ? parts.join(BREADCRUMB_SEPARATOR) : "Docs";
    } catch {
      return "Docs";
    }
  }

  function displayLabelForResult(result) {
    if (result.section) return result.section;
    const label = result.content ?? "";
    const parts = label.split(/\s+[—–]\s+/).map((part) => part.trim()).filter(Boolean);
    return result.type === "heading" && parts.length > 1 ? parts[parts.length - 1] : label;
  }

  let visibleResults = $derived.by(() => {
    if (filter === "pages") return currentResults.filter((result) => result.type === "page");
    if (filter === "inside") return currentResults.filter((result) => result.type !== "page");
    return currentResults;
  });

  let flatItems = $derived.by(() => {
    const q = query.trim();
    if (q && visibleResults.length) {
      return visibleResults.map((r) => ({
        id: r.url,
        label: displayLabelForResult(r),
        url: r.url,
        subtitle: breadcrumbForUrl(r.url),
        description: r.description,
      }));
    }
    return recentsList.map((r) => ({
      id: r.id,
      label: r.label,
      url: r.url,
      subtitle: "Recently used",
    }));
  });

  let showRecents = $derived(!query.trim());
  let showDocs = $derived(!!query.trim() && visibleResults.length > 0);
  let showEmpty = $derived(
    query.trim() ? visibleResults.length === 0 && !loading : recentsList.length === 0
  );
  let emptyText = $derived(
    query.trim()
      ? currentResults.length > 0
        ? `No ${FILTER_LABELS[filter].toLowerCase()} results found.`
        : "No results found. Try a different query."
      : "Type to search the docs, or browse recent items."
  );

  function getRecents() {
    if (typeof document === "undefined" || typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveRecent(entry) {
    if (typeof localStorage === "undefined") return;
    try {
      const recents = getRecents();
      const next = [entry, ...recents.filter((r) => r.id !== entry.id)].slice(0, MAX_RECENTS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }

  function loadRecents() {
    recentsList = getRecents();
  }

  function close() {
    if (typeof document !== "undefined") document.body.style.overflow = "";
    onclose?.();
  }

  function updateFilter(nextFilter) {
    filter = nextFilter;
    filterOpen = false;
    activeId = flatItems[0]?.id ?? null;
  }

  function executeItem(item) {
    const localizedUrl = withLang(item.url);
    saveRecent({ id: localizedUrl, label: item.label ?? item.content ?? item.url, url: localizedUrl });
    if (localizedUrl.startsWith("http")) {
      if (typeof window !== "undefined") window.open(localizedUrl, "_blank", "noopener,noreferrer");
    } else {
      goto(localizedUrl);
    }
    close();
  }

  function moveActive(delta) {
    if (!flatItems.length) return;
    const idx = flatItems.findIndex((i) => i.id === activeId);
    const nextIdx = idx < 0 ? 0 : (((idx + delta) % flatItems.length) + flatItems.length) % flatItems.length;
    activeId = flatItems[nextIdx].id;
    scrollActiveIntoView();
  }

  function executeActive() {
    const idx = activeId != null ? flatItems.findIndex((i) => i.id === activeId) : 0;
    const item = flatItems[idx ?? 0];
    if (item) executeItem(item);
  }

  function scrollActiveIntoView() {
    tick().then(() => {
      if (typeof document === "undefined" || !listRef) return;
      const node = listRef.querySelector(`[data-id="${activeId}"]`);
      node?.scrollIntoView({ block: "nearest" });
    });
  }

  function onInput() {
    loadRecents();
    loading = false;
    currentResults = [];
    activeId = null;
    const q = query.trim();
    filterOpen = false;
    if (abortController) abortController.abort();
    if (!q) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    const requestUrl = withLang(`/api/docs?query=${encodeURIComponent(q)}`);
    const cached = searchCache.get(requestUrl);
    if (cached) {
      currentResults = cached;
      activeId = cached[0]?.url ?? null;
      return;
    }
    debounceTimer = setTimeout(async () => {
      const controller = new AbortController();
      abortController = controller;
      loading = true;
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
        currentResults = nextResults;
        activeId = currentResults[0]?.url ?? null;
      } catch (error) {
        if (controller.signal.aborted) return;
        currentResults = [];
      } finally {
        if (abortController === controller) {
          abortController = null;
          loading = false;
        }
      }
    }, DEBOUNCE_MS);
  }

  $effect(() => {
    void query;
    onInput();
  });

  $effect(() => {
    void filter;
    activeId = flatItems[0]?.id ?? null;
  });

  function handleKeydown(e) {
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

  function onContentClick(e) {
    e.stopPropagation();
  }

  const EmptyIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;

  onMount(() => {
    loadRecents();
    if (typeof document !== "undefined") document.body.style.overflow = "hidden";
    tick().then(() => inputEl?.focus());
  });

  onDestroy(() => {
    if (typeof document !== "undefined") document.body.style.overflow = "";
    if (debounceTimer) clearTimeout(debounceTimer);
    if (abortController) abortController.abort();
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="omni-overlay"
  aria-hidden="true"
  role="presentation"
  onclick={onOverlayClick}
  onkeydown={handleKeydown}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="omni-content"
    role="dialog"
    aria-label="Command palette"
    tabindex="-1"
    onclick={onContentClick}
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
          bind:this={inputEl}
          bind:value={query}
          type="text"
          class="omni-search-input"
          role="combobox"
          aria-expanded="true"
          aria-controls="omni-listbox"
          aria-activedescendant={activeId ? `omni-item-${activeId}` : undefined}
          placeholder="Search"
          autocomplete="off"
          onkeydown={handleKeydown}
        />
        <button type="button" aria-label="Close" class="omni-close-btn" onclick={close}>
          ESC
        </button>
      </div>
    </div>

    <div
      bind:this={listRef}
      id="omni-listbox"
      class="omni-body"
      role="listbox"
      aria-label="Command results"
    >
      {#if loading}
        <div class="omni-loading">
          <svg class="omni-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Fetching results…
        </div>

      {:else if showRecents && recentsList.length > 0}
        <div class="omni-group">
          <div class="omni-group-label">Recent</div>
          <div class="omni-group-items">
            {#each flatItems as item, i}
              {@const active = item.id === activeId || (activeId == null && i === 0)}
              <button
                type="button"
                id="omni-item-{item.id}"
                data-id={item.id}
                class="omni-item"
                class:omni-item-active={active}
                role="option"
                aria-selected={active}
                onmouseenter={() => (activeId = item.id)}
                onclick={() => executeItem(item)}
              >
                <div class="omni-item-text">
                  <div class="omni-item-subtitle">{item.subtitle}</div>
                  <div class="omni-item-label">{item.label}</div>
                </div>
              </button>
            {/each}
          </div>
        </div>

      {:else if showDocs}
        <div class="omni-group">
          <div class="omni-group-label">Documentation</div>
          <div class="omni-group-items">
            {#each flatItems as item, i}
              {@const active = item.id === activeId || (activeId == null && i === 0)}
              <button
                type="button"
                id="omni-item-{item.id}"
                data-id={item.id}
                class="omni-item"
                class:omni-item-active={active}
                role="option"
                aria-selected={active}
                onmouseenter={() => (activeId = item.id)}
                onclick={() => executeItem(item)}
              >
                <div class="omni-item-text">
                  <div class="omni-item-subtitle">{item.subtitle}</div>
                  <div class="omni-item-label">{item.label}</div>
                  {#if item.description}
                    <div class="omni-item-description">{item.description}</div>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if showEmpty}
        <div class="omni-empty">
          <div class="omni-empty-icon">
            {@html EmptyIcon}
          </div>
          {emptyText}
        </div>
      {/if}
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
            aria-expanded={filterOpen}
            onclick={() => (filterOpen = !filterOpen)}
          >
            {FILTER_LABELS[filter]}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {#if filterOpen}
            <div class="omni-filter-menu" role="menu" aria-label="Search filter">
              {#each FILTER_OPTIONS as option}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={filter === option}
                  class="omni-filter-option"
                  class:omni-filter-option-active={filter === option}
                  onclick={() => updateFilter(option)}
                >
                  {FILTER_LABELS[option]}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
