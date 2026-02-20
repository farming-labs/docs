<script setup lang="ts">
import { ref, onMounted } from "vue";

const theme = ref<"light" | "dark">("light");

onMounted(() => {
  const stored = document.cookie.match(/(?:^|;\s*)theme=(\w+)/);
  if (stored) {
    theme.value = stored[1] as "light" | "dark";
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    theme.value = "dark";
  } else {
    theme.value = document.documentElement.classList.contains("dark") ? "dark" : "light";
  }
});

function toggle() {
  theme.value = theme.value === "dark" ? "light" : "dark";
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme.value);
  document.cookie = `theme=${theme.value};path=/;max-age=31536000;SameSite=Lax`;
}
</script>

<template>
  <button class="fd-theme-toggle" type="button" aria-label="Toggle theme" @click="toggle">
    <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </button>
</template>
