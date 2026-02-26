<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import DocsPage from "./DocsPage.vue";

const DEFAULT_OPEN_PROVIDERS = [
  { name: "ChatGPT", urlTemplate: "https://chatgpt.com/?hints=search&q=Read+{mdxUrl},+I+want+to+ask+questions+about+it." },
  { name: "Claude", urlTemplate: "https://claude.ai/new?q=Read+{mdxUrl},+I+want+to+ask+questions+about+it." },
];

const props = defineProps<{
  data: {
    title: string;
    description?: string;
    html: string;
    rawMarkdown?: string;
    previousPage?: { name: string; url: string } | null;
    nextPage?: { name: string; url: string } | null;
    editOnGithub?: string;
    lastModified?: string;
  };
  config?: Record<string, unknown> | null;
}>();

const route = useRoute();
const openDropdownMenu = ref(false);
const copyLabel = ref("Copy page");
const copied = ref(false);

const titleSuffix = computed(() =>
  props.config?.metadata?.titleTemplate
    ? String((props.config.metadata as Record<string, string>).titleTemplate).replace("%s", "")
    : " – Docs",
);

const themeUi = computed(() => (props.config?.theme as Record<string, unknown>)?.ui as Record<string, unknown> | undefined);
const layout = computed(() => themeUi.value?.layout as Record<string, unknown> | undefined);
const tocConfig = computed(() => layout.value?.toc as Record<string, unknown> | undefined);
const tocEnabledVal = computed(() => tocConfig.value?.enabled ?? true);
const tocStyleVal = computed(() => {
  const style = tocConfig.value?.style as string | undefined;
  return style === "directional" ? "directional" : "default";
});

const breadcrumbEnabled = computed(() => {
  const bc = props.config?.breadcrumb;
  if (bc === undefined || bc === true) return true;
  if (bc === false) return false;
  if (typeof bc === "object") return (bc as { enabled?: boolean }).enabled !== false;
  return true;
});

const showEditOnGithub = computed(() => !!props.config?.github && !!props.data.editOnGithub);
const showLastModified = computed(() => !!props.data.lastModified);

const llmsTxtEnabled = computed(() => {
  const cfg = props.config?.llmsTxt;
  if (cfg === true) return true;
  if (typeof cfg === "object" && cfg !== null) return (cfg as { enabled?: boolean }).enabled !== false;
  return false;
});

const entry = computed(() => (props.config?.entry as string) ?? "docs");

const copyMarkdownEnabled = computed(() => {
  const pa = props.config?.pageActions as Record<string, unknown> | undefined;
  if (!pa) return false;
  const cm = pa.copyMarkdown;
  if (cm === true) return true;
  if (typeof cm === "object" && cm !== null) return (cm as { enabled?: boolean }).enabled !== false;
  return false;
});

const openDocsEnabled = computed(() => {
  const pa = props.config?.pageActions as Record<string, unknown> | undefined;
  if (!pa) return false;
  const od = pa.openDocs;
  if (od === true) return true;
  if (typeof od === "object" && od !== null) return (od as { enabled?: boolean }).enabled !== false;
  return false;
});

