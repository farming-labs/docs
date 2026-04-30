<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRoute } from "vue-router";
import Breadcrumb from "./Breadcrumb.vue";
import TableOfContents from "./TableOfContents.vue";

const props = withDefaults(
  defineProps<{
    tocEnabled?: boolean;
    tocStyle?: "default" | "directional";
    breadcrumbEnabled?: boolean;
    entry?: string;
    locale?: string;
    previousPage?: { name: string; url: string } | null;
    nextPage?: { name: string; url: string } | null;
    editOnGithub?: string | null;
    lastModified?: string | null;
    llmsTxtEnabled?: boolean;
  }>(),
  {
    tocEnabled: true,
    tocStyle: "default",
    breadcrumbEnabled: true,
    entry: "docs",
    locale: undefined,
    previousPage: null,
    nextPage: null,
    editOnGithub: null,
    lastModified: null,
    llmsTxtEnabled: false,
  },
);

const route = useRoute();
const tocItems = ref<{ title: string; url: string; depth: number }[]>([]);
const llmsLangParam = computed(() =>
  props.locale ? `&lang=${encodeURIComponent(props.locale)}` : "",
);
const localizedPreviousPage = computed(() => localizePage(props.previousPage));
const localizedNextPage = computed(() => localizePage(props.nextPage));

