/**
 * The docs UI for an app on any Farm renderer, shared by its server and browser entries
 * (`universal.ts` and `universal.browser.ts`). It builds the page with the app renderer's own
 * `createElement()`, writes it with that renderer's `renderToString()`, and hydrates it with its
 * `hydrateRoot()`, so `withDocs(defineConfig({ renderer: leaf() }))` needs no docs UI of its own.
 *
 * The page uses the React UI's DOM and classes, so the same stylesheet styles it, with the rules in
 * `universal-css.ts` that the docs server appends to it. It uses host elements only (no
 * components, events, or style objects) to stay within what every renderer writes the same way,
 * and plain DOM listeners add the interactive parts.
 */
import type { DocsConfig } from "@farming-labs/docs";
import type { FolderNode, NavNode, PageNode } from "./content.js";
import type {
  DocsServerLoadResult,
  FarmDocsClientRenderer,
  FarmDocsHydrateInput,
} from "./server.js";

/** A renderer's `createElement()`. */
export type FarmDocsCreateElement = (
  type: string,
  props?: Record<string, unknown> | null,
  ...children: unknown[]
) => unknown;

/** A heading in the page's table of contents. */
export interface FarmDocsTocItem {
  /** The heading's text. */
  title: string;
  /** `#` and the heading's id. */
  url: string;
  /** 2 to 4, for h2 to h4. */
  depth: number;
}

export interface FarmDocsLayoutInput {
  config: DocsConfig;
  data: DocsServerLoadResult;
  /** The page's Markdown, as HTML. */
  contentHtml: string;
  /** The page's h2 to h4 headings. The server reads them from `contentHtml`. */
  toc?: readonly FarmDocsTocItem[];
}

/** Marks the element whose HTML is the page's Markdown, which the browser reads back. */
const CONTENT_ATTRIBUTE = "data-farm-docs-content";
/** Marks the table of contents, whose items the browser reads back. */
const TOC_ATTRIBUTE = "data-farm-docs-toc";

const LAYOUT_CLASS =
  "grid overflow-x-clip min-h-(--fd-docs-height) [--fd-docs-height:100dvh] [--fd-header-height:0px] [--fd-toc-popover-height:0px] [--fd-sidebar-width:0px] [--fd-toc-width:0px] transition-[--fd-sidebar-col]";
const SUBNAV_CLASS =
  "[grid-area:header] sticky top-(--fd-docs-row-1) z-30 flex items-center ps-4 pe-2.5 border-b transition-colors backdrop-blur-sm h-(--fd-header-height) md:hidden max-md:layout:[--fd-header-height:--spacing(14)] data-[transparent=false]:bg-fd-background/80";
const ICON_BUTTON_CLASS =
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fd-ring hover:bg-fd-accent hover:text-fd-accent-foreground [&_svg]:size-4.5 p-2";
const SIDEBAR_PLACEHOLDER_CLASS =
  "sticky top-(--fd-docs-row-1) z-20 [grid-area:sidebar] pointer-events-none *:pointer-events-auto h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] md:layout:[--fd-sidebar-width:268px] max-md:hidden";
const SIDEBAR_CLASS =
  "absolute flex flex-col w-full inset-s-0 inset-y-0 items-end bg-fd-card text-sm border-e duration-250 *:w-(--fd-sidebar-width)";
const SIDEBAR_VIEWPORT_CLASS =
  "size-full rounded-[inherit] p-4 overscroll-contain overflow-y-auto flex flex-col gap-0.5";
const SIDEBAR_ITEM_CLASS =
  "relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere [&_svg]:size-4 [&_svg]:shrink-0 transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none";
const SIDEBAR_LINK_CLASS = `${SIDEBAR_ITEM_CLASS} data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary data-[active=true]:hover:transition-colors`;
const FOLDER_CONTENT_CLASS =
  "overflow-hidden relative flex flex-col gap-0.5 before:content-[''] before:absolute before:w-px before:inset-y-1 before:bg-fd-border before:inset-s-2.5";
