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

export const AnimatedBackground = () => {
  const { width, height, isClient, isMobile } = useWindowSize();

  if (!isClient) {
    return (
      <div className={cn("absolute inset-0 w-full h-full bg-black")}>
        <div className="w-full h-full bg-gradient-to-br from-black via-gray-900 to-black animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute inset-0 w-full h-full overflow-hidden",
        "flex items-center justify-center"
      )}
    >
      <div className={cn("w-full h-full", isMobile && "min-h-screen")}>
        <UnicornScene
          production={true}
          projectId="erpu4mAlEe8kmhaGKYe9"
          width={width + 100}
          height={height}
        />
      </div>
    </div>
  );
};
