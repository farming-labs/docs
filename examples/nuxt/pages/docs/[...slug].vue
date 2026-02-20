<script setup lang="ts">
import { DocsLayout, DocsContent } from "@farming-labs/nuxt-theme";
import AskAITrigger from "~/components/AskAITrigger.vue";
import config from "~/docs.config";

const route = useRoute();
const pathname = computed(() => route.path);

const { data, error } = await useFetch("/api/docs", {
  query: { pathname },
  watch: [pathname],
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
