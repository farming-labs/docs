"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type FlickeringGridProps = {
  squareSize?: number;
  gridGap?: number;
  flickerChance?: number;
  maxOpacity?: number;
  className?: string;
};

type GridState = {
  cols: number;
  rows: number;
  squares: Float32Array;
  width: number;
  height: number;
};

/**
 * A canvas of small squares that flicker at random. Squares take the element's text color,
 * so the grid follows the light/dark ink without extra props. It only animates while visible
 * and holds a still frame for reduced motion.
 */
export function FlickeringGrid({
  squareSize = 2,
  gridGap = 7,
  flickerChance = 0.9,
  maxOpacity = 0.32,
  className,
}: FlickeringGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !container || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let color = getComputedStyle(container).color;
    let animationFrame: number | undefined;
    let isInView = false;
    let lastFrame = 0;

    const setup = (): GridState => {
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const cell = squareSize + gridGap;
      const cols = Math.ceil(width / cell);
      const rows = Math.ceil(height / cell);
      const squares = new Float32Array(cols * rows);
      for (let index = 0; index < squares.length; index += 1) {
        squares[index] = Math.random() * maxOpacity;
      }
      return { cols, rows, squares, width, height };
    };

    let grid = setup();

    const draw = () => {
      context.clearRect(0, 0, grid.width, grid.height);
      context.fillStyle = color;
      for (let col = 0; col < grid.cols; col += 1) {
        for (let row = 0; row < grid.rows; row += 1) {
          context.globalAlpha = grid.squares[col * grid.rows + row];
          context.fillRect(
            col * (squareSize + gridGap),
            row * (squareSize + gridGap),
            squareSize,
            squareSize,
          );
        }
      }
      context.globalAlpha = 1;
    };

    const stop = () => {
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
    };

    const animate = (time: number) => {
      if (!isInView || reducedMotion.matches) {
        stop();
        return;
      }
      const elapsed = time - lastFrame;
      if (elapsed >= 42) {
        const chance = flickerChance * (elapsed / 1000);
        for (let index = 0; index < grid.squares.length; index += 1) {
          if (Math.random() < chance) grid.squares[index] = Math.random() * maxOpacity;
        }
        draw();
        lastFrame = time;
      }
      animationFrame = requestAnimationFrame(animate);
    };

    const start = () => {
      if (animationFrame !== undefined || !isInView || reducedMotion.matches) return;
      lastFrame = performance.now();
      animationFrame = requestAnimationFrame(animate);
    };

    const resizeObserver = new ResizeObserver(() => {
      grid = setup();
      draw();
    });
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isInView = entry?.isIntersecting ?? false;
      if (isInView) start();
      else stop();
    });
    // Theme switches flip the `dark` class on <html>; pick up the new ink.
    const themeObserver = new MutationObserver(() => {
      color = getComputedStyle(container).color;
      draw();
    });
    const handleMotionPreference = () => {
      if (reducedMotion.matches) {
        stop();
        draw();
      } else {
        start();
      }
    };

    draw();
    resizeObserver.observe(container);
    intersectionObserver.observe(canvas);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    reducedMotion.addEventListener("change", handleMotionPreference);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      reducedMotion.removeEventListener("change", handleMotionPreference);
    };
  }, [flickerChance, gridGap, maxOpacity, squareSize]);

  return (
    <div ref={containerRef} aria-hidden="true" className={cn("relative h-full w-full", className)}>
      <canvas ref={canvasRef} className="pointer-events-none block size-full" />
    </div>
  );
}
