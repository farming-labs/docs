<script setup lang="ts">
import { ref, computed } from "vue";
import SearchDialog from "./SearchDialog.vue";
import FloatingAIChat from "./FloatingAIChat.vue";
import ThemeToggle from "./ThemeToggle.vue";

interface NavNode {
  type: "page" | "folder";
  name: string;
  url?: string;
  icon?: string;
  index?: { name: string; url: string };
  children?: NavNode[];
}

const props = withDefaults(
  defineProps<{
    tree?: { name: string; children: NavNode[] };
    config?: Record<string, any> | null;
    title?: string;
    titleUrl?: string;
    triggerComponent?: object | null;
  }>(),
  { config: null, title: undefined, titleUrl: undefined, triggerComponent: null },
);

const route = useRoute();

const resolvedTitle = computed(() => props.title ?? props.config?.nav?.title ?? "Docs");
const resolvedTitleUrl = computed(() => props.titleUrl ?? props.config?.nav?.url ?? "/docs");

const showThemeToggle = computed(() => {
  const toggle = props.config?.themeToggle;
  if (toggle === undefined || toggle === true) return true;
  if (toggle === false) return false;
  if (typeof toggle === "object") return toggle.enabled !== false;
  return true;
});

const forcedTheme = computed(() => {
  const toggle = props.config?.themeToggle;
  if (typeof toggle === "object" && toggle?.enabled === false && toggle?.default) {
    return toggle.default as string;
  }
  return null;
});

const defaultTheme = computed(() => {
  const toggle = props.config?.themeToggle;
  if (typeof toggle === "object" && toggle?.default) return toggle.default as string;
  return null;
});

// Theme initialization script — runs before paint to avoid flash.
// Uses cookies for SSR compatibility, falls back to system preference.
const themeInitScript = computed(() => {
  if (forcedTheme.value) {
    return `document.documentElement.classList.remove('light','dark');document.documentElement.classList.add('${forcedTheme.value}')`;
  }
  const def = defaultTheme.value;
  const fallback = def
    ? `'${def}'`
    : `(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')`;
  return [
    "(function(){",
    "var m=document.cookie.match(/(?:^|;\\s*)theme=(\\w+)/);",
    `var t=m?m[1]:${fallback};`,
    "document.documentElement.classList.remove('light','dark');",
    "document.documentElement.classList.add(t);",
    "})()",
  ].join("");
});

// ─── Color CSS variable generation ───────────────────────────
const COLOR_MAP: Record<string, string> = {
  primary: "--color-fd-primary",
  primaryForeground: "--color-fd-primary-foreground",
  background: "--color-fd-background",
  foreground: "--color-fd-foreground",
  muted: "--color-fd-muted",
  mutedForeground: "--color-fd-muted-foreground",
  border: "--color-fd-border",
  card: "--color-fd-card",
  cardForeground: "--color-fd-card-foreground",
  accent: "--color-fd-accent",
  accentForeground: "--color-fd-accent-foreground",
  popover: "--color-fd-popover",
  popoverForeground: "--color-fd-popover-foreground",
  secondary: "--color-fd-secondary",
  secondaryForeground: "--color-fd-secondary-foreground",
  ring: "--color-fd-ring",
};

function buildColorsCSS(colors: Record<string, string> | undefined): string {
  if (!colors) return "";
  const vars: string[] = [];
  for (const [key, value] of Object.entries(colors)) {
    if (!value || !COLOR_MAP[key]) continue;
    vars.push(`${COLOR_MAP[key]}: ${value};`);
  }
  if (vars.length === 0) return "";
  return `.dark {\n  ${vars.join("\n  ")}\n}`;
}

// ─── Typography CSS variable generation ──────────────────────
function buildFontStyleVars(prefix: string, style: Record<string, any>): string {
  if (!style) return "";
  const parts: string[] = [];
  if (style.size) parts.push(`${prefix}-size: ${style.size};`);
  if (style.weight != null) parts.push(`${prefix}-weight: ${style.weight};`);
  if (style.lineHeight) parts.push(`${prefix}-line-height: ${style.lineHeight};`);
  if (style.letterSpacing) parts.push(`${prefix}-letter-spacing: ${style.letterSpacing};`);
  return parts.join("\n  ");
}

