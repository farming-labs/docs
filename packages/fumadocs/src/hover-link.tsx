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
  external?: boolean;
  prefetch?: boolean;
}

export function HoverLink({
  href,
  title,
  description,
  children,
  linkLabel = "Open page",
  external,
  prefetch,
}: HoverLinkProps) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

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
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
  }

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onMouseEnter={openPopover}
          onMouseLeave={closePopover}
          onFocus={openPopover}
          onBlur={closePopover}
          onClick={() => setOpen((value) => !value)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            border: "none",
            background: "transparent",
            padding: 0,
            color: "var(--color-fd-foreground, currentColor)",
            cursor: "pointer",
            textDecoration: "underline",
            textDecorationStyle: "dashed",
            textUnderlineOffset: "0.22em",
            textDecorationColor:
              "color-mix(in srgb, var(--color-fd-border, currentColor) 85%, transparent)",
            font: "inherit",
          }}
        >
          <span>{children}</span>
          <span aria-hidden="true" style={{ fontSize: "0.75em", opacity: 0.8 }}>
            +
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        sideOffset={12}
        onMouseEnter={openPopover}
        onMouseLeave={closePopover}
        onFocusCapture={openPopover}
        onBlurCapture={closePopover}
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
            <span
              style={{
                fontSize: "0.68rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontFamily: "var(--fd-font-mono, var(--font-geist-mono, ui-monospace, monospace))",
                color:
                  "color-mix(in srgb, var(--color-fd-popover-foreground, currentColor) 55%, transparent)",
              }}
            >
              Link Preview
            </span>
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
