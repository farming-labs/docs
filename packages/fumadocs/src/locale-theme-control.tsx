"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { resolveClientLocale, withLangInUrl } from "./i18n.js";

interface LocaleThemeControlProps {
  locales: string[];
  defaultLocale: string;
  locale?: string;
  showThemeToggle?: boolean;
  themeMode?: "light-dark" | "light-dark-system";
}

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function LocaleThemeControl({
  locales,
  defaultLocale,
  locale,
  showThemeToggle = true,
  themeMode = "light-dark",
}: LocaleThemeControlProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [themeValue, setThemeValue] = useState<"light" | "dark" | "system">("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  const activeLocale = useMemo(
    () => resolveClientLocale(searchParams, locale ?? defaultLocale) ?? defaultLocale,
    [defaultLocale, locale, searchParams],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !showThemeToggle) return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const updateThemeState = () => {
      let storedTheme: "light" | "dark" | "system" = "system";
      try {
        const raw = localStorage.getItem("theme");
        if (raw === "light" || raw === "dark" || raw === "system") storedTheme = raw;
      } catch {
        // noop
      }

      const nextResolved =
        storedTheme === "system" ? (media.matches ? "dark" : "light") : storedTheme;

      setThemeValue(storedTheme);
      setResolvedTheme(nextResolved);
    };

    const observer = new MutationObserver(updateThemeState);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    media.addEventListener("change", updateThemeState);
    updateThemeState();

    return () => {
      observer.disconnect();
      media.removeEventListener("change", updateThemeState);
    };
  }, [mounted, showThemeToggle]);

  function onLocaleChange(nextLocale: string) {
    const params = searchParams.toString();
    const current = `${pathname}${params ? `?${params}` : ""}`;
    router.push(withLangInUrl(current, nextLocale));
  }

  if (!mounted) return null;

  const toggleContainerStyle = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 9999,
    border: "1px solid var(--color-fd-border)",
    padding: 4,
    gap: 2,
  } as const;

  const getToggleItemStyle = (active: boolean) =>
    ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 26,
      height: 26,
      borderRadius: 9999,
      border: "none",
      background: active ? "var(--color-fd-accent)" : "transparent",
      color: active
        ? "var(--color-fd-accent-foreground)"
        : "var(--color-fd-muted-foreground)",
      cursor: "pointer",
    }) as const;

  function applyTheme(nextTheme: "light" | "dark" | "system") {
    const resolved = nextTheme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : nextTheme;

    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(resolved);
    document.documentElement.style.colorScheme = resolved;

    try {
      localStorage.setItem("theme", nextTheme);
    } catch {
      // noop
    }

    setThemeValue(nextTheme);
    setResolvedTheme(resolved);
  }

  return (
    <div
      className="fd-sidebar-locale-theme-control"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        width: "100%",
      }}
    >
      <select
        id="fd-locale-select"
        value={activeLocale}
        onChange={(e) => onLocaleChange(e.target.value)}
        aria-label="Select language"
        style={{
          minWidth: 76,
          height: 32,
          borderRadius: 9999,
          border: "1px solid var(--color-fd-border)",
          background: "var(--color-fd-background)",
          color: "var(--color-fd-foreground)",
          padding: "0 12px",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        {locales.map((item) => (
          <option key={item} value={item}>
            {item.toUpperCase()}
          </option>
        ))}
      </select>
      {showThemeToggle &&
        (themeMode === "light-dark" ? (
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => applyTheme(resolvedTheme === "light" ? "dark" : "light")}
            style={toggleContainerStyle}
          >
            <span style={getToggleItemStyle(resolvedTheme === "light")}>
              <SunIcon />
            </span>
            <span style={getToggleItemStyle(resolvedTheme === "dark")}>
              <MoonIcon />
            </span>
          </button>
        ) : (
          <div style={toggleContainerStyle}>
            <button
              type="button"
              aria-label="light"
              style={getToggleItemStyle(themeValue === "light")}
              onClick={() => applyTheme("light")}
            >
              <SunIcon />
            </button>
            <button
              type="button"
              aria-label="dark"
              style={getToggleItemStyle(themeValue === "dark")}
              onClick={() => applyTheme("dark")}
            >
              <MoonIcon />
            </button>
            <button
              type="button"
              aria-label="system"
              style={getToggleItemStyle(themeValue === "system")}
              onClick={() => applyTheme("system")}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                Auto
              </span>
            </button>
          </div>
        ))}
    </div>
  );
}
