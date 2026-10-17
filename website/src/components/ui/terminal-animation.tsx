"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface TerminalLine {
  text: string;
  color?: string;
  delay?: number;
}

export interface TabContent {
  label: string;
  command: string;
  lines: TerminalLine[];
}

type TerminalAnimationRootProps = HTMLAttributes<HTMLDivElement> & {
  tabs: TabContent[];
  defaultActiveTab?: number;
  activeTab?: number;
  onActiveTabChange?: (index: number) => void;
  hideCursorOnComplete?: boolean;
  autoRotate?: boolean;
  rotationPauseMs?: number;
  backgroundImage?: string;
  alwaysDark?: boolean;
};

type TerminalAnimationContextValue = {
  activeTab: number;
  setActiveTab: (index: number) => void;
  commandTyped: string;
  isTypingCommand: boolean;
  showCursor: boolean;
  visibleLines: number;
  currentTab: TabContent;
  tabs: TabContent[];
};

const TerminalAnimationContext = createContext<TerminalAnimationContextValue | undefined>(
  undefined,
);

function useTerminalAnimationContext() {
  const context = useContext(TerminalAnimationContext);
  if (!context) {
    throw new Error("Terminal animation components must be used within TerminalAnimationRoot");
  }
  return context;
}

export function TerminalAnimationRoot({
  tabs,
  defaultActiveTab = 0,
  activeTab: activeTabProp,
  onActiveTabChange,
  hideCursorOnComplete = true,
  autoRotate = false,
  rotationPauseMs = 2200,
  backgroundImage,
  alwaysDark = false,
  className,
  children,
  ...props
}: TerminalAnimationRootProps) {
  const isControlled = typeof activeTabProp === "number";
  const [internalActiveTab, setInternalActiveTab] = useState(defaultActiveTab);
  const activeTab = isControlled ? activeTabProp : internalActiveTab;
  const [visibleLines, setVisibleLines] = useState(0);
  const [commandTyped, setCommandTyped] = useState("");
  const [isTypingCommand, setIsTypingCommand] = useState(true);
  const [showCursor, setShowCursor] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const safeTabs = tabs.length > 0 ? tabs : [{ label: "default", command: "", lines: [] }];
  const safeActiveTab = Math.min(activeTab ?? 0, safeTabs.length - 1);

  const setActiveTab = useCallback(
    (index: number) => {
      if (!isControlled) {
        setInternalActiveTab(index);
      }
      onActiveTabChange?.(index);
    },
    [isControlled, onActiveTabChange],
  );

  const clearTimeouts = useCallback(() => {
    timeoutRef.current.forEach(clearTimeout);
    timeoutRef.current = [];
  }, []);

  const animateTab = useCallback(
    (tabIndex: number) => {
      clearTimeouts();
      setVisibleLines(0);
      setCommandTyped("");
      setIsTypingCommand(true);
      setShowCursor(true);

      const tab = safeTabs[tabIndex];
      if (!tab) return;

      const command = tab.command;
      let charIndex = 0;

      const typeCommand = () => {
        if (charIndex <= command.length) {
          setCommandTyped(command.slice(0, charIndex));
          charIndex += 1;
          const timer = setTimeout(typeCommand, 22 + Math.random() * 22);
          timeoutRef.current.push(timer);
          return;
        }

        const timer = setTimeout(() => {
          setIsTypingCommand(false);
          showLines(0);
        }, 220);
        timeoutRef.current.push(timer);
      };

      const showLines = (lineIndex: number) => {
        if (lineIndex <= tab.lines.length) {
          setVisibleLines(lineIndex);

          if (lineIndex < tab.lines.length) {
            const delay = tab.lines[lineIndex]?.delay ?? 100;
            const timer = setTimeout(() => showLines(lineIndex + 1), delay);
            timeoutRef.current.push(timer);
            return;
          }

          if (hideCursorOnComplete) {
            const cursorTimer = setTimeout(() => setShowCursor(false), 600);
            timeoutRef.current.push(cursorTimer);
          }

          if (autoRotate && safeTabs.length > 1) {
            const rotateTimer = setTimeout(() => {
              setActiveTab((tabIndex + 1) % safeTabs.length);
            }, rotationPauseMs);
            timeoutRef.current.push(rotateTimer);
          }
        }
      };

      const startTimer = setTimeout(typeCommand, 240);
      timeoutRef.current.push(startTimer);
    },
    [autoRotate, clearTimeouts, hideCursorOnComplete, rotationPauseMs, safeTabs, setActiveTab],
  );

  useEffect(() => {
    animateTab(safeActiveTab);
    return clearTimeouts;
  }, [animateTab, clearTimeouts, safeActiveTab]);

  const contextValue = useMemo<TerminalAnimationContextValue>(
    () => ({
      activeTab: safeActiveTab,
      setActiveTab,
      commandTyped,
      isTypingCommand,
      showCursor,
      visibleLines,
      currentTab: safeTabs[safeActiveTab]!,
      tabs: safeTabs,
    }),
    [
      commandTyped,
      isTypingCommand,
      safeActiveTab,
      safeTabs,
      setActiveTab,
      showCursor,
      visibleLines,
    ],
  );

  return (
    <TerminalAnimationContext.Provider value={contextValue}>
      <div
        className={cn(alwaysDark && "dark", className)}
        data-slot="terminal-animation-root"
        {...props}
      >
        {backgroundImage ? (
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center"
            data-slot="terminal-animation-background"
            style={{ backgroundImage: `url(${backgroundImage})` }}
          />
        ) : null}
        {children}
      </div>
    </TerminalAnimationContext.Provider>
  );
}

