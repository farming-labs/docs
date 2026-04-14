"use client";

import { useState } from "react";
import Shuffle from "@/components/ui/shuffle";

type CloudHeroHeadlineProps = {
  initialText: string;
  shuffledText: string;
};

export function CloudHeroHeadline({ initialText, shuffledText }: CloudHeroHeadlineProps) {
  const [shuffleStarted, setShuffleStarted] = useState(false);

  return (
    <>
      <h1 className="max-w-[13ch] text-balance text-[2.45rem] font-semibold leading-[0.94] tracking-[-0.08em] text-black dark:text-white sm:hidden">
        {initialText}
      </h1>

      <div className="relative hidden max-w-5xl sm:block">
        <h1
          className={[
            "font-semibold tracking-[-0.06em] text-black transition-opacity dark:text-white sm:text-5xl lg:text-6xl",
            shuffleStarted ? "opacity-0" : "opacity-100",
          ].join(" ")}
        >
          {initialText}
        </h1>

        <Shuffle
          text={shuffledText}
          shuffleDirection="right"
          duration={0.35}
          animationMode="evenodd"
          shuffleTimes={1}
          ease="power3.out"
          stagger={0.03}
          threshold={0.1}
          triggerOnce={true}
          triggerOnHover
          respectReducedMotion={true}
          loop={false}
          loopDelay={0}
          tag="h1"
          textAlign="left"
          onShuffleStart={() => setShuffleStarted(true)}
          className="absolute inset-0 max-w-5xl font-semibold tracking-[-0.06em] text-black dark:text-white sm:text-5xl lg:text-6xl"
        />
      </div>
    </>
  );
}
