"use client";

import { FrameworkProvider, type Framework } from "fumadocs-core/framework";
import { RootProvider as FumadocsRootProvider } from "fumadocs-ui/provider/base";
import {
  useMemo,
  useSyncExternalStore,
  type ComponentProps,
  type ComponentPropsWithoutRef,
} from "react";
import { TanstackDocsLayout, type TanstackDocsLayoutProps } from "./tanstack-layout.js";

export type BrowserDocsLayoutProps = Omit<TanstackDocsLayoutProps, "browserRuntime">;

/** Docs layout for framework-neutral browser adapters such as Farm.js. */
export function BrowserDocsLayout(props: BrowserDocsLayoutProps) {
  return <TanstackDocsLayout {...props} browserRuntime />;
}

type FumadocsProviderProps = ComponentPropsWithoutRef<typeof FumadocsRootProvider>;

declare global {
  interface Window {
    __fdBrowserHistoryPatched?: boolean;
  }
}

export interface BrowserRootProviderProps extends FumadocsProviderProps {
  /** Path rendered by the server, used to keep hydration deterministic. */
  initialPathname?: string;
}

function patchHistoryEvents() {
  if (typeof window === "undefined" || window.__fdBrowserHistoryPatched) return;

  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method];
    window.history[method] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event("fd-location-change"));
      return result;
    };
  }

  window.__fdBrowserHistoryPatched = true;
}

function subscribeToLocation(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  patchHistoryEvents();

  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("fd-location-change", onStoreChange);
  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("fd-location-change", onStoreChange);
  };
}

function getBrowserPathname() {
  return typeof window === "undefined" ? "/" : window.location.pathname;
}

function useBrowserRouter() {
  return useMemo(
    () => ({
      push(url: string) {
        window.location.assign(url);
      },
      refresh() {
        window.location.reload();
      },
    }),
    [],
  );
}

function useBrowserParams() {
  return useMemo<Record<string, string | string[]>>(() => ({}), []);
}

function BrowserLink({
  prefetch: _prefetch,
  ...props
}: ComponentProps<"a"> & { prefetch?: boolean }) {
  return <a {...props} />;
}

/** Framework-neutral provider for server-rendered React documentation adapters. */
export function BrowserRootProvider({
  children,
  search,
  initialPathname = "/",
  ...props
}: BrowserRootProviderProps) {
  const useBrowserPathname = () =>
    useSyncExternalStore(subscribeToLocation, getBrowserPathname, () => initialPathname);

  return (
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
  );
}
