import "@sveltejs/kit/internal";
import "../../../../chunks/exports.js";
import "../../../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../../../chunks/root.js";
import "../../../../chunks/state.svelte.js";
import { c as config } from "../../../../chunks/docs.config.js";
import { f as ssr_context, a as attr, e as escape_html, b as attr_class, d as ensure_array_like, i as attr_style, j as stringify, c as store_get, u as unsubscribe_stores, h as head } from "../../../../chunks/index2.js";
import { p as page, h as html } from "../../../../chunks/stores.js";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
function Breadcrumb($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { pathname = "" } = $$props;
    let segments = (() => {
      return pathname.split("/").filter(Boolean);
    })();
    let parentLabel = (() => {
      if (segments.length < 2) return "";
      return segments[segments.length - 2].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    })();
    let currentLabel = (() => {
      if (segments.length < 2) return "";
      return segments[segments.length - 1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    })();
    let parentUrl = (() => {
      if (segments.length < 2) return "";
      return "/" + segments.slice(0, segments.length - 1).join("/");
    })();
    if (segments.length >= 2) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<nav class="fd-breadcrumb" aria-label="Breadcrumb"><span class="fd-breadcrumb-item"><a${attr("href", parentUrl)} class="fd-breadcrumb-parent fd-breadcrumb-link">${escape_html(parentLabel)}</a></span> <span class="fd-breadcrumb-item"><span class="fd-breadcrumb-sep">/</span> <span class="fd-breadcrumb-current">${escape_html(currentLabel)}</span></span></nav>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]-->`);
  });
}
function TableOfContents($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { items = [], tocStyle = "default" } = $$props;
    let activeIds = /* @__PURE__ */ new Set();
    const isDirectional = tocStyle === "directional";
    function getItemOffset(depth) {
      if (depth <= 2) return 14;
      if (depth === 3) return 26;
      return 36;
    }
    function getLineOffset(depth) {
      return depth >= 3 ? 10 : 0;
    }
    function isActive(item) {
      return activeIds.has(item.url.slice(1));
    }
    function hasDiagonal(index) {
      if (index === 0) return false;
      return items[index - 1].depth !== items[index].depth;
    }
    function getDiagonalCoords(index) {
      const upperOffset = getLineOffset(items[index - 1].depth);
      const currentOffset = getLineOffset(items[index].depth);
      return { upperOffset, currentOffset };
    }
    function verticalLineStyle(item, index) {
      const prevDepth = index > 0 ? items[index - 1].depth : item.depth;
      const nextDepth = index < items.length - 1 ? items[index + 1].depth : item.depth;
      return {
        position: "absolute",
        left: `${getLineOffset(item.depth)}px`,
        top: prevDepth !== item.depth ? "6px" : "0",
        bottom: nextDepth !== item.depth ? "6px" : "0",
        width: "1px",
        background: "hsla(0, 0%, 50%, 0.1)"
      };
    }
    function styleObj(obj) {
      return Object.entries(obj).map(([k, v]) => `${k}:${v}`).join(";");
    }
    onDestroy(() => {
    });
    $$renderer2.push(`<div${attr_class("fd-toc-inner", void 0, { "fd-toc-directional": isDirectional })}><h3 class="fd-toc-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="15" y2="12"></line><line x1="3" y1="18" x2="18" y2="18"></line></svg> On this page</h3> `);
    if (items.length === 0) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="fd-toc-empty">No Headings</p>`);
    } else if (!isDirectional) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<ul class="fd-toc-list"><!--[-->`);
      const each_array = ensure_array_like(items);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let item = each_array[$$index];
        $$renderer2.push(`<li class="fd-toc-item"><a${attr("href", item.url)}${attr_class("fd-toc-link", void 0, { "fd-toc-link-active": isActive(item) })}${attr_style("", {
          "padding-left": `${stringify(12 + (item.depth - 2) * 12)}px`
        })}>${escape_html(item.title)}</a></li>`);
      }
      $$renderer2.push(`<!--]--></ul>`);
    } else {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<ul class="fd-toc-list fd-toc-clerk" style="position:relative;"><!--[-->`);
      const each_array_1 = ensure_array_like(items);
      for (let index = 0, $$length = each_array_1.length; index < $$length; index++) {
        let item = each_array_1[index];
        $$renderer2.push(`<li class="fd-toc-item"><a${attr("href", item.url)} class="fd-toc-link fd-toc-clerk-link"${attr("data-active", isActive(item) ? "true" : void 0)}${attr_style(`position:relative; padding-left:${stringify(getItemOffset(item.depth))}px; padding-top:6px; padding-bottom:6px; font-size:${stringify(item.depth <= 2 ? "14" : "13")}px; overflow-wrap:anywhere;`)}><div${attr_style(styleObj(verticalLineStyle(item, index)))}></div> `);
        if (hasDiagonal(index)) {
          $$renderer2.push("<!--[-->");
          const d = getDiagonalCoords(index);
          $$renderer2.push(`<svg viewBox="0 0 16 16" width="16" height="16" style="position:absolute; top:-6px; left:0;"><line${attr("x1", d.upperOffset)} y1="0"${attr("x2", d.currentOffset)} y2="12" stroke="hsla(0, 0%, 50%, 0.1)" stroke-width="1"></line></svg>`);
        } else {
          $$renderer2.push("<!--[!-->");
        }
        $$renderer2.push(`<!--]--> ${escape_html(item.title)}</a></li>`);
      }
      $$renderer2.push(`<!--]--> `);
      {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></ul>`);
    }
    $$renderer2.push(`<!--]--></div>`);
  });
}
function DocsPage($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let {
      tocEnabled = true,
      tocStyle = "default",
      breadcrumbEnabled = true,
      previousPage = null,
      nextPage = null,
      editOnGithub = null,
      lastModified = null,
      llmsTxtEnabled = false,
      children
    } = $$props;
    let tocItems = [];
    $$renderer2.push(`<div class="fd-page"><article class="fd-page-article" id="nd-page">`);
    if (breadcrumbEnabled) {
      $$renderer2.push("<!--[-->");
      Breadcrumb($$renderer2, {
        pathname: store_get($$store_subs ??= {}, "$page", page).url.pathname
      });
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> <div class="fd-page-body">`);
    children($$renderer2);
    $$renderer2.push(`<!----></div> <footer class="fd-page-footer">`);
    if (editOnGithub || lastModified || llmsTxtEnabled) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="fd-edit-on-github">`);
      if (editOnGithub) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<a${attr("href", editOnGithub)} target="_blank" rel="noopener noreferrer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit on GitHub</a>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (llmsTxtEnabled) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<span class="fd-llms-txt-links"><a href="/api/docs?format=llms" target="_blank" rel="noopener noreferrer" class="fd-llms-txt-link">llms.txt</a> <a href="/api/docs?format=llms-full" target="_blank" rel="noopener noreferrer" class="fd-llms-txt-link">llms-full.txt</a></span>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--> `);
      if (lastModified) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<span class="fd-last-modified">Last updated: ${escape_html(lastModified)}</span>`);
      } else {
        $$renderer2.push("<!--[!-->");
      }
      $$renderer2.push(`<!--]--></div>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (previousPage || nextPage) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<nav class="fd-page-nav" aria-label="Page navigation">`);
      if (previousPage) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<a${attr("href", previousPage.url)} class="fd-page-nav-card fd-page-nav-prev"><span class="fd-page-nav-label"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg> Previous</span> <span class="fd-page-nav-title">${escape_html(previousPage.name)}</span></a>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<div></div>`);
      }
      $$renderer2.push(`<!--]--> `);
      if (nextPage) {
        $$renderer2.push("<!--[-->");
        $$renderer2.push(`<a${attr("href", nextPage.url)} class="fd-page-nav-card fd-page-nav-next"><span class="fd-page-nav-label">Next <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg></span> <span class="fd-page-nav-title">${escape_html(nextPage.name)}</span></a>`);
      } else {
        $$renderer2.push("<!--[!-->");
        $$renderer2.push(`<div></div>`);
      }
      $$renderer2.push(`<!--]--></nav>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></footer></article> `);
    if (tocEnabled) {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<aside class="fd-toc">`);
      TableOfContents($$renderer2, { items: tocItems, tocStyle });
      $$renderer2.push(`<!----></aside>`);
    } else {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}
function DocsContent($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const DEFAULT_OPEN_PROVIDERS = [
      {
        name: "ChatGPT",
        urlTemplate: "https://chatgpt.com/?hints=search&q=Read+{mdxUrl},+I+want+to+ask+questions+about+it."
      },
      {
        name: "Claude",
        urlTemplate: "https://claude.ai/new?q=Read+{mdxUrl},+I+want+to+ask+questions+about+it."
      }
    ];
    let { data, config: config2 = null } = $$props;
    let openDropdownMenu = false;
    let copyLabel = "Copy page";
    let copied = false;
    let titleSuffix = config2?.metadata?.titleTemplate ? config2.metadata.titleTemplate.replace("%s", "") : " – Docs";
    let tocEnabled = config2?.theme?.ui?.layout?.toc?.enabled ?? true;
    let tocStyle = config2?.theme?.ui?.layout?.toc?.style === "directional" ? "directional" : "default";
    let breadcrumbEnabled = (() => {
      const bc = config2?.breadcrumb;
      if (bc === void 0 || bc === true) return true;
      if (bc === false) return false;
      if (typeof bc === "object") return bc.enabled !== false;
      return true;
    })();
    let showEditOnGithub = !!config2?.github && !!data.editOnGithub;
    !!data.lastModified;
    let llmsTxtEnabled = (() => {
      const cfg = config2?.llmsTxt;
      if (cfg === true) return true;
      if (typeof cfg === "object" && cfg !== null) return cfg.enabled !== false;
      return false;
    })();
    let copyMarkdownEnabled = (() => {
      const pa = config2?.pageActions;
      if (!pa) return false;
      const cm = pa.copyMarkdown;
      if (cm === true) return true;
      if (typeof cm === "object" && cm !== null) return cm.enabled !== false;
      return false;
    })();
    let openDocsEnabled = (() => {
      const pa = config2?.pageActions;
      if (!pa) return false;
      const od = pa.openDocs;
      if (od === true) return true;
      if (typeof od === "object" && od !== null) return od.enabled !== false;
      return false;
    })();
    let openDocsProviders = (() => {
      const pa = config2?.pageActions;
      const od = pa && typeof pa === "object" && pa.openDocs != null ? pa.openDocs : null;
      const list = od && typeof od === "object" && "providers" in od ? od.providers : void 0;
      if (Array.isArray(list) && list.length > 0) {
        const mapped = list.map((p) => ({
          name: typeof p?.name === "string" ? p.name : "Open",
          urlTemplate: typeof p?.urlTemplate === "string" ? p.urlTemplate : ""
        })).filter((p) => p.urlTemplate.length > 0);
        if (mapped.length > 0) return mapped;
      }
      return DEFAULT_OPEN_PROVIDERS;
    })();
    let pageActionsPosition = typeof config2?.pageActions === "object" && config2?.pageActions !== null && config2?.pageActions.position ? config2.pageActions.position : "below-title";
    let pageActionsAlignment = typeof config2?.pageActions === "object" && config2?.pageActions !== null && config2?.pageActions.alignment ? config2.pageActions.alignment : "left";
    let lastUpdatedConfig = (() => {
      const lu = config2?.lastUpdated;
      if (lu === false) return { enabled: false, position: "footer" };
      if (lu === true || lu === void 0) return { enabled: true, position: "footer" };
      const o = lu;
      return {
        enabled: o.enabled !== false,
        position: o.position ?? "footer"
      };
    })();
    let showLastUpdatedInFooter = !!data.lastModified && lastUpdatedConfig.enabled && lastUpdatedConfig.position === "footer";
    let showLastUpdatedBelowTitle = !!data.lastModified && lastUpdatedConfig.enabled && lastUpdatedConfig.position === "below-title";
    let htmlWithoutFirstH1 = (data.html || "").replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
    let showPageActions = (copyMarkdownEnabled || openDocsEnabled) && openDocsProviders.length >= 0;
    let showActionsAbove = pageActionsPosition === "above-title" && showPageActions;
    let showActionsBelow = pageActionsPosition === "below-title" && showPageActions;
    function handleClickOutside(e) {
      e.target;
    }
    onDestroy(() => {
      if (typeof document !== "undefined") {
        document.removeEventListener("click", handleClickOutside);
      }
    });
    head("1fjyzf0", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(data.title)}${escape_html(titleSuffix)}</title>`);
      });
      if (data.description) {
        $$renderer3.push("<!--[-->");
        $$renderer3.push(`<meta name="description"${attr("content", data.description)}/>`);
      } else {
        $$renderer3.push("<!--[!-->");
      }
      $$renderer3.push(`<!--]-->`);
    });
    {
      let children = function($$renderer3) {
        $$renderer3.push(`<div class="fd-docs-content">`);
        if (showActionsAbove) {
          $$renderer3.push("<!--[-->");
          $$renderer3.push(`<div class="fd-page-actions" data-page-actions=""${attr("data-actions-alignment", pageActionsAlignment)}>`);
          if (copyMarkdownEnabled) {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<button type="button" class="fd-page-action-btn" aria-label="Copy page content"${attr("data-copied", copied)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>${escape_html(copyLabel)}</span></button>`);
          } else {
            $$renderer3.push("<!--[!-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (openDocsEnabled && openDocsProviders.length > 0) {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<div class="fd-page-action-dropdown"><button type="button" class="fd-page-action-btn"${attr("aria-expanded", openDropdownMenu)} aria-haspopup="true"><span>Open in</span> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button> <div class="fd-page-action-menu" role="menu"${attr("hidden", !openDropdownMenu)}><!--[-->`);
            const each_array = ensure_array_like(openDocsProviders);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let provider = each_array[$$index];
              $$renderer3.push(`<button type="button" role="menuitem" class="fd-page-action-menu-item"><span class="fd-page-action-menu-label">Open in ${escape_html(provider.name)}</span> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></button>`);
            }
            $$renderer3.push(`<!--]--></div></div>`);
          } else {
            $$renderer3.push("<!--[!-->");
          }
          $$renderer3.push(`<!--]--></div>`);
        } else {
          $$renderer3.push("<!--[!-->");
        }
        $$renderer3.push(`<!--]--> <h1 class="fd-page-title">${escape_html(data.title)}</h1> `);
        if (data.description) {
          $$renderer3.push("<!--[-->");
          $$renderer3.push(`<p class="fd-page-description">${escape_html(data.description)}</p>`);
        } else {
          $$renderer3.push("<!--[!-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (showLastUpdatedBelowTitle && data.lastModified) {
          $$renderer3.push("<!--[-->");
          $$renderer3.push(`<p class="fd-last-modified fd-last-modified-below-title">Last updated: ${escape_html(data.lastModified)}</p>`);
        } else {
          $$renderer3.push("<!--[!-->");
        }
        $$renderer3.push(`<!--]--> `);
        if (showActionsBelow) {
          $$renderer3.push("<!--[-->");
          $$renderer3.push(`<hr class="fd-page-actions-divider" aria-hidden="true"/> <div class="fd-page-actions" data-page-actions=""${attr("data-actions-alignment", pageActionsAlignment)}>`);
          if (copyMarkdownEnabled) {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<button type="button" class="fd-page-action-btn" aria-label="Copy page content"${attr("data-copied", copied)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> <span>${escape_html(copyLabel)}</span></button>`);
          } else {
            $$renderer3.push("<!--[!-->");
          }
          $$renderer3.push(`<!--]--> `);
          if (openDocsEnabled && openDocsProviders.length > 0) {
            $$renderer3.push("<!--[-->");
            $$renderer3.push(`<div class="fd-page-action-dropdown"><button type="button" class="fd-page-action-btn"${attr("aria-expanded", openDropdownMenu)} aria-haspopup="true"><span>Open in</span> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></button> <div class="fd-page-action-menu" role="menu"${attr("hidden", !openDropdownMenu)}><!--[-->`);
            const each_array_1 = ensure_array_like(openDocsProviders);
            for (let $$index_1 = 0, $$length = each_array_1.length; $$index_1 < $$length; $$index_1++) {
              let provider = each_array_1[$$index_1];
              $$renderer3.push(`<button type="button" role="menuitem" class="fd-page-action-menu-item"><span class="fd-page-action-menu-label">Open in ${escape_html(provider.name)}</span> <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></button>`);
            }
            $$renderer3.push(`<!--]--></div></div>`);
          } else {
            $$renderer3.push("<!--[!-->");
          }
          $$renderer3.push(`<!--]--></div>`);
        } else {
          $$renderer3.push("<!--[!-->");
        }
        $$renderer3.push(`<!--]--> ${html(htmlWithoutFirstH1)}</div>`);
      };
      DocsPage($$renderer2, {
        entry: config2?.entry ?? "docs",
        tocEnabled,
        tocStyle,
        breadcrumbEnabled,
        previousPage: data.previousPage,
        nextPage: data.nextPage,
        editOnGithub: showEditOnGithub ? data.editOnGithub : null,
        lastModified: showLastUpdatedInFooter ? data.lastModified : null,
        llmsTxtEnabled,
        children
      });
    }
  });
}
function _page($$renderer, $$props) {
  let { data } = $$props;
  DocsContent($$renderer, { data, config });
}
export {
  _page as default
};
