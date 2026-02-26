<template>
  <button type="button" class="ask-ai-trigger">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" /><path d="M22 5h-4" />
    </svg>
    Ask AI
  </button>
</template>

<style scoped>
.ask-ai-trigger {
  background: color-mix(in srgb, var(--color-fd-secondary, #f4f4f5) 80%, transparent);
  backdrop-filter: blur(4px);
  color: var(--color-fd-muted-foreground, #71717a);
  border: 1px solid var(--color-fd-border, rgba(255, 255, 255, 0.1));
  padding: 8px 12px;
  height: 40px;
  border-radius: 16px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: inherit;
  box-shadow: 0 1px 3px color-mix(in srgb, var(--color-fd-background, #000) 20%, transparent);
  transition: transform 150ms, background 150ms, color 150ms;
}
.ask-ai-trigger:hover {
  background: var(--color-fd-accent);
  color: var(--color-fd-accent-foreground);
  transform: scale(1.03);
}
.ask-ai-trigger:active {
  transform: scale(0.97);
}
</style>