function withLang(url?: string) {
  if (!url || url.startsWith("#")) return url;
  try {
    const parsed = new URL(url, "https://farming-labs.local");
    const locale = props.locale ?? (route.query.lang as string | undefined);
    if (locale) parsed.searchParams.set("lang", locale);
    else parsed.searchParams.delete("lang");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

function localizePage(page?: { name: string; url: string } | null) {
  if (!page?.url) return page;
  return { ...page, url: withLang(page.url)! };
}

function scanHeadings() {
  requestAnimationFrame(() => {
    const container = document.querySelector(".fd-page-body");
    if (!container) return;
    const headings = container.querySelectorAll("h2[id], h3[id], h4[id]");
    tocItems.value = Array.from(headings).map((el) => ({
      title: (el.textContent ?? "").replace(/^#\s*/, ""),
      url: `#${el.id}`,
      depth: parseInt(el.tagName[1], 10),
    }));
  });
}

function setHoverLinkOpen(root: HTMLElement, open: boolean) {
  const trigger = root.querySelector(".fd-hover-link-trigger");
  const popover = root.querySelector(".fd-hover-link-popover");
  if (!(trigger instanceof HTMLElement) || !(popover instanceof HTMLElement)) return;

  root.classList.toggle("fd-hover-link-open", open);
  trigger.setAttribute("aria-expanded", String(open));
  popover.setAttribute("aria-hidden", String(!open));
}

function closeOpenHoverLinks(event: Event) {
  document.querySelectorAll("[data-hover-link].fd-hover-link-open").forEach((root) => {
    if (!(root instanceof HTMLElement)) return;
    if (event.target instanceof Node && root.contains(event.target)) return;
    setHoverLinkOpen(root, false);
  });
}

async function fallbackCopyPromptText(text: string): Promise<boolean> {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

function setPromptMenuOpen(root: HTMLElement, open: boolean) {
  const trigger = root.querySelector("[data-prompt-trigger]");
  const menu = root.querySelector("[data-prompt-menu]");
  if (!(trigger instanceof HTMLElement) || !(menu instanceof HTMLElement)) return;

  trigger.setAttribute("aria-expanded", String(open));
  menu.hidden = !open;
}

function closeOpenPromptMenus(event: Event) {
  document.querySelectorAll("[data-prompt-dropdown]").forEach((root) => {
    if (!(root instanceof HTMLElement)) return;
    if (event.target instanceof Node && root.contains(event.target)) return;
    setPromptMenuOpen(root, false);
  });
}

function wireInteractive() {
  requestAnimationFrame(() => {
    document.querySelectorAll(".fd-copy-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const code = btn
          .getAttribute("data-code")
          ?.replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"');
        if (!code) return;
        const block = btn.closest(".fd-codeblock");
        const title = block?.querySelector(".fd-codeblock-title-text")?.textContent?.trim() ?? undefined;
        const language = block?.getAttribute("data-language") ?? undefined;
        const url = typeof window !== "undefined" ? window.location.href : "";
        const data = { title, content: code, url, language };
        navigator.clipboard.writeText(code).then(() => {
          try {
            if (typeof window !== "undefined" && (window as any).__fdOnCopyClick__) (window as any).__fdOnCopyClick__(data);
            if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("fd:code-block-copy", { detail: data }));
          } catch (_) {}
          btn.classList.add("fd-copy-btn-copied");
          btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(() => {
            btn.classList.remove("fd-copy-btn-copied");
            btn.innerHTML =
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
          }, 2000);
        });
      });
    });
    document.querySelectorAll("[data-tabs]").forEach((tabs) => {
      tabs.querySelectorAll(".fd-tab-trigger").forEach((trigger) => {
        trigger.addEventListener("click", () => {
          const val = trigger.getAttribute("data-tab-value");
          tabs.querySelectorAll(".fd-tab-trigger").forEach((t) => {
            t.classList.toggle("fd-tab-active", t.getAttribute("data-tab-value") === val);
            t.setAttribute("aria-selected", String(t.getAttribute("data-tab-value") === val));
          });
          tabs.querySelectorAll(".fd-tab-panel").forEach((p) => {
            p.classList.toggle("fd-tab-panel-active", p.getAttribute("data-tab-panel") === val);
          });
        });
      });
    });
    document.querySelectorAll(".fd-page-body a[href]").forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(href)) return;
      const localized = withLang(href);
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
      const containsTarget = (target: EventTarget | null) => target instanceof Node && root.contains(target);
      const clearCloseTimer = () => {
        if (closeTimer !== 0) {
          window.clearTimeout(closeTimer);
          closeTimer = 0;
        }
      };

      const openPopover = () => {
        clearCloseTimer();
        setHoverLinkOpen(root, true);
      };
      const closePopover = () => {
        clearCloseTimer();
        setHoverLinkOpen(root, false);
      };
      const closePopoverSoon = () => {
        clearCloseTimer();
        closeTimer = window.setTimeout(closePopover, 90);
      };

      trigger.addEventListener("pointerenter", openPopover);
      trigger.addEventListener("pointerleave", (event) => {
        if (containsTarget(event.relatedTarget)) return;
        closePopoverSoon();
      });
      trigger.addEventListener("focus", (event) => {
        if (!(event.currentTarget instanceof HTMLElement)) return;
        if (typeof event.currentTarget.matches === "function" && !event.currentTarget.matches(":focus-visible")) {
          return;
        }
        openPopover();
      });
      trigger.addEventListener("blur", (event) => {
        if (containsTarget(event.relatedTarget)) return;
        closePopoverSoon();
      });
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        openPopover();
      });

      popover.addEventListener("pointerenter", openPopover);
      popover.addEventListener("pointerleave", (event) => {
        if (containsTarget(event.relatedTarget)) return;
        closePopoverSoon();
      });
      popover.addEventListener("focusin", openPopover);
      popover.addEventListener("focusout", (event) => {
        if (containsTarget(event.relatedTarget)) return;
        closePopoverSoon();
      });

      root.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        closePopover();
      });
    });

    if (document.documentElement.dataset.fdHoverLinkGlobalBound !== "true") {
      document.documentElement.dataset.fdHoverLinkGlobalBound = "true";

      document.addEventListener("pointerdown", closeOpenHoverLinks);
      document.addEventListener("focusin", closeOpenHoverLinks);
    }

    document.querySelectorAll("[data-prompt-card]").forEach((root) => {
      if (!(root instanceof HTMLElement)) return;
      if (root.dataset.fdPromptBound === "true") return;
      root.dataset.fdPromptBound = "true";

      const promptTextNode = root.querySelector("[data-prompt-text]");
      const promptText = promptTextNode?.textContent?.trim() ?? "";

      const copyButton = root.querySelector("[data-prompt-copy]");
      if (copyButton instanceof HTMLButtonElement && promptText) {
        copyButton.addEventListener("click", async () => {
          const defaultIcon = copyButton.querySelector(".fd-prompt-action-icon");
          const copiedIcon = copyButton.querySelector(".fd-prompt-action-icon-copied");
          const label = copyButton.querySelector("[data-prompt-copy-label]");
          const copiedLabel = label?.getAttribute("data-prompt-copy-label") ?? "Copied";
          const defaultLabel =
            label?.getAttribute("data-prompt-default-label") ??
            label?.textContent ??
            "Copy prompt";

          let copied = false;
          try {
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(promptText);
              copied = true;
            } else {
              copied = await fallbackCopyPromptText(promptText);
            }
          } catch {
            copied = await fallbackCopyPromptText(promptText);
          }

          if (!copied || !(label instanceof HTMLElement)) return;

          copyButton.dataset.copied = "true";
          label.textContent = copiedLabel;
          if (defaultIcon instanceof HTMLElement) defaultIcon.hidden = true;
          if (copiedIcon instanceof HTMLElement) copiedIcon.hidden = false;

          window.setTimeout(() => {
            copyButton.dataset.copied = "false";
            label.textContent = defaultLabel;
            if (defaultIcon instanceof HTMLElement) defaultIcon.hidden = false;
            if (copiedIcon instanceof HTMLElement) copiedIcon.hidden = true;
          }, 2000);
        });
      }

      const directOpen = root.querySelector("[data-prompt-open-direct]");
      if (directOpen instanceof HTMLButtonElement && promptText) {
        directOpen.addEventListener("click", () => {
          const template = directOpen.getAttribute("data-url-template");
          if (!template) return;
          const url = template.replace(/\{prompt\}/g, encodeURIComponent(promptText));
          window.open(url, "_blank", "noopener,noreferrer");
        });
      }

      const dropdown = root.querySelector("[data-prompt-dropdown]");
      const trigger = root.querySelector("[data-prompt-trigger]");
      if (dropdown instanceof HTMLElement && trigger instanceof HTMLButtonElement) {
        trigger.addEventListener("click", () => {
          const isOpen = trigger.getAttribute("aria-expanded") === "true";
          setPromptMenuOpen(dropdown, !isOpen);
        });
      }

      root.querySelectorAll("[data-prompt-open-provider]").forEach((providerButton) => {
        if (!(providerButton instanceof HTMLButtonElement) || !promptText) return;
        providerButton.addEventListener("click", () => {
          const template = providerButton.getAttribute("data-url-template");
          if (!template) return;
          const url = template.replace(/\{prompt\}/g, encodeURIComponent(promptText));
          window.open(url, "_blank", "noopener,noreferrer");
          if (dropdown instanceof HTMLElement) setPromptMenuOpen(dropdown, false);
        });
      });
    });

    if (document.documentElement.dataset.fdPromptGlobalBound !== "true") {
      document.documentElement.dataset.fdPromptGlobalBound = "true";
      document.addEventListener("pointerdown", closeOpenPromptMenus);
      document.addEventListener("focusin", closeOpenPromptMenus);
    }
  });
}