function buildTypographyCSS(typo: Record<string, any> | undefined): string {
  if (!typo?.font) return "";
  const vars: string[] = [];
  const fontStyle = typo.font.style;
  if (fontStyle?.sans) vars.push(`--fd-font-sans: ${fontStyle.sans};`);
  if (fontStyle?.mono) vars.push(`--fd-font-mono: ${fontStyle.mono};`);
  for (const el of ["h1", "h2", "h3", "h4", "body", "small"]) {
    const elStyle = typo.font[el];
    if (elStyle) {
      const elVars = buildFontStyleVars(`--fd-${el}`, elStyle);
      if (elVars) vars.push(elVars);
    }
  }
  if (vars.length === 0) return "";
  return `:root {\n  ${vars.join("\n  ")}\n}`;
}

function buildLayoutCSS(layout: Record<string, any> | undefined): string {
  if (!layout) return "";
  const rootVars: string[] = [];
  const desktopVars: string[] = [];
  if (layout.sidebarWidth) desktopVars.push(`--fd-sidebar-width: ${layout.sidebarWidth}px;`);
  if (layout.contentWidth) rootVars.push(`--fd-content-width: ${layout.contentWidth}px;`);
  if (layout.tocWidth) desktopVars.push(`--fd-toc-width: ${layout.tocWidth}px;`);
  if (rootVars.length === 0 && desktopVars.length === 0) return "";
  const parts: string[] = [];
  if (rootVars.length > 0) parts.push(`:root {\n  ${rootVars.join("\n  ")}\n}`);
  if (desktopVars.length > 0)
    parts.push(
      `@media (min-width: 1024px) {\n  :root {\n    ${desktopVars.join("\n    ")}\n  }\n}`,
    );
  return parts.join("\n");
}

const overrideCSS = computed(() => {
  const colorOverrides =
    (props.config?.theme as any)?._userColorOverrides ?? (props.config?.theme as any)?.ui?.colors;
  const typography = (props.config?.theme as any)?.ui?.typography;
  const layout = (props.config?.theme as any)?.ui?.layout;
  return [buildColorsCSS(colorOverrides), buildTypographyCSS(typography), buildLayoutCSS(layout)]
    .filter(Boolean)
    .join("\n");
});

useHead(() => ({
  script: [{ innerHTML: themeInitScript.value, tagPosition: "head" }],
  style: overrideCSS.value ? [{ innerHTML: overrideCSS.value }] : [],
}));

// ─── Sidebar / search / keyboard ─────────────────────────────
const sidebarOpen = ref(false);
const searchOpen = ref(false);

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value;
}
function closeSidebar() {
  sidebarOpen.value = false;
}
function openSearch() {
  searchOpen.value = true;
}
function closeSearch() {
  searchOpen.value = false;
}

function isActive(url: string) {
  const current = route.path;
  const normalised = (url ?? "").replace(/\/$/, "") || "/";
  const currentNorm = current.replace(/\/$/, "") || "/";
  return normalised === currentNorm;
}

const ICON_MAP: Record<string, string> = {
  book: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  terminal:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
  code: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
  file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  folder:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  rocket:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
  settings:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
};

function getIcon(iconKey?: string) {
  if (!iconKey) return null;
  return ICON_MAP[iconKey] ?? null;
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    searchOpen.value = !searchOpen.value;
  }
  if (e.key === "Escape") {
    searchOpen.value = false;
    sidebarOpen.value = false;
  }
}

const showFloatingAI = computed(
  () => props.config?.ai?.enabled && props.config?.ai?.mode === "floating",
);
</script>

