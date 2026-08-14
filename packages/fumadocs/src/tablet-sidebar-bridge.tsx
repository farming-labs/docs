"use client";

import { useSidebar } from "fumadocs-ui/components/sidebar/base";
import { useEffect, useRef, useState } from "react";

const tabletSidebarQuery = "(min-width: 768px) and (max-width: 1023px)";

/**
 * Extends Fumadocs' sidebar state through the tablet breakpoint without
 * intercepting its trigger or cloning the configured navigation tree.
 */
export function TabletSidebarBridge() {
  const { open, setOpen } = useSidebar();
  const [isTablet, setIsTablet] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement>(null);
  const visible = isTablet && open;

  useEffect(() => {
    const media = window.matchMedia(tabletSidebarQuery);
    const update = () => setIsTablet(media.matches);

    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!visible) return;

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    };
  }, [setOpen, visible]);

  if (!isTablet) return null;

  return (
    <>
      <span hidden aria-hidden="true" data-fd-tablet-sidebar-state={visible ? "open" : "closed"} />
      {visible && (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="fd-tablet-sidebar-backdrop"
            onClick={() => setOpen(false)}
          />
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close Sidebar"
            className="fd-tablet-sidebar-close"
            onClick={() => setOpen(false)}
          >
            <span aria-hidden="true" />
          </button>
        </>
      )}
    </>
  );
}
