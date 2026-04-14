"use client";

import React, { useEffect, useMemo, useRef, useState, type JSX } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText as GSAPSplitText } from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, GSAPSplitText);

export interface ShuffleProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
  shuffleDirection?: "left" | "right" | "up" | "down";
  duration?: number;
  maxDelay?: number;
  ease?: string | ((t: number) => number);
  threshold?: number;
  rootMargin?: string;
  tag?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span";
  textAlign?: React.CSSProperties["textAlign"];
  onShuffleStart?: () => void;
  onShuffleComplete?: () => void;
  shuffleTimes?: number;
  animationMode?: "random" | "evenodd";
  loop?: boolean;
  loopDelay?: number;
  stagger?: number;
  scrambleCharset?: string;
  colorFrom?: string;
  colorTo?: string;
  triggerOnce?: boolean;
  respectReducedMotion?: boolean;
  triggerOnHover?: boolean;
}

const Shuffle: React.FC<ShuffleProps> = ({
  text,
  className = "",
  style = {},
  shuffleDirection = "right",
  duration = 0.35,
  maxDelay = 0,
  ease = "power3.out",
  threshold = 0.1,
  rootMargin = "-100px",
  tag = "p",
  textAlign = "center",
  onShuffleStart,
  onShuffleComplete,
  shuffleTimes = 1,
  animationMode = "evenodd",
  loop = false,
  loopDelay = 0,
  stagger = 0.03,
  scrambleCharset = "",
  colorFrom,
  colorTo,
  triggerOnce = true,
  respectReducedMotion = true,
  triggerOnHover = true,
}) => {
  const ref = useRef<HTMLElement>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [ready, setReady] = useState(false);

  const splitRef = useRef<GSAPSplitText | null>(null);
  const wrappersRef = useRef<HTMLElement[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const playingRef = useRef(false);
  const hoverHandlerRef = useRef<((e: Event) => void) | null>(null);

  useEffect(() => {
    if ("fonts" in document) {
      if (document.fonts.status === "loaded") {
        setFontsLoaded(true);
      } else {
        document.fonts.ready.then(() => setFontsLoaded(true));
      }
    } else {
      setFontsLoaded(true);
    }
  }, []);

  const scrollTriggerStart = useMemo(() => {
    const startPct = (1 - threshold) * 100;
    const match = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin || "");
    const marginValue = match ? Number.parseFloat(match[1]) : 0;
    const marginUnit = match ? match[2] || "px" : "px";
    const sign =
      marginValue === 0
        ? ""
        : marginValue < 0
          ? `-=${Math.abs(marginValue)}${marginUnit}`
          : `+=${marginValue}${marginUnit}`;

    return `top ${startPct}%${sign}`;
  }, [rootMargin, threshold]);

  useGSAP(
    () => {
      if (!ref.current || !text || !fontsLoaded) {
        return;
      }

      if (
        respectReducedMotion &&
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        onShuffleComplete?.();
        return;
      }

      const element = ref.current;
      const start = scrollTriggerStart;

      const removeHover = () => {
        if (hoverHandlerRef.current && ref.current) {
          ref.current.removeEventListener("mouseenter", hoverHandlerRef.current);
          hoverHandlerRef.current = null;
        }
      };

      const teardown = () => {
        if (tlRef.current) {
          tlRef.current.kill();
          tlRef.current = null;
        }

        if (wrappersRef.current.length) {
          wrappersRef.current.forEach((wrap) => {
            const inner = wrap.firstElementChild as HTMLElement | null;
            const original = inner?.querySelector("[data-orig='1']") as HTMLElement | null;
            if (original && wrap.parentNode) {
              wrap.parentNode.replaceChild(original, wrap);
            }
          });
          wrappersRef.current = [];
        }

        try {
          splitRef.current?.revert();
        } catch {}

        splitRef.current = null;
        playingRef.current = false;
      };

      const build = () => {
        teardown();

        const computedFont = getComputedStyle(element).fontFamily;
        splitRef.current = new GSAPSplitText(element, {
          type: "chars",
          charsClass: "shuffle-char",
          wordsClass: "shuffle-word",
          linesClass: "shuffle-line",
          smartWrap: true,
          reduceWhiteSpace: false,
        });

        const chars = (splitRef.current.chars || []) as HTMLElement[];
        wrappersRef.current = [];

        const rolls = Math.max(1, Math.floor(shuffleTimes));
        const randomCharacter = (charset: string) =>
          charset.charAt(Math.floor(Math.random() * charset.length)) || "";

        chars.forEach((char) => {
          const parent = char.parentElement;
          if (!parent) {
            return;
          }

          const rect = char.getBoundingClientRect();
          const width = rect.width;
          const height = rect.height;

          if (!width) {
            return;
          }

          const wrap = document.createElement("span");
          wrap.className = "inline-block overflow-hidden text-left";
          Object.assign(wrap.style, {
            width: `${width}px`,
            height:
              shuffleDirection === "up" || shuffleDirection === "down" ? `${height}px` : "auto",
            verticalAlign: "bottom",
          });

          const inner = document.createElement("span");
          inner.className =
            "inline-block origin-left transform-gpu will-change-transform " +
            (shuffleDirection === "up" || shuffleDirection === "down"
              ? "whitespace-normal"
              : "whitespace-nowrap");

          parent.insertBefore(wrap, char);
          wrap.appendChild(inner);

          const firstOriginal = char.cloneNode(true) as HTMLElement;
          firstOriginal.className =
            "text-left " +
            (shuffleDirection === "up" || shuffleDirection === "down" ? "block" : "inline-block");
          Object.assign(firstOriginal.style, {
            width: `${width}px`,
            fontFamily: computedFont,
          });

          char.setAttribute("data-orig", "1");
          char.className =
            "text-left " +
            (shuffleDirection === "up" || shuffleDirection === "down" ? "block" : "inline-block");
          Object.assign(char.style, {
            width: `${width}px`,
            fontFamily: computedFont,
          });

          inner.appendChild(firstOriginal);

          for (let index = 0; index < rolls; index += 1) {
            const copy = char.cloneNode(true) as HTMLElement;
            if (scrambleCharset) {
              copy.textContent = randomCharacter(scrambleCharset);
            }

            copy.className =
              "text-left " +
              (shuffleDirection === "up" || shuffleDirection === "down" ? "block" : "inline-block");
            Object.assign(copy.style, {
              width: `${width}px`,
              fontFamily: computedFont,
            });
            inner.appendChild(copy);
          }

          inner.appendChild(char);

          const steps = rolls + 1;

          if (shuffleDirection === "right" || shuffleDirection === "down") {
            const firstCopy = inner.firstElementChild as HTMLElement | null;
            const real = inner.lastElementChild as HTMLElement | null;
            if (real) {
              inner.insertBefore(real, inner.firstChild);
            }
            if (firstCopy) {
              inner.appendChild(firstCopy);
            }
          }

          let startX = 0;
          let finalX = 0;
          let startY = 0;
          let finalY = 0;

          if (shuffleDirection === "right") {
            startX = -steps * width;
            finalX = 0;
          } else if (shuffleDirection === "left") {
            startX = 0;
            finalX = -steps * width;
          } else if (shuffleDirection === "down") {
            startY = -steps * height;
            finalY = 0;
          } else if (shuffleDirection === "up") {
            startY = 0;
            finalY = -steps * height;
          }

          if (shuffleDirection === "left" || shuffleDirection === "right") {
            gsap.set(inner, { x: startX, y: 0, force3D: true });
            inner.setAttribute("data-start-x", String(startX));
            inner.setAttribute("data-final-x", String(finalX));
          } else {
            gsap.set(inner, { x: 0, y: startY, force3D: true });
            inner.setAttribute("data-start-y", String(startY));
            inner.setAttribute("data-final-y", String(finalY));
          }

          if (colorFrom) {
            inner.style.color = colorFrom;
          }

          wrappersRef.current.push(wrap);
        });
      };

      const inners = () => wrappersRef.current.map((wrap) => wrap.firstElementChild as HTMLElement);

      const randomizeScrambles = () => {
        if (!scrambleCharset) {
          return;
        }

        wrappersRef.current.forEach((wrap) => {
          const strip = wrap.firstElementChild as HTMLElement | null;
          if (!strip) {
            return;
          }

          const children = Array.from(strip.children) as HTMLElement[];
          for (let index = 1; index < children.length - 1; index += 1) {
            children[index].textContent = scrambleCharset.charAt(
              Math.floor(Math.random() * scrambleCharset.length),
            );
          }
        });
      };

      const cleanupToStill = () => {
        wrappersRef.current.forEach((wrap) => {
          const strip = wrap.firstElementChild as HTMLElement | null;
          if (!strip) {
            return;
          }

          const real = strip.querySelector("[data-orig='1']") as HTMLElement | null;
          if (!real) {
            return;
          }

          strip.replaceChildren(real);
          strip.style.transform = "none";
          strip.style.willChange = "auto";
        });
      };

      const play = () => {
        const strips = inners();
        if (!strips.length) {
          return;
        }

        playingRef.current = true;
        const isVertical = shuffleDirection === "up" || shuffleDirection === "down";

        const timeline = gsap.timeline({
          smoothChildTiming: true,
          repeat: loop ? -1 : 0,
          repeatDelay: loop ? loopDelay : 0,
          onRepeat: () => {
            if (scrambleCharset) {
              randomizeScrambles();
            }

            if (isVertical) {
              gsap.set(strips, {
                y: (_index, target: HTMLElement) =>
                  Number.parseFloat(target.getAttribute("data-start-y") || "0"),
              });
            } else {
              gsap.set(strips, {
                x: (_index, target: HTMLElement) =>
                  Number.parseFloat(target.getAttribute("data-start-x") || "0"),
              });
            }

            onShuffleComplete?.();
          },
          onComplete: () => {
            playingRef.current = false;
            if (!loop) {
              cleanupToStill();
              if (colorTo) {
                gsap.set(strips, { color: colorTo });
              }
              onShuffleComplete?.();
              armHover();
            }
          },
        });

        const addTween = (targets: HTMLElement[], at: number) => {
          const vars: gsap.TweenVars = {
            duration,
            ease,
            force3D: true,
            stagger: animationMode === "evenodd" ? stagger : 0,
          };

          if (isVertical) {
            vars.y = (_index, target: HTMLElement) =>
              Number.parseFloat(target.getAttribute("data-final-y") || "0");
          } else {
            vars.x = (_index, target: HTMLElement) =>
              Number.parseFloat(target.getAttribute("data-final-x") || "0");
          }

          timeline.to(targets, vars, at);

          if (colorFrom && colorTo) {
            timeline.to(
              targets,
              {
                color: colorTo,
                duration,
                ease,
              },
              at,
            );
          }
        };

        if (animationMode === "evenodd") {
          const odd = strips.filter((_strip, index) => index % 2 === 1);
          const even = strips.filter((_strip, index) => index % 2 === 0);
          const oddTotal = duration + Math.max(0, odd.length - 1) * stagger;
          const evenStart = odd.length ? oddTotal * 0.7 : 0;
          if (odd.length) {
            addTween(odd, 0);
          }
          if (even.length) {
            addTween(even, evenStart);
          }
        } else {
          strips.forEach((strip) => {
            const delay = Math.random() * maxDelay;
            const vars: gsap.TweenVars = {
              duration,
              ease,
              force3D: true,
            };

            if (isVertical) {
              vars.y = Number.parseFloat(strip.getAttribute("data-final-y") || "0");
            } else {
              vars.x = Number.parseFloat(strip.getAttribute("data-final-x") || "0");
            }

            timeline.to(strip, vars, delay);

            if (colorFrom && colorTo) {
              timeline.fromTo(
                strip,
                { color: colorFrom },
                { color: colorTo, duration, ease },
                delay,
              );
            }
          });
        }

        tlRef.current = timeline;
      };

      const armHover = () => {
        if (!triggerOnHover || !ref.current) {
          return;
        }

        removeHover();

        const handler = () => {
          if (playingRef.current) {
            return;
          }

          build();
          if (scrambleCharset) {
            randomizeScrambles();
          }
          play();
        };

        hoverHandlerRef.current = handler;
        ref.current.addEventListener("mouseenter", handler);
      };

      const create = () => {
        build();
        if (scrambleCharset) {
          randomizeScrambles();
        }
        onShuffleStart?.();
        play();
        armHover();
        setReady(true);
      };

      const trigger = ScrollTrigger.create({
        trigger: element,
        start,
        once: triggerOnce,
        onEnter: create,
      });

      return () => {
        trigger.kill();
        removeHover();
        teardown();
        setReady(false);
      };
    },
    {
      dependencies: [
        animationMode,
        colorFrom,
        colorTo,
        duration,
        ease,
        fontsLoaded,
        loop,
        loopDelay,
        maxDelay,
        onShuffleStart,
        onShuffleComplete,
        respectReducedMotion,
        scrambleCharset,
        scrollTriggerStart,
        shuffleDirection,
        shuffleTimes,
        stagger,
        text,
        triggerOnHover,
        triggerOnce,
      ],
      scope: ref,
    },
  );

  const baseClassName =
    "inline-block whitespace-normal break-words text-2xl leading-none will-change-transform";
  const userHasFont = useMemo(() => className && /font[-[]/i.test(className), [className]);

  const fallbackFont = useMemo(
    () => (userHasFont ? {} : { fontFamily: "'Press Start 2P', sans-serif" }),
    [userHasFont],
  );

  const commonStyle = useMemo(
    () => ({
      textAlign,
      ...fallbackFont,
      ...style,
    }),
    [fallbackFont, style, textAlign],
  );

  const classes = useMemo(
    () => `${baseClassName} ${ready ? "visible" : "invisible"} ${className}`.trim(),
    [baseClassName, className, ready],
  );

  const Tag = (tag || "p") as keyof JSX.IntrinsicElements;

  return React.createElement(
    Tag,
    { ref: ref as never, className: classes, style: commonStyle },
    text,
  );
};

export default Shuffle;
