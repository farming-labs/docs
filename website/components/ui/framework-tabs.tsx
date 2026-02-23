"use client";

import { useState } from "react";

interface FrameworkTabsProps {
  tabs: {
    label: string;
    value: string;
    content: React.ReactNode;
  }[];
}

export default function FrameworkTabs({ tabs }: FrameworkTabsProps) {
  const [active, setActive] = useState(tabs[0].value);

  return (
    <div>
      <div className="flex items-center gap-0 mb-4 border-b border-white/[8%]">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActive(tab.value)}
            className={`px-4 py-2 text-[11px] font-mono uppercase tracking-wider transition-colors relative ${
              active === tab.value ? "text-white" : "text-white/30 hover:text-white/60"
            }`}
          >
            {tab.label}
            {active === tab.value && (
              <span className="absolute bottom-0 left-0 right-0 h-px bg-white" />
            )}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.value} className={active === tab.value ? "block" : "hidden"}>
          {tab.content}
        </div>
      ))}
    </div>
  );
}
