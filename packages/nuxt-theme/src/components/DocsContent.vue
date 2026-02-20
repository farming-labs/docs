<script setup lang="ts">
import { computed } from "vue";
import DocsPage from "./DocsPage.vue";

const props = defineProps<{
  data: {
    title: string;
    description?: string;
    html: string;
    previousPage?: { name: string; url: string } | null;
    nextPage?: { name: string; url: string } | null;
    editOnGithub?: string;
    lastModified?: string;
  };
  config?: Record<string, unknown> | null;
}>();

const titleSuffix = computed(() =>
  props.config?.metadata?.titleTemplate
    ? String(props.config.metadata.titleTemplate).replace("%s", "")
    : " – Docs"
);

const tocEnabled = computed(
  () => (props.config?.theme as any)?.ui?.layout?.toc?.enabled ?? true
);

const tocStyle = computed(
  () => (props.config?.theme as any)?.ui?.layout?.toc?.style ?? "default"
);

const breadcrumbEnabled = computed(() => {
  const bc = props.config?.breadcrumb;
  if (bc === undefined || bc === true) return true;
  if (bc === false) return false;
  if (typeof bc === "object") return (bc as { enabled?: boolean }).enabled !== false;
  return true;
});

const showEditOnGithub = computed(
  () => !!props.config?.github && !!props.data.editOnGithub
);
const showLastModified = computed(() => !!props.data.lastModified);

const entry = computed(() => (props.config?.entry as string) ?? "docs");

const metaDescription = computed(
  () =>
    props.data.description ??
    (props.config?.metadata as any)?.description ??
    undefined
);

useHead({
  title: () => `${props.data.title}${titleSuffix.value}`,
  meta: () =>
    metaDescription.value
      ? [{ name: "description", content: metaDescription.value }]
      : [],
});
</script>

<template>
  <DocsPage
    :entry="entry"
    :toc-enabled="tocEnabled"
    :toc-style="tocStyle"
    :breadcrumb-enabled="breadcrumbEnabled"
    :previous-page="data.previousPage ?? null"
    :next-page="data.nextPage ?? null"
    :edit-on-github="showEditOnGithub ? data.editOnGithub : null"
    :last-modified="showLastModified ? data.lastModified : null"
  >
    <p v-if="data.description" class="fd-page-description">{{ data.description }}</p>
    <div class="fd-docs-content" v-html="data.html" />
  </DocsPage>
</template>