onMounted(() => {
  scanHeadings();
  wireInteractive();
});

watch(
  () => route.path,
  () => {
    scanHeadings();
    wireInteractive();
  },
);
</script>

<template>
  <div class="fd-page">
    <article class="fd-page-article" id="nd-page">
      <Breadcrumb v-if="breadcrumbEnabled" :pathname="route.path" :entry="entry" :locale="props.locale" />

      <div class="fd-page-body">
        <div class="fd-docs-content">
          <slot />
        </div>
      </div>

      <footer class="fd-page-footer">
        <div v-if="editOnGithub || lastModified || llmsTxtEnabled" class="fd-edit-on-github">
          <a v-if="editOnGithub" :href="editOnGithub" target="_blank" rel="noopener noreferrer">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit on GitHub
          </a>
          <span v-if="llmsTxtEnabled" class="fd-llms-txt-links">
            <a :href="`/api/docs?format=llms${llmsLangParam}`" target="_blank" rel="noopener noreferrer" class="fd-llms-txt-link">llms.txt</a>
            <a :href="`/api/docs?format=llms-full${llmsLangParam}`" target="_blank" rel="noopener noreferrer" class="fd-llms-txt-link">llms-full.txt</a>
          </span>
          <span v-if="lastModified" class="fd-last-modified">Last updated: {{ lastModified }}</span>
        </div>

        <nav v-if="previousPage || nextPage" class="fd-page-nav" aria-label="Page navigation">
          <NuxtLink
            v-if="localizedPreviousPage"
            :to="localizedPreviousPage.url"
            class="fd-page-nav-card fd-page-nav-prev"
          >
            <span class="fd-page-nav-label">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Previous
            </span>
            <span class="fd-page-nav-title">{{ localizedPreviousPage.name }}</span>
          </NuxtLink>
          <div v-else></div>
          <NuxtLink v-if="localizedNextPage" :to="localizedNextPage.url" class="fd-page-nav-card fd-page-nav-next">
            <span class="fd-page-nav-label">
              Next
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </span>
            <span class="fd-page-nav-title">{{ localizedNextPage.name }}</span>
          </NuxtLink>
          <div v-else></div>
        </nav>
      </footer>
    </article>

    <aside v-if="tocEnabled" class="fd-toc">
      <TableOfContents :items="tocItems" :toc-style="tocStyle" />
    </aside>
  </div>
</template>
