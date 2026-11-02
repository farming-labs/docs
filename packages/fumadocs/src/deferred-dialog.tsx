"use client";

import { Component, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Mount on first use, then retain dialog state across closes. */
export function DeferredDialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean, trigger: "escape" | "overlay" | "button") => void;
  children: ReactNode;
}) {
  const [hasOpened, setHasOpened] = useState(open);
  if (open && !hasOpened) setHasOpened(true);
  if (!open && !hasOpened) return null;

  return (
    <DialogBoundary fallback={open ? <LoadingDialog failed onOpenChange={onOpenChange} /> : null}>
      <Suspense fallback={open ? <LoadingDialog onOpenChange={onOpenChange} /> : null}>
        {children}
      </Suspense>
    </DialogBoundary>
  );
}

class DialogBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function LoadingDialog({
  onOpenChange,
  failed = false,
}: {
  failed?: boolean;
  onOpenChange: (open: boolean, trigger: "escape" | "overlay" | "button") => void;
}) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false, "escape");
      // The loading shell has one focusable control.
      if (event.key === "Tab") {
        event.preventDefault();
        closeButton.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [onOpenChange]);

  return createPortal(
    <>
      <div className="fd-ai-overlay" onClick={() => onOpenChange(false, "overlay")} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={failed ? "Dialog unavailable" : "Loading dialog"}
        aria-busy={!failed}
        className="fd-ai-dialog"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(680px, calc(100vw - 32px))",
        }}
      >
        <div className="fd-ai-header">
          <span role={failed ? "alert" : "status"} className="fd-ai-header-title">
            {failed ? "Unable to load. Reload this page to try again." : "Loading…"}
          </span>
          <button
            ref={closeButton}
            className="fd-ai-close-btn"
            onClick={() => onOpenChange(false, "button")}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
