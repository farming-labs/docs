import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import type { DocsConfig, DocsNavLink } from "@farming-labs/docs";
import type { LinkItemType } from "fumadocs-ui/layouts/shared";
import { DocsTopHeader } from "./top-header.js";

export type DocsLayoutContainerProps = HTMLAttributes<HTMLDivElement> & {
  [attribute: `data-${string}`]: string | undefined;
};

function isTopHeader(config: DocsConfig): boolean {
  return config.theme?.ui?.layout?.header?.placement === "top";
}

function topHeaderHeight(config: DocsConfig): number | undefined {
  const height = config.theme?.ui?.layout?.header?.height;
  return typeof height === "number" && height > 0 ? height : undefined;
}

function resolveNavLinks(config: DocsConfig): DocsNavLink[] {
  const links = config.nav?.links;
  if (!Array.isArray(links)) return [];
  return links.filter(
    (link): link is DocsNavLink =>
      !!link && typeof link.label === "string" && typeof link.href === "string",
  );
}

/** Attributes on the layout root (`#nd-docs-layout`) that theme CSS selects on. */
export function resolveLayoutContainerProps(
  config: DocsConfig,
  adapterProps?: DocsLayoutContainerProps,
): DocsLayoutContainerProps | undefined {
  const themeName = config.theme?.name;
  const props: DocsLayoutContainerProps = {
    ...(themeName ? { "data-fd-theme": themeName } : {}),
    ...adapterProps,
  };
  if (isTopHeader(config)) {
    const height = topHeaderHeight(config);
    props["data-fd-header"] = "top";
    // Fumadocs offsets its sticky sidebar, TOC and mobile header by --fd-docs-row-1.
    props.style = {
      "--fd-docs-row-1": "calc(var(--fd-banner-height, 0px) + var(--fd-top-header-offset, 0px))",
      ...(height ? { "--fd-top-header-height": `${height}px` } : {}),
    } as CSSProperties;
  }
  return Object.keys(props).length > 0 ? props : undefined;
}

/** `nav.links` as sidebar link items; the top header hides them from the desktop sidebar. */
export function resolveSidebarNavLinks(config: DocsConfig): LinkItemType[] | undefined {
  const links = resolveNavLinks(config);
  if (links.length === 0) return undefined;
  return links.map((link) => ({
    text: <span className="fd-nav-link">{link.label}</span>,
    url: link.href,
    external: link.external === true,
  }));
}

/** The nav title, marked so the top header can hide its sidebar copy on desktop. */
export function resolveSidebarNavTitle(config: DocsConfig, title: ReactNode): ReactNode {
  return isTopHeader(config) ? <span className="fd-nav-title">{title}</span> : title;
}

export interface LayoutChromeOptions {
  navTitle: ReactNode;
  navUrl: string;
  search: boolean;
  askAI: boolean;
  themeToggle: false | { mode?: "light-dark" | "light-dark-system" };
}

/** Chrome rendered before the docs layout, so it comes first in focus order. */
export function renderLayoutChrome(config: DocsConfig, options: LayoutChromeOptions): ReactNode {
  if (!isTopHeader(config)) return null;
  return (
    <DocsTopHeader
      title={options.navTitle}
      titleUrl={options.navUrl}
      links={resolveNavLinks(config)}
      search={options.search}
      askAI={options.askAI}
      themeToggle={options.themeToggle}
      themeName={config.theme?.name}
      height={topHeaderHeight(config)}
    />
  );
}
