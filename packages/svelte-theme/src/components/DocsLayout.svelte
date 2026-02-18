<script>
  import ThemeToggle from "./ThemeToggle.svelte";
  import SearchDialog from "./SearchDialog.svelte";
  import { page } from "$app/stores";

  let {
    tree,
    title = "Docs",
    titleUrl = "/docs",
    themeToggle = true,
    children,
  } = $props();

  let sidebarOpen = $state(false);
  let searchOpen = $state(false);

  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }

  function closeSidebar() {
    sidebarOpen = false;
  }

  function openSearch() {
    searchOpen = true;
  }

  function closeSearch() {
    searchOpen = false;
  }

  function handleKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      searchOpen = !searchOpen;
    }
    if (e.key === "Escape") {
      searchOpen = false;
      sidebarOpen = false;
    }
  }

  function isActive(url) {
    const current = $page.url.pathname;
    const normalised = url.replace(/\/$/, '') || '/';
    const currentNorm = current.replace(/\/$/, '') || '/';
    return normalised === currentNorm;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="fd-layout">
  <!-- Mobile header -->
  <header class="fd-header">
    <button class="fd-menu-btn" onclick={toggleSidebar} aria-label="Toggle sidebar">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
    <a href={titleUrl} class="fd-header-title">{title}</a>
    <button class="fd-search-trigger-mobile" onclick={openSearch} aria-label="Search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    </button>
  </header>

  {#if sidebarOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="fd-sidebar-overlay" onclick={closeSidebar} role="presentation"></div>
  {/if}

  <aside class="fd-sidebar" class:fd-sidebar-open={sidebarOpen}>
    <div class="fd-sidebar-header">
      <a href={titleUrl} class="fd-sidebar-title" onclick={closeSidebar}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        {title}
      </a>
    </div>

    <div class="fd-sidebar-search">
      <button class="fd-sidebar-search-btn" onclick={openSearch}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>Search</span>
        <kbd>&#8984;</kbd><kbd>K</kbd>
      </button>
    </div>

    <nav class="fd-sidebar-nav">
      {#if tree?.children}
        {#each tree.children as node}
          {#if node.type === "page"}
            <a
              href={node.url}
              class="fd-sidebar-link"
              class:fd-sidebar-link-active={isActive(node.url)}
              data-active={isActive(node.url)}
              onclick={closeSidebar}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              {node.name}
            </a>
          {:else if node.type === "folder"}
            <details class="fd-sidebar-folder" open>
              <summary class="fd-sidebar-folder-trigger">
                <span class="fd-sidebar-folder-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  {node.name}
                </span>
                <svg class="fd-sidebar-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </summary>
              <div class="fd-sidebar-folder-content">
                {#if node.index}
                  <a
                    href={node.index.url}
                    class="fd-sidebar-link"
                    class:fd-sidebar-link-active={isActive(node.index.url)}
                    data-active={isActive(node.index.url)}
                    onclick={closeSidebar}
                  >
                    {node.index.name}
                  </a>
                {/if}
                {#each node.children as child}
                  {#if child.type === "page"}
                    <a
                      href={child.url}
                      class="fd-sidebar-link"
                      class:fd-sidebar-link-active={isActive(child.url)}
                      data-active={isActive(child.url)}
                      onclick={closeSidebar}
                    >
                      {child.name}
                    </a>
                  {:else if child.type === "folder"}
                    <details class="fd-sidebar-folder" open>
                      <summary class="fd-sidebar-folder-trigger">
                        <span class="fd-sidebar-folder-label">
                          {child.name}
                        </span>
                        <svg class="fd-sidebar-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </summary>
                      <div class="fd-sidebar-folder-content">
                        {#if child.index}
                          <a
                            href={child.index.url}
                            class="fd-sidebar-link"
                            class:fd-sidebar-link-active={isActive(child.index.url)}
                            data-active={isActive(child.index.url)}
                            onclick={closeSidebar}
                          >
                            {child.index.name}
                          </a>
                        {/if}
                        {#each child.children as grandchild}
                          {#if grandchild.type === "page"}
                            <a
                              href={grandchild.url}
                              class="fd-sidebar-link"
                              class:fd-sidebar-link-active={isActive(grandchild.url)}
                              data-active={isActive(grandchild.url)}
                              onclick={closeSidebar}
                            >
                              {grandchild.name}
                            </a>
                          {/if}
                        {/each}
                      </div>
                    </details>
                  {/if}
                {/each}
              </div>
            </details>
          {/if}
        {/each}
      {/if}
    </nav>

    {#if themeToggle}
      <div class="fd-sidebar-footer">
        <ThemeToggle />
      </div>
    {/if}
  </aside>

  <main class="fd-main">
    {@render children()}
  </main>
</div>

{#if searchOpen}
  <SearchDialog onclose={closeSearch} />
{/if}
