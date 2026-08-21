"use client";

import { FrameworkProvider, type Framework } from "fumadocs-core/framework";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider/base";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ComponentProps,
  type ComponentPropsWithoutRef,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { subscribeToWindowLocation } from "./client-location.js";
import { TanstackDocsLayout, type TanstackDocsLayoutProps } from "./tanstack-layout.js";

export type BrowserDocsLayoutProps = Omit<TanstackDocsLayoutProps, "browserRuntime">;

/** Docs layout for framework-neutral browser adapters such as Farm.js. */
export function BrowserDocsLayout(props: BrowserDocsLayoutProps) {
  return <TanstackDocsLayout {...props} browserRuntime />;
}

type FumadocsProviderProps = ComponentPropsWithoutRef<typeof FumadocsRootProvider>;

export interface BrowserRootProviderProps extends FumadocsProviderProps {
  /** Path rendered by the server, used to keep hydration deterministic. */
  initialPathname?: string;
  /** Framework adapter navigation that preserves the current document shell. */
  navigation?: BrowserNavigationAdapter;
}

export interface BrowserNavigationAdapter {
  push(url: string): void | Promise<void>;
  refresh(): void | Promise<void>;
}

const defaultBrowserNavigation: BrowserNavigationAdapter = {
  push(url) {
    window.location.assign(url);
  },
  refresh() {
    window.location.reload();
  },
};

const BrowserNavigationContext = createContext<BrowserNavigationAdapter>(defaultBrowserNavigation);

function getBrowserPathname() {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function useBrowserRouter() {
  const navigation = useContext(BrowserNavigationContext);
  return useMemo(
    () => ({
      push(url: string) {
        return navigation.push(url);
      },
      refresh() {
        return navigation.refresh();
      },
    }),
    [navigation],
  );
}

function useBrowserParams() {
  return useMemo<Record<string, string | string[]>>(() => ({}), []);
}

function BrowserLink({
  prefetch: _prefetch,
  href,
  target,
  download,
  onClick,
  ...props
}: ComponentProps<"a"> & { prefetch?: boolean }) {
  const navigation = useContext(BrowserNavigationContext);
  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const hasDownload = download !== undefined && download !== false;
      if (!href || hasDownload || (target && target !== "_self")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      event.preventDefault();
      void navigation.push(`${url.pathname}${url.search}${url.hash}`);
    },
    [download, href, navigation, onClick, target],
  );

  return <a {...props} href={href} target={target} download={download} onClick={handleClick} />;
}

/** Framework-neutral provider for server-rendered React documentation adapters. */
export function BrowserRootProvider({
  children,
  search,
  initialPathname = "/",
  navigation = defaultBrowserNavigation,
  ...props
}: BrowserRootProviderProps) {
  const useBrowserPathname = () =>
    useSyncExternalStore(subscribeToWindowLocation, getBrowserPathname, () => initialPathname);

  return (
    <BrowserNavigationContext.Provider value={navigation}>
      <FrameworkProvider
        Link={BrowserLink}
        usePathname={useBrowserPathname}
        useParams={useBrowserParams}
        useRouter={useBrowserRouter as Framework["useRouter"]}
      >
        <FumadocsRootProvider
          search={{
            ...search,
            options: {
              api: "/api/docs",
              ...search?.options,
            },
          }}
          {...props}
        >
          {children}
        </FumadocsRootProvider>
      </FrameworkProvider>
    </BrowserNavigationContext.Provider>
  );
}
