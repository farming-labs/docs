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

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};

  patchHistoryEvents();

  const notify = () => onStoreChange();

  window.addEventListener("popstate", notify);
  window.addEventListener("hashchange", notify);
  window.addEventListener("fd-location-change", notify);

  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener("hashchange", notify);
    window.removeEventListener("fd-location-change", notify);
  };
}

function getSnapshot() {
  if (typeof window === "undefined") return "";
  return window.location.search;
}

export function useWindowSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return new URLSearchParams(search);
}
