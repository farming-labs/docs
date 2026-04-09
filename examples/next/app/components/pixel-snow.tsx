"use client";

import { useEffect, useRef } from "react";
import { mountPixelSnow, type PixelSnowOptions } from "@/lib/pixel-snow";

export default function PixelSnow(props: PixelSnowOptions) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return mountPixelSnow(ref.current, props);
  }, [props]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
