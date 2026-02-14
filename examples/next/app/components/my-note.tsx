"use client";

import type { ReactNode } from "react";

interface MyNoteProps {
  children: ReactNode;
  type?: "info" | "warning" | "tip";
}

const colors = {
  info: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
  warning: { bg: "#fefce8", border: "#eab308", text: "#854d0e" },
  tip: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
};

export function MyNote({ children, type = "info" }: MyNoteProps) {
  const c = colors[type];
  return (
    <div
      style={{
        backgroundColor: c.bg,
        borderLeft: `4px solid ${c.border}`,
        color: c.text,
        padding: "1rem 1.25rem",
        borderRadius: "0.5rem",
        margin: "1rem 0",
        fontSize: "0.95rem",
      }}
    >
      <strong style={{ textTransform: "uppercase", fontSize: "0.8rem" }}>
        {type}
      </strong>
      <div style={{ marginTop: "0.25rem" }}>{children}</div>
    </div>
  );
}