<template>
  <div class="fd-layout-root">
    <div class="fd-layout" @keydown="handleKeydown">
      <header class="fd-header">
        <button
          class="fd-menu-btn"
          type="button"
          aria-label="Toggle sidebar"
          @click="toggleSidebar"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <NuxtLink :to="resolvedTitleUrl" class="fd-header-title">{{ resolvedTitle }}</NuxtLink>
        <button
          class="fd-search-trigger-mobile"
          type="button"
          aria-label="Search"
          @click="openSearch"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </header>

      <div v-if="sidebarOpen" class="fd-sidebar-overlay" aria-hidden="true" @click="closeSidebar" />

      <aside class="fd-sidebar" :class="{ 'fd-sidebar-open': sidebarOpen }">
        <div class="fd-sidebar-header">
          <NuxtLink :to="resolvedTitleUrl" class="fd-sidebar-title" @click="closeSidebar">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            {{ resolvedTitle }}
          </NuxtLink>
        </div>

        <div class="fd-sidebar-search">
          <button type="button" class="fd-sidebar-search-btn" @click="openSearch">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Search</span>
            <kbd>⌘</kbd><kbd>K</kbd>
          </button>
        </div>

        <div v-if="$slots['sidebar-header']" class="fd-sidebar-banner">
          <slot name="sidebar-header" />
        </div>

        <nav class="fd-sidebar-nav">
          <slot name="sidebar" :tree="tree" :is-active="isActive">
            <template v-if="tree?.children">
              <template v-for="(node, i) in tree.children" :key="node.name + (node.url ?? '')">
                <NuxtLink
                  v-if="node.type === 'page'"
                  :to="node.url!"
                  class="fd-sidebar-link fd-sidebar-top-link"
                  :class="{
                    'fd-sidebar-link-active': isActive(node.url ?? ''),
                    'fd-sidebar-first-item': i === 0,
                  }"
                  @click="closeSidebar"
                >
                  <span
                    v-if="getIcon(node.icon)"
                    class="fd-sidebar-icon"
                    v-html="getIcon(node.icon)"
                  />
                  {{ node.name }}
                </NuxtLink>
                <details
                  v-else-if="node.type === 'folder'"
                  class="fd-sidebar-folder"
                  :class="{ 'fd-sidebar-first-item': i === 0 }"
                  open
                >
                  <summary class="fd-sidebar-folder-trigger">
                    <span class="fd-sidebar-folder-label">
                      <span
                        v-if="getIcon(node.icon)"
                        class="fd-sidebar-icon"
                        v-html="getIcon(node.icon)"
                      />
                      {{ node.name }}
                    </span>
                    <svg
                      class="fd-sidebar-chevron"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </summary>
                  <div class="fd-sidebar-folder-content">
                    <NuxtLink
                      v-if="node.index"
                      :to="node.index.url"
                      class="fd-sidebar-link fd-sidebar-child-link"
                      :class="{ 'fd-sidebar-link-active': isActive(node.index.url) }"
                      @click="closeSidebar"
                    >
                      {{ node.index.name }}
                    </NuxtLink>
                    <template
                      v-for="child in node.children"
                      :key="child.name + ((child as any).url ?? '')"
                    >
                      <NuxtLink
                        v-if="child.type === 'page'"
                        :to="(child as any).url"
                        class="fd-sidebar-link fd-sidebar-child-link"
                        :class="{ 'fd-sidebar-link-active': isActive((child as any).url) }"
                        @click="closeSidebar"
                      >
                        {{ child.name }}
                      </NuxtLink>
                      <details
                        v-else-if="child.type === 'folder'"
                        class="fd-sidebar-folder fd-sidebar-nested-folder"
                        open
                      >
                        <summary class="fd-sidebar-folder-trigger">
                          <span class="fd-sidebar-folder-label">{{ child.name }}</span>
                          <svg
                            class="fd-sidebar-chevron"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </summary>
                        <div class="fd-sidebar-folder-content">
                          <NuxtLink
                            v-if="(child as any).index"
                            :to="(child as any).index.url"
                            class="fd-sidebar-link fd-sidebar-child-link"
                            :class="{ 'fd-sidebar-link-active': isActive((child as any).index.url) }"
                            @click="closeSidebar"
                          >
                            {{ (child as any).index.name }}
                          </NuxtLink>
                          <NuxtLink
                            v-for="grandchild in (child as any).children"
                            v-if="grandchild.type === 'page'"
                            :key="grandchild.url"
                            :to="grandchild.url"
                            class="fd-sidebar-link fd-sidebar-child-link"
                            :class="{ 'fd-sidebar-link-active': isActive(grandchild.url) }"
                            @click="closeSidebar"
                          >
                            {{ grandchild.name }}
                          </NuxtLink>
                        </div>
                      </details>
                    </template>
                  </div>
                </details>
              </template>
            </template>
          </slot>
        </nav>

        <div v-if="$slots['sidebar-footer']" class="fd-sidebar-footer-custom">
          <slot name="sidebar-footer" />
        </div>

        <div v-if="showThemeToggle" class="fd-sidebar-footer">
          <ThemeToggle />
        </div>
      </aside>

      <main class="fd-main">
        <slot />
      </main>
    </div>

    <FloatingAIChat
      v-if="showFloatingAI"
      api="/api/docs"
      :suggested-questions="config?.ai?.suggestedQuestions ?? []"
      :ai-label="config?.ai?.aiLabel ?? 'AI'"
      :position="config?.ai?.position ?? 'bottom-right'"
      :floating-style="config?.ai?.floatingStyle ?? 'panel'"
      :trigger-component="triggerComponent"
    />

    <SearchDialog v-if="searchOpen" @close="closeSearch" />
  </div>
</template>
