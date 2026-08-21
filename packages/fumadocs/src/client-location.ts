"use client";

import { useSyncExternalStore } from "react";

declare global {
  interface Window {
    __fdHistoryPatched?: boolean;
  }
}

function patchHistoryEvents() {
  if (typeof window === "undefined" || window.__fdHistoryPatched) return;

  const wrap = (method: "pushState" | "replaceState") => {
    const original = window.history[method];
    window.history[method] = function patchedHistoryMethod(...args) {
      const result = original.apply(this, args);
      window.dispatchEvent(new Event("fd-location-change"));
      return result;
    };
  };

  wrap("pushState");
  wrap("replaceState");
  window.__fdHistoryPatched = true;
}

export function subscribeToWindowLocation(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  patchHistoryEvents();

  let active = true;
  let notificationQueued = false;
  const notify = () => {
    if (notificationQueued) return;
    notificationQueued = true;

    // Routers can update history during React's commit phase. Notify subscribers
    // once that commit completes while still updating before the browser paints.
    queueMicrotask(() => {
      notificationQueued = false;
      if (active) onStoreChange();
    });
  };

  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
  window.addEventListener("fd-location-change", notify);

  return () => {
    active = false;
    window.removeEventListener("popstate", notify);
    window.removeEventListener("hashchange", notify);
    window.removeEventListener("fd-location-change", notify);
  };
}

function getSearchSnapshot() {
  if (typeof window === "undefined") return "";
  return window.location.search;
}

function getPathnameSnapshot() {
  if (typeof window === "undefined") return "";
  return window.location.pathname;
}

export function useWindowSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(subscribeToWindowLocation, getSearchSnapshot, () => "");
  return new URLSearchParams(search);
}

export function useWindowPathname(): string {
  return useSyncExternalStore(subscribeToWindowLocation, getPathnameSnapshot, () => "");
}
