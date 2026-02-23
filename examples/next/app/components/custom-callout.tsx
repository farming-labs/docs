"use client";

import type { ReactNode } from "react";

interface CustomCalloutProps {
  type?: "info" | "warn" | "error";
  title?: string;
  children: ReactNode;
}

const icons: Record<string, string> = {
  info: "💡",
  warn: "⚠️",
  error: "🚨",
};

/**
 * Example custom Callout component that overrides fumadocs' built-in Callout.
 * It must accept the same props interface.
 */
export function CustomCallout({ type = "info", title, children }: CustomCalloutProps) {
  return (
    <div
      style={{
        border: "1px solid #333",
        borderRadius: "0.75rem",
        padding: "1rem 1.25rem",
        margin: "1rem 0",
        background: "#1a1a2e",
        color: "#e0e0e0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ fontSize: "1.25rem" }}>{icons[type] ?? "💡"}</span>
        {title && <strong style={{ color: "#f0f0f0" }}>{title}</strong>}
      </div>
      <div style={{ marginTop: "0.5rem" }}>{children}</div>
    </div>
  );
}
