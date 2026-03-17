<script setup lang="ts">
import { DocsLayout, DocsContent } from "@farming-labs/nuxt-theme";
import config from "~/docs.config";

const route = useRoute();
const pathname = computed(() => route.path);
const locale = computed(() => {
  const value = route.query.lang;
  return Array.isArray(value) ? value[0] : value;
});

const { data, error } = await useFetch("/api/docs", {
  query: computed(() => ({
    pathname: pathname.value,
    lang: locale.value,
  })),
  watch: [pathname, locale],
});

if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Page not found",
  });
}
</script>

<template>
  <div v-if="data" class="fd-docs-wrapper">
    <DocsLayout :tree="data.tree" :config="config" :trigger-component="AskAITrigger">
      <DocsContent :data="data" :config="config" />
    </DocsLayout>
  </div>
</template>
