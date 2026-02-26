"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import UnicornScene from "unicornstudio-react";

export const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });
  const [isClient, setIsClient] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setWindowSize({ width, height });
      setIsMobile(width < 768);
    };

    handleResize();

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return { ...windowSize, isClient, isMobile };
};

export function useIsDark() {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

export const AnimatedBackground = () => {
  const { width, height, isClient, isMobile } = useWindowSize();
  const isDark = useIsDark();

  if (!isClient) {
    return (
      <div
        className={cn(
          "absolute inset-0 w-full h-full",
          isDark ? "bg-black" : "bg-white",
        )}
      >
        <div
          className={cn(
            "w-full h-full animate-pulse",
            isDark
              ? "bg-gradient-to-br from-black via-gray-900 to-black"
              : "bg-gradient-to-br from-white via-neutral-50 to-white",
          )}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute inset-0 w-full h-full overflow-hidden",
        "flex items-center justify-center",
        isDark ? "bg-black" : "bg-white",
      )}
    >
      <div className={cn("w-full h-full relative", isMobile && "min-h-screen")}>
        <UnicornScene
          production={true}
          projectId="erpu4mAlEe8kmhaGKYe9"
          width={width + 100}
          height={height}
          className="bg-white"
        />
        {!isDark && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, transparent 0%, rgba(255,255,255,1) 70%, white 100%)",
            }}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
};