const THEME_TOGGLE_CLASS =
  "inline-flex items-center border p-1 overflow-hidden px-1 py-0 border-y-0 border-e-0 rounded-none ms-auto *:rounded-md";
const MAIN_CLASS = "grid [grid-area:main] justify-items-center";
const ARTICLE_CLASS =
  "flex flex-col min-w-0 w-full max-w-[900px] px-4 py-6 gap-4 md:px-6 md:pt-8 xl:px-8 xl:pt-14";
const MOBILE_SIDEBAR_CLASS =
  "fixed inset-0 z-40 flex flex-col gap-0.5 overflow-y-auto bg-fd-background p-4 text-sm md:hidden";
const TOC_CLASS =
  "sticky top-(--fd-docs-row-1) h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] flex flex-col [grid-area:toc] w-(--fd-toc-width) pt-12 pe-4 pb-2 xl:layout:[--fd-toc-width:268px] max-xl:hidden";
const TOC_SCROLL_CLASS =
  "relative min-h-0 text-sm ms-px overflow-auto overscroll-contain [scrollbar-width:none] mask-[linear-gradient(to_bottom,transparent,white_16px,white_calc(100%-16px),transparent)] py-3";
const TOC_ITEM_CLASS =
  "prose prose-sm relative py-1.5 scroll-m-4 text-fd-muted-foreground hover:text-fd-accent-foreground transition-colors wrap-anywhere data-[active=true]:text-fd-primary";

const SVG_ATTRIBUTES =
  'xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const ICONS = {
  sidebar: `<svg ${SVG_ATTRIBUTES} class="lucide lucide-panel-left"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M9 3v18"></path></svg>`,
  chevron: `<svg ${SVG_ATTRIBUTES} class="lucide lucide-chevron-down ms-auto transition-transform -rotate-90 rtl:rotate-90"><path d="m6 9 6 6 6-6"></path></svg>`,
  sun: `<svg ${SVG_ATTRIBUTES.replace('fill="none"', 'fill="currentColor"')} class="lucide lucide-sun size-6.5 p-1.5 text-fd-muted-foreground"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2"></path><path d="M12 20v2"></path><path d="m4.93 4.93 1.41 1.41"></path><path d="m17.66 17.66 1.41 1.41"></path><path d="M2 12h2"></path><path d="M20 12h2"></path><path d="m6.34 17.66-1.41 1.41"></path><path d="m19.07 4.93-1.41 1.41"></path></svg>`,
  moon: `<svg ${SVG_ATTRIBUTES.replace('fill="none"', 'fill="currentColor"')} class="lucide lucide-moon size-6.5 p-1.5 text-fd-muted-foreground"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"></path></svg>`,
  previous:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>',
  next: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>',
  text: `<svg ${SVG_ATTRIBUTES} class="lucide lucide-text size-4"><path d="M15 18H3"></path><path d="M17 6H3"></path><path d="M21 12H3"></path></svg>`,
} as const;

function icon(h: FarmDocsCreateElement, name: keyof typeof ICONS): unknown {
  return h("span", { className: "contents", dangerouslySetInnerHTML: { __html: ICONS[name] } });
}

function isEnabledByDefault(value: unknown): boolean {
  if (value === false) return false;
  if (value && typeof value === "object" && "enabled" in value) {
    return (value as { enabled?: unknown }).enabled !== false;
  }
  return true;
}

function navTitle(config: DocsConfig): string {
  const title = (config.nav as { title?: unknown } | undefined)?.title;
  return typeof title === "string" && title.trim() ? title : "Docs";
}

function homeHref(config: DocsConfig, data: DocsServerLoadResult): string {
  const url = (config.nav as { url?: unknown } | undefined)?.url;
  if (typeof url === "string" && url) return url;
  return `/${(data.entry ?? config.entry ?? "docs").replace(/^\/+|\/+$/g, "")}`;
}

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function containsPage(node: NavNode, url: string): boolean {
  if (node.type === "page") return normalizePath(node.url) === url;
  if (node.type !== "folder") return false;
  if (node.index && normalizePath(node.index.url) === url) return true;
  return node.children.some((child) => containsPage(child, url));
}