const openDocsProviders = computed(() => {
  const pa = props.config?.pageActions as Record<string, unknown> | undefined;
  const od = pa && typeof pa === "object" && pa.openDocs != null ? pa.openDocs : null;
  const list = od && typeof od === "object" && "providers" in od
    ? (od as { providers?: Array<{ name?: string; urlTemplate?: string }> }).providers
    : undefined;
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

const pageActionsPosition = computed(() => {
  const pa = props.config?.pageActions as Record<string, unknown> | undefined;
  if (typeof pa === "object" && pa !== null && pa.position) return pa.position as string;
  return "below-title";
});

const pageActionsAlignment = computed(() => {
  const pa = props.config?.pageActions as Record<string, unknown> | undefined;
  if (typeof pa === "object" && pa !== null && pa.alignment) return pa.alignment as string;
  return "left";
});

const lastUpdatedConfig = computed(() => {
  const lu = props.config?.lastUpdated;
  if (lu === false) return { enabled: false, position: "footer" as const };
  if (lu === true || lu === undefined) return { enabled: true, position: "footer" as const };
  const o = lu as { enabled?: boolean; position?: "footer" | "below-title" };
  return {
    enabled: o.enabled !== false,
    position: (o.position ?? "footer") as "footer" | "below-title",
  };
});

const showLastUpdatedInFooter = computed(
  () => !!props.data.lastModified && lastUpdatedConfig.value.enabled && lastUpdatedConfig.value.position === "footer",
);
const showLastUpdatedBelowTitle = computed(
  () => !!props.data.lastModified && lastUpdatedConfig.value.enabled && lastUpdatedConfig.value.position === "below-title",
);

const htmlWithoutFirstH1 = computed(() => {
  const html = props.data.html || "";
  return html.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
});

const metaDescription = computed(
  () => props.data.description ?? (props.config?.metadata as Record<string, string>)?.description ?? undefined,
);

const showPageActions = computed(
  () => (copyMarkdownEnabled.value || openDocsEnabled.value) && openDocsProviders.value.length >= 0,
);
const showActionsAbove = computed(() => pageActionsPosition.value === "above-title" && showPageActions.value);
const showActionsBelow = computed(() => pageActionsPosition.value === "below-title" && showPageActions.value);

useHead({
  title: () => `${props.data.title}${titleSuffix.value}`,
  meta: () =>
    metaDescription.value ? [{ name: "description", content: metaDescription.value }] : [],
});

function handleCopyPage() {
  let text = "";
  const raw = props.data.rawMarkdown;
  if (raw && typeof raw === "string" && raw.length > 0) {
    text = raw;
  } else {
    const article = document.querySelector("#nd-page");
    if (article) text = (article as HTMLElement).innerText || "";
  }
  if (!text) return;
  navigator.clipboard.writeText(text).then(
    () => {
      copyLabel.value = "Copied!";
      copied.value = true;
      setTimeout(() => {
        copyLabel.value = "Copy page";
        copied.value = false;
      }, 2000);
    },
    () => {
      copyLabel.value = "Copy failed";
      setTimeout(() => { copyLabel.value = "Copy page"; }, 2000);
    },
  );
}

function toggleDropdown() {
  openDropdownMenu.value = !openDropdownMenu.value;
}

function closeDropdown() {
  openDropdownMenu.value = false;
}

function openInProvider(provider: { name: string; urlTemplate: string }) {
  const pathname = route.path;
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";
  const mdxUrl = typeof window !== "undefined"
    ? window.location.origin + pathname + (pathname.endsWith("/") ? "page.mdx" : ".mdx")
    : "";
  const githubUrl = props.data.editOnGithub || "";
  const url = provider.urlTemplate
    .replace(/\{url\}/g, encodeURIComponent(pageUrl))
    .replace(/\{mdxUrl\}/g, encodeURIComponent(mdxUrl))
    .replace(/\{githubUrl\}/g, githubUrl);
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  closeDropdown();
}

function handleClickOutside(e: MouseEvent) {
  const target = e.target as Node;
  if (openDropdownMenu.value && !(target as Element).closest?.(".fd-page-action-dropdown")) {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});
onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<template>
  <DocsPage
    :entry="entry"
    :toc-enabled="tocEnabledVal"
    :toc-style="tocStyleVal"
    :breadcrumb-enabled="breadcrumbEnabled"
    :previous-page="data.previousPage ?? null"
    :next-page="data.nextPage ?? null"
    :edit-on-github="showEditOnGithub ? data.editOnGithub : null"
    :last-modified="showLastUpdatedInFooter ? data.lastModified : null"
    :llms-txt-enabled="llmsTxtEnabled"
  >
    <!-- Above-title actions -->
    <div
      v-if="showActionsAbove"
      class="fd-page-actions"
      data-page-actions
      :data-actions-alignment="pageActionsAlignment"
    >
      <button
        v-if="copyMarkdownEnabled"
        type="button"
        class="fd-page-action-btn"
        aria-label="Copy page content"
        :data-copied="copied"
        @click="handleCopyPage"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span>{{ copyLabel }}</span>
      </button>
      <div v-if="openDocsEnabled && openDocsProviders.length > 0" class="fd-page-action-dropdown">
        <button
          type="button"
          class="fd-page-action-btn"
          :aria-expanded="openDropdownMenu"
          aria-haspopup="true"
          @click="toggleDropdown"
        >
          <span>Open in</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        <div
          class="fd-page-action-menu"
          role="menu"
          :hidden="!openDropdownMenu"
        >
          <a
            v-for="provider in openDocsProviders"
            :key="provider.name"
            role="menuitem"
            href="#"
            class="fd-page-action-menu-item"
            @click.prevent="openInProvider(provider)"
          >
            <span class="fd-page-action-menu-label">Open in {{ provider.name }}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>
    </div>

    <h1 class="fd-page-title">{{ data.title }}</h1>
    <p v-if="data.description" class="fd-page-description">{{ data.description }}</p>
    <p v-if="showLastUpdatedBelowTitle && data.lastModified" class="fd-last-modified fd-last-modified-below-title">
      Last updated: {{ data.lastModified }}
    </p>

    <!-- Below-title actions -->
    <template v-if="showActionsBelow">
      <hr class="fd-page-actions-divider" aria-hidden="true" />
      <div
        class="fd-page-actions"
        data-page-actions
        :data-actions-alignment="pageActionsAlignment"
      >
        <button
          v-if="copyMarkdownEnabled"
          type="button"
          class="fd-page-action-btn"
          aria-label="Copy page content"
          :data-copied="copied"
          @click="handleCopyPage"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>{{ copyLabel }}</span>
        </button>
        <div v-if="openDocsEnabled && openDocsProviders.length > 0" class="fd-page-action-dropdown">
          <button
            type="button"
            class="fd-page-action-btn"
            :aria-expanded="openDropdownMenu"
            aria-haspopup="true"
            @click="toggleDropdown"
          >
            <span>Open in</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <div
            class="fd-page-action-menu"
            role="menu"
            :hidden="!openDropdownMenu"
          >
            <a
              v-for="provider in openDocsProviders"
              :key="provider.name"
              role="menuitem"
              href="#"
              class="fd-page-action-menu-item"
              @click.prevent="openInProvider(provider)"
            >
              <span class="fd-page-action-menu-label">Open in {{ provider.name }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </template>

    <div v-html="htmlWithoutFirstH1" />
  </DocsPage>
</template>
