import { h as head, a as attr, e as escape_html, b as attr_class, c as store_get, d as ensure_array_like, u as unsubscribe_stores } from "../../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../../chunks/exports.js";
import "../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../chunks/root.js";
import "../../../chunks/state.svelte.js";
import { c as config } from "../../../chunks/docs.config.js";
import { h as html, p as page } from "../../../chunks/stores.js";
function ThemeToggle($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    $$renderer2.push(`<button class="fd-theme-toggle" aria-label="Toggle theme">`);
    {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`);
    }
    $$renderer2.push(`<!--]--></button>`);
  });
}
function FloatingAIChat($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function DocsLayout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let {
      tree,
      config: config2 = null,
      title = void 0,
      titleUrl = void 0,
      children,
      sidebar = void 0,
      sidebarHeader = void 0,
      sidebarFooter = void 0
    } = $$props;
    let resolvedTitle = title ?? config2?.nav?.title ?? "Docs";
    let resolvedTitleUrl = titleUrl ?? config2?.nav?.url ?? "/docs";
    let staticExport = !!(config2 && config2.staticExport);
    let showSearch = !staticExport;
    let showFloatingAI = !staticExport && config2?.ai?.mode === "floating" && !!config2?.ai?.enabled;
    let showThemeToggle = (() => {
      const toggle = config2?.themeToggle;
      if (toggle === void 0 || toggle === true) return true;
      if (toggle === false) return false;
      if (typeof toggle === "object") return toggle.enabled !== false;
      return true;
    })();
    let forcedTheme = (() => {
      const toggle = config2?.themeToggle;
      if (typeof toggle === "object" && toggle.enabled === false && toggle.default && toggle.default !== "system") {
        return toggle.default;
      }
      return null;
    })();
    let themeInitScript = (() => {
      if (forcedTheme) {
        return `document.documentElement.classList.remove('light','dark');document.documentElement.classList.add('${forcedTheme}')`;
      }
      return [
        "(function(){",
        "var m=document.cookie.match(/(?:^|;\\s*)theme=(\\w+)/);",
        "var t=m?m[1]:(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');",
        "document.documentElement.classList.remove('light','dark');",
        "document.documentElement.classList.add(t);",
        "})()"
      ].join("");
    })();
    let sidebarOpen = false;
    function isActive(url) {
      const current = store_get($$store_subs ??= {}, "$page", page).url.pathname;
      const normalised = url.replace(/\/$/, "") || "/";
      const currentNorm = current.replace(/\/$/, "") || "/";
      return normalised === currentNorm;
    }
    const ICON_MAP = {
      book: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
      terminal: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
      rocket: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>`,
      settings: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
      shield: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
      puzzle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.23 8.77c.24-.24.581-.353.917-.303.515.076.84.523 1.02.968a2.501 2.501 0 1 0 3.237-3.237c-.464-.18-.894-.527-.968-1.02a1.025 1.025 0 0 1 .303-.917l1.525-1.525A2.402 2.402 0 0 1 12 1.998c.617 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.969a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02Z"/></svg>`,
      zap: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>`,
      database: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`,
      key: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/></svg>`,
      mail: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
      file: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
      folder: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
      link: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
      lightbulb: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`,
      code: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
      users: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      globe: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
      lock: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
    };
    function getIcon(iconKey) {
      if (!iconKey) return null;
      return ICON_MAP[iconKey] || null;
    }
    const COLOR_MAP = {
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
      ring: "--color-fd-ring"
    };
    function buildColorsCSS(colors) {
      if (!colors) return "";
      const vars = [];
      for (const [key, value] of Object.entries(colors)) {
        if (!value || !COLOR_MAP[key]) continue;
        vars.push(`${COLOR_MAP[key]}: ${value};`);
      }
      if (vars.length === 0) return "";
      return `.dark {
  ${vars.join("\n  ")}
}`;
    }
    function buildFontStyleVars(prefix, style) {
      if (!style) return "";
      const parts = [];
      if (style.size) parts.push(`${prefix}-size: ${style.size};`);
      if (style.weight != null) parts.push(`${prefix}-weight: ${style.weight};`);
      if (style.lineHeight) parts.push(`${prefix}-line-height: ${style.lineHeight};`);
      if (style.letterSpacing) parts.push(`${prefix}-letter-spacing: ${style.letterSpacing};`);
      return parts.join("\n  ");
    }
    function buildTypographyCSS(typo) {
      if (!typo?.font) return "";
      const vars = [];
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
      return `:root {
  ${vars.join("\n  ")}
}`;
    }
    function buildLayoutCSS(layout) {
      if (!layout) return "";
      const rootVars = [];
      const desktopVars = [];
      if (layout.sidebarWidth) desktopVars.push(`--fd-sidebar-width: ${layout.sidebarWidth}px;`);
      if (layout.contentWidth) rootVars.push(`--fd-content-width: ${layout.contentWidth}px;`);
      if (layout.tocWidth) desktopVars.push(`--fd-toc-width: ${layout.tocWidth}px;`);
      if (rootVars.length === 0 && desktopVars.length === 0) return "";
      const parts = [];
      if (rootVars.length > 0) parts.push(`:root {
  ${rootVars.join("\n  ")}
}`);
      if (desktopVars.length > 0) parts.push(`@media (min-width: 1024px) {
  :root {
    ${desktopVars.join("\n    ")}
  }
}`);
      return parts.join("\n");
    }
    let overrideCSS = (() => {
      const colorOverrides = config2?.theme?._userColorOverrides;
      const typography = config2?.theme?.ui?.typography;
      const layout = config2?.theme?.ui?.layout;
      return [
        buildColorsCSS(colorOverrides),
        buildTypographyCSS(typography),
        buildLayoutCSS(layout)
      ].filter(Boolean).join("\n");
    })();
    const styleTagOpen = "<style>";
    const styleTagClose = "</style>";
    function defaultSidebar($$renderer3) {
      if (tree?.children) {
        $$renderer3.push("<!--[-->");
        $$renderer3.push(`<!--[-->`);
        const each_array = ensure_array_like(tree.children);
        for (let i = 0, $$length = each_array.length; i < $$length; i++) {
          let node = each_array[i];
          if (node.type === "page") {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<a${attr("href", node.url)}${attr_class("fd-sidebar-link fd-sidebar-top-link", void 0, {
              "fd-sidebar-link-active": isActive(node.url),
              "fd-sidebar-first-item": i === 0
            })}${attr("data-active", isActive(node.url))}>`);
            if (getIcon(node.icon)) {
              $$renderer3.push("<!--[-->");
              $$renderer3.push(`<span class="fd-sidebar-icon">${html(getIcon(node.icon))}</span>`);
            } else {
              $$renderer3.push("<!--[!-->");
            }
            $$renderer3.push(`<!--]--> ${escape_html(node.name)}</a>`);
          } else if (node.type === "folder") {
            $$renderer3.push("<!--[1-->");
            $$renderer3.push(`<details${attr_class("fd-sidebar-folder", void 0, { "fd-sidebar-first-item": i === 0 })} open=""><summary class="fd-sidebar-folder-trigger"><span class="fd-sidebar-folder-label">`);
            if (getIcon(node.icon)) {
              $$renderer3.push("<!--[-->");
              $$renderer3.push(`<span class="fd-sidebar-icon">${html(getIcon(node.icon))}</span>`);
            } else {
              $$renderer3.push("<!--[!-->");
            }
            $$renderer3.push(`<!--]--> ${escape_html(node.name)}</span> <svg class="fd-sidebar-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"></polyline></svg></summary> <div class="fd-sidebar-folder-content">`);
            if (node.index) {
              $$renderer3.push("<!--[-->");
              $$renderer3.push(`<a${attr("href", node.index.url)}${attr_class("fd-sidebar-link fd-sidebar-child-link", void 0, { "fd-sidebar-link-active": isActive(node.index.url) })}${attr("data-active", isActive(node.index.url))}>${escape_html(node.index.name)}</a>`);
            } else {
              $$renderer3.push("<!--[!-->");
            }
            $$renderer3.push(`<!--]--> <!--[-->`);
            const each_array_1 = ensure_array_like(node.children);
            for (let $$index_1 = 0, $$length2 = each_array_1.length; $$index_1 < $$length2; $$index_1++) {
              let child = each_array_1[$$index_1];
              if (child.type === "page") {
                $$renderer3.push("<!--[-->");
                $$renderer3.push(`<a${attr("href", child.url)}${attr_class("fd-sidebar-link fd-sidebar-child-link", void 0, { "fd-sidebar-link-active": isActive(child.url) })}${attr("data-active", isActive(child.url))}>${escape_html(child.name)}</a>`);
              } else if (child.type === "folder") {
                $$renderer3.push("<!--[1-->");
                $$renderer3.push(`<details class="fd-sidebar-folder fd-sidebar-nested-folder" open=""><summary class="fd-sidebar-folder-trigger"><span class="fd-sidebar-folder-label">${escape_html(child.name)}</span> <svg class="fd-sidebar-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"></polyline></svg></summary> <div class="fd-sidebar-folder-content">`);
                if (child.index) {
                  $$renderer3.push("<!--[-->");
                  $$renderer3.push(`<a${attr("href", child.index.url)}${attr_class("fd-sidebar-link fd-sidebar-child-link", void 0, { "fd-sidebar-link-active": isActive(child.index.url) })}${attr("data-active", isActive(child.index.url))}>${escape_html(child.index.name)}</a>`);
                } else {
                  $$renderer3.push("<!--[!-->");
                }
                $$renderer3.push(`<!--]--> <!--[-->`);
                const each_array_2 = ensure_array_like(child.children);
                for (let $$index = 0, $$length3 = each_array_2.length; $$index < $$length3; $$index++) {
                  let grandchild = each_array_2[$$index];
                  if (grandchild.type === "page") {
                    $$renderer3.push("<!--[-->");
                    $$renderer3.push(`<a${attr("href", grandchild.url)}${attr_class("fd-sidebar-link fd-sidebar-child-link", void 0, { "fd-sidebar-link-active": isActive(grandchild.url) })}${attr("data-active", isActive(grandchild.url))}>${escape_html(grandchild.name)}</a>`);
                  } else {
                    $$renderer3.push("<!--[!-->");
                  }
                  $$renderer3.push(`<!--]-->`);
                }
                $$renderer3.push(`<!--]--></div></details>`);
              } else {
                $$renderer3.push("<!--[!-->");
              }
              $$renderer3.push(`<!--]-->`);
            }
            $$renderer3.push(`<!--]--></div></details>`);
          } else {
            $$renderer3.push("<!--[!-->");
          }
          $$renderer3.push(`<!--]-->`);
        }
        $$renderer3.push(`<!--]-->`);
      } else {
        $$renderer3.push("<!--[!-->");
      }
      $$renderer3.push(`<!--]-->`);
    }
    head("1dslliw", $$renderer2, ($$renderer3) => {
      $$renderer3.push(`${html(`<script>${themeInitScript}<\/script>`)} `);
      if (overrideCSS) {
        $$renderer3.push("<!--[-->");
        $$renderer3.push(`${html(`${styleTagOpen}${overrideCSS}${styleTagClose}`)}`);
      } else {
        $$renderer3.push("<!--[!-->");
      }
      $$renderer3.push(`<!--]-->`);
    });
    $$renderer2.push(`<div class="fd-layout"><header class="fd-header"><button class="fd-menu-btn" aria-label="Toggle sidebar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button> <a${attr("href", resolvedTitleUrl)} class="fd-header-title">${escape_html(resolvedTitle)}</a> `);
    if (showSearch) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<button class="fd-search-trigger-mobile" aria-label="Search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></button>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></header> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <aside${attr_class("fd-sidebar", void 0, { "fd-sidebar-open": sidebarOpen })}><div class="fd-sidebar-header"><a${attr("href", resolvedTitleUrl)} class="fd-sidebar-title"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> ${escape_html(resolvedTitle)}</a></div> `);
    if (showSearch) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="fd-sidebar-search"><button class="fd-sidebar-search-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> <span>Search</span> <kbd>⌘</kbd><kbd>K</kbd></button></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (sidebarHeader) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="fd-sidebar-banner">`);
      sidebarHeader($$renderer2);
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <nav class="fd-sidebar-nav">`);
    if (sidebar) {
      $$renderer2.push("<!--[-->");
      sidebar($$renderer2, { tree, isActive });
      $$renderer2.push(`<!---->`);
    } else {
      $$renderer2.push("<!--[!-->");
      defaultSidebar($$renderer2);
    }
    $$renderer2.push(`<!--]--></nav> `);
    if (sidebarFooter) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="fd-sidebar-footer-custom">`);
      sidebarFooter($$renderer2);
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (showThemeToggle) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="fd-sidebar-footer">`);
      ThemeToggle($$renderer2);
      $$renderer2.push(`<!----></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></aside> <main class="fd-main">`);
    children($$renderer2);
    $$renderer2.push(`<!----></main></div> `);
    if (showFloatingAI) {
      $$renderer2.push("<!--[-->");
      FloatingAIChat($$renderer2, {
        suggestedQuestions: config2.ai.suggestedQuestions ?? [],
        aiLabel: config2.ai.aiLabel ?? "AI",
        position: config2.ai.position ?? "bottom-right",
        floatingStyle: config2.ai.floatingStyle ?? "panel"
      });
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data, children } = $$props;
    DocsLayout($$renderer2, {
      tree: data.tree,
      config,
      children: ($$renderer3) => {
        children($$renderer3);
        $$renderer3.push(`<!---->`);
      }
    });
  });
}
export {
  _layout as default
};
