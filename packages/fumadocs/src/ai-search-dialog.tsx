"use client";

/**
 * Enhanced search dialog with "Ask AI" tab + floating chat widget.
 *
 * All visual styles live in CSS (`ai.css` + theme overrides) using `fd-ai-*`
 * class names. Each theme (default, darksharp, pixel-border) provides its
 * own variant so the AI UI matches the rest of the docs.
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
import { highlight } from "sugar-high";

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

type AIModelOption = { id: string; label: string };

// ─── Markdown renderer ──────────────────────────────────────────────

function buildCodeBlock(lang: string, code: string): string {
  const trimmed = code.replace(/\n$/, "");
  // Strip newlines between sh__line spans — <pre> preserves whitespace
  // and display:block spans already break lines, so raw \n doubles them.
  const highlighted = highlight(trimmed).replace(/<\/span>\n<span/g, "</span><span");
  const langLabel = lang ? `<div class="fd-ai-code-lang">${escapeHtml(lang)}</div>` : "";
  const copyBtn = `<button class="fd-ai-code-copy" onclick="(function(btn){var code=btn.closest('.fd-ai-code-block').querySelector('code').textContent;navigator.clipboard.writeText(code).then(function(){btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy'},1500)})})(this)">Copy</button>`;
  return (
    `<div class="fd-ai-code-block">` +
    `<div class="fd-ai-code-header">${langLabel}${copyBtn}</div>` +
    `<pre><code>${highlighted}</code></pre>` +
    `</div>`
  );
}

function renderMarkdown(text: string): string {
  const codeBlocks: string[] = [];

  // Complete fences: ```lang\n...\n```
  let processed = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    codeBlocks.push(buildCodeBlock(lang, code));
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  // Incomplete fence (streaming): opening ``` with no closing one
  processed = processed.replace(/```(\w*)\n([\s\S]*)$/, (_match, lang, code) => {
    codeBlocks.push(buildCodeBlock(lang, code));
    return `\x00CB${codeBlocks.length - 1}\x00`;
  });

  const lines = processed.split("\n");
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    if (isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines: string[] = [lines[i]];
      i++; // separator
      i++; // move past separator
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      output.push(renderTable(tableLines));
      continue;
    }
    output.push(lines[i]);
    i++;
  }

  let result = output.join("\n");

  result = result
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^### (.*$)/gm, "<h4>$1</h4>")
    .replace(/^## (.*$)/gm, "<h3>$1</h3>")
    .replace(/^# (.*$)/gm, "<h2>$1</h2>")
    .replace(
      /^[-*] (.*$)/gm,
      '<div style="display:flex;gap:8px;padding:2px 0"><span style="opacity:0.5">•</span><span>$1</span></div>',
    )
    .replace(
      /^(\d+)\. (.*$)/gm,
      '<div style="display:flex;gap:8px;padding:2px 0"><span style="opacity:0.5">$1.</span><span>$2</span></div>',
    )
    .replace(/\n\n/g, '<div style="height:8px"></div>')
    .replace(/\n/g, "<br>");

  result = result.replace(/\x00CB(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)]);

  return result;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
}

function isTableSeparator(line: string): boolean {
  return /^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/.test(line.trim());
}

function renderTable(rows: string[]): string {
  const parseRow = (row: string) =>
    row
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const headerCells = parseRow(rows[0]);
  const thead = `<thead><tr>${headerCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;

  const bodyRows = rows
    .slice(1)
    .map((row) => {
      const cells = parseRow(row);
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    })
    .join("");

  return `<table>${thead}<tbody>${bodyRows}</tbody></table>`;
}

// ─── Icons ──────────────────────────────────────────────────────────

function SearchIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SparklesIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

type LoaderVariant =
  | "shimmer-dots"
  | "circular"
  | "dots"
  | "typing"
  | "wave"
  | "bars"
  | "pulse"
  | "pulse-dot"
  | "terminal"
  | "text-blink"
  | "text-shimmer"
  | "loading-dots";

function LoaderIndicator({
  variant = "shimmer-dots",
}: {
  variant?: LoaderVariant;
  label?: string;
}) {
  const text = "Thinking";

  switch (variant) {
    case "circular":
      return (
        <div className="fd-ai-loader">
          <div className="fd-ai-loader-circular" />
          <span className="sr-only">Loading</span>
        </div>
      );
    case "dots":
      return (
        <div className="fd-ai-loader">
          <span className="fd-ai-loader-dots">
            <span className="fd-ai-loader-bounce-dot" />
            <span className="fd-ai-loader-bounce-dot" />
            <span className="fd-ai-loader-bounce-dot" />
          </span>
        </div>
      );
    case "typing":
      return (
        <div className="fd-ai-loader">
          <span className="fd-ai-loader-typing-dots">
            <span className="fd-ai-loader-typing-dot" />
            <span className="fd-ai-loader-typing-dot" />
            <span className="fd-ai-loader-typing-dot" />
          </span>
        </div>
      );
    case "wave":
      return (
        <div className="fd-ai-loader">
          <span className="fd-ai-loader-wave">
            <span className="fd-ai-loader-wave-bar" />
            <span className="fd-ai-loader-wave-bar" />
            <span className="fd-ai-loader-wave-bar" />
            <span className="fd-ai-loader-wave-bar" />
            <span className="fd-ai-loader-wave-bar" />
          </span>
        </div>
      );
    case "bars":
      return (
        <div className="fd-ai-loader">
          <span className="fd-ai-loader-bars">
            <span className="fd-ai-loader-bar" />
            <span className="fd-ai-loader-bar" />
            <span className="fd-ai-loader-bar" />
          </span>
        </div>
      );
    case "pulse":
      return (
        <div className="fd-ai-loader">
          <div className="fd-ai-loader-pulse" />
        </div>
      );
    case "pulse-dot":
      return (
        <div className="fd-ai-loader">
          <div className="fd-ai-loader-pulse-dot" />
        </div>
      );
    case "terminal":
      return (
        <div className="fd-ai-loader">
          <span className="fd-ai-loader-terminal">
            <span className="fd-ai-loader-terminal-prompt">{">"}</span>
            <span className="fd-ai-loader-terminal-cursor" />
          </span>
        </div>
      );
    case "text-blink":
      return (
        <div className="fd-ai-loader">
          <span className="fd-ai-loader-text-blink">{text}</span>
        </div>
      );
    case "text-shimmer":
      return (
        <div className="fd-ai-loader">
          <span className="fd-ai-loader-shimmer-text">{text}</span>
        </div>
      );
    case "loading-dots":
      return (
        <div className="fd-ai-loader">
          <span className="fd-ai-loader-text">{text}</span>
          <span className="fd-ai-loader-text-dots">
            <span className="fd-ai-loader-text-dot">.</span>
            <span className="fd-ai-loader-text-dot">.</span>
            <span className="fd-ai-loader-text-dot">.</span>
          </span>
        </div>
      );
    case "shimmer-dots":
    default:
      return (
        <div className="fd-ai-loader">
          <span className="fd-ai-loader-shimmer-text">{text}</span>
          <span className="fd-ai-loader-typing-dots">
            <span className="fd-ai-loader-typing-dot" />
            <span className="fd-ai-loader-typing-dot" />
            <span className="fd-ai-loader-typing-dot" />
          </span>
        </div>
      );
  }
}

function InlineLoaderDots() {
  return (
    <span className="fd-ai-loader-typing-dots" style={{ marginLeft: 0 }}>
      <span className="fd-ai-loader-typing-dot" />
      <span className="fd-ai-loader-typing-dot" />
      <span className="fd-ai-loader-typing-dot" />
    </span>
  );
}

// ─── Model Selector Dropdown (matches "Open in" page-action style) ──

function ModelSelector({
  models,
  selectedId,
  onChange,
  disabled,
}: {
  models: AIModelOption[];
  selectedId: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const current = models.find((m) => m.id === selectedId) ?? models[0];

  return (
    <div ref={ref} className="fd-ai-model-dropdown">
      <button
        type="button"
        className="fd-ai-model-dropdown-btn"
        onClick={() => !disabled && setOpen(!open)}
        aria-expanded={open}
        disabled={disabled}
      >
        <span>{current?.label ?? "Select model"}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="fd-ai-model-dropdown-menu" role="menu">
          {models.map((m) => (
            <button
              key={m.id}
              type="button"
              role="menuitem"
              className="fd-ai-model-dropdown-item"
              data-active={m.id === selectedId}
              onClick={() => {
                onChange(m.id);
                setOpen(false);
              }}
            >
              <span className="fd-ai-model-dropdown-label">{m.label}</span>
              {m.id === selectedId && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared AI Chat Component ───────────────────────────────────────

function AIChat({
  api,
  messages,
  setMessages,
  aiInput,
  setAiInput,
  isStreaming,
  setIsStreaming,
  suggestedQuestions,
  aiLabel,
  loaderVariant,
  loadingComponentHtml,
  models,
  defaultModelId,
}: {
  api: string;
  messages: ChatMessage[];
  setMessages: (m: ChatMessage[]) => void;
  aiInput: string;
  setAiInput: (v: string) => void;
  isStreaming: boolean;
  setIsStreaming: (v: boolean) => void;
  suggestedQuestions?: string[];
  aiLabel?: string;
  loaderVariant?: LoaderVariant;
  loadingComponentHtml?: string;
  models?: AIModelOption[];
  defaultModelId?: string;
}) {
  const label = aiLabel || "AI";
  const aiInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [selectedModel, setSelectedModel] = useState<string | undefined>(() => {
    const trimmed = (defaultModelId ?? "").trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

  const effectiveModelId =
    selectedModel || (Array.isArray(models) && models.length > 0 ? models[0]!.id : undefined);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  useEffect(() => {
    aiInputRef.current?.focus();
  }, []);

  const submitQuestion = useCallback(
    async (question: string) => {
      if (!question.trim() || isStreaming) return;
      const userMessage: ChatMessage = { role: "user", content: question };
      const newMessages = [...messages, userMessage];
      setAiInput("");
      setIsStreaming(true);
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      try {
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
            model: effectiveModelId,
          }),
        });

        if (!res.ok) {
          let errMsg = "Something went wrong.";
          try {
            const err = await res.json();
            errMsg = err.error || errMsg;
          } catch {}
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
        if (assistantContent)
          setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
      } catch {
        setMessages([
          ...newMessages,
          { role: "assistant", content: "Failed to connect. Please try again." },
        ]);
      }
      setIsStreaming(false);
    },
    [messages, api, isStreaming, setMessages, setAiInput, setIsStreaming, effectiveModelId],
  );

  const handleAskAI = useCallback(async () => {
    await submitQuestion(aiInput);
  }, [aiInput, submitQuestion]);

  const handleAIKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAskAI();
    }
  };

  const canSend = !!(aiInput.trim() && !isStreaming);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      <div className="fd-ai-messages">
        {messages.length === 0 ? (
          <div className="fd-ai-empty">
            <SparklesIcon size={20} />
            <div className="fd-ai-empty-title">Ask anything about the docs</div>
            <div className="fd-ai-empty-desc">
              {label} will search through the documentation and answer your question with relevant
              context.
            </div>
            {suggestedQuestions && suggestedQuestions.length > 0 && (
              <div className="fd-ai-suggestions">
                {suggestedQuestions.map((q, i) => (
                  <button key={i} onClick={() => submitQuestion(q)} className="fd-ai-suggestion">
                    <ArrowUpIcon />
                    <span style={{ flex: 1 }}>{q}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="fd-ai-msg" data-role={msg.role}>
              <div className="fd-ai-msg-label">{msg.role === "user" ? "You" : label}</div>
              {msg.role === "user" ? (
                <div className="fd-ai-bubble-user">{msg.content}</div>
              ) : (
                <div className="fd-ai-bubble-ai">
                  {msg.content ? (
                    <div
                      className={
                        isStreaming && i === messages.length - 1 ? "fd-ai-streaming" : undefined
                      }
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  ) : loadingComponentHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: loadingComponentHtml }} />
                  ) : (
                    <LoaderIndicator variant={loaderVariant} label={label} />
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="fd-ai-chat-footer">
        {Array.isArray(models) && models.length > 0 && (
          <div className="fd-ai-model-select-row">
            <ModelSelector
              models={models}
              selectedId={effectiveModelId ?? models[0]!.id}
              onChange={setSelectedModel}
              disabled={isStreaming}
            />
          </div>
        )}
        {messages.length > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", paddingBottom: 8 }}>
            <button
              onClick={() => {
                setMessages([]);
                setAiInput("");
              }}
              className="fd-ai-clear-btn"
            >
              Clear chat
            </button>
          </div>
        )}
        <div className="fd-ai-input-wrap">
          <input
            ref={aiInputRef}
            type="text"
            placeholder="Ask a question..."
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={handleAIKeyDown}
            disabled={isStreaming}
            className="fd-ai-input"
            style={{ opacity: isStreaming ? 0.5 : 1 }}
          />
          <button
            onClick={handleAskAI}
            disabled={!canSend}
            className="fd-ai-send-btn"
            data-active={canSend}
          >
            <ArrowUpIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Search Dialog (Cmd+K) mode ─────────────────────────────────────

export function DocsSearchDialog({
  open,
  onOpenChange,
  api = "/api/docs",
  suggestedQuestions,
  aiLabel,
  loaderVariant,
  loadingComponentHtml,
  models,
  defaultModelId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api?: string;
  suggestedQuestions?: string[];
  aiLabel?: string;
  loaderVariant?: LoaderVariant;
  loadingComponentHtml?: string;
  models?: AIModelOption[];
  defaultModelId?: string;
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
  const [selectedModel, setSelectedModel] = useState<string | undefined>(() => {
    const trimmed = (defaultModelId ?? "").trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

  const effectiveModelId =
    selectedModel || (Array.isArray(models) && models.length > 0 ? models[0]!.id : undefined);

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setSearchResults([]);
      setActiveIndex(0);
      setTimeout(() => {
        if (tab === "search") searchInputRef.current?.focus();
      }, 50);
    }
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!searchQuery.trim() || tab !== "search") {
      setSearchResults([]);
      setActiveIndex(0);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${api}?query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setActiveIndex(0);
        }
      } catch {}
      setIsSearching(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, api, tab]);

  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && searchResults[activeIndex]) {
      e.preventDefault();
      onOpenChange(false);
      window.location.href = searchResults[activeIndex].url;
    }
  };

  if (!open) return null;

  const aiName = aiLabel || "AI";

  return createPortal(
    <>
      <div onClick={() => onOpenChange(false)} className="fd-ai-overlay" />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="fd-ai-dialog"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(680px, calc(100vw - 32px))",
          maxHeight: "min(560px, calc(100vh - 64px))",
          animation: "fd-ai-slide-up 200ms ease-out",
        }}
      >
        <div className="fd-ai-tab-bar">
          <button
            onClick={() => setTab("search")}
            className="fd-ai-tab"
            data-active={tab === "search"}
          >
            <SearchIcon /> Search
          </button>
          <button onClick={() => setTab("ai")} className="fd-ai-tab" data-active={tab === "ai"}>
            <SparklesIcon /> Ask {aiName}
          </button>
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
            <kbd className="fd-ai-esc">ESC</kbd>
          </div>
        </div>

        {tab === "search" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div className="fd-ai-search-wrap">
              <SearchIcon />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="fd-ai-input"
              />
              {isSearching && <InlineLoaderDots />}
            </div>
            <div className="fd-ai-results">
              {searchResults.length > 0 ? (
                searchResults.map((result, i) => (
                  <button
                    key={result.id}
                    onClick={() => {
                      onOpenChange(false);
                      window.location.href = result.url;
                    }}
                    onMouseEnter={() => setActiveIndex(i)}
                    className="fd-ai-result"
                    data-active={i === activeIndex}
                  >
                    <FileIcon />
                    <span
                      dangerouslySetInnerHTML={{ __html: result.content }}
                      style={{ flex: 1 }}
                    />
                  </button>
                ))
              ) : (
                <div className="fd-ai-result-empty">
                  {searchQuery.trim()
                    ? isSearching
                      ? "Searching..."
                      : `No results found. Try the Ask ${aiName} tab.`
                    : "Type to search the docs"}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "ai" && (
          <AIChat
            api={api}
            messages={messages}
            setMessages={setMessages}
            aiInput={aiInput}
            setAiInput={setAiInput}
            isStreaming={isStreaming}
            setIsStreaming={setIsStreaming}
            suggestedQuestions={suggestedQuestions}
            aiLabel={aiLabel}
            loaderVariant={loaderVariant}
            loadingComponentHtml={loadingComponentHtml}
            models={models}
            defaultModelId={effectiveModelId}
          />
        )}
      </div>
    </>,
    document.body,
  );
}

// ─── Floating Chat Widget ───────────────────────────────────────────

type FloatingPosition = "bottom-right" | "bottom-left" | "bottom-center";
type FloatingStyle = "panel" | "modal" | "popover" | "full-modal";

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
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(680px, calc(100vw - 32px))",
        height: "min(560px, calc(100vh - 64px))",
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
    ? "fd-ai-float-center-in 200ms ease-out"
    : "fd-ai-float-in 200ms ease-out";
}

export function FloatingAIChat({
  api = "/api/docs",
  position = "bottom-right",
  floatingStyle = "panel",
  triggerComponentHtml,
  suggestedQuestions,
  aiLabel,
  loaderVariant,
  loadingComponentHtml,
  models,
  defaultModelId,
}: {
  api?: string;
  position?: FloatingPosition;
  floatingStyle?: FloatingStyle;
  triggerComponentHtml?: string;
  suggestedQuestions?: string[];
  aiLabel?: string;
  loaderVariant?: LoaderVariant;
  loadingComponentHtml?: string;
  models?: AIModelOption[];
  defaultModelId?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const handler = (e: globalThis.KeyboardEvent) => {
        if (e.key === "Escape") setIsOpen(false);
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && (floatingStyle === "modal" || floatingStyle === "full-modal"))
      document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, floatingStyle]);

  if (!mounted) return null;

  if (floatingStyle === "full-modal") {
    return (
      <FullModalAIChat
        api={api}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        messages={messages}
        setMessages={setMessages}
        aiInput={aiInput}
        setAiInput={setAiInput}
        isStreaming={isStreaming}
        setIsStreaming={setIsStreaming}
        suggestedQuestions={suggestedQuestions}
        aiLabel={aiLabel}
        loaderVariant={loaderVariant}
        loadingComponentHtml={loadingComponentHtml}
        triggerComponentHtml={triggerComponentHtml}
        position={position}
        models={models}
        defaultModelId={defaultModelId}
      />
    );
  }

  const btnPosition = BTN_POSITIONS[position] || BTN_POSITIONS["bottom-right"];
  const isModal = floatingStyle === "modal";
  const containerStyles = getContainerStyles(floatingStyle, position);
  const aiName = aiLabel || "AI";

  return createPortal(
    <>
      {isOpen && isModal && <div onClick={() => setIsOpen(false)} className="fd-ai-overlay" />}

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fd-ai-dialog"
          style={{ ...containerStyles, animation: getAnimation(floatingStyle) }}
        >
          <div className="fd-ai-header">
            <SparklesIcon size={16} />
            <span className="fd-ai-header-title">Ask {aiName}</span>
            {isModal && <kbd className="fd-ai-esc">ESC</kbd>}
            <button onClick={() => setIsOpen(false)} className="fd-ai-close-btn">
              <XIcon />
            </button>
          </div>

          <AIChat
            api={api}
            messages={messages}
            setMessages={setMessages}
            aiInput={aiInput}
            setAiInput={setAiInput}
            isStreaming={isStreaming}
            setIsStreaming={setIsStreaming}
            suggestedQuestions={suggestedQuestions}
            aiLabel={aiLabel}
            loaderVariant={loaderVariant}
            loadingComponentHtml={loadingComponentHtml}
          />
        </div>
      )}

      {!isOpen &&
        (triggerComponentHtml ? (
          <div
            onClick={() => setIsOpen(true)}
            className="fd-ai-floating-trigger"
            style={btnPosition}
            dangerouslySetInnerHTML={{ __html: triggerComponentHtml }}
          />
        ) : (
          <button
            onClick={() => setIsOpen(true)}
            aria-label={`Ask ${aiName}`}
            className="fd-ai-floating-btn"
            style={btnPosition}
          >
            <SparklesIcon size={16} />
            <span>Ask {aiName}</span>
          </button>
        ))}
    </>,
    document.body,
  );
}

// ─── Full-Modal (better-auth inspired full-screen AI chat) ──────────

function FullModalAIChat({
  api,
  isOpen,
  setIsOpen,
  messages,
  setMessages,
  aiInput,
  setAiInput,
  isStreaming,
  setIsStreaming,
  suggestedQuestions,
  aiLabel,
  loaderVariant,
  loadingComponentHtml,
  triggerComponentHtml,
  position,
  models,
  defaultModelId,
}: {
  api: string;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  messages: ChatMessage[];
  setMessages: (m: ChatMessage[]) => void;
  aiInput: string;
  setAiInput: (v: string) => void;
  isStreaming: boolean;
  setIsStreaming: (v: boolean) => void;
  suggestedQuestions?: string[];
  aiLabel?: string;
  loaderVariant?: LoaderVariant;
  loadingComponentHtml?: string;
  triggerComponentHtml?: string;
  position: FloatingPosition;
  models?: AIModelOption[];
  defaultModelId?: string;
}) {
  const label = aiLabel || "AI";
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const btnPosition = BTN_POSITIONS[position] || BTN_POSITIONS["bottom-right"];

  const [selectedModel, setSelectedModel] = useState<string | undefined>(() => {
    const trimmed = (defaultModelId ?? "").trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

  const effectiveModelId =
    selectedModel || (Array.isArray(models) && models.length > 0 ? models[0]!.id : undefined);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 100);
  }, [isOpen]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const submitQuestion = useCallback(
    async (question: string) => {
      if (!question.trim() || isStreaming) return;
      const userMessage: ChatMessage = { role: "user", content: question };
      const newMessages = [...messages, userMessage];
      setAiInput("");
      setIsStreaming(true);
      setMessages([...newMessages, { role: "assistant", content: "" }]);

      try {
        const res = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
            model: effectiveModelId,
          }),
        });

        if (!res.ok) {
          let errMsg = "Something went wrong.";
          try {
            const err = await res.json();
            errMsg = err.error || errMsg;
          } catch {}
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
        if (assistantContent)
          setMessages([...newMessages, { role: "assistant", content: assistantContent }]);
      } catch {
        setMessages([
          ...newMessages,
          { role: "assistant", content: "Failed to connect. Please try again." },
        ]);
      }
      setIsStreaming(false);
    },
    [messages, api, isStreaming, setMessages, setAiInput, setIsStreaming, effectiveModelId],
  );

  const canSend = !!(aiInput.trim() && !isStreaming);
  const showSuggestions = messages.length === 0 && !isStreaming;

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) submitQuestion(aiInput);
    }
  };

  return createPortal(
    <>
      {/* Full-screen overlay */}
      {isOpen && (
        <div
          className="fd-ai-fm-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          {/* Close button */}
          <div className="fd-ai-fm-topbar">
            <button onClick={() => setIsOpen(false)} className="fd-ai-fm-close-btn">
              <XIcon />
            </button>
          </div>

          {/* Scrollable message list */}
          <div ref={listRef} className="fd-ai-fm-messages">
            <div className="fd-ai-fm-messages-inner">
              {messages.map((msg, i) => (
                <div key={i} className="fd-ai-fm-msg" data-role={msg.role}>
                  <div className="fd-ai-fm-msg-label" data-role={msg.role}>
                    {msg.role === "user" ? "you" : label}
                  </div>
                  <div className="fd-ai-fm-msg-content">
                    {msg.content ? (
                      <div
                        className={
                          isStreaming && i === messages.length - 1 ? "fd-ai-streaming" : undefined
                        }
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                      />
                    ) : loadingComponentHtml ? (
                      <div dangerouslySetInnerHTML={{ __html: loadingComponentHtml }} />
                    ) : (
                      <LoaderIndicator variant={loaderVariant} label={label} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom input bar — always visible when open, pinned to bottom */}
      <div
        className={`fd-ai-fm-input-bar ${isOpen ? "fd-ai-fm-input-bar--open" : "fd-ai-fm-input-bar--closed"}`}
        style={isOpen ? undefined : btnPosition}
      >
        {!isOpen ? (
          triggerComponentHtml ? (
            <div
              onClick={() => setIsOpen(true)}
              dangerouslySetInnerHTML={{ __html: triggerComponentHtml }}
            />
          ) : (
            <button
              onClick={() => setIsOpen(true)}
              className="fd-ai-fm-trigger-btn"
              aria-label={`Ask ${label}`}
            >
              <SparklesIcon size={16} />
              <span>Ask {label}</span>
            </button>
          )
        ) : (
          <div className="fd-ai-fm-input-container">
            {Array.isArray(models) && models.length > 0 && (
              <div className="fd-ai-model-select-row fd-ai-model-select-row--fm">
                <ModelSelector
                  models={models}
                  selectedId={effectiveModelId ?? models[0]!.id}
                  onChange={setSelectedModel}
                  disabled={isStreaming}
                />
              </div>
            )}
            <div className="fd-ai-fm-input-wrap">
              <textarea
                ref={inputRef}
                className="fd-ai-fm-input"
                placeholder={isStreaming ? "answering..." : `Ask ${label}`}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming}
                rows={1}
              />
              {isStreaming ? (
                <button className="fd-ai-fm-send-btn" onClick={() => setIsStreaming(false)}>
                  <InlineLoaderDots />
                </button>
              ) : (
                <button
                  className="fd-ai-fm-send-btn"
                  data-active={canSend}
                  disabled={!canSend}
                  onClick={() => submitQuestion(aiInput)}
                >
                  <ArrowUpIcon />
                </button>
              )}
            </div>

            {showSuggestions && suggestedQuestions && suggestedQuestions.length > 0 && (
              <div className="fd-ai-fm-suggestions-area">
                <div className="fd-ai-fm-suggestions-label">Try asking:</div>
                <div className="fd-ai-fm-suggestions">
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => submitQuestion(q)}
                      className="fd-ai-fm-suggestion"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="fd-ai-fm-footer-bar">
              {messages.length > 0 ? (
                <button
                  className="fd-ai-fm-clear-btn"
                  onClick={() => {
                    if (!isStreaming) {
                      setMessages([]);
                      setAiInput("");
                    }
                  }}
                  aria-disabled={isStreaming}
                >
                  <TrashIcon />
                  <span>Clear</span>
                </button>
              ) : (
                <div className="fd-ai-fm-footer-hint">
                  AI can be inaccurate, please verify the information.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

// ─── Pure AI Modal (no search tabs, centered modal with footer) ─────

export function AIModalDialog({
  open,
  onOpenChange,
  api = "/api/docs",
  suggestedQuestions,
  aiLabel,
  loaderVariant,
  loadingComponentHtml,
  models,
  defaultModelId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  api?: string;
  suggestedQuestions?: string[];
  aiLabel?: string;
  loaderVariant?: LoaderVariant;
  loadingComponentHtml?: string;
  models?: AIModelOption[];
  defaultModelId?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [aiInput, setAiInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const aiName = aiLabel || "AI";

  return createPortal(
    <>
      <div onClick={() => onOpenChange(false)} className="fd-ai-overlay" />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="fd-ai-dialog fd-ai-modal-pure"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(680px, calc(100vw - 32px))",
          height: "min(560px, calc(100vh - 64px))",
          animation: "fd-ai-float-center-in 200ms ease-out",
        }}
      >
        <div className="fd-ai-header">
          <SparklesIcon size={16} />
          <span className="fd-ai-header-title">Ask {aiName}</span>
          <kbd className="fd-ai-esc">ESC</kbd>
          <button onClick={() => onOpenChange(false)} className="fd-ai-close-btn">
            <XIcon />
          </button>
        </div>

        <AIChat
          api={api}
          messages={messages}
          setMessages={setMessages}
          aiInput={aiInput}
          setAiInput={setAiInput}
          isStreaming={isStreaming}
          setIsStreaming={setIsStreaming}
          suggestedQuestions={suggestedQuestions}
          aiLabel={aiLabel}
          loaderVariant={loaderVariant}
          loadingComponentHtml={loadingComponentHtml}
          models={models}
          defaultModelId={defaultModelId}
        />

        <div className="fd-ai-modal-footer">
          {messages.length > 0 ? (
            <button
              className="fd-ai-fm-clear-btn"
              onClick={() => {
                if (!isStreaming) {
                  setMessages([]);
                  setAiInput("");
                }
              }}
              aria-disabled={isStreaming}
            >
              <TrashIcon />
              <span>Clear chat</span>
            </button>
          ) : (
            <div className="fd-ai-modal-footer-hint">
              AI can be inaccurate, please verify the information.
            </div>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