function sidebarPage(
  h: FarmDocsCreateElement,
  page: PageNode,
  depth: number,
  activeUrl: string,
): unknown {
  return h(
    "a",
    {
      key: page.url,
      href: page.url,
      className: SIDEBAR_LINK_CLASS,
      "data-depth": String(depth),
      "data-active": normalizePath(page.url) === activeUrl ? "true" : "false",
      ...(normalizePath(page.url) === activeUrl ? { "aria-current": "page" } : {}),
    },
    page.name,
  );
}

function sidebarFolder(
  h: FarmDocsCreateElement,
  folder: FolderNode,
  depth: number,
  activeUrl: string,
  key: string,
): unknown {
  const open = Boolean(folder.defaultOpen) || containsPage(folder, activeUrl);
  const state = open ? "open" : "closed";
  return h(
    "div",
    { key, "data-state": state, "data-farm-docs-folder": "" },
    h(
      "button",
      {
        type: "button",
        className: `${SIDEBAR_ITEM_CLASS} w-full`,
        "data-depth": String(depth),
        "aria-expanded": open ? "true" : "false",
        "data-state": state,
      },
      folder.name,
      icon(h, "chevron"),
    ),
    h(
      "div",
      { className: FOLDER_CONTENT_CLASS, "data-state": state, hidden: !open },
      folder.index ? sidebarPage(h, folder.index, depth + 1, activeUrl) : null,
      sidebarNodes(h, folder.children, depth + 1, activeUrl, key),
    ),
  );
}

function sidebarNodes(
  h: FarmDocsCreateElement,
  nodes: readonly NavNode[],
  depth: number,
  activeUrl: string,
  parentKey = "",
): unknown[] {
  return nodes.map((node, index) =>
    node.type === "page"
      ? sidebarPage(h, node, depth, activeUrl)
      : sidebarFolder(h, node, depth, activeUrl, `${parentKey}/${index}:${node.name}`),
  );
}

function pageFooter(h: FarmDocsCreateElement, config: DocsConfig, data: DocsServerLoadResult) {
  const llms = isEnabledByDefault((config as { llmsTxt?: unknown }).llmsTxt);
  if (!llms && !data.lastModified) return null;
  return h(
    "div",
    { className: "not-prose fd-page-footer" },
    llms
      ? h(
          "span",
          { className: "fd-llms-txt-links" },
          h(
            "a",
            {
              href: "/llms.txt",
              target: "_blank",
              rel: "noopener noreferrer",
              className: "fd-llms-txt-link",
            },
            "llms.txt",
          ),
          h(
            "a",
            {
              href: "/llms-full.txt",
              target: "_blank",
              rel: "noopener noreferrer",
              className: "fd-llms-txt-link",
            },
            "llms-full.txt",
          ),
        )
      : null,
    data.lastModified
      ? h("span", { className: "fd-last-updated-footer" }, `Last updated ${data.lastModified}`)
      : null,
  );
}

function pageNavigation(h: FarmDocsCreateElement, data: DocsServerLoadResult) {
  if (!data.previousPage && !data.nextPage) return null;
  const previous = data.previousPage;
  const next = data.nextPage;
  return h(
    "nav",
    { className: "not-prose fd-page-nav", "aria-label": "Page navigation" },
    previous
      ? h(
          "a",
          { href: previous.url, className: "fd-page-nav-card fd-page-nav-prev" },
          h(
            "span",
            { className: "fd-page-nav-title fd-page-nav-title-prev" },
            icon(h, "previous"),
            previous.name,
          ),
          h("span", { className: "fd-page-nav-description" }, "Previous Page"),
        )
      : h("div", { "aria-hidden": "true" }),
    next
      ? h(
          "a",
          { href: next.url, className: "fd-page-nav-card fd-page-nav-next" },
          h(
            "span",
            { className: "fd-page-nav-title fd-page-nav-title-next" },
            next.name,
            icon(h, "next"),
          ),
          h("span", { className: "fd-page-nav-description" }, "Next Page"),
        )
      : h("div", { "aria-hidden": "true" }),
  );
}

