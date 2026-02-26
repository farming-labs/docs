<script>
  import DocsPage from "./DocsPage.svelte";
  import { onMount, onDestroy } from "svelte";

  const DEFAULT_OPEN_PROVIDERS = [
    { name: "ChatGPT", urlTemplate: "https://chatgpt.com/?hints=search&q=Read+{mdxUrl},+I+want+to+ask+questions+about+it." },
    { name: "Claude", urlTemplate: "https://claude.ai/new?q=Read+{mdxUrl},+I+want+to+ask+questions+about+it." },
  ];

  let { data, config = null } = $props();

  let openDropdownMenu = $state(false);
  let copyLabel = $state("Copy page");
  let copied = $state(false);

  let titleSuffix = $derived(
    config?.metadata?.titleTemplate
      ? config.metadata.titleTemplate.replace("%s", "")
      : " – Docs"
  );

  let tocEnabled = $derived(
    config?.theme?.ui?.layout?.toc?.enabled ?? true
  );

  let tocStyle = $derived(
    (config?.theme?.ui?.layout?.toc?.style === "directional") ? "directional" : "default"
  );

  let breadcrumbEnabled = $derived.by(() => {
    const bc = config?.breadcrumb;
    if (bc === undefined || bc === true) return true;
    if (bc === false) return false;
    if (typeof bc === "object") return bc.enabled !== false;
    return true;
  });

  let showEditOnGithub = $derived(
    !!config?.github && !!data.editOnGithub
  );

  let showLastModified = $derived(!!data.lastModified);

  let llmsTxtEnabled = $derived.by(() => {
    const cfg = config?.llmsTxt;
    if (cfg === true) return true;
    if (typeof cfg === "object" && cfg !== null) return cfg.enabled !== false;
    return false;
  });

  let copyMarkdownEnabled = $derived.by(() => {
    const pa = config?.pageActions;
    if (!pa) return false;
    const cm = pa.copyMarkdown;
    if (cm === true) return true;
    if (typeof cm === "object" && cm !== null) return cm.enabled !== false;
    return false;
  });

  let openDocsEnabled = $derived.by(() => {
    const pa = config?.pageActions;
    if (!pa) return false;
    const od = pa.openDocs;
    if (od === true) return true;
    if (typeof od === "object" && od !== null) return od.enabled !== false;
    return false;
  });

  let openDocsProviders = $derived.by(() => {
    const pa = config?.pageActions;
    const od = pa && typeof pa === "object" && pa.openDocs != null ? pa.openDocs : null;
    const list = od && typeof od === "object" && "providers" in od ? od.providers : undefined;
    if (Array.isArray(list) && list.length > 0) {
      const mapped = list
        .map((p) => ({
          name: typeof p?.name === "string" ? p.name : "Open",
          urlTemplate: typeof p?.urlTemplate === "string" ? p.urlTemplate : "",
        }))
        .filter((p) => p.urlTemplate.length > 0);
      if (mapped.length > 0) return mapped;
    }
    return DEFAULT_OPEN_PROVIDERS;
  });

  let pageActionsPosition = $derived(
    typeof config?.pageActions === "object" && config?.pageActions !== null && config?.pageActions.position
      ? config.pageActions.position
      : "below-title"
  );

  let pageActionsAlignment = $derived(
    typeof config?.pageActions === "object" && config?.pageActions !== null && config?.pageActions.alignment
      ? config.pageActions.alignment
      : "left"
  );

  let lastUpdatedConfig = $derived.by(() => {
    const lu = config?.lastUpdated;
    if (lu === false) return { enabled: false, position: "footer" };
    if (lu === true || lu === undefined) return { enabled: true, position: "footer" };
    const o = lu;
    return {
      enabled: o.enabled !== false,
      position: o.position ?? "footer",
    };
  });

  let showLastUpdatedInFooter = $derived(
    !!data.lastModified && lastUpdatedConfig.enabled && lastUpdatedConfig.position === "footer"
  );
  let showLastUpdatedBelowTitle = $derived(
    !!data.lastModified && lastUpdatedConfig.enabled && lastUpdatedConfig.position === "below-title"
  );

  let htmlWithoutFirstH1 = $derived(
    (data.html || "").replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "")
  );

  let showPageActions = $derived(
    (copyMarkdownEnabled || openDocsEnabled) && openDocsProviders.length >= 0
  );
  let showActionsAbove = $derived(pageActionsPosition === "above-title" && showPageActions);
  let showActionsBelow = $derived(pageActionsPosition === "below-title" && showPageActions);

  function handleCopyPage() {
    let text = "";
    if (data.rawMarkdown && typeof data.rawMarkdown === "string" && data.rawMarkdown.length > 0) {
      text = data.rawMarkdown;
    } else {
      const article = document.querySelector("#nd-page");
      if (article) text = article.innerText || "";
    }
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => {
        copyLabel = "Copied!";
        copied = true;
        setTimeout(() => {
          copyLabel = "Copy page";
          copied = false;
        }, 2000);
      },
      () => {
        copyLabel = "Copy failed";
        setTimeout(() => { copyLabel = "Copy page"; }, 2000);
      }
    );
  }

  function toggleDropdown() {
    openDropdownMenu = !openDropdownMenu;
  }

  function closeDropdown() {
    openDropdownMenu = false;
  }

  function openInProvider(provider) {
    const pathname = typeof window !== "undefined" ? window.location.pathname : "";
    const pageUrl = typeof window !== "undefined" ? window.location.href : "";
    const mdxUrl = typeof window !== "undefined"
      ? window.location.origin + pathname + (pathname.endsWith("/") ? "page.mdx" : ".mdx")
      : "";
    const githubUrl = data.editOnGithub || "";
    const url = provider.urlTemplate
      .replace(/\{url\}/g, encodeURIComponent(pageUrl))
      .replace(/\{mdxUrl\}/g, encodeURIComponent(mdxUrl))
      .replace(/\{githubUrl\}/g, githubUrl);
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
    closeDropdown();
  }

  function handleClickOutside(e) {
    const target = e.target;
    if (openDropdownMenu && !target?.closest?.(".fd-page-action-dropdown")) {
      closeDropdown();
    }
  }

  onMount(() => {
    if (typeof document !== "undefined") {
      document.addEventListener("click", handleClickOutside);
    }
  });
  onDestroy(() => {
    if (typeof document !== "undefined") {
      document.removeEventListener("click", handleClickOutside);
    }
  });
