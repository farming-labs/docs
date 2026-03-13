<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{ pathname?: string; entry?: string; locale?: string }>(), {
  pathname: "",
  entry: "docs",
  locale: undefined,
});

const segments = computed(() => props.pathname.split("/").filter(Boolean));
const entryParts = computed(() => props.entry.split("/").filter(Boolean));
const contentSegments = computed(() => segments.value.slice(entryParts.value.length));

const parentLabel = computed(() => {
  if (contentSegments.value.length < 2) return "";
  return contentSegments.value[contentSegments.value.length - 2]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
});

const currentLabel = computed(() => {
  if (contentSegments.value.length < 2) return "";
  return contentSegments.value[contentSegments.value.length - 1]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
});

const parentUrl = computed(() => {
  if (contentSegments.value.length < 2) return "";
  return (
    "/" +
    [...segments.value.slice(0, entryParts.value.length), ...contentSegments.value.slice(0, -1)].join("/")
  );
});

const localizedParentUrl = computed(() => {
  if (!parentUrl.value) return "";
  try {
    const url = new URL(parentUrl.value, "https://farming-labs.local");
    if (props.locale) url.searchParams.set("lang", props.locale);
    else url.searchParams.delete("lang");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return parentUrl.value;
  }
});
</script>

<template>
  <nav v-if="contentSegments.length >= 2" class="fd-breadcrumb" aria-label="Breadcrumb">
    <span class="fd-breadcrumb-item">
      <a :href="localizedParentUrl" class="fd-breadcrumb-parent fd-breadcrumb-link">
        {{ parentLabel }}
      </a>
    </span>
    <span class="fd-breadcrumb-item">
      <span class="fd-breadcrumb-sep">/</span>
      <span class="fd-breadcrumb-current">{{ currentLabel }}</span>
    </span>
  </nav>
</template>
