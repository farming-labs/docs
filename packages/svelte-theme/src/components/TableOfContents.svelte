<script>
  import { onMount, onDestroy, tick } from "svelte";

  let { items = [], tocStyle = "default" } = $props();
  let activeId = $state("");
  let activeIds = $state([]);
  let thumbTop = $state(0);
  let thumbHeight = $state(0);
  let tocListEl;
  let observer;

  const isDirectional = $derived(tocStyle === "directional");

  function updateThumb() {
    if (!isDirectional || !tocListEl || activeIds.length === 0) {
      thumbTop = 0;
      thumbHeight = 0;
      return;
    }

    let upper = Number.MAX_VALUE;
    let lower = 0;

    for (const id of activeIds) {
      const link = tocListEl.querySelector(`a[href="#${id}"]`);
      if (!link) continue;
      const styles = getComputedStyle(link);
      upper = Math.min(upper, link.offsetTop + parseFloat(styles.paddingTop));
      lower = Math.max(
        lower,
        link.offsetTop + link.clientHeight - parseFloat(styles.paddingBottom)
      );
    }

    if (upper === Number.MAX_VALUE) {
      thumbTop = 0;
      thumbHeight = 0;
    } else {
      thumbTop = upper;
      thumbHeight = lower - upper;
    }
  }

  onMount(() => {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            activeId = entry.target.id;
            activeIds = [entry.target.id];
          }
        }
        tick().then(updateThumb);
      },
      { rootMargin: "-80px 0px -80% 0px" }
    );

    observeHeadings();
  });

  $effect(() => {
    void items;
    observeHeadings();
    tick().then(updateThumb);
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

<div class="fd-toc-inner" class:fd-toc-directional={isDirectional}>
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
    <div class="fd-toc-thumb-container">
      {#if isDirectional}
        <div
          class="fd-toc-thumb"
          style="--fd-top: {thumbTop}px; --fd-height: {thumbHeight}px;"
        ></div>
      {/if}
      <ul class="fd-toc-list" bind:this={tocListEl}>
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
    </div>
  {/if}
</div>
