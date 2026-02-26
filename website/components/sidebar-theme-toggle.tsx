"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * Light/dark theme toggle for the docs sidebar footer.
 * Toggles the `dark` class on document.documentElement and persists to localStorage.
 */
export function SidebarThemeToggle() {
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

  const toggle = () => {
    if (isDark) {
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
    setIsDark(!isDark);
  };

  if (!mounted) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex items-center gap-1 rounded-full border p-1.5 transition-colors hover:opacity-90"
      style={{
        borderColor: "var(--color-fd-border)",
        color: "var(--color-fd-muted-foreground)",
      }}
    >
      <Sun size={14} className={!isDark ? "opacity-100" : "opacity-40"} aria-hidden />
      <Moon size={14} className={isDark ? "opacity-100" : "opacity-40"} aria-hidden />
    </button>
  );
}