function tocEnabled(config: DocsConfig): boolean {
  const toc = (config.theme as { ui?: { layout?: { toc?: { enabled?: unknown } } } } | undefined)
    ?.ui?.layout?.toc;
  return toc?.enabled !== false;
}

/**
 * The table of contents on wide screens, with the React UI's classes. Its indents and track live
 * in `universal-css.ts`, since the React UI sets them as inline styles. Without headings, the
 * placeholder still reserves the column, as on the React UI.
 */
function tableOfContents(
  h: FarmDocsCreateElement,
  config: DocsConfig,
  toc: readonly FarmDocsTocItem[],
) {
  if (!tocEnabled(config)) return h("div", { id: "nd-toc-placeholder", className: "hidden" });
  if (toc.length === 0) {
    return h("div", {
      id: "nd-toc-placeholder",
      className: "hidden xl:layout:[--fd-toc-width:268px]",
    });
  }
  return h(
    "div",
    { id: "nd-toc", className: TOC_CLASS, [TOC_ATTRIBUTE]: "" },
    h(
      "h3",
      {
        id: "toc-title",
        className: "inline-flex items-center gap-1.5 text-sm text-fd-muted-foreground",
      },
      icon(h, "text"),
      "On this page",
    ),
    h(
      "div",
      { className: TOC_SCROLL_CLASS },
      h(
        "div",
        { className: "relative flex flex-col" },
        ...toc.map((item, index) =>
          h(
            "a",
            {
              key: item.url,
              href: item.url,
              className: `${TOC_ITEM_CLASS}${index === 0 ? " pt-0" : ""}${index === toc.length - 1 ? " pb-0" : ""}`,
              "data-toc-depth": String(item.depth),
              "data-active": "false",
            },
            item.title,
          ),
        ),
      ),
    ),
  );
}

/** The table of contents the server wrote, read back so the browser builds the same tree. */
function readToc(container: Element): FarmDocsTocItem[] {
  return [...container.querySelectorAll(`[${TOC_ATTRIBUTE}] a[data-toc-depth]`)].map((link) => ({
    title: link.textContent ?? "",
    url: link.getAttribute("href") ?? "",
    depth: Number(link.getAttribute("data-toc-depth")),
  }));
}

/**
 * The docs page, built with `h`, a renderer's `createElement()`. The server and the browser call
 * it with the same input, so the browser's tree matches the HTML the server wrote.
 */