export function TerminalAnimationBackgroundGradient({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(255,255,255,0.12),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_55%)] dark:bg-[radial-gradient(120%_100%_at_50%_0%,rgba(255,255,255,0.08),transparent_52%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_55%)]",
        className,
      )}
      data-slot="terminal-animation-background-gradient"
      {...props}
    />
  );
}

export function TerminalAnimationContainer({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative w-full", className)}
      data-slot="terminal-animation-container"
      {...props}
    />
  );
}

export function TerminalAnimationWindow({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#09090b] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        className,
      )}
      data-slot="terminal-animation-window"
      {...props}
    />
  );
}

export function TerminalAnimationContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 px-4 py-4 sm:px-5 sm:py-5", className)}
      data-slot="terminal-animation-content"
      {...props}
    />
  );
}

export function TerminalAnimationBlinkingCursor({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden
      className={cn("ml-0.5 inline-block h-[15px] w-[6px] animate-pulse bg-white/65", className)}
      data-slot="terminal-animation-blinking-cursor"
      {...props}
    />
  );
}

export function TerminalAnimationCommandBar({
  className,
  cursor,
  ...props
}: HTMLAttributes<HTMLDivElement> & { cursor?: ReactNode }) {
  const { commandTyped, isTypingCommand, showCursor } = useTerminalAnimationContext();

  return (
    <div className={className} data-slot="terminal-animation-command" {...props}>
      {commandTyped}
      {isTypingCommand && showCursor ? (cursor ?? <TerminalAnimationBlinkingCursor />) : null}
    </div>
  );
}

export function TerminalAnimationOutput({
  className,
  renderLine,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  renderLine?: (line: TerminalLine, index: number, visible: boolean) => ReactNode;
}) {
  const { currentTab, visibleLines, activeTab, isTypingCommand } = useTerminalAnimationContext();

  if (isTypingCommand) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      role="log"
      className={className}
      data-slot="terminal-animation-output"
      {...props}
    >
      {currentTab.lines.map((line, index) => {
        const visible = index < visibleLines;
        const key = `${activeTab}-${index}`;

        if (renderLine) {
          const content = renderLine(line, index, visible);
          return content ? <div key={key}>{content}</div> : null;
        }

        if (!visible) return null;
        return (
          <div key={key} className="leading-relaxed">
            <span className={cn("font-mono text-xs text-white/68", line.color)}>{line.text}</span>
          </div>
        );
      })}
    </div>
  );
}

export function TerminalAnimationTrailingPrompt({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const { isTypingCommand, showCursor, visibleLines, currentTab } = useTerminalAnimationContext();
  const show = !isTypingCommand && showCursor && visibleLines >= currentTab.lines.length;

  if (!show) return null;

  return (
    <div className={className} data-slot="terminal-animation-trailing-prompt" {...props}>
      {children}
    </div>
  );
}

export function TerminalAnimationTabList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      aria-label="Terminal commands"
      className={className}
      data-slot="terminal-animation-tab-list"
      {...props}
    />
  );
}

export function TerminalAnimationTabTrigger({
  index,
  asChild = false,
  className,
  children,
  ...props
}: Omit<React.ComponentPropsWithoutRef<"button">, "children"> & {
  index: number;
  asChild?: boolean;
  children?: ReactNode;
}) {
  const { activeTab, setActiveTab } = useTerminalAnimationContext();
  const active = activeTab === index;

  const triggerProps = {
    role: "tab" as const,
    "aria-selected": active,
    "data-state": active ? "active" : "inactive",
    onClick: () => setActiveTab(index),
    children,
  };

  if (asChild) {
    return <Slot className={className} {...triggerProps} {...props} />;
  }

  return (
    <button
      type="button"
      className={className}
      data-slot="terminal-animation-tab-trigger"
      {...triggerProps}
      {...props}
    />
  );
}

export function useTerminalAnimation() {
  return useTerminalAnimationContext();
}
