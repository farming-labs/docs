"use client";

/**
 * Enhanced search dialog with "Ask AI" tab + floating chat widget.
 *
 * All styles use `--color-fd-*` CSS variables from the active theme,
 * so the dialog automatically adapts to default / darksharp / pixel-border.
 *
 * Two modes:
 * - `mode="search"` (default): AI tab inside the Cmd+K search dialog
 * - `mode="floating"`: Standalone floating chat widget with configurable position
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";

// ─── Types ──────────────────────────────────────────────────────────

interface SearchResult {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Shared CSS (theme-aware) ───────────────────────────────────────

const CSS = {
  overlay: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 9998,
    background: "color-mix(in srgb, var(--color-fd-background, #000) 70%, transparent)",
    backdropFilter: "blur(6px)",
  },
  dialogBase: {
    position: "fixed" as const,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column" as const,
    background: "var(--color-fd-popover, var(--color-fd-background, #0c0c0c))",
    border: "1px solid var(--color-fd-border, #1f1f2e)",
    borderRadius: "var(--radius, 12px)",
    boxShadow: "0 20px 60px color-mix(in srgb, var(--color-fd-background, #000) 60%, transparent)",
    overflow: "hidden",
    color: "var(--color-fd-foreground, #e4e4e7)",
    fontFamily: "var(--fd-font-sans, system-ui, -apple-system, sans-serif)",
  },
  tabBtn: (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 500 as const,
    border: "none",
    borderRadius: "var(--radius, 8px) var(--radius, 8px) 0 0",
    cursor: "pointer" as const,
    transition: "all 150ms",
    background: active ? "var(--color-fd-accent, rgba(255,255,255,0.06))" : "transparent",
    color: active ? "var(--color-fd-foreground, #e4e4e7)" : "var(--color-fd-muted-foreground, #71717a)",
    borderBottom: active ? "2px solid var(--color-fd-primary, #6366f1)" : "2px solid transparent",
  }),
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--color-fd-foreground, #e4e4e7)",
    fontSize: 14,
    fontFamily: "inherit",
  },
  resultBtn: (active: boolean) => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "10px 12px",
    border: "none",
    borderRadius: "var(--radius, 8px)",
    cursor: "pointer" as const,
    textAlign: "left" as const,
    fontSize: 13,
    fontFamily: "inherit",
    transition: "background 100ms",
    background: active ? "var(--color-fd-accent, rgba(255,255,255,0.06))" : "transparent",
    color: active ? "var(--color-fd-accent-foreground, #fff)" : "var(--color-fd-foreground, #e4e4e7)",
  }),
  userBubble: {
    background: "var(--color-fd-primary, #6366f1)",
    color: "var(--color-fd-primary-foreground, #fff)",
    padding: "8px 14px",
    borderRadius: "var(--radius, 14px)",
    fontSize: 13,
    lineHeight: 1.5,
    maxWidth: "85%",
    wordBreak: "break-word" as const,
  },
  aiBubble: {
    background: "var(--color-fd-muted, rgba(255,255,255,0.04))",
    padding: "10px 14px",
    borderRadius: "var(--radius, 14px)",
    fontSize: 13,
    lineHeight: 1.6,
    maxWidth: "95%",
    wordBreak: "break-word" as const,
  },
  chatInputWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "var(--color-fd-muted, rgba(255,255,255,0.04))",
    borderRadius: "var(--radius, 10px)",
    padding: "4px 4px 4px 14px",
    border: "1px solid var(--color-fd-border, rgba(255,255,255,0.08))",
  },
  sendBtn: (canSend: boolean) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: "var(--radius, 8px)",
    border: "none",
    cursor: canSend ? "pointer" as const : "default" as const,
    background: canSend ? "var(--color-fd-primary, #6366f1)" : "var(--color-fd-muted, rgba(255,255,255,0.06))",
    color: canSend ? "var(--color-fd-primary-foreground, #fff)" : "var(--color-fd-muted-foreground, #71717a)",
    transition: "all 150ms",
  }),
  muted: { color: "var(--color-fd-muted-foreground, #71717a)" },
  border: { borderColor: "var(--color-fd-border, rgba(255,255,255,0.06))" },
} as const;

// ─── Markdown renderer ──────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      '<pre style="background:var(--color-fd-muted,#1a1a2e);padding:12px 16px;border-radius:var(--radius,8px);overflow-x:auto;margin:8px 0;font-size:13px;line-height:1.5;font-family:var(--fd-font-mono,ui-monospace,monospace)"><code>$2</code></pre>',
    )
    .replace(
      /`([^`]+)`/g,
      '<code style="background:var(--color-fd-muted,#1a1a2e);padding:2px 6px;border-radius:var(--radius,4px);font-size:0.875em;font-family:var(--fd-font-mono,ui-monospace,monospace)">$1</code>',
    )
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" style="color:var(--color-fd-primary,#6366f1);text-decoration:underline">$1</a>',
    )
    .replace(/^### (.*$)/gm, '<h4 style="font-size:14px;font-weight:600;margin:12px 0 4px">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 style="font-size:15px;font-weight:600;margin:14px 0 4px">$1</h3>')
    .replace(/^# (.*$)/gm, '<h2 style="font-size:16px;font-weight:600;margin:16px 0 6px">$1</h2>')
    .replace(
      /^[-*] (.*$)/gm,
      '<div style="display:flex;gap:8px;padding:2px 0"><span style="color:var(--color-fd-muted-foreground,#888)">•</span><span>$1</span></div>',
    )
    .replace(
      /^(\d+)\. (.*$)/gm,
      '<div style="display:flex;gap:8px;padding:2px 0"><span style="color:var(--color-fd-muted-foreground,#888)">$1.</span><span>$2</span></div>',
    )
    .replace(/\n\n/g, '<div style="height:8px"></div>')
    .replace(/\n/g, "<br>");
}

// ─── Icons ──────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SparklesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" /><path d="M22 5h-4" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" /><path d="m6 6 12 12" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-fd-muted-foreground, #888)", animation: `fdAiDot 1.4s infinite ease-in-out both`, animationDelay: `${i * 0.16}s` }} />
      ))}
    </span>
  );
}

// ─── Shared AI Chat Component ───────────────────────────────────────

function AIChat({ api, messages, setMessages, aiInput, setAiInput, isStreaming, setIsStreaming }: {
  api: string;
  messages: ChatMessage[];
  setMessages: (m: ChatMessage[]) => void;
  aiInput: string;
  setAiInput: (v: string) => void;
  isStreaming: boolean;
  setIsStreaming: (v: boolean) => void;
}) {
  const aiInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { aiInputRef.current?.focus(); }, []);

  const handleAskAI = useCallback(async () => {
    if (!aiInput.trim() || isStreaming) return;
    const userMessage: ChatMessage = { role: "user", content: aiInput };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setAiInput("");
    setIsStreaming(true);

    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map((m) => ({ role: m.role, content: m.content })) }),
      });

      if (!res.ok) {
        let errMsg = "Something went wrong.";
        try { const err = await res.json(); errMsg = err.error || errMsg; } catch {}
        setMessages([...newMessages, { role: "assistant", content: errMsg }]);
        setIsStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                assistantContent += content;
                setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
              }
            } catch {}
          }
        }
      }
      if (assistantContent) setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "Failed to connect. Please try again." }]);
    }
    setIsStreaming(false);
  }, [aiInput, messages, api, isStreaming, setMessages, setAiInput, setIsStreaming]);

  const handleAIKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAskAI(); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, gap: 12, padding: "24px 0", ...CSS.muted }}>
            <SparklesIcon size={20} />
            <div style={{ fontSize: 14, fontWeight: 500 }}>Ask anything about the docs</div>
            <div style={{ fontSize: 12, opacity: 0.7, textAlign: "center", maxWidth: 300, lineHeight: 1.5 }}>
              AI will search through the documentation and answer your question with relevant context.
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", ...CSS.muted, padding: "0 2px" }}>
                {msg.role === "user" ? "You" : "AI"}
              </div>
              {msg.role === "user" ? (
                <div style={CSS.userBubble}>{msg.content}</div>
              ) : (
                <div style={CSS.aiBubble}>
                  {msg.content ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} /> : <LoadingDots />}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 12px 12px", borderTop: `1px solid var(--color-fd-border, rgba(255,255,255,0.06))` }}>
        {messages.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 8 }}>
            <button onClick={() => { setMessages([]); setAiInput(""); }} style={{ fontSize: 11, ...CSS.muted, background: "transparent", border: "none", cursor: "pointer", padding: "2px 8px", borderRadius: "var(--radius, 4px)", fontFamily: "inherit" }}>
              Clear chat
            </button>
          </div>
        )}
        <div style={CSS.chatInputWrap}>
          <input ref={aiInputRef} type="text" placeholder="Ask a question..." value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={handleAIKeyDown} disabled={isStreaming}
            style={{ ...CSS.input, opacity: isStreaming ? 0.5 : 1 }} />
          <button onClick={handleAskAI} disabled={!aiInput.trim() || isStreaming} style={CSS.sendBtn(!!(aiInput.trim() && !isStreaming))}>
            <ArrowUpIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Search Dialog (Cmd+K) mode ─────────────────────────────────────

export function DocsSearchDialog({ open, onOpenChange, api = "/api/docs" }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api?: string;
}) {
  const [tab, setTab] = useState<"search" | "ai">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (open) { setSearchQuery(""); setSearchResults([]); setActiveIndex(0); setTimeout(() => { if (tab === "search") searchInputRef.current?.focus(); }, 50); }
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Search
  useEffect(() => {
    if (!searchQuery.trim() || tab !== "search") { setSearchResults([]); setActiveIndex(0); return; }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${api}?query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) { const data = await res.json(); setSearchResults(data); setActiveIndex(0); }
      } catch {}
      setIsSearching(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, api, tab]);

  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && searchResults[activeIndex]) { e.preventDefault(); onOpenChange(false); window.location.href = searchResults[activeIndex].url; }
  };

  if (!open) return null;

  return createPortal(
    <>
      <style>{`@keyframes fdAiDot{0%,80%,100%{transform:scale(0);opacity:.5}40%{transform:scale(1);opacity:1}}@keyframes fdFadeIn{from{opacity:0}to{opacity:1}}@keyframes fdSlideUp{from{opacity:0;transform:translate(-50%,-48%) scale(.96)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style>
      <div onClick={() => onOpenChange(false)} style={{ ...CSS.overlay, animation: "fdFadeIn 150ms ease-out" }} />
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{
        ...CSS.dialogBase,
        left: "50%", top: "50%", transform: "translate(-50%, -50%)",
        width: "min(580px, calc(100vw - 32px))", maxHeight: "min(520px, calc(100vh - 64px))",
        animation: "fdSlideUp 200ms ease-out",
      }}>
        {/* Tab bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 2, padding: "10px 12px 0", borderBottom: `1px solid var(--color-fd-border, #1f1f2e)` }}>
          <button onClick={() => setTab("search")} style={CSS.tabBtn(tab === "search")}><SearchIcon /> Search</button>
          <button onClick={() => setTab("ai")} style={CSS.tabBtn(tab === "ai")}><SparklesIcon /> Ask AI</button>
          <div style={{ marginLeft: "auto", fontSize: 11, ...CSS.muted, display: "flex", gap: 4, alignItems: "center" }}>
            <kbd style={{ padding: "2px 6px", borderRadius: "var(--radius, 4px)", border: `1px solid var(--color-fd-border, rgba(255,255,255,0.1))`, fontSize: 10, fontFamily: "inherit" }}>ESC</kbd>
          </div>
        </div>

        {/* Search tab */}
        {tab === "search" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid var(--color-fd-border, rgba(255,255,255,0.06))` }}>
              <SearchIcon />
              <input ref={searchInputRef} type="text" placeholder="Search documentation..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={handleSearchKeyDown} style={CSS.input} />
              {isSearching && <LoadingDots />}
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
              {searchResults.length > 0 ? searchResults.map((result, i) => (
                <button key={result.id} onClick={() => { onOpenChange(false); window.location.href = result.url; }} onMouseEnter={() => setActiveIndex(i)} style={CSS.resultBtn(i === activeIndex)}>
                  <FileIcon /><span dangerouslySetInnerHTML={{ __html: result.content }} style={{ flex: 1 }} />
                </button>
              )) : (
                <div style={{ padding: "32px 16px", textAlign: "center", ...CSS.muted, fontSize: 13 }}>
                  {searchQuery.trim() ? (isSearching ? "Searching..." : "No results found. Try the Ask AI tab.") : "Type to search the docs"}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI tab */}
        {tab === "ai" && (
          <AIChat api={api} messages={messages} setMessages={setMessages} aiInput={aiInput} setAiInput={setAiInput} isStreaming={isStreaming} setIsStreaming={setIsStreaming} />
        )}
      </div>
    </>,
    document.body,
  );
}

// ─── Floating Chat Widget ───────────────────────────────────────────

type FloatingPosition = "bottom-right" | "bottom-left" | "bottom-center";
type FloatingStyle = "panel" | "modal" | "popover";

const BTN_POSITIONS: Record<FloatingPosition, React.CSSProperties> = {
  "bottom-right": { bottom: 24, right: 24 },
  "bottom-left": { bottom: 24, left: 24 },
  "bottom-center": { bottom: 24, left: "50%", transform: "translateX(-50%)" },
};

const PANEL_POSITIONS: Record<FloatingPosition, React.CSSProperties> = {
  "bottom-right": { bottom: 80, right: 24 },
  "bottom-left": { bottom: 80, left: 24 },
  "bottom-center": { bottom: 80, left: "50%", transform: "translateX(-50%)" },
};

const POPOVER_POSITIONS: Record<FloatingPosition, React.CSSProperties> = {
  "bottom-right": { bottom: 80, right: 24 },
  "bottom-left": { bottom: 80, left: 24 },
  "bottom-center": { bottom: 80, left: "50%", transform: "translateX(-50%)" },
};

function getContainerStyles(style: FloatingStyle, position: FloatingPosition): React.CSSProperties {
  switch (style) {
    case "modal":
      return {
        top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(560px, calc(100vw - 32px))",
        height: "min(520px, calc(100vh - 64px))",
      };
    case "popover":
      return {
        ...(POPOVER_POSITIONS[position] || POPOVER_POSITIONS["bottom-right"]),
        width: "min(360px, calc(100vw - 48px))",
        height: "min(400px, calc(100vh - 120px))",
      };
    case "panel":
    default:
      return {
        ...(PANEL_POSITIONS[position] || PANEL_POSITIONS["bottom-right"]),
        width: "min(400px, calc(100vw - 48px))",
        height: "min(500px, calc(100vh - 120px))",
      };
  }
}

function getAnimation(style: FloatingStyle): string {
  return style === "modal"
    ? "fdFloatCenterIn 200ms ease-out"
    : "fdFloatIn 200ms ease-out";
}

export function FloatingAIChat({
  api = "/api/docs",
  position = "bottom-right",
  floatingStyle = "panel",
  triggerComponentHtml,
}: {
  api?: string;
  position?: FloatingPosition;
  floatingStyle?: FloatingStyle;
  /** Serialized HTML for a custom trigger component. Replaces the default sparkles button. */
  triggerComponentHtml?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isOpen) {
      const handler = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }
  }, [isOpen]);

  // Lock body scroll for modal style
  useEffect(() => {
    if (isOpen && floatingStyle === "modal") document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen, floatingStyle]);

  if (!mounted) return null;

  const btnPosition = BTN_POSITIONS[position] || BTN_POSITIONS["bottom-right"];
  const isModal = floatingStyle === "modal";
  const containerStyles = getContainerStyles(floatingStyle, position);

  return createPortal(
    <>
      <style>{`@keyframes fdAiDot{0%,80%,100%{transform:scale(0);opacity:.5}40%{transform:scale(1);opacity:1}}@keyframes fdFadeIn{from{opacity:0}to{opacity:1}}@keyframes fdFloatIn{from{opacity:0;transform:translateY(12px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes fdFloatCenterIn{from{opacity:0;transform:translate(-50%,-48%) scale(.96)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}`}</style>

      {/* Backdrop overlay — shown for modal style only */}
      {isOpen && isModal && (
        <div onClick={() => setIsOpen(false)} style={{ ...CSS.overlay, animation: "fdFadeIn 150ms ease-out" }} />
      )}

      {/* Chat container */}
      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            ...CSS.dialogBase,
            ...containerStyles,
            animation: getAnimation(floatingStyle),
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
            borderBottom: `1px solid var(--color-fd-border, rgba(255,255,255,0.06))`,
          }}>
            <SparklesIcon size={16} />
            <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Ask AI</span>
            {isModal && (
              <kbd style={{ padding: "2px 6px", borderRadius: "var(--radius, 4px)", border: `1px solid var(--color-fd-border, rgba(255,255,255,0.1))`, fontSize: 10, fontFamily: "inherit", marginRight: 4, ...CSS.muted }}>ESC</kbd>
            )}
            <button onClick={() => setIsOpen(false)} style={{
              display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28,
              borderRadius: "var(--radius, 6px)", border: "none", cursor: "pointer",
              background: "transparent", color: "var(--color-fd-muted-foreground, #71717a)",
              transition: "all 150ms",
            }}>
              <XIcon />
            </button>
          </div>

          <AIChat api={api} messages={messages} setMessages={setMessages} aiInput={aiInput} setAiInput={setAiInput} isStreaming={isStreaming} setIsStreaming={setIsStreaming} />
        </div>
      )}

      {/* Floating button (default or custom trigger component) */}
      {!isOpen && (
        triggerComponentHtml ? (
          <div
            onClick={() => setIsOpen(true)}
            style={{ position: "fixed", zIndex: 9997, ...btnPosition, cursor: "pointer", animation: "fdFadeIn 300ms ease-out" }}
            dangerouslySetInnerHTML={{ __html: triggerComponentHtml }}
          />
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Ask AI"
            style={{
              position: "fixed", zIndex: 9997,
              ...btnPosition,
              width: 52, height: 52,
              borderRadius: "var(--radius, 26px)",
              border: "1px solid var(--color-fd-border, rgba(255,255,255,0.1))",
              background: "var(--color-fd-primary, #6366f1)",
              color: "var(--color-fd-primary-foreground, #fff)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 32px color-mix(in srgb, var(--color-fd-primary, #6366f1) 30%, transparent)",
              transition: "all 200ms",
              animation: "fdFadeIn 300ms ease-out",
            }}
          >
            <SparklesIcon size={22} />
          </button>
        )
      )}
    </>,
    document.body,
  );
}
