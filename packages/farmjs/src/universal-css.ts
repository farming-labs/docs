/**
 * Rules the renderer-neutral docs UI needs beyond the theme's stylesheet: what the theme's
 * components set as props, such as the grid the React layout sets as an inline style, nested
 * sidebar and table of contents indents, the contents' track, and which theme toggle icon is on.
 *
 * The docs server appends them to `/__farm_docs/browser.css` rather than the page writing a
 * `<style>`: renderers write raw text inside `<style>` differently (Svelte adds a hydration
 * marker), and React and Vue escape the quotes these rules need. Every selector requires
 * `[data-farm-docs-ui]`, so the React UI's pages match none of them.
 */
export const FARM_DOCS_UNIVERSAL_CSS = `#nd-docs-layout[data-farm-docs-ui]{grid-template:"sidebar sidebar header toc toc" "sidebar sidebar toc-popover toc toc" "sidebar sidebar tabs toc toc" "sidebar sidebar main toc toc" 1fr / minmax(min-content,1fr) var(--fd-sidebar-col) minmax(0,calc(var(--fd-layout-width,97rem) - var(--fd-sidebar-width) - var(--fd-toc-width))) var(--fd-toc-width) minmax(min-content,1fr);--fd-docs-row-1:var(--fd-banner-height,0px);--fd-docs-row-2:calc(var(--fd-docs-row-1) + var(--fd-header-height));--fd-docs-row-3:calc(var(--fd-docs-row-2) + var(--fd-toc-popover-height));--fd-sidebar-col:var(--fd-sidebar-width)}
#nd-docs-layout[data-farm-docs-ui] [data-depth]{padding-inline-start:calc((2 + 3 * var(--farm-docs-depth,0)) * var(--spacing))}
#nd-docs-layout[data-farm-docs-ui] [data-depth="1"]{--farm-docs-depth:1}
#nd-docs-layout[data-farm-docs-ui] [data-depth="2"]{--farm-docs-depth:2}
#nd-docs-layout[data-farm-docs-ui] [data-depth="3"]{--farm-docs-depth:3}
#nd-docs-layout[data-farm-docs-ui] [data-state="open"]>button>span>svg{rotate:none}
#nd-docs-layout[data-farm-docs-ui] [data-toc-depth]{padding-inline-start:20px;border-inline-start:1px solid color-mix(in oklab,var(--color-fd-foreground) 10%,transparent)}
#nd-docs-layout[data-farm-docs-ui] [data-toc-depth="3"]{padding-inline-start:32px}
#nd-docs-layout[data-farm-docs-ui] [data-toc-depth="4"]{padding-inline-start:44px}
#nd-docs-layout[data-farm-docs-ui] [data-toc-depth][data-active="true"]{border-inline-start-color:var(--color-fd-primary)}
html:not(.dark) #nd-docs-layout[data-farm-docs-ui] [data-theme-toggle] .lucide-sun,html.dark #nd-docs-layout[data-farm-docs-ui] [data-theme-toggle] .lucide-moon{background:var(--color-fd-accent);color:var(--color-fd-accent-foreground)}`;
