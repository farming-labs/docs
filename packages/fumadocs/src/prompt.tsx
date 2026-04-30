"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { extractPromptText } from "./prompt-text.js";
type PromptAction = "copy" | "open";

type PromptIconValue = React.ReactNode | string;

interface PromptOpenDocsProvider {
  name: string;
  icon?: PromptIconValue;
  urlTemplate: string;
  promptUrlTemplate?: string;
}

interface PromptProviderChoice {
  name: string;
  icon?: PromptIconValue;
  urlTemplate: string;
}

interface PromptProps {
  title?: string;
  description?: string;
  prompt?: string;
  icon?: string;
  showTitle?: boolean;
  showDescription?: boolean;
  showPrompt?: boolean;
  actions?: PromptAction[] | string[];
  providers?: string[] | string;
  copyLabel?: string;
  copiedLabel?: string;
  openLabel?: string;
  copyIcon?: string | false;
  copiedIcon?: string | false;
  openIcon?: string | false;
  iconRegistry?: Record<string, PromptIconValue>;
  openDocsProviders?: PromptOpenDocsProvider[];
}

type BuiltInIconName = "copy" | "check" | "arrowUpRight" | "chevronDown";

const builtInIcons: Record<BuiltInIconName, React.ReactNode> = {
  copy: (
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  check: (
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  arrowUpRight: (
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
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
  chevronDown: (
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
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
};

const defaultPromptProviderTemplates: Record<string, string> = {
  chatgpt: "https://chatgpt.com/?q={prompt}",
  claude: "https://claude.ai/new?q={prompt}",
  cursor: "https://cursor.com/link/prompt?text={prompt}",
  gemini: "https://gemini.google.com/app?q={prompt}",
  copilot: "https://github.com/copilot?prompt={prompt}",
};

function normalizeProviderName(name: string): string {
  return name.trim().toLowerCase();
}

function parseStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const normalized = value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const normalized = trimmed
      .slice(1, -1)
      .split(",")
      .map((entry) => entry.trim().replace(/^['"]|['"]$/g, ""))
      .filter(Boolean);
    return normalized.length > 0 ? normalized : undefined;
  }

  const normalized = trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function resolveProviderChoices(
  availableProviders?: PromptOpenDocsProvider[],
  preferredNames?: string[],
): PromptProviderChoice[] {
  const configuredByName = new Map(
    (availableProviders ?? []).map((provider) => [normalizeProviderName(provider.name), provider]),
  );

  const names =
    preferredNames && preferredNames.length > 0
      ? preferredNames
      : (availableProviders ?? []).map((provider) => provider.name);

  const seen = new Set<string>();
  const resolved: PromptProviderChoice[] = [];

  for (const rawName of names) {
    const name = rawName.trim();
    if (!name) continue;

    const normalized = normalizeProviderName(name);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const configured = configuredByName.get(normalized);
    const template =
      configured?.promptUrlTemplate ??
      configured?.urlTemplate ??
      defaultPromptProviderTemplates[normalized];
    if (!template) continue;

    resolved.push({
      name: configured?.name ?? name,
      icon: configured?.icon,
      urlTemplate: template,
    });
  }

  return resolved;
}

function resolveActionIcon(
  name: string | false | undefined,
  iconRegistry?: Record<string, PromptIconValue>,
): React.ReactNode | null {
  if (name === false) return null;
  if (!name) return null;

  const registryMatch = iconRegistry?.[name];
  if (registryMatch) {
    if (typeof registryMatch !== "string") {
      return registryMatch;
    }
  }

  if (name in builtInIcons) {
    return builtInIcons[name as BuiltInIconName];
  }

  return null;
}

async function fallbackCopyText(text: string): Promise<boolean> {
  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }

  return copied;
}

export function Prompt({
  title,
  description,
  prompt,
  icon,
  showTitle = true,
  showDescription = true,
  showPrompt = false,
  actions,
  providers,
  copyLabel = "Copy prompt",
  copiedLabel = "Copied",
  openLabel = "Open in",
  copyIcon = "copy",
  copiedIcon = "check",
  openIcon = "arrowUpRight",
  iconRegistry,
  openDocsProviders,
  children,
}: React.PropsWithChildren<PromptProps>) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const promptText = useMemo(
    () =>
      typeof prompt === "string" && prompt.trim() ? prompt.trim() : extractPromptText(children),
    [prompt, children],
  );
  const promptIconValue = icon && iconRegistry?.[icon] ? iconRegistry[icon] : undefined;
  const promptIcon =
    promptIconValue && typeof promptIconValue !== "string" ? promptIconValue : null;
  const resolvedActions = useMemo(
    () => (parseStringArray(actions) as PromptAction[] | undefined) ?? ["copy"],
    [actions],
  );
  const resolvedProviders = useMemo<PromptProviderChoice[]>(
    () => resolveProviderChoices(openDocsProviders, parseStringArray(providers)),
    [openDocsProviders, providers],
  );

  const handleCopy = useCallback(async () => {
    if (!promptText) return;

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptText);
      } else {
        const copiedWithFallback = await fallbackCopyText(promptText);
        if (!copiedWithFallback) return;
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const copiedWithFallback = await fallbackCopyText(promptText);
      if (!copiedWithFallback) return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }, [promptText]);

  const handleOpen = useCallback(
    (provider: PromptProviderChoice) => {
      if (!promptText) return;
      const targetUrl = provider.urlTemplate.replace(/\{prompt\}/g, encodeURIComponent(promptText));
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      setMenuOpen(false);
    },
    [promptText],
  );

  useEffect(() => {
    if (!menuOpen) return;

    function handleOutsideClick(event: MouseEvent) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  const showCopy = resolvedActions.includes("copy");
  const showOpen = resolvedActions.includes("open") && resolvedProviders.length > 0;
  const singleProvider = showOpen && resolvedProviders.length === 1 ? resolvedProviders[0] : null;
  const visibleTitle = showTitle ? title : undefined;
  const visibleDescription = showDescription ? description : undefined;

  return (
    <div className="fd-prompt" data-prompt-card>
      {(promptIcon || visibleTitle || visibleDescription) && (
        <div className="fd-prompt-header">
          {promptIcon ? <span className="fd-prompt-icon">{promptIcon}</span> : null}
          <div className="fd-prompt-copy">
            {visibleTitle && <p className="fd-prompt-title">{visibleTitle}</p>}
            {visibleDescription && <p className="fd-prompt-description">{visibleDescription}</p>}
          </div>
        </div>
      )}

      {showPrompt && promptText && (
        <div className="fd-prompt-body">
          <pre className="fd-prompt-code">{promptText}</pre>
        </div>
      )}

      {(showCopy || showOpen) && (
        <div className="fd-prompt-actions">
          {showCopy && (
            <button
              type="button"
              className="fd-prompt-action-btn"
              data-copied={copied}
              onClick={handleCopy}
            >
              {copied
                ? resolveActionIcon(copiedIcon, iconRegistry)
                : resolveActionIcon(copyIcon, iconRegistry)}
              <span>{copied ? copiedLabel : copyLabel}</span>
            </button>
          )}

          {singleProvider ? (
            <button
              type="button"
              className="fd-prompt-action-btn"
              onClick={() => handleOpen(singleProvider)}
            >
              {resolveActionIcon(openIcon, iconRegistry)}
              <span>
                {openLabel} {singleProvider.name}
              </span>
            </button>
          ) : null}

          {!singleProvider && showOpen ? (
            <div ref={dropdownRef} className="fd-prompt-dropdown">
              <button
                type="button"
                className="fd-prompt-action-btn"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((current) => !current)}
              >
                {resolveActionIcon(openIcon, iconRegistry)}
                <span>{openLabel}</span>
                {builtInIcons.chevronDown}
              </button>

              {menuOpen && (
                <div className="fd-prompt-menu" role="menu">
                  {resolvedProviders.map((provider) => (
                    <button
                      key={provider.name}
                      type="button"
                      role="menuitem"
                      className="fd-prompt-menu-item"
                      onClick={() => handleOpen(provider)}
                    >
                      {provider.icon && typeof provider.icon !== "string" ? (
                        <span className="fd-prompt-menu-icon">{provider.icon}</span>
                      ) : null}
                      <span className="fd-prompt-menu-label">
                        {openLabel} {provider.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export type { PromptProps };
