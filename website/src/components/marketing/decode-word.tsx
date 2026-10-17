"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const GLYPHS = "#%&*+/<>=_{}[]$@0123456789";
const HOLD_MS = 2600;
const DECODE_MS = 560;
const FRAME_MS = 36;

/**
 * Cycles through words inside a design-tool selection. Each change decodes through
 * look-alike glyphs, left to right, then holds. The first word renders on the server
 * and stays put for reduced motion; headings should carry the stable text in aria-label.
 */
export function DecodeWord({ words, className }: { words: readonly string[]; className?: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = textRef.current;
    const root = rootRef.current;
    if (!node || !root || words.length < 2) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let index = 0;
    let holdTimer: number | undefined;
    let frameTimer: number | undefined;
    let inView = true;

    const decodeTo = (target: string, from: string, onDone: () => void) => {
      if (reducedMotion.matches) {
        node.textContent = target;
        onDone();
        return;
      }
      const length = Math.max(target.length, from.length);
      const started = performance.now();
      const step = () => {
        const progress = Math.min(1, (performance.now() - started) / DECODE_MS);
        let next = "";
        for (let position = 0; position < length; position += 1) {
          const settled = progress >= (position + 1) / length;
          if (settled) next += target[position] ?? "";
          else if (position < target.length || progress < 0.6)
            next += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        node.textContent = next;
        if (progress < 1) frameTimer = window.setTimeout(step, FRAME_MS);
        else {
          node.textContent = target;
          onDone();
        }
      };
      step();
    };

    const schedule = () => {
      window.clearTimeout(holdTimer);
      holdTimer = window.setTimeout(() => {
        if (!inView || document.hidden) {
          schedule();
          return;
        }
        const from = words[index];
        index = (index + 1) % words.length;
        decodeTo(words[index], from, schedule);
      }, HOLD_MS);
    };

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry?.isIntersecting ?? true;
    });
    observer.observe(root);
    schedule();

    return () => {
      observer.disconnect();
      window.clearTimeout(holdTimer);
      window.clearTimeout(frameTimer);
    };
  }, [words]);

  return (
    <span ref={rootRef} aria-hidden="true" className={cn("mk-select whitespace-nowrap", className)}>
      <span ref={textRef}>{words[0]}</span>
      <span className="mk-select-handle -left-[4px] -top-[4px]" />
      <span className="mk-select-handle -right-[4px] -top-[4px]" />
      <span className="mk-select-handle -bottom-[4px] -left-[4px]" />
      <span className="mk-select-handle -bottom-[4px] -right-[4px]" />
    </span>
  );
}
