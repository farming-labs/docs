<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import { useHead } from "#app";
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
    entry?: string;
    slug?: string;
    locale?: string;
  };
  config?: Record<string, unknown> | null;
}>();

type FeedbackValue = "positive" | "negative";
type FeedbackStatus = "idle" | "submitting" | "submitted" | "error";
type FeedbackPayload = {
  value: FeedbackValue;
  comment?: string;
  title?: string;
  description?: string;
  url: string;
  pathname: string;
  path: string;
  entry: string;
  slug: string;
  locale?: string;
};

interface DocsWindowHooks extends Window {
  __fdOnFeedback__?: (payload: FeedbackPayload) => void | Promise<void>;
}

const route = useRoute();
const openDropdownMenu = ref(false);
const copyLabel = ref("Copy page");
const copied = ref(false);
const selectedFeedback = ref<FeedbackValue | null>(null);
const feedbackComment = ref("");
const feedbackStatus = ref<FeedbackStatus>("idle");

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

const entry = computed(() => (props.data.entry as string) ?? (props.config?.entry as string) ?? "docs");

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
const feedbackConfig = computed(() => {
  const defaults = {
    enabled: false,
    question: "How is this guide?",
    placeholder: "Leave your feedback...",
    positiveLabel: "Good",
    negativeLabel: "Bad",
    submitLabel: "Submit",
    onFeedback: undefined as ((payload: FeedbackPayload) => void | Promise<void>) | undefined,
  };

  const feedback = props.config?.feedback as Record<string, unknown> | boolean | null | undefined;
  if (feedback === undefined || feedback === false) return defaults;
  if (feedback === true) return { ...defaults, enabled: true };
  if (typeof feedback !== "object" || feedback === null) return defaults;

  return {
    enabled: feedback.enabled !== false,
    question: String((feedback as { question?: string }).question ?? defaults.question),
    placeholder: String(feedback.placeholder ?? defaults.placeholder),
    positiveLabel: String(
      feedback.positiveLabel ?? defaults.positiveLabel,
    ),
    negativeLabel: String(
      feedback.negativeLabel ?? defaults.negativeLabel,
    ),
    submitLabel: String(feedback.submitLabel ?? defaults.submitLabel),
    onFeedback:
      typeof feedback.onFeedback === "function"
        ? (feedback.onFeedback as (payload: FeedbackPayload) => void | Promise<void>)
        : undefined,
  };
});

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

function resetFeedback() {
  selectedFeedback.value = null;
  feedbackComment.value = "";
  feedbackStatus.value = "idle";
}

watch(() => route.path, resetFeedback, { immediate: true });

function buildFeedbackPayload(): FeedbackPayload {
  const pathname =
    typeof window !== "undefined"
      ? window.location.pathname.replace(/\/$/, "") || "/"
      : props.data.slug
        ? `/${entry.value}/${props.data.slug}`
        : `/${entry.value}`;

  return {
    value: selectedFeedback.value as FeedbackValue,
    comment: feedbackComment.value.trim() ? feedbackComment.value.trim() : undefined,
    title: props.data.title,
    description: props.data.description,
    url: typeof window !== "undefined" ? window.location.href : pathname,
    pathname,
    path: pathname,
    entry: entry.value,
    slug: props.data.slug ?? "",
    locale: props.data.locale,
  };
}

async function emitFeedback(payload: FeedbackPayload) {
  let firstError: unknown;

  try {
    await feedbackConfig.value.onFeedback?.(payload);
  } catch (error) {
    firstError ??= error;
  }

  try {
    if (typeof window !== "undefined") {
      await (window as DocsWindowHooks).__fdOnFeedback__?.(payload);
    }
  } catch (error) {
    firstError ??= error;
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fd:feedback", { detail: payload }));
  }

  if (firstError) throw firstError;
}

function handleFeedback(value: FeedbackValue) {
  selectedFeedback.value = value;
  if (feedbackStatus.value !== "idle") feedbackStatus.value = "idle";
}

async function submitFeedback() {
  if (!selectedFeedback.value || feedbackStatus.value === "submitting" || feedbackStatus.value === "submitted") {
    return;
  }

  try {
    feedbackStatus.value = "submitting";
    await emitFeedback(buildFeedbackPayload());
    feedbackStatus.value = "submitted";
  } catch {
    feedbackStatus.value = "error";
  }
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
    :locale="data.locale"
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

    <section v-if="feedbackConfig.enabled" class="fd-feedback" aria-label="Page feedback">
      <div class="fd-feedback-content">
        <p class="fd-feedback-question">{{ feedbackConfig.question }}</p>
        <div class="fd-feedback-actions" role="group" :aria-label="feedbackConfig.question">
          <button
            type="button"
            class="fd-page-action-btn fd-feedback-choice"
            :aria-pressed="selectedFeedback === 'positive'"
            :data-selected="selectedFeedback === 'positive' ? 'true' : undefined"
            :disabled="feedbackStatus === 'submitting'"
            @click="handleFeedback('positive')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M7 21H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2m0 11V10m0 11h9.28a2 2 0 0 0 1.97-1.66l1.2-7A2 2 0 0 0 17.48 10H13V6.5a2.5 2.5 0 0 0-2.5-2.5L7 10"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>{{ feedbackConfig.positiveLabel }}</span>
          </button>
          <button
            type="button"
            class="fd-page-action-btn fd-feedback-choice"
            :aria-pressed="selectedFeedback === 'negative'"
            :data-selected="selectedFeedback === 'negative' ? 'true' : undefined"
            :disabled="feedbackStatus === 'submitting'"
            @click="handleFeedback('negative')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M17 3h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2M17 3v11m0-11H7.72a2 2 0 0 0-1.97 1.66l-1.2 7A2 2 0 0 0 6.52 14H11v3.5a2.5 2.5 0 0 0 2.5 2.5L17 14"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>{{ feedbackConfig.negativeLabel }}</span>
          </button>
        </div>
      </div>
      <div v-if="selectedFeedback" class="fd-feedback-form">
        <textarea
          v-model="feedbackComment"
          class="fd-feedback-input"
          aria-label="Additional feedback"
          :placeholder="feedbackConfig.placeholder"
          :disabled="feedbackStatus === 'submitting'"
          @input="feedbackStatus !== 'idle' && (feedbackStatus = 'idle')"
        />
        <div class="fd-feedback-submit-row">
          <button
            type="button"
            class="fd-page-action-btn fd-feedback-submit"
            :disabled="feedbackStatus === 'submitting' || feedbackStatus === 'submitted'"
            @click="submitFeedback"
          >
            <span v-if="feedbackStatus === 'submitting'" class="fd-feedback-spinner" aria-hidden="true" />
            <svg
              v-else-if="feedbackStatus === 'submitted'"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M20 6 9 17l-5-5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>
              {{
                feedbackStatus === "submitted"
                    ? "Submitted"
                    : feedbackConfig.submitLabel
              }}
            </span>
          </button>
          <p
            v-if="feedbackStatus === 'submitted'"
            class="fd-feedback-status"
            data-status="success"
            role="status"
            aria-live="polite"
          >
            Thanks for the feedback.
          </p>
        </div>
        <p
          v-if="feedbackStatus === 'error'"
          class="fd-feedback-status"
          data-status="error"
          role="status"
          aria-live="polite"
        >
          Could not send feedback. Please try again.
        </p>
      </div>
    </section>
  </DocsPage>
</template>
