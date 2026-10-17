import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PixelCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "code" | "highlight";
  showTexture?: boolean;
}

export default function PixelCard({
  children,
  className = "",
  variant = "default",
  showTexture = true,
}: PixelCardProps) {
  const baseClasses =
    "border border-black/[0.12] dark:border-white/5 bg-white/95 dark:bg-black/50 backdrop-blur-sm relative";

  const variantClasses = {
    default:
      "p-6 rounded-none border border-black/[0.12] dark:border-white/10 bg-white dark:bg-black/[20%] hover:bg-neutral-50 dark:hover:bg-black/[20%] hover:border-black/15 dark:hover:border-white/10",
    code: "px-4 py-2.5 rounded-none bg-white dark:bg-black border-black/[0.18] dark:border-white/15 overflow-hidden",
    highlight:
      "p-6 rounded-none border-black/10 dark:border-white/5 bg-neutral-50/90 dark:bg-white/[2%] backdrop-blur-md",
  };

  return (
    <div className={cn(baseClasses, variantClasses[variant], className)}>
      {showTexture ? (
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.16] mix-blend-multiply contrast-100 dark:opacity-80 dark:mix-blend-overlay dark:contrast-100"
          style={{
            backgroundImage: "url(/shades.png)",
            backgroundRepeat: "repeat",
            backgroundSize: "auto",
          }}
        />
      ) : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
