"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "fumadocs-core/link";
import { Popover, PopoverContent, PopoverTrigger } from "fumadocs-ui/components/ui/popover";

export interface HoverLinkProps {
  href: string;
  title: string;
  description: string;
  children: ReactNode;
  linkLabel?: string;
  previewLabel?: string;
  external?: boolean;
  prefetch?: boolean;
  showIndicator?: boolean;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  closeDelay?: number;
}

export function HoverLink({
  href,
  title,
  description,
  children,
  linkLabel = "Open page",
  previewLabel,
  external,
  prefetch,
  showIndicator = false,
  align = "center",
  side = "bottom",
  sideOffset = 12,
  closeDelay = 90,
}: HoverLinkProps) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const underlineColor = open
    ? "color-mix(in srgb, var(--color-fd-foreground, currentColor) 68%, transparent)"
    : "color-mix(in srgb, var(--color-fd-foreground, currentColor) 46%, transparent)";

  function clearCloseTimer() {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openPopover() {
    clearCloseTimer();
    setOpen(true);
  }

  function closePopover() {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), closeDelay);
  }

  function isWithinHoverArea(target: EventTarget | null) {
    if (!(target instanceof Node)) return false;

    return (
      (triggerRef.current !== null && triggerRef.current.contains(target)) ||
      (contentRef.current !== null && contentRef.current.contains(target))
    );
  }

  function shouldOpenFromFocus(element: HTMLButtonElement) {
    return typeof element.matches === "function" && element.matches(":focus-visible");
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        clearCloseTimer();
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          onPointerEnter={openPopover}
          onPointerLeave={(event) => {
            if (isWithinHoverArea(event.relatedTarget)) return;
            closePopover();
          }}
          onFocus={(event) => {
            if (!shouldOpenFromFocus(event.currentTarget)) return;
            openPopover();
          }}
          onBlur={(event) => {
            if (isWithinHoverArea(event.relatedTarget)) return;
            closePopover();
          }}
          onClick={openPopover}
          style={{
            display: "inline",
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            color: "var(--color-fd-foreground, currentColor)",
            cursor: "pointer",
            textDecoration: "underline",
            textDecorationStyle: "dashed",
            textDecorationThickness: "0.08em",
            textUnderlineOffset: "0.22em",
            textDecorationColor: underlineColor,
            font: "inherit",
            lineHeight: "inherit",
            verticalAlign: "baseline",
            appearance: "none",
            transition: "text-decoration-color 180ms ease",
          }}
        >
          <span>{children}</span>
          {showIndicator ? (
            <span
              aria-hidden="true"
              style={{ marginInlineStart: "0.3em", fontSize: "0.75em", opacity: 0.8 }}
            >
              +
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align={align}
        side={side}
        sideOffset={sideOffset}
        onPointerEnter={openPopover}
        onPointerLeave={(event) => {
          if (isWithinHoverArea(event.relatedTarget)) return;
          closePopover();
        }}
        onFocusCapture={openPopover}
        onBlurCapture={(event) => {
          if (isWithinHoverArea(event.relatedTarget)) return;
          closePopover();
        }}
        onInteractOutside={() => {
          clearCloseTimer();
          setOpen(false);
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
        style={{
          width: "min(22rem, calc(100vw - 2rem))",
          borderRadius: "calc(var(--radius, 0.75rem) + 2px)",
          border: "1px solid color-mix(in srgb, var(--color-fd-border, #2a2a2a) 88%, transparent)",
          background: "var(--color-fd-popover, var(--color-fd-background, #0b0b0b))",
          color: "var(--color-fd-popover-foreground, var(--color-fd-foreground, currentColor))",
          padding: "0.95rem 1rem",
          boxShadow:
            "0 20px 45px color-mix(in srgb, var(--color-fd-background, #000) 78%, transparent)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {previewLabel ? (
              <span
                style={{
                  fontSize: "0.68rem",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  fontFamily:
                    "var(--fd-font-mono, var(--font-geist-mono, ui-monospace, monospace))",
                  color:
                    "color-mix(in srgb, var(--color-fd-popover-foreground, currentColor) 55%, transparent)",
                }}
              >
                {previewLabel}
              </span>
            ) : null}
            <Link
              href={href}
              external={external}
              prefetch={prefetch}
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                lineHeight: 1.3,
                color: "var(--color-fd-popover-foreground, currentColor)",
                textDecoration: "none",
              }}
            >
              {title}
            </Link>
            <p
              style={{
                margin: 0,
                fontSize: "0.92rem",
                lineHeight: 1.6,
                color:
                  "color-mix(in srgb, var(--color-fd-popover-foreground, currentColor) 74%, transparent)",
              }}
            >
              {description}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              paddingTop: "0.25rem",
              borderTop:
                "1px solid color-mix(in srgb, var(--color-fd-border, #2a2a2a) 72%, transparent)",
            }}
          >
            <Link
              href={href}
              external={external}
              prefetch={prefetch}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                fontFamily: "var(--fd-font-mono, var(--font-geist-mono, ui-monospace, monospace))",
                color: "var(--color-fd-primary, var(--color-fd-popover-foreground, currentColor))",
                textDecoration: "none",
              }}
            >
              {linkLabel}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
