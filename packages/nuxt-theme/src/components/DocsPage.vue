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
    previousPage: null,
    nextPage: null,
    editOnGithub: null,
    lastModified: null,
    llmsTxtEnabled: false,
  },
);

const route = useRoute();
const tocItems = ref<{ title: string; url: string; depth: number }[]>([]);

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
        navigator.clipboard.writeText(code).then(() => {
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
      <Breadcrumb v-if="breadcrumbEnabled" :pathname="route.path" :entry="entry" />

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
            <a href="/api/docs?format=llms" target="_blank" rel="noopener noreferrer" class="fd-llms-txt-link">llms.txt</a>
            <a href="/api/docs?format=llms-full" target="_blank" rel="noopener noreferrer" class="fd-llms-txt-link">llms-full.txt</a>
          </span>
          <span v-if="lastModified" class="fd-last-modified">Last updated: {{ lastModified }}</span>
        </div>

        <nav v-if="previousPage || nextPage" class="fd-page-nav" aria-label="Page navigation">
          <NuxtLink
            v-if="previousPage"
            :to="previousPage.url"
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
            <span class="fd-page-nav-title">{{ previousPage.name }}</span>
          </NuxtLink>
          <div v-else></div>
          <NuxtLink v-if="nextPage" :to="nextPage.url" class="fd-page-nav-card fd-page-nav-next">
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
            <span class="fd-page-nav-title">{{ nextPage.name }}</span>
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
