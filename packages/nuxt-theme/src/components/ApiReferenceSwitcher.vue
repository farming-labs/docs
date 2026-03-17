<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    config: Record<string, any>;
    current?: "docs" | "api";
  }>(),
  {
    current: "docs",
  },
);

const route = useRoute();

const apiReference = computed(() => {
  const value = props.config?.apiReference;
  if (value === true) {
    return {
      enabled: true,
      path: "api-reference",
    };
  }

  if (!value || value === false || value.enabled === false) {
    return {
      enabled: false,
      path: "api-reference",
    };
  }

  return {
    enabled: true,
    path: String(value.path ?? "api-reference").replace(/^\/+|\/+$/g, "") || "api-reference",
  };
});

const docsHref = computed(() => {
  if (typeof props.config?.nav?.url === "string" && props.config.nav.url.length > 0) {
    return props.config.nav.url;
  }

  const entry = String(props.config?.entry ?? "docs").replace(/^\/+|\/+$/g, "") || "docs";
  const params = new URLSearchParams();

  for (const [key, raw] of Object.entries(route.query)) {
    if (raw == null) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value != null) params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `/${entry}?${query}` : `/${entry}`;
});

const apiHref = computed(() => {
  const params = new URLSearchParams();

  for (const [key, raw] of Object.entries(route.query)) {
    if (raw == null) continue;
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (value != null) params.set(key, String(value));
  }

  const query = params.toString();
  return query ? `/${apiReference.value.path}?${query}` : `/${apiReference.value.path}`;
});
</script>

<template>
  <details v-if="apiReference.enabled" class="fd-api-switcher">
    <summary class="fd-api-switcher-trigger">
      <span class="fd-api-switcher-trigger-copy">
        <span class="fd-api-switcher-icon">{{ current === "api" ? "</>" : "▣" }}</span>
        <span class="fd-api-switcher-label">
          {{ current === "api" ? "API Reference" : "Documentation" }}
        </span>
      </span>
      <span class="fd-api-switcher-caret">▿</span>
    </summary>

    <div class="fd-api-switcher-panel">
      <NuxtLink
        :to="docsHref"
        class="fd-api-switcher-option"
        :class="{ 'fd-api-switcher-option-active': current === 'docs' }"
      >
        <span class="fd-api-switcher-option-icon">▣</span>
        <span class="fd-api-switcher-option-copy">
          <span class="fd-api-switcher-option-title">Documentation</span>
          <span class="fd-api-switcher-option-description">
            Markdown pages, guides, and concepts
          </span>
        </span>
        <span class="fd-api-switcher-option-check">✓</span>
      </NuxtLink>

      <NuxtLink
        :to="apiHref"
        class="fd-api-switcher-option"
        :class="{ 'fd-api-switcher-option-active': current === 'api' }"
      >
        <span class="fd-api-switcher-option-icon">&lt;/&gt;</span>
        <span class="fd-api-switcher-option-copy">
          <span class="fd-api-switcher-option-title">API Reference</span>
          <span class="fd-api-switcher-option-description">
            Scalar-powered route handler reference
          </span>
        </span>
        <span class="fd-api-switcher-option-check">✓</span>
      </NuxtLink>
    </div>
  </details>
</template>

<style scoped>
.fd-api-switcher {
  position: relative;
  margin: 0;
  border: 1px solid color-mix(in srgb, var(--color-fd-border) 100%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, var(--color-fd-card) 96%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-fd-border) 28%, transparent);
  overflow: hidden;
}

.fd-api-switcher-trigger {
  list-style: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
  padding: 11px 13px;
  background: color-mix(in srgb, var(--color-fd-card) 98%, transparent);
}

.fd-api-switcher-trigger::-webkit-details-marker {
  display: none;
}

.fd-api-switcher-trigger-copy {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.fd-api-switcher-icon,
.fd-api-switcher-option-icon {
  display: inline-flex;
  width: 20px;
  height: 20px;
  align-items: center;
  justify-content: center;
  flex: 0 0 20px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--color-fd-border) 100%, transparent);
  background: color-mix(in srgb, var(--color-fd-card) 92%, transparent);
  color: var(--color-fd-primary);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-fd-border) 28%, transparent);
  font-size: 9px;
  font-weight: 700;
}

.fd-api-switcher-label {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}

.fd-api-switcher-caret {
  font-size: 11px;
  opacity: 0.56;
  transform: translateY(1px);
}

.fd-api-switcher-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  background: color-mix(in srgb, var(--color-fd-card) 96%, transparent);
  border-top: 1px solid color-mix(in srgb, var(--color-fd-border) 100%, transparent);
}

.fd-api-switcher-option {
  display: grid;
  grid-template-columns: 20px 1fr 14px;
  gap: 12px;
  align-items: start;
  padding: 11px 12px;
  border-radius: 12px;
  text-decoration: none;
  color: inherit;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.fd-api-switcher-option:hover {
  background: color-mix(in srgb, var(--color-fd-primary) 6%, transparent);
}

.fd-api-switcher-option-active {
  background: color-mix(in srgb, var(--color-fd-primary) 10%, transparent);
}

.fd-api-switcher-option-copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.fd-api-switcher-option-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
}

.fd-api-switcher-option-description {
  font-size: 12px;
  line-height: 1.4;
  opacity: 0.62;
}

.fd-api-switcher-option-check {
  padding-top: 2px;
  font-size: 12px;
  color: var(--color-fd-primary);
  opacity: 0;
}

.fd-api-switcher-option-active .fd-api-switcher-option-check {
  opacity: 1;
}
</style>
