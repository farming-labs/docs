import { SparklesIcon } from "lucide-react";

export function AskAITrigger() {
  return (
    <button
      className="flex items-center justify-center gap-2 text-sm border cursor-pointer"
      style={{
        background: "color-mix(in srgb, var(--color-fd-secondary, #f4f4f5) 80%, transparent)",
        backdropFilter: "blur(4px)",
        color: "var(--color-fd-muted-foreground, #71717a)",
        borderColor: "var(--color-fd-border, rgba(255, 255, 255, 0.1))",
        padding: "8px 12px",
        height: "40px",
        borderRadius: "16px",
        fontFamily: "var(--fd-font-sans, inherit)",
        fontSize: "14px",
        boxShadow:
          "0 1px 3px color-mix(in srgb, var(--color-fd-background, #000) 20%, transparent)",
        transition: "transform 150ms, background 150ms, color 150ms",
      }}
    >
      <SparklesIcon size={16} />
      Ask AI
    </button>
  );
}