export function createFarmDocsLayout(h: FarmDocsCreateElement, input: FarmDocsLayoutInput) {
  const { config, data, contentHtml } = input;
  const title = navTitle(config);
  const home = homeHref(config, data);
  const activeUrl = normalizePath(data.url);
  const description = data.descriptionInBody ? undefined : data.description;

  return h(
    "div",
    {
      id: "nd-docs-layout",
      className: LAYOUT_CLASS,
      "data-farm-docs-ui": "universal",
      "data-sidebar-collapsed": "false",
      // The theme's browser layout rules key off this, as on the React UI's layout.
      "data-fd-browser-adapter": "",
    },
    h(
      "header",
      { id: "nd-subnav", className: SUBNAV_CLASS, "data-transparent": "false" },
      h("a", { href: home, className: "inline-flex items-center gap-2.5 font-semibold" }, title),
      h("div", { className: "flex-1" }),
      h(
        "button",
        {
          type: "button",
          className: ICON_BUTTON_CLASS,
          "aria-label": "Open Sidebar",
          "aria-expanded": "false",
          "aria-controls": "nd-sidebar-mobile",
          "data-farm-docs-sidebar-toggle": "",
        },
        icon(h, "sidebar"),
      ),
    ),
    h(
      "nav",
      {
        id: "nd-sidebar-mobile",
        className: MOBILE_SIDEBAR_CLASS,
        "aria-label": title,
        hidden: true,
      },
      h(
        "div",
        { className: "flex items-center pb-2" },
        h("a", { href: home, className: "font-medium me-auto" }, title),
        h(
          "button",
          {
            type: "button",
            className: ICON_BUTTON_CLASS,
            "aria-label": "Close Sidebar",
            "aria-controls": "nd-sidebar-mobile",
            "data-farm-docs-sidebar-close": "",
          },
          icon(h, "sidebar"),
        ),
      ),
      ...sidebarNodes(h, data.tree.children, 0, activeUrl, "mobile"),
    ),
    h(
      "div",
      { className: SIDEBAR_PLACEHOLDER_CLASS, "data-sidebar-placeholder": "" },
      h(
        "aside",
        { id: "nd-sidebar", className: SIDEBAR_CLASS, "data-collapsed": "false" },
        h(
          "div",
          { className: "flex flex-col gap-3 p-4 pb-2" },
          h(
            "div",
            { className: "flex" },
            h(
              "a",
              {
                href: home,
                className: "inline-flex text-[0.9375rem] items-center gap-2.5 font-medium me-auto",
              },
              title,
            ),
          ),
        ),
        h(
          "nav",
          { className: "overflow-hidden min-h-0 flex-1", "aria-label": title },
          h(
            "div",
            { className: SIDEBAR_VIEWPORT_CLASS },
            ...sidebarNodes(h, data.tree.children, 0, activeUrl, "desktop"),
          ),
        ),
        h(
          "div",
          { className: "flex flex-col p-4 pt-2" },
          h(
            "div",
            {
              className:
                "flex text-fd-muted-foreground items-center border bg-fd-secondary/50 p-0.5 pe-0 rounded-lg",
            },
            h(
              "button",
              {
                type: "button",
                className: THEME_TOGGLE_CLASS,
                "aria-label": "Toggle Theme",
                "data-theme-toggle": "",
              },
              icon(h, "sun"),
              icon(h, "moon"),
            ),
          ),
        ),
      ),
    ),
    h(
      "main",
      { className: MAIN_CLASS, "data-layout-main": "" },
      h(
        "article",
        {
          id: "nd-page",
          className: ARTICLE_CLASS,
          "data-layout-content": "",
          "data-full": "false",
        },
        h(
          "div",
          { className: "prose flex-1 flex flex-col fd-page-body" },
          h("div", {
            className: "fd-docs-content flex-1",
            [CONTENT_ATTRIBUTE]: "",
            dangerouslySetInnerHTML: { __html: contentHtml },
          }),
          description
            ? h(
                "div",
                { className: "fd-title-decorations-fallback", hidden: true },
                h("p", { className: "fd-page-description" }, description),
              )
            : null,
          pageFooter(h, config, data),
          pageNavigation(h, data),
        ),
      ),
    ),
    tableOfContents(h, config, input.toc ?? []),
  );
}

export function missingRenderer(where: "server" | "browser"): Error {
  return new Error(
    `The docs UI @farming-labs/farmjs/universal builds pages with the app's renderer, and Farm ` +
      `did not pass it in the ${where}. Upgrade @farm.js/core to a release that passes ` +
      "`renderer` to docs UIs, or use a UI written for your renderer with withDocs({ ui }).",
  );
}

/** What `hydrateFarmDocs()` returns: stop the page's listeners and unmount the root. */
export interface FarmDocsUniversalRoot {
  unmount(): void;
}

/**
 * Hydrates the server's docs page with the app's renderer. The page's Markdown stays the HTML the
 * server wrote: the browser reads it back from the page instead of downloading it again.
 */
export function hydrateFarmDocs(
  input: FarmDocsHydrateInput & { container?: Element | null },
): FarmDocsUniversalRoot {
  const renderer: FarmDocsClientRenderer | undefined = input.renderer;
  if (!renderer) throw missingRenderer("browser");
  const container = input.container ?? document.getElementById("farm-docs-root");
  if (!container) throw new Error("Farm docs hydration root was not found.");

  const contentHtml = container.querySelector(`[${CONTENT_ATTRIBUTE}]`)?.innerHTML ?? "";
  const root = renderer.hydrateRoot(
    container,
    createFarmDocsLayout(renderer.createElement as FarmDocsCreateElement, {
      config: input.config,
      data: input.data,
      contentHtml,
      toc: readToc(container),
    }),
  );
  const detach = attachFarmDocsBehaviors(container);
  return {
    unmount() {
      detach();
      root.unmount();
    },
  };
}

