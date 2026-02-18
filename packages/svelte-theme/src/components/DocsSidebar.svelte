<script>
  /**
   * DocsSidebar — Standalone sidebar navigation component.
   * Use this if you want more control over the layout.
   */
  import { page } from "$app/stores";

  let { tree, onnavigate } = $props();

  $effect(() => {
    // Auto-highlight current page in sidebar
  });
</script>

<nav class="fd-sidebar-nav">
  {#if tree?.children}
    {#each tree.children as node}
      {#if node.type === "page"}
        <a
          href={node.url}
          class="fd-sidebar-link"
          class:fd-sidebar-link-active={$page.url.pathname === node.url}
          onclick={onnavigate}
        >
          {node.name}
        </a>
      {:else if node.type === "folder"}
        <details class="fd-sidebar-folder" open>
          <summary class="fd-sidebar-folder-trigger">
            {node.name}
            <svg class="fd-sidebar-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </summary>
          <div class="fd-sidebar-folder-content">
            {#if node.index}
              <a
                href={node.index.url}
                class="fd-sidebar-link"
                class:fd-sidebar-link-active={$page.url.pathname === node.index.url}
                onclick={onnavigate}
              >
                {node.index.name}
              </a>
            {/if}
            {#each node.children as child}
              {#if child.type === "page"}
                <a
                  href={child.url}
                  class="fd-sidebar-link"
                  class:fd-sidebar-link-active={$page.url.pathname === child.url}
                  onclick={onnavigate}
                >
                  {child.name}
                </a>
              {/if}
            {/each}
          </div>
        </details>
      {/if}
    {/each}
  {/if}
</nav>
