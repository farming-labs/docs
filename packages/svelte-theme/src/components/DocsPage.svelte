<script>
  import Breadcrumb from "./Breadcrumb.svelte";
  import TableOfContents from "./TableOfContents.svelte";
  import { page } from "$app/stores";
  import { onMount } from "svelte";

  let {
    tocEnabled = true,
    tocStyle = "default",
    breadcrumbEnabled = true,
    entry = "docs",
    locale = null,
    previousPage = null,
    nextPage = null,
    editOnGithub = null,
    lastModified = null,
    llmsTxtEnabled = false,
    children,
  } = $props();

  let tocItems = $state([]);
  let llmsLangParam = $derived(locale ? `&lang=${encodeURIComponent(locale)}` : "");
  let localizedPreviousPage = $derived.by(() => localizePage(previousPage, locale));
  let localizedNextPage = $derived.by(() => localizePage(nextPage, locale));

  function withLang(url, activeLocale) {
    if (!url || url.startsWith("#")) return url;
    try {
      const parsed = new URL(url, "https://farming-labs.local");
      if (activeLocale) parsed.searchParams.set("lang", activeLocale);
      else parsed.searchParams.delete("lang");
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return url;
    }
  }

  function localizePage(page, activeLocale) {
    if (!page?.url) return page;
    return { ...page, url: withLang(page.url, activeLocale) };
  }

  function setHoverLinkOpen(root, open) {
    if (!(root instanceof HTMLElement)) return;
    const trigger = root.querySelector(".fd-hover-link-trigger");
    const popover = root.querySelector(".fd-hover-link-popover");
    if (!(trigger instanceof HTMLElement) || !(popover instanceof HTMLElement)) return;

    root.classList.toggle("fd-hover-link-open", open);
    trigger.setAttribute("aria-expanded", String(open));
    popover.setAttribute("aria-hidden", String(!open));
  }

  function closeOpenHoverLinks(event) {
    document.querySelectorAll("[data-hover-link].fd-hover-link-open").forEach((root) => {
      if (!(root instanceof HTMLElement)) return;
      if (event.target instanceof Node && root.contains(event.target)) return;
      setHoverLinkOpen(root, false);
    });
  }

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
          const block = btn.closest(".fd-codeblock");
          const title = block?.querySelector(".fd-codeblock-title-text")?.textContent?.trim() ?? undefined;
          const language = block?.getAttribute("data-language") ?? undefined;
          const url = typeof window !== "undefined" ? window.location.href : "";
          const data = { title, content: code, url, language };
          navigator.clipboard.writeText(code).then(() => {
            try {
              if (typeof window !== "undefined" && window.__fdOnCopyClick__) window.__fdOnCopyClick__(data);
              if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fd:code-block-copy", { detail: data }));
            } catch (_) {}
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

      document.querySelectorAll(".fd-page-body a[href]").forEach((link) => {
        const href = link.getAttribute("href");
        if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(href)) return;
        const localized = withLang(href, locale);
        if (localized) link.setAttribute("href", localized);
      });

      document.querySelectorAll("[data-hover-link]").forEach((root) => {
        if (!(root instanceof HTMLElement)) return;
        if (root.dataset.fdHoverLinkBound === "true") return;
        root.dataset.fdHoverLinkBound = "true";

        const trigger = root.querySelector(".fd-hover-link-trigger");
        const popover = root.querySelector(".fd-hover-link-popover");
        if (!(trigger instanceof HTMLElement) || !(popover instanceof HTMLElement)) return;

        let closeTimer = 0;
        const setOpen = (open) => {
          if (closeTimer !== 0) {
            window.clearTimeout(closeTimer);
            closeTimer = 0;
          }
          setHoverLinkOpen(root, open);
        };

        const containsTarget = (target) => target instanceof Node && root.contains(target);
        const closeSoon = () => {
          if (closeTimer !== 0) window.clearTimeout(closeTimer);
          closeTimer = window.setTimeout(() => setOpen(false), 90);
        };

        trigger.addEventListener("pointerenter", () => setOpen(true));
        trigger.addEventListener("pointerleave", (event) => {
          if (containsTarget(event.relatedTarget)) return;
          closeSoon();
        });
        trigger.addEventListener("focus", (event) => {
          if (!(event.currentTarget instanceof HTMLElement)) return;
          if (typeof event.currentTarget.matches === "function" && !event.currentTarget.matches(":focus-visible")) {
            return;
          }
          setOpen(true);
        });
        trigger.addEventListener("blur", (event) => {
          if (containsTarget(event.relatedTarget)) return;
          closeSoon();
        });
        trigger.addEventListener("click", (event) => {
          event.preventDefault();
          setOpen(true);
        });

        popover.addEventListener("pointerenter", () => setOpen(true));
        popover.addEventListener("pointerleave", (event) => {
          if (containsTarget(event.relatedTarget)) return;
          closeSoon();
        });
        popover.addEventListener("focusin", () => setOpen(true));
        popover.addEventListener("focusout", (event) => {
          if (containsTarget(event.relatedTarget)) return;
          closeSoon();
        });

        root.addEventListener("keydown", (event) => {
          if (event.key !== "Escape") return;
          setOpen(false);
        });
      });

      if (document.documentElement.dataset.fdHoverLinkGlobalBound !== "true") {
        document.documentElement.dataset.fdHoverLinkGlobalBound = "true";

        document.addEventListener("pointerdown", closeOpenHoverLinks);
        document.addEventListener("focusin", closeOpenHoverLinks);
      }
    });
  }
</script>

<div class="fd-page">
  <article class="fd-page-article" id="nd-page">
    {#if breadcrumbEnabled}
      <Breadcrumb pathname={$page.url.pathname} {entry} {locale} />
    {/if}

    <div class="fd-page-body">
      {@render children()}
    </div>

    <footer class="fd-page-footer">
      {#if editOnGithub || lastModified || llmsTxtEnabled}
        <div class="fd-edit-on-github">
          {#if editOnGithub}
            <a href={editOnGithub} target="_blank" rel="noopener noreferrer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit on GitHub
            </a>
          {/if}
          {#if llmsTxtEnabled}
            <span class="fd-llms-txt-links">
              <a href={`/api/docs?format=llms${llmsLangParam}`} target="_blank" rel="noopener noreferrer" class="fd-llms-txt-link">llms.txt</a>
              <a href={`/api/docs?format=llms-full${llmsLangParam}`} target="_blank" rel="noopener noreferrer" class="fd-llms-txt-link">llms-full.txt</a>
            </span>
          {/if}
          {#if lastModified}
            <span class="fd-last-modified">Last updated: {lastModified}</span>
          {/if}
        </div>
      {/if}

      {#if previousPage || nextPage}
        <nav class="fd-page-nav" aria-label="Page navigation">
          {#if localizedPreviousPage}
            <a href={localizedPreviousPage.url} class="fd-page-nav-card fd-page-nav-prev">
              <span class="fd-page-nav-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Previous
              </span>
              <span class="fd-page-nav-title">{localizedPreviousPage.name}</span>
            </a>
          {:else}
            <div></div>
          {/if}
          {#if localizedNextPage}
            <a href={localizedNextPage.url} class="fd-page-nav-card fd-page-nav-next">
              <span class="fd-page-nav-label">
                Next
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </span>
              <span class="fd-page-nav-title">{localizedNextPage.name}</span>
            </a>
          {:else}
            <div></div>
          {/if}
        </nav>
      {/if}
    </footer>
  </article>

  {#if tocEnabled}
    <aside class="fd-toc">
      <TableOfContents items={tocItems} {tocStyle} />
    </aside>
  {/if}
</div>
