<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{ pathname?: string; entry?: string }>(),
  { pathname: "", entry: "docs" }
);

const segments = computed(() => {
  const all = props.pathname.split("/").filter(Boolean);
  return all.filter((s) => s.toLowerCase() !== props.entry.toLowerCase());
});

const parentLabel = computed(() => {
  if (segments.value.length < 2) return "";
  return segments.value[segments.value.length - 2]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
});

const currentLabel = computed(() => {
  if (segments.value.length < 2) return "";
  return segments.value[segments.value.length - 1]
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
});

const parentUrl = computed(() => {
  if (segments.value.length < 2) return "";
  const all = props.pathname.split("/").filter(Boolean);
  const parentSegment = segments.value[segments.value.length - 2];
  const parentIndex = all.indexOf(parentSegment);
  return "/" + all.slice(0, parentIndex + 1).join("/");
});
</script>

<template>
  <nav v-if="segments.length >= 2" class="fd-breadcrumb" aria-label="Breadcrumb">
    <span class="fd-breadcrumb-item">
      <a :href="parentUrl" class="fd-breadcrumb-parent fd-breadcrumb-link">
        {{ parentLabel }}
      </a>
    </span>
    <span class="fd-breadcrumb-item">
      <span class="fd-breadcrumb-sep">/</span>
      <span class="fd-breadcrumb-current">{{ currentLabel }}</span>
    </span>
  </nav>
</template>
