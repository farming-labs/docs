<script>
  /**
   * Omni command palette — pixel-perfect default for SvelteKit, aligned with
   * website/components/ui/omni-command-palette.tsx. Recents when empty,
   * /api/docs search, keyboard nav, same copy and structure.
   */
  import { onMount, onDestroy, tick } from "svelte";
  import { goto } from "$app/navigation";

  const STORAGE_KEY = "fd:omni:recents";
  const MAX_RECENTS = 8;
  const DEBOUNCE_MS = 120;
  const PLACEHOLDER = "Search documentation…";

  let { onclose } = $props();

  let query = $state("");
  let currentResults = $state([]);
  let loading = $state(false);
  let activeId = $state(null);
  let recentsList = $state([]);
  let inputEl = $state(null);
  let listRef = $state(null);
  let debounceTimer = null;

  let flatItems = $derived.by(() => {
    const q = query.trim();
    if (q && currentResults.length) {
      return currentResults.map((r) => ({
        id: r.url,
        label: r.content,
        url: r.url,
        subtitle: r.description ?? "Page",
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
  let showDocs = $derived(!!query.trim() && currentResults.length > 0);
  let showEmpty = $derived(
    query.trim() ? currentResults.length === 0 && !loading : recentsList.length === 0
  );
  let emptyText = $derived(
    query.trim()
      ? "No results found. Try a different query."
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

  function executeItem(item) {
    saveRecent({ id: item.url, label: item.label ?? item.content ?? item.url, url: item.url });
    if (item.url.startsWith("http")) {
      if (typeof window !== "undefined") window.open(item.url, "_blank", "noopener,noreferrer");
    } else {
      goto(item.url);
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
    if (!q) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      loading = true;
      try {
        const res = await fetch(`/api/docs?query=${encodeURIComponent(q)}`);
        const data = res.ok ? await res.json() : [];
        currentResults = Array.isArray(data) ? data : [];
        activeId = currentResults[0]?.url ?? null;
      } catch {
        currentResults = [];
      } finally {
        loading = false;
      }
    }, DEBOUNCE_MS);
  }

  $effect(() => {
    void query;
    onInput();
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

  function onExternalClick(e, url) {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      if (typeof window !== "undefined") window.location.href = url;
    }
  }

  const FileIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>`;
  const ExternalIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
  const ChevronIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>`;
  const EmptyIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;

  onMount(() => {
    loadRecents();
    if (typeof document !== "undefined") document.body.style.overflow = "hidden";
    tick().then(() => inputEl?.focus());
  });

  onDestroy(() => {
    if (typeof document !== "undefined") document.body.style.overflow = "";
    if (debounceTimer) clearTimeout(debounceTimer);
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
          placeholder={PLACEHOLDER}
          autocomplete="off"
          onkeydown={handleKeydown}
        />
        <kbd class="omni-kbd">⌘K</kbd>
        <button type="button" aria-label="Close" class="omni-close-btn" onclick={close}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
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
                <div class="omni-item-icon">
                  {@html FileIcon}
                </div>
                <div class="omni-item-text">
                  <div class="omni-item-label">{item.label}</div>
                  <div class="omni-item-subtitle">{item.subtitle}</div>
                </div>
                <a
                  href={item.url}
                  class="omni-item-badge"
                  title="Open in new tab"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-hidden="true"
                  onclick={(e) => onExternalClick(e, item.url)}
                >
                  {@html ExternalIcon}
                </a>
                <span class="omni-item-chevron" aria-hidden="true">
                  {@html ChevronIcon}
                </span>
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
                <div class="omni-item-icon">
                  {@html FileIcon}
                </div>
                <div class="omni-item-text">
                  <div class="omni-item-label">{item.label}</div>
                  <div class="omni-item-subtitle">{item.subtitle}</div>
                </div>
                <a
                  href={item.url}
                  class="omni-item-badge"
                  title="Open in new tab"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-hidden="true"
                  onclick={(e) => onExternalClick(e, item.url)}
                >
                  {@html ExternalIcon}
                </a>
                <span class="omni-item-chevron" aria-hidden="true">
                  {@html ChevronIcon}
                </span>
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