</script>

<svelte:head>
  <title>{data.title}{titleSuffix}</title>
  {#if data.description}
    <meta name="description" content={data.description} />
  {/if}
</svelte:head>

<DocsPage
  entry={config?.entry ?? "docs"}
  {tocEnabled}
  {tocStyle}
  {breadcrumbEnabled}
  previousPage={data.previousPage}
  nextPage={data.nextPage}
  editOnGithub={showEditOnGithub ? data.editOnGithub : null}
  lastModified={showLastUpdatedInFooter ? data.lastModified : null}
  {llmsTxtEnabled}
>
  {#snippet children()}
    <div class="fd-docs-content">
      {#if showActionsAbove}
        <div
          class="fd-page-actions"
          data-page-actions
          data-actions-alignment={pageActionsAlignment}
        >
          {#if copyMarkdownEnabled}
            <button
              type="button"
              class="fd-page-action-btn"
              aria-label="Copy page content"
              data-copied={copied}
              onclick={handleCopyPage}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copyLabel}</span>
            </button>
          {/if}
          {#if openDocsEnabled && openDocsProviders.length > 0}
            <div class="fd-page-action-dropdown">
              <button
                type="button"
                class="fd-page-action-btn"
                aria-expanded={openDropdownMenu}
                aria-haspopup="true"
                onclick={toggleDropdown}
              >
                <span>Open in</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div
                class="fd-page-action-menu"
                role="menu"
                hidden={!openDropdownMenu}
              >
                {#each openDocsProviders as provider}
                  <button
                    type="button"
                    role="menuitem"
                    class="fd-page-action-menu-item"
                    onclick={() => openInProvider(provider)}
                  >
                    <span class="fd-page-action-menu-label">Open in {provider.name}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <h1 class="fd-page-title">{data.title}</h1>
      {#if data.description}
        <p class="fd-page-description">{data.description}</p>
      {/if}
      {#if showLastUpdatedBelowTitle && data.lastModified}
        <p class="fd-last-modified fd-last-modified-below-title">
          Last updated: {data.lastModified}
        </p>
      {/if}

      {#if showActionsBelow}
        <hr class="fd-page-actions-divider" aria-hidden="true" />
        <div
          class="fd-page-actions"
          data-page-actions
          data-actions-alignment={pageActionsAlignment}
        >
          {#if copyMarkdownEnabled}
            <button
              type="button"
              class="fd-page-action-btn"
              aria-label="Copy page content"
              data-copied={copied}
              onclick={handleCopyPage}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copyLabel}</span>
            </button>
          {/if}
          {#if openDocsEnabled && openDocsProviders.length > 0}
            <div class="fd-page-action-dropdown">
              <button
                type="button"
                class="fd-page-action-btn"
                aria-expanded={openDropdownMenu}
                aria-haspopup="true"
                onclick={toggleDropdown}
              >
                <span>Open in</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              <div
                class="fd-page-action-menu"
                role="menu"
                hidden={!openDropdownMenu}
              >
                {#each openDocsProviders as provider}
                  <button
                    type="button"
                    role="menuitem"
                    class="fd-page-action-menu-item"
                    onclick={() => openInProvider(provider)}
                  >
                    <span class="fd-page-action-menu-label">Open in {provider.name}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      {@html htmlWithoutFirstH1}
    </div>
  {/snippet}
</DocsPage>