const COPIED_MS = 1500;

function setTheme(theme: "light" | "dark"): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Storage can be unavailable (private windows, blocked site data); the page still switches.
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The interactive parts, as plain DOM listeners on the docs root: folders, the theme toggle, the
 * mobile sidebar, and copy buttons on code blocks and heading anchors. Returns a function that
 * removes them.
 */
export function attachFarmDocsBehaviors(container: Element): () => void {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const mobileSidebar = () => container.querySelector<HTMLElement>("#nd-sidebar-mobile");
  const sidebarToggle = () =>
    container.querySelector<HTMLElement>("[data-farm-docs-sidebar-toggle]");

  const setMobileSidebar = (open: boolean) => {
    const sidebar = mobileSidebar();
    if (!sidebar) return;
    sidebar.hidden = !open;
    sidebarToggle()?.setAttribute("aria-expanded", open ? "true" : "false");
  };

  const markCopied = (button: HTMLElement) => {
    button.setAttribute("data-checked", "");
    const timer = setTimeout(() => {
      timers.delete(timer);
      button.removeAttribute("data-checked");
    }, COPIED_MS);
    timers.add(timer);
  };

  const onClick = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLElement>("button");
    if (!button || !container.contains(button)) return;

    if (button.hasAttribute("data-theme-toggle")) {
      setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
      return;
    }
    if (button.hasAttribute("data-farm-docs-sidebar-toggle")) {
      setMobileSidebar(mobileSidebar()?.hidden ?? false);
      return;
    }
    if (button.hasAttribute("data-farm-docs-sidebar-close")) {
      setMobileSidebar(false);
      return;
    }

    const folder = button.parentElement;
    if (folder?.hasAttribute("data-farm-docs-folder") && button === folder.firstElementChild) {
      const open = button.getAttribute("aria-expanded") !== "true";
      const state = open ? "open" : "closed";
      button.setAttribute("aria-expanded", String(open));
      for (const element of [folder, button, button.nextElementSibling]) {
        element?.setAttribute("data-state", state);
      }
      if (button.nextElementSibling instanceof HTMLElement) {
        button.nextElementSibling.hidden = !open;
      }
      return;
    }

    const code = button.closest("figure")?.querySelector("pre");
    if (code && button.closest(`[${CONTENT_ATTRIBUTE}]`)) {
      void copyText(code.textContent ?? "").then((copied) => copied && markCopied(button));
      return;
    }
    const heading = button.closest("h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]");
    if (heading && button.closest(`[${CONTENT_ATTRIBUTE}]`)) {
      const url = new URL(window.location.href);
      url.hash = heading.id;
      void copyText(url.href).then((copied) => copied && markCopied(button));
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && mobileSidebar()?.hidden === false) setMobileSidebar(false);
  };

  container.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeyDown);
  const stopWatchingHeadings = watchTocHeadings(container);
  return () => {
    container.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKeyDown);
    stopWatchingHeadings();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
}

/**
 * Marks the table of contents items whose headings are on screen. When none is, the items marked
 * last stay marked, so the reader still sees which section they are in.
 */
function watchTocHeadings(container: Element): () => void {
  const links = new Map<string, Element>();
  for (const link of container.querySelectorAll(`[${TOC_ATTRIBUTE}] a[data-toc-depth]`)) {
    links.set((link.getAttribute("href") ?? "").slice(1), link);
  }
  if (links.size === 0 || typeof IntersectionObserver === "undefined") return () => {};

  const visible = new Set<string>();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) visible.add(entry.target.id);
      else visible.delete(entry.target.id);
    }
    if (visible.size === 0) return;
    for (const [id, link] of links) {
      link.setAttribute("data-active", visible.has(id) ? "true" : "false");
    }
  });
  for (const heading of container.querySelectorAll(`[${CONTENT_ATTRIBUTE}] [id]`)) {
    if (links.has(heading.id)) observer.observe(heading);
  }
  return () => observer.disconnect();
}
