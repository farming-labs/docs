"use client";

import { Fragment, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "fumadocs-ui/components/ui/popover";

export interface PageActionsMenuItem {
  key: string;
  label: ReactNode;
  /** Second line under the label, announced as the item's description. */
  description?: ReactNode;
  icon?: ReactNode;
  /** Opens in a new tab. */
  href?: string;
  onSelect?: () => void;
  /** Renders a separator above the item when another item precedes it. */
  separatorBefore?: boolean;
}

const MoreIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

/**
 * A "…" trigger opening a menu of page actions. It follows the WAI-ARIA menu button pattern:
 * arrow keys, Home and End move between items, Escape closes and returns focus to the trigger.
 */
export function PageActionsMenu({
  items,
  label = "More page actions",
}: {
  items: PageActionsMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const initialFocus = useRef<"first" | "last">("first");
  const idPrefix = useId();

  if (items.length === 0) return null;

  const menuItems = () =>
    Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const focusItem = (index: number) => {
    const list = menuItems();
    list[(index + list.length) % list.length]?.focus();
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    initialFocus.current = event.key === "ArrowUp" ? "last" : "first";
    setOpen(true);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = menuItems().indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") focusItem(current + 1);
    else if (event.key === "ArrowUp") focusItem(current < 0 ? -1 : current - 1);
    else if (event.key === "Home") focusItem(0);
    else if (event.key === "End") focusItem(-1);
    else {
      if (event.key === "Tab") setOpen(false);
      return;
    }
    event.preventDefault();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) initialFocus.current = "first";
        setOpen(next);
      }}
    >
      <PopoverTrigger
        className="fd-page-action-btn fd-page-actions-menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        title={label}
        onKeyDown={onTriggerKeyDown}
      >
        <MoreIcon />
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        role="menu"
        aria-label={label}
        align="end"
        className="fd-page-actions-menu"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusItem(initialFocus.current === "last" ? -1 : 0);
        }}
        onKeyDown={onMenuKeyDown}
      >
        {items.map((item, index) => {
          const labelId = item.description ? `${idPrefix}-${index}-label` : undefined;
          const descriptionId = item.description ? `${idPrefix}-${index}-description` : undefined;
          const label = (
            <span id={labelId} className="fd-page-action-menu-label">
              {item.label}
            </span>
          );
          const content = (
            <>
              {item.icon && (
                <span className="fd-page-action-menu-icon" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              {item.description ? (
                <span className="fd-page-action-menu-text">
                  {label}
                  <span id={descriptionId} className="fd-page-action-menu-description">
                    {item.description}
                  </span>
                </span>
              ) : (
                label
              )}
            </>
          );
          const separator = item.separatorBefore && index > 0 && (
            <div role="separator" className="fd-page-actions-menu-separator" />
          );

          const menuItem = item.href ? (
            <a
              role="menuitem"
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
              tabIndex={-1}
              className="fd-page-action-menu-item"
              href={item.href}
              target="_blank"
              rel="noreferrer noopener"
              onClick={() => {
                item.onSelect?.();
                setOpen(false);
              }}
            >
              {content}
            </a>
          ) : (
            <button
              type="button"
              role="menuitem"
              aria-labelledby={labelId}
              aria-describedby={descriptionId}
              tabIndex={-1}
              className="fd-page-action-menu-item"
              onClick={() => {
                item.onSelect?.();
                setOpen(false);
              }}
            >
              {content}
            </button>
          );

          return (
            <Fragment key={item.key}>
              {separator}
              {menuItem}
            </Fragment>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
