<script>
  import { onMount, onDestroy, tick } from "svelte";

  const ACTIVE_ZONE_TOP = 120;
  const HYSTERESIS_PX = 65;

  let { items = [], tocStyle = "default" } = $props();
  let activeIds = $state(new Set());
  let listEl = $state(null);
  let lastStableId = null;
  let scrollRafId = 0;

  let svgPath = $state("");
  let svgWidth = $state(0);
  let svgHeight = $state(0);
  let thumbTop = $state(0);
  let thumbHeight = $state(0);

  const isDirectional = $derived(tocStyle === "directional");

  function getDistanceToZone(id) {
    const el = document.getElementById(id);
    if (!el) return Infinity;
    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    return Math.abs(mid - ACTIVE_ZONE_TOP);
  }

  function getClosestId() {
    const ids = items.map((item) => item.url.slice(1));
    let bestId = null;
    let bestDistance = Infinity;
    for (const id of ids) {
      const d = getDistanceToZone(id);
      if (d < bestDistance) {
        bestDistance = d;
        bestId = id;
      }
    }
    return bestId;
  }

  function isInView(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  }

  function updateActiveFromScroll() {
    scrollRafId = 0;
    const newId = getClosestId();
    if (!newId) {
      activeIds = new Set();
      return;
    }
    if (lastStableId === null) {
      lastStableId = newId;
      activeIds = new Set([newId]);
      return;
    }
    if (newId === lastStableId) {
      activeIds = new Set([newId]);
      return;
    }
    const newDist = getDistanceToZone(newId);
    const currentDist = getDistanceToZone(lastStableId);
    const switchToNew = newDist <= currentDist - HYSTERESIS_PX || !isInView(lastStableId);
    if (switchToNew) lastStableId = newId;
    activeIds = new Set([lastStableId]);
  }

  function scheduleActiveUpdate() {
    if (scrollRafId !== 0) return;
    scrollRafId = requestAnimationFrame(updateActiveFromScroll);
  }

  function getItemOffset(depth) {
    if (depth <= 2) return 14;
    if (depth === 3) return 26;
    return 36;
  }

  function getLineOffset(depth) {
    return depth >= 3 ? 10 : 0;
  }

  function buildSvgPath() {
    if (!listEl) return;
    const links = listEl.querySelectorAll(".fd-toc-clerk-link");
    if (links.length === 0) { svgPath = ""; return; }

    let d = [];
    let w = 0, h = 0;

    links.forEach((el, i) => {
      if (i >= items.length) return;
      const depth = items[i].depth;
      const x = getLineOffset(depth) + 1;
      const styles = getComputedStyle(el);
      const top = el.offsetTop + parseFloat(styles.paddingTop);
      const bottom = el.offsetTop + el.clientHeight - parseFloat(styles.paddingBottom);
      w = Math.max(x, w);
      h = Math.max(h, bottom);
      d.push(`${i === 0 ? "M" : "L"}${x} ${top}`);
      d.push(`L${x} ${bottom}`);
    });

    svgPath = d.join(" ");
    svgWidth = w + 1;
    svgHeight = h;
  }

  function calcThumb() {
    if (!listEl || activeIds.size === 0) {
      thumbTop = 0;
      thumbHeight = 0;
      return;
    }

    let upper = Infinity, lower = 0;
    for (const id of activeIds) {
      const el = listEl.querySelector(`a[href="#${id}"]`);
      if (!el) continue;
      const styles = getComputedStyle(el);
      upper = Math.min(upper, el.offsetTop + parseFloat(styles.paddingTop));
      lower = Math.max(lower, el.offsetTop + el.clientHeight - parseFloat(styles.paddingBottom));
    }

    if (upper === Infinity) {
      thumbTop = 0;
      thumbHeight = 0;
      return;
    }

    thumbTop = upper;
    thumbHeight = lower - upper;
  }

  function maskSvgUrl() {
    if (!svgPath) return "none";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}"><path d="${svgPath}" stroke="black" stroke-width="1" fill="none"/></svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  }

  function isActive(item) {
    return activeIds.has(item.url.slice(1));
  }

  function hasDiagonal(index) {
    if (index === 0) return false;
    return items[index - 1].depth !== items[index].depth;
  }

  function getDiagonalCoords(index) {
    const upperOffset = getLineOffset(items[index - 1].depth);
    const currentOffset = getLineOffset(items[index].depth);
    return { upperOffset, currentOffset };
  }

  function verticalLineStyle(item, index) {
    const prevDepth = index > 0 ? items[index - 1].depth : item.depth;
    const nextDepth = index < items.length - 1 ? items[index + 1].depth : item.depth;
    return {
      position: "absolute",
      left: `${getLineOffset(item.depth)}px`,
      top: prevDepth !== item.depth ? "6px" : "0",
      bottom: nextDepth !== item.depth ? "6px" : "0",
      width: "1px",
      background: "hsla(0, 0%, 50%, 0.1)",
    };
  }

  function styleObj(obj) {
    return Object.entries(obj).map(([k, v]) => `${k}:${v}`).join(";");
  }

  onMount(() => {
    const onScroll = () => scheduleActiveUpdate();
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    document.addEventListener("scroll", onScroll, { passive: true, capture: true });

    tick().then(() => {
      const id = getClosestId();
      if (id) {
        lastStableId = id;
        activeIds = new Set([id]);
      }
      if (isDirectional) {
        buildSvgPath();
        calcThumb();
      }
    });

    return () => {
      window.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("scroll", onScroll, { capture: true });
      if (scrollRafId) cancelAnimationFrame(scrollRafId);
    };
  });

  $effect(() => {
    void items;
    if (isDirectional && listEl) {
      tick().then(() => {
        buildSvgPath();
        calcThumb();
      });
    }
  });

  $effect(() => {
    void activeIds;
    if (isDirectional) {
      calcThumb();
    }
  });

  onDestroy(() => {});
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
  {:else if !isDirectional}
    <ul class="fd-toc-list">
      {#each items as item}
        <li class="fd-toc-item">
          <a
            href={item.url}
            class="fd-toc-link"
            class:fd-toc-link-active={isActive(item)}
            style:padding-left="{12 + (item.depth - 2) * 12}px"
          >
            {item.title}
          </a>
        </li>
      {/each}
    </ul>
  {:else}
    <ul class="fd-toc-list fd-toc-clerk" style="position:relative;" bind:this={listEl}>
      {#each items as item, index}
        <li class="fd-toc-item">
          <a
            href={item.url}
            class="fd-toc-link fd-toc-clerk-link"
            data-active={isActive(item) ? "true" : undefined}
            style="position:relative; padding-left:{getItemOffset(item.depth)}px; padding-top:6px; padding-bottom:6px; font-size:{item.depth <= 2 ? '14' : '13'}px; overflow-wrap:anywhere;"
          >
            <div style={styleObj(verticalLineStyle(item, index))}></div>

            {#if hasDiagonal(index)}
              {@const d = getDiagonalCoords(index)}
              <svg viewBox="0 0 16 16" width="16" height="16" style="position:absolute; top:-6px; left:0;">
                <line x1={d.upperOffset} y1="0" x2={d.currentOffset} y2="12" stroke="hsla(0, 0%, 50%, 0.1)" stroke-width="1" />
              </svg>
            {/if}

            {item.title}
          </a>
        </li>
      {/each}

      {#if svgPath}
        <div
          class="fd-toc-clerk-mask"
          style="position:absolute; left:0; top:0; width:{svgWidth}px; height:{svgHeight}px; pointer-events:none; mask-image:{maskSvgUrl()}; -webkit-mask-image:{maskSvgUrl()}; mask-repeat:no-repeat; -webkit-mask-repeat:no-repeat;"
        >
          <div
            class="fd-toc-clerk-thumb"
            style="margin-top:{thumbTop}px; height:{thumbHeight}px; background:var(--color-fd-primary); transition:all 0.15s; will-change:height,margin-top;"
          ></div>
        </div>
      {/if}
    </ul>
  {/if}
</div>
