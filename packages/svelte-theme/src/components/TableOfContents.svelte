<script>
  import { onMount, onDestroy } from "svelte";

  let { items = [] } = $props();
  let activeId = $state("");
  let observer;

  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeId = entry.target.id;
          }
        }
      },
      { rootMargin: "-80px 0px -80% 0px" }
    );

    observeHeadings();
  });

  $effect(() => {
    void items;
    observeHeadings();
  });

  function observeHeadings() {
    if (!observer) return;
    observer.disconnect();
    for (const item of items) {
      const el = document.querySelector(item.url);
      if (el) observer.observe(el);
    }
  }

  onDestroy(() => {
    observer?.disconnect();
  });
</script>

<div class="fd-toc-inner">
  <h3 class="fd-toc-title">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="15" y2="12" />
      <line x1="3" y1="18" x2="18" y2="18" />
    </svg>
    On this page
  </h3>
  {#if items.length === 0}
    <p class="fd-toc-empty">No Headings</p>
  {:else}
    <ul class="fd-toc-list">
      {#each items as item}
        <li class="fd-toc-item">
          <a
            href={item.url}
            class="fd-toc-link"
            class:fd-toc-link-active={activeId === item.url.slice(1)}
            style:padding-left="{12 + (item.depth - 2) * 12}px"
          >
            {item.title}
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>
