<script>
  /**
   * SearchDialog — Cmd+K search overlay.
   * Fetches from /api/docs?query=… (same unified handler as Next.js version).
   */
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";

  let { onclose } = $props();
  let query = $state("");
  let results = $state([]);
  let loading = $state(false);
  let inputEl;
  let debounceTimer;

  onMount(() => {
    inputEl?.focus();
  });

  $effect(() => {
    clearTimeout(debounceTimer);
    if (!query.trim()) {
      results = [];
      return;
    }
    loading = true;
    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/docs?query=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          results = data ?? [];
        }
      } catch {
        results = [];
      } finally {
        loading = false;
      }
    }, 200);
  });

  function navigate(url) {
    onclose?.();
    goto(url);
  }

  function handleKeydown(e) {
    if (e.key === "Escape") {
      onclose?.();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fd-search-overlay" onclick={onclose} onkeydown={handleKeydown} role="dialog">
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fd-search-dialog" onclick={(e) => e.stopPropagation()} role="document">
    <div class="fd-search-input-wrap">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        bind:this={inputEl}
        bind:value={query}
        class="fd-search-input"
        placeholder="Search documentation..."
        type="text"
      />
      <kbd class="fd-search-kbd">ESC</kbd>
    </div>

    <div class="fd-search-results">
      {#if loading}
        <div class="fd-search-empty">Searching...</div>
      {:else if query && results.length === 0}
        <div class="fd-search-empty">No results found for "{query}"</div>
      {:else}
        {#each results as result}
          <button class="fd-search-result" onclick={() => navigate(result.url)}>
            <span class="fd-search-result-title">{result.content}</span>
            {#if result.url}
              <span class="fd-search-result-url">{result.url}</span>
            {/if}
          </button>
        {/each}
      {/if}
    </div>
  </div>
</div>
