"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type SidebarThemeToggleProps = {
  variant?: "text" | "pill";
};

/**
 * Light/dark theme toggle for the docs sidebar footer.
 * Toggles the `dark` class on document.documentElement and persists to localStorage.
 */
export function SidebarThemeToggle({ variant = "text" }: SidebarThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, [mounted]);

  const applyTheme = (nextIsDark: boolean) => {
    if (!nextIsDark) {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      document.documentElement.style.colorScheme = "light";
      try {
        localStorage.setItem("theme", "light");
      } catch {}
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
      try {
        localStorage.setItem("theme", "dark");
      } catch {}
    }
    setIsDark(nextIsDark);
  };

  const toggle = () => {
    const nextIsDark = !isDark;

    const documentWithTransition = document as Document & {
      startViewTransition?: (callback: () => void) => {
        finished: Promise<void>;
      };
    };

    if (!documentWithTransition.startViewTransition) {
      applyTheme(nextIsDark);
      return;
    }

    documentWithTransition.startViewTransition(() => {
      applyTheme(nextIsDark);
    });
  };

  if (!mounted) return null;

  const isPill = variant === "pill";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={
        isPill
          ? "inline-flex items-center gap-1 rounded-3xl border p-1.5 transition-colors hover:opacity-90"
          : "inline-flex text-[11px] text-black/30 dark:text-white/30 items-center gap-1 pr-1"
      }
      style={{
        borderColor: "var(--color-fd-border)",
        ...(isPill ? { color: "var(--color-fd-muted-foreground)" } : {}),
      }}
    >
      {isPill ? (
        <>
          <Sun size={14} className={!isDark ? "opacity-100" : "opacity-40"} aria-hidden />
          <Moon size={14} className={isDark ? "opacity-100" : "opacity-40"} aria-hidden />
        </>
      ) : (
        <>
          {isDark ? <Moon size={12} aria-hidden /> : <Sun size={12} aria-hidden />}/{" "}
          {isDark ? (
            <span className="ml-1 font-mono text-[11px]">DARK</span>
          ) : (
            <span className="ml-1 font-mono text-[11px]">LIGHT</span>
          )}
        </>
      )}
    </button>
  );
}
