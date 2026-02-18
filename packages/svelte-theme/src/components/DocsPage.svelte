<script>
  import Breadcrumb from "./Breadcrumb.svelte";
  import TableOfContents from "./TableOfContents.svelte";
  import { page } from "$app/stores";
  import { onMount } from "svelte";

  let {
    tocEnabled = true,
    breadcrumbEnabled = true,
    entry = "docs",
    previousPage = null,
    nextPage = null,
    editOnGithub = null,
    lastModified = null,
    children,
  } = $props();

  let tocItems = $state([]);

  onMount(() => {
    scanHeadings();
    wireInteractive();
  });

  $effect(() => {
    void $page.url.pathname;
    scanHeadings();
    wireInteractive();
  });

  function scanHeadings() {
    requestAnimationFrame(() => {
      const container = document.querySelector(".fd-page-body");
      if (!container) return;

      const headings = container.querySelectorAll("h2[id], h3[id], h4[id]");
      tocItems = Array.from(headings).map((el) => ({
        title: el.textContent?.replace(/^#\s*/, "") || "",
        url: `#${el.id}`,
        depth: parseInt(el.tagName[1], 10),
      }));
    });
  }

  function wireInteractive() {
    requestAnimationFrame(() => {
      // Copy buttons
      document.querySelectorAll(".fd-copy-btn").forEach((btn) => {
        btn.onclick = () => {
          const code = btn.getAttribute("data-code")
            ?.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
          if (!code) return;
          navigator.clipboard.writeText(code).then(() => {
            btn.classList.add("fd-copy-btn-copied");
            btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
            setTimeout(() => {
              btn.classList.remove("fd-copy-btn-copied");
              btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
            }, 2000);
          });
        };
      });

      // Tabs
      document.querySelectorAll("[data-tabs]").forEach((tabs) => {
        tabs.querySelectorAll(".fd-tab-trigger").forEach((trigger) => {
          trigger.onclick = () => {
            const val = trigger.getAttribute("data-tab-value");
            tabs.querySelectorAll(".fd-tab-trigger").forEach((t) => {
              t.classList.toggle("fd-tab-active", t.getAttribute("data-tab-value") === val);
              t.setAttribute("aria-selected", String(t.getAttribute("data-tab-value") === val));
            });
            tabs.querySelectorAll(".fd-tab-panel").forEach((p) => {
              p.classList.toggle("fd-tab-panel-active", p.getAttribute("data-tab-panel") === val);
            });
          };
        });
      });
    });
  }
</script>

<div class="fd-page">
  <article class="fd-page-article" id="nd-page">
    {#if breadcrumbEnabled}
      <Breadcrumb pathname={$page.url.pathname} {entry} />
    {/if}

    <div class="fd-page-body">
      {@render children()}
    </div>

    {#if editOnGithub}
      <div class="fd-edit-on-github">
        <a href={editOnGithub} target="_blank" rel="noopener noreferrer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit on GitHub
        </a>
        {#if lastModified}
          <span class="fd-last-modified">Last updated: {lastModified}</span>
        {/if}
      </div>
    {/if}

    {#if previousPage || nextPage}
      <nav class="fd-page-nav" aria-label="Page navigation">
        {#if previousPage}
          <a href={previousPage.url} class="fd-page-nav-card fd-page-nav-prev">
            <span class="fd-page-nav-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Previous
            </span>
            <span class="fd-page-nav-title">{previousPage.name}</span>
          </a>
        {:else}
          <div></div>
        {/if}
        {#if nextPage}
          <a href={nextPage.url} class="fd-page-nav-card fd-page-nav-next">
            <span class="fd-page-nav-label">
              Next
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
            <span class="fd-page-nav-title">{nextPage.name}</span>
          </a>
        {:else}
          <div></div>
        {/if}
      </nav>
    {/if}
  </article>

  {#if tocEnabled}
    <aside class="fd-toc">
      <TableOfContents items={tocItems} />
    </aside>
  {/if}
</div>
