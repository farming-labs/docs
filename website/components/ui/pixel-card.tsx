import { ReactNode } from "react";

interface PixelCardProps {
  children: ReactNode;
  className?: string;
  variant?: "default" | "code" | "highlight";
}

export default function PixelCard({
  children,
  className = "",
  variant = "default",
}: PixelCardProps) {
  const baseClasses =
    "border border-black/10 dark:border-white/5 bg-white/80 dark:bg-black/50 backdrop-blur-sm relative";

  const variantClasses = {
    default:
      "p-6 rounded-none border border-black/10 dark:border-white/10 bg-neutral-50/90 dark:bg-black/[20%] hover:bg-neutral-100/90 dark:hover:bg-black/[20%] hover:border-black/10 dark:hover:border-white/10",
    code:
      "px-4 py-2.5 rounded-none bg-neutral-100 dark:bg-black border-black/15 dark:border-white/15 overflow-hidden",
    highlight:
      "p-6 rounded-none border-black/5 dark:border-white/5 bg-black/[2%] dark:bg-white/[2%] backdrop-blur-md",
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      <div
        className="absolute inset-0 pointer-events-none opacity-60 dark:opacity-80 mix-blend-overlay"
        style={{
          backgroundImage: "url(/shades.png)",
          backgroundRepeat: "repeat",
          backgroundSize: "auto",
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
