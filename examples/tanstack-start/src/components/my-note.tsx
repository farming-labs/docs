import type { ReactNode } from "react";

export function MyNote({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        margin: "1.5rem 0",
        padding: "1rem 1.125rem",
        borderRadius: "1rem",
        border: "1px solid color-mix(in srgb, var(--color-fd-primary) 18%, transparent)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--color-fd-primary) 12%, transparent), transparent 65%)",
      }}
    >
      <strong style={{ display: "block", marginBottom: "0.4rem" }}>Project Note</strong>
      <div>{children}</div>
    </div>
  );
}
