"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { highlight as sugarHighlight } from "sugar-high";
import {
  TWEAKS_ACCENT_SWATCHES,
  TWEAKS_COLOR_KEYS,
  TWEAKS_DEFAULT_FONT_OPTIONS,
  TWEAKS_DEFAULT_STORAGE_KEY,
  TWEAKS_PRESET_BUNDLE,
  applyTweaks,
  buildFoucScript,
  clearSavedTweaks,
  readSavedTweaks,
  resetTweaks,
  writeSavedTweaks,
  type TweaksColorKey,
  type TweaksDensity,
  type TweaksPresetKey,
  type TweaksState,
} from "./tweaks-runtime.js";
import { SidebarCollapseTrigger } from "fumadocs-ui/components/sidebar/base";


export type TweaksKnob = "color" | "density" | "radius" | "preset" | "font-family";

const DEFAULT_KNOBS: ReadonlyArray<TweaksKnob> = [
  "color",
  "density",
  "radius",
  "preset",
  "font-family",
];

const DENSITY_OPTIONS: ReadonlyArray<{ label: string; value: TweaksDensity }> = [
  { label: "Compact", value: "compact" },
  { label: "Cozy", value: "comfortable" },
  { label: "Roomy", value: "roomy" },
];

const PRESET_OPTIONS: ReadonlyArray<{ label: string; value: TweaksPresetKey }> = (
  Object.entries(TWEAKS_PRESET_BUNDLE) as Array<[TweaksPresetKey, { label: string }]>
).map(([value, tokens]) => ({ value, label: tokens.label }));

const COLOR_KEY_LABELS: Record<TweaksColorKey, string> = {
  primary: "Primary",
  primaryForeground: "Primary fg",
  background: "Background",
  foreground: "Foreground",
  muted: "Muted",
  mutedForeground: "Muted fg",
  border: "Border",
  card: "Card",
  cardForeground: "Card fg",
  accent: "Accent",
  accentForeground: "Accent fg",
  secondary: "Secondary",
  secondaryForeground: "Secondary fg",
  popover: "Popover",
  popoverForeground: "Popover fg",
  ring: "Ring",
};

const DEFAULT_FALLBACKS: Record<TweaksColorKey, string> = {
  primary: "#6366f1",
  primaryForeground: "#ffffff",
  background: "#0c0c0c",
  foreground: "#fafafa",
  muted: "#262626",
  mutedForeground: "#a3a3a3",
  border: "#262626",
  card: "#141414",
  cardForeground: "#fafafa",
  accent: "#1f1f1f",
  accentForeground: "#fafafa",
  secondary: "#141414",
  secondaryForeground: "#fafafa",
  popover: "#141414",
  popoverForeground: "#fafafa",
  ring: "#6366f1",
};

function parsePxWidth(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const m = raw.match(/^([\d.]+)(px|rem)?$/);
  if (!m) return fallback;
  const n = Number(m[1]);
  if (Number.isNaN(n)) return fallback;
  return m[2] === "rem" ? Math.round(n * 16) : Math.round(n);
}

// ─── Icons (inline SVG, stroke="currentColor", matches repo convention) ─

function SettingsIcon() {
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
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function CloseIcon() {
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
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TweaksColorRow({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (color: string) => void;
}) {
  return (
    <div className="fd-tweaks-row">
      <span className="fd-tweaks-row-label">Accent color</span>
      <div className="fd-tweaks-swatches" role="radiogroup" aria-label="Accent color">
        {TWEAKS_ACCENT_SWATCHES.map((s) => {
          const selected = value === s.value;
          return (
            <button
              key={s.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={s.name}
              className="fd-tweaks-swatch"
              data-selected={selected || undefined}
              style={{ background: s.value }}
              onClick={() => onChange(s.value)}
            >
              {selected && (
                <span className="fd-tweaks-swatch-check" aria-hidden="true">
                  <CheckIcon />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TweaksChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: ReadonlyArray<{ label: string; value: T }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="fd-tweaks-row">
      <span className="fd-tweaks-row-label">{label}</span>
      <div className="fd-tweaks-chips" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              className="fd-tweaks-chip"
              data-selected={selected || undefined}
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TweaksSlider({
  label, value, min,
  max, step, format,
  onChange, disabled
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (next: number) => void;
  disabled?: boolean
}) {
  return (
    <div className="fd-tweaks-row">
      <span className="fd-tweaks-row-label">
        <span>{label}</span>
        <span className="fd-tweaks-row-value">{format(value)}</span>
      </span>
      <input
        type="range"
        className="fd-tweaks-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
    </div>
  );
}

function buildCreateThemeSnippet(state: TweaksState): string {
  const lines: string[] = [];
  lines.push(`import { createTheme } from "@farming-labs/docs";`);
  lines.push(``);
  lines.push(`export const theme = createTheme({`);
  lines.push(`  name: "custom",`);
  lines.push(`  ui: {`);

  const colorEntries: Array<[string, string]> = [];
  if (state.primary) colorEntries.push(["primary", state.primary]);
  if (state.colors) {
    for (const key of TWEAKS_COLOR_KEYS) {
      const v = state.colors[key];
      if (v && !(key === "primary" && state.primary)) colorEntries.push([key, v]);
    }
  }
  if (colorEntries.length > 0) {
    lines.push(`    colors: {`);
    for (const [k, v] of colorEntries) lines.push(`      ${k}: ${JSON.stringify(v)},`);
    lines.push(`    },`);
  }

  if (state.radius) lines.push(`    radius: ${JSON.stringify(state.radius)},`);

  if (state.fontFamily) {
    lines.push(`    typography: { font: { style: { sans: ${JSON.stringify(state.fontFamily)} } } },`);
  }

  const layoutBits: string[] = [];
  if (state.contentWidth) layoutBits.push(`contentWidth: ${JSON.stringify(state.contentWidth)}`);
  if (state.sidebarWidth) layoutBits.push(`sidebarWidth: ${JSON.stringify(state.sidebarWidth)}`);
  if (state.tocWidth) layoutBits.push(`tocWidth: ${JSON.stringify(state.tocWidth)}`);
  if (layoutBits.length > 0) {
    lines.push(`    layout: { ${layoutBits.join(", ")} },`);
  }

  lines.push(`  },`);
  lines.push(`});`);
  return lines.join("\n");
}

function buildCssSnippet(state: TweaksState): string {
  const rules: string[] = [":root {"];
  const colorRules = (key: TweaksColorKey, value: string) =>
    rules.push(`  --color-fd-${cssVarSegment(key)}: ${value};`);

  if (state.primary) {
    colorRules("primary", state.primary);
    colorRules("ring", state.primary);
  }
  if (state.colors) {
    for (const key of TWEAKS_COLOR_KEYS) {
      const v = state.colors[key];
      if (v) colorRules(key, v);
    }
  }
  if (state.radius) rules.push(`  --radius: ${state.radius};`);
  if (state.fontFamily) rules.push(`  --fd-font-sans: ${state.fontFamily};`);
  if (state.density) {
    const scale = state.density === "compact" ? "0.9" : state.density === "roomy" ? "1.1" : "1";
    rules.push(`  --fd-font-scale: ${scale};`);
  }
  if (state.sidebarWidth) rules.push(`  --fd-sidebar-width: ${state.sidebarWidth};`);
  if (state.contentWidth) rules.push(`  --fd-content-width: ${state.contentWidth};`);
  if (state.tocWidth) rules.push(`  --fd-toc-width: ${state.tocWidth};`);

  rules.push("}");
  return rules.join("\n");
}

function cssVarSegment(key: TweaksColorKey): string {
  // primaryForeground → primary-foreground
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function isPristineState(state: TweaksState): boolean {
  if (state.primary) return false;
  if (state.density) return false;
  if (state.radius) return false;
  if (state.preset) return false;
  if (state.fontFamily) return false;
  if (state.sidebarWidth || state.contentWidth || state.tocWidth) return false;
  if (state.colors && Object.values(state.colors).some((v) => v)) return false;
  return true;
}

function highlightSnippet(code: string): string {
  try {
    return sugarHighlight(code);
  } catch {
    const div = typeof document !== "undefined" ? document.createElement("div") : null;
    if (div) {
      div.textContent = code;
      return div.innerHTML;
    }
    return code.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
  }
}

function TweaksCodeExport({ state }: { state: TweaksState }) {
  const [tab, setTab] = useState<"ts" | "css">("ts");
  const [copied, setCopied] = useState(false);
  const code = tab === "ts" ? buildCreateThemeSnippet(state) : buildCssSnippet(state);
  const highlighted = highlightSnippet(code);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }, [code]);


  return (
    <div className="fd-tweaks-export">
      <div className="fd-tweaks-export-tabs" role="tablist" aria-label="Export format">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "ts"}
          data-selected={tab === "ts" || undefined}
          className="fd-tweaks-export-tab"
          onClick={() => setTab("ts")}
        >
          createTheme
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "css"}
          data-selected={tab === "css" || undefined}
          className="fd-tweaks-export-tab"
          onClick={() => setTab("css")}
        >
          CSS
        </button>
        <button
          type="button"
          className="fd-tweaks-export-copy"
          aria-label="Copy snippet"
          onClick={handleCopy}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="fd-tweaks-export-code fd-tweaks-export-code-highlighted"
        aria-live="polite"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}

function TweaksHexColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | undefined;
  fallback: string;
  onChange: (next: string) => void;
}) {
  const swatchRef = useRef<HTMLInputElement>(null);
  const display = value ?? "";
  const swatchColor = value || fallback;
  return (
    <div className="fd-tweaks-color-pair">
      <button
        type="button"
        className="fd-tweaks-color-swatch-mini"
        style={{ background: swatchColor }}
        aria-label={`Pick ${label}`}
        onClick={() => swatchRef.current?.click()}
      />
      <input
        ref={swatchRef}
        type="color"
        value={/^#[0-9a-f]{6}$/i.test(swatchColor) ? swatchColor : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" }}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        type="text"
        className="fd-tweaks-color-text"
        value={display}
        placeholder={fallback}
        spellCheck={false}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="fd-tweaks-color-label">{label}</span>
    </div>
  );
}

function TweaksSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | "";
  options: ReadonlyArray<{ label: string; value: T }>;
  onChange: (next: T) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="fd-tweaks-row">
      <span className="fd-tweaks-row-label">{label}</span>
      <div className="fd-tweaks-select-wrap" ref={wrapRef}>
        <button
          type="button"
          className="fd-tweaks-select-trigger"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label}
          data-open={isOpen || undefined}
          onClick={() => setIsOpen((v) => !v)}
        >
          <span className="fd-tweaks-select-trigger-label">
            {selected?.label ?? "Default"}
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="fd-tweaks-select-chevron"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        {isOpen && (
          <div className="fd-tweaks-select-menu" role="listbox" aria-label={label}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <button
                  type="button"
                  key={option.value}
                  role="option"
                  aria-selected={active}
                  data-active={active || undefined}
                  className="fd-tweaks-select-option"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                >
                  <span className="fd-tweaks-select-option-dot" aria-hidden="true" />
                  <span className="fd-tweaks-select-option-label">{option.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


interface TweaksDialogProps {
  open: boolean;
  onClose: () => void;
  mode: TweaksMode;
  knobs: ReadonlyArray<TweaksKnob>;
  fontOptions: ReadonlyArray<{ label: string; value: string }>;
  state: TweaksState;
  onPatch: (patch: Partial<TweaksState>) => void;
  onReset: () => void;
  title: string;
}

function parseRadiusPx(raw: string | undefined): number {
  if (!raw) return 8;
  const matchResult = raw.match(/^([\d.]+)(px|rem)?$/);
  if (!matchResult) return 8;
  const numericValue = Number(matchResult[1]);
  if (Number.isNaN(numericValue)) return 8;
  return matchResult[2] === "rem" ? Math.round(numericValue * 16) : Math.round(numericValue);
}

function TweaksDialog({
  open,
  onClose,
  mode,
  knobs,
  fontOptions,
  state,
  onPatch,
  onReset,
  title,
}: TweaksDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [side, setSide] = useState<"left" | "right">(state.dialogSide ?? "right");
  const [dragX, setDragX] = useState(0);
  const dragRef = useRef({ startX: 0, active: false });
  const [ tocInvisibe, setTocInvisible ] = useState(false);
  const [ sidebarInvisible, setSidebarInvisible ] = useState(false);

  useEffect(() => {
    const windowWidth = window?.matchMedia("(min-width: 1200px)")
    setTocInvisible(!windowWidth.matches)

    const handler = (e: MediaQueryListEvent) => setTocInvisible(!e.matches)
    windowWidth.addEventListener("change", handler)

    return () => {
        windowWidth.removeEventListener("change", handler)
    }
  }, [])

  useEffect(() => {
    const windowWidth = window?.matchMedia("(min-width: 767px)")
    setSidebarInvisible(!windowWidth.matches)

    const handler = (e: MediaQueryListEvent) => setSidebarInvisible(!e.matches)
    windowWidth.addEventListener("change", handler)

    return () => {
        windowWidth.removeEventListener("change", handler)
    }
  }, [])

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setSide(state.dialogSide ?? "right");
  }, [state.dialogSide]);

  const DRAG_SNAP_THRESHOLD = 30;

  function onHeaderPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest(".fd-tweaks-close")) return;
    dragRef.current = { startX: e.clientX, active: true };
    setDragX(0);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onHeaderPointerMove(e: React.PointerEvent) {
    if (!dragRef.current.active) return;
    setDragX(e.clientX - dragRef.current.startX);
  }

  function onHeaderPointerUp(e: React.PointerEvent) {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    const dist = e.clientX - dragRef.current.startX;
    if (Math.abs(dist) > DRAG_SNAP_THRESHOLD) {
      const newSide: "left" | "right" = dist < 0 ? "left" : "right";
      if (newSide !== side) {
        setSide(newSide);
        onPatch({ dialogSide: newSide });
      }
    }
    setDragX(0);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Click outside the dialog closes it. 
  useEffect(() => {
    if (!open) return;

    let attached = false;
    function onPointer(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target || !dialogRef.current) return;
      if (dialogRef.current.contains(target)) return;
      if (target.closest?.(".fd-tweaks-trigger")) return;
      onClose();
    }

    const t = window.setTimeout(() => {
      attached = true;
      document.addEventListener("mousedown", onPointer);
    }, 0);
    return () => {
      window.clearTimeout(t);
      if (attached) document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  const radiusPx = parseRadiusPx(state.radius);

  const node = (
    <div className="fd-tweaks-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="fd-tweaks-dialog"
        role="dialog"  
        aria-modal="true"
        aria-label={title}
        data-side={side}
        style={dragX !== 0 ? { transform: `translateX(${dragX}px)`, transition: "none" } : undefined}
      >
        <div
          className="fd-tweaks-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          <span className="fd-tweaks-title">{title}</span>
          <button
            type="button"
            className="fd-tweaks-reset"
            onClick={onReset}
            onPointerDown={(e) => e.stopPropagation()}
          >
            Reset
          </button>
          <button
            type="button"
            className="fd-tweaks-close"
            aria-label={`Close ${title}`}
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <CloseIcon />
          </button>
        </div>
        <div className="fd-tweaks-body">
          {knobs.includes("color") && (
            <TweaksColorRow value={state.primary} onChange={(primary) => onPatch({ primary })} />
          )}
          {knobs.includes("density") && (
            <TweaksChipGroup<TweaksDensity>
              label="Density"
              value={state.density ?? "comfortable"}
              options={DENSITY_OPTIONS}
              onChange={(density) => onPatch({ density })}
            />
          )}
          {knobs.includes("radius") && (
            <TweaksSlider
              label="Border radius"
              value={radiusPx}
              min={0}
              max={16}
              step={2}
              format={(v) => `${v}px`}
              onChange={(v) => onPatch({ radius: `${v}px` })}
            />
          )}
          {knobs.includes("preset") && (
            <TweaksSelect<TweaksPresetKey>
              label="Theme preset"
              value={state.preset ?? ""}
              options={PRESET_OPTIONS}
              onChange={(preset) => onPatch({ preset })}
            />
          )}
          {knobs.includes("font-family") && (
            <TweaksSelect<string>
              label="Font"
              value={
                fontOptions.find((o) => o.value === state.fontFamily)?.value ?? ""
              }
              options={fontOptions}
              onChange={(fontFamily) => onPatch({ fontFamily })}
            />
          )}
          {mode === "author" && (
            <>
              <div className="fd-tweaks-section-divider" role="separator">
                <span className="fd-tweaks-section-label">Tokens</span>
              </div>
              <div className="fd-tweaks-color-grid">
                {TWEAKS_COLOR_KEYS.map((key) => (
                  <TweaksHexColorRow
                    key={key}
                    label={COLOR_KEY_LABELS[key]}
                    value={state.colors?.[key]}
                    fallback={DEFAULT_FALLBACKS[key]}
                    onChange={(next) =>
                      onPatch({ colors: { ...state.colors, [key]: next } })
                    }
                  />
                ))}
              </div>
              <div className="fd-tweaks-section-divider" role="separator">
                <span className="fd-tweaks-section-label">Layout</span>
              </div>
              <TweaksSlider
                label="Sidebar width"
                value={parsePxWidth(state.sidebarWidth, 280)}
                min={200}
                max={400}
                step={4}
                format={(v) => `${v}px`}
                onChange={(v) => onPatch({ sidebarWidth: `${v}px` })}
                disabled={sidebarInvisible}
              />
              <TweaksSlider
                label="Content width"
                value={parsePxWidth(state.contentWidth, 768)}
                min={560}
                max={1100}
                step={8}
                format={(v) => `${v}px`}
                onChange={(v) => onPatch({ contentWidth: `${v}px` })}
              />
              <TweaksSlider
                label="TOC width"
                value={parsePxWidth(state.tocWidth , 224)}
                min={160}
                max={320}
                step={4}
                format={(v) => `${v}px`}
                onChange={(v) => onPatch({ tocWidth: `${window.innerWidth < 1200 ? 0 : v}px` })}
                disabled={tocInvisibe}
              />
              {!isPristineState(state) && (
                <>
                  <div className="fd-tweaks-section-divider" role="separator">
                    <span className="fd-tweaks-section-label">Export</span>
                  </div>
                  <TweaksCodeExport state={state} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

interface TweaksTriggerProps {
  variant: "sidebar" | "floating";
  label: string;
  open: boolean;
  onClick: () => void;
  fallback?: boolean;
}

function TweaksTrigger({ variant, label, open, onClick, fallback }: TweaksTriggerProps) {
  return (
    <button
      type="button"
      className={`fd-tweaks-trigger fd-tweaks-trigger-${variant}`}
      data-open={open || undefined}
      data-fallback={fallback || undefined}
      aria-expanded={open}
      aria-label={open ? `Hide ${label}` : label}
      onClick={onClick}
    >
      <SettingsIcon />
      <span className="fd-tweaks-trigger-label">{open ? `Hide ${label}` : label}</span>
    </button>
  );
}

let openState = false;
const openListeners = new Set<(open: boolean) => void>();

function setTweaksOpen(open: boolean) {
  if (open === openState) return;
  openState = open;
  openListeners.forEach((cb) => cb(open));
}

function useTweaksOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(openState);
  useEffect(() => {
    const cb = (v: boolean) => setOpen(v);
    openListeners.add(cb);
    return () => {
      openListeners.delete(cb);
    };
  }, []);
  return [open, setTweaksOpen];
}

export interface TweaksSidebarTriggerProps {
  label?: string;
}

export function TweaksSidebarTrigger({ label = "Tweaks" }: TweaksSidebarTriggerProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useTweaksOpen();
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;
  return (
    <TweaksTrigger
      variant="sidebar"
      label={label}
      open={open}
      onClick={() => setOpen(!open)}
    />
  );
}

// ─── Auto-portal trigger (framework default) ──────────────────────────
//
// Finds the page's `[data-theme-toggle]` element (fumadocs-ui's default
// dark/light pill and our `LocaleThemeControl`) and portals the trigger
// in as a sibling immediately before it, so the visual result is:
//   [ Tweaks ] [ ☀ ☾ ]
// regardless of which sidebar slot the host theme uses for the toggle.

const PORTAL_CONTAINER_CLASS = "fd-tweaks-portal-slot";

export interface TweaksAutoPortalTriggerProps {
  label?: string;
}

export function TweaksAutoPortalTrigger({ label = "Tweaks" }: TweaksAutoPortalTriggerProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useTweaksOpen();

  useEffect(() => {
    function tryAttach(): boolean {
      const toggle = document.querySelector<HTMLElement>("[data-theme-toggle]");
      if (!toggle || !toggle.parentElement) return false;

      // If injected, setContainer and bail, else create and inject slot
      const slot = document.querySelector<HTMLElement>(`.${PORTAL_CONTAINER_CLASS}`)
      if (slot) {
        // Refresh radius in case the host theme switched.
        const radius = window.getComputedStyle(toggle).borderRadius || "0px";
        slot.style.setProperty("--fd-tweaks-trigger-radius-match", radius);
        setContainer(slot);
        return true;
      } else {
        const computed = window.getComputedStyle(toggle);
        const radius = computed.borderRadius || "0px";

        const slot = document.createElement("span");
        slot.className = PORTAL_CONTAINER_CLASS;
        slot.style.display = "inline-flex"; 
        slot.style.alignItems = "center";
        slot.style.setProperty("--fd-tweaks-trigger-radius-match", radius);
      
        toggle.before(slot);

        setContainer(slot);
        return true;
    }
    }

    // Initial attach attempt.
    tryAttach();

    // Permanent observer: check if slot exists on every subtree mutation. Reattach if not exists
    const observer = new MutationObserver(() => {
      const toggle = document.querySelector<HTMLElement>("[data-theme-toggle]");
      if (!toggle || !toggle.parentElement) return;
      if (document.querySelector(`.${PORTAL_CONTAINER_CLASS}`)) return;
      tryAttach();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      // Remove any slots on unmount
      const slots = document.querySelectorAll<HTMLElement>(`.${PORTAL_CONTAINER_CLASS}`);
      slots.forEach((slot) => {
        const parent = slot.parentElement;
        parent?.removeChild(slot);
      });
    };
  }, []);

  if (!container) return null;

  return createPortal(
    <TweaksTrigger
      variant="sidebar"
      label={label}
      open={open}
      onClick={() => setOpen(!open)}
    />,
    container,
  );
}

// ─── Public composite — dialog + (optional) floating FAB ───────────────

export type TweaksMode = "reader" | "author";

interface TweaksControlProps {
  /**
   * Dialog power level.
   * - `"reader"`: limited knobs (accent, density, radius, preset, font).
   * - `"author"`: full knob set (all 16 colors, sidebar/TOC style, layout) + code export.
   *
   * @default "reader"
   */
  mode?: TweaksMode;
  knobs?: ReadonlyArray<TweaksKnob>;
  position?: "sidebar-footer" | "floating" | "both" | "manual";
  label?: string;
  storageKey?: string;
  persist?: boolean;
  fontOptions?: ReadonlyArray<{ label: string; value: string }>;
  onApply?: (state: Record<string, string>) => void | Promise<void>;
}

function stateToRecord(s: TweaksState): Record<string, string> {
  const out: Record<string, string> = {};
  if (s.preset) out.preset = s.preset;
  if (s.primary) out.primary = s.primary;
  if (s.radius) out.radius = s.radius;
  if (s.density) out.density = s.density;
  if (s.fontFamily) out.fontFamily = s.fontFamily;
  return out;
}

export function TweaksControl({
  mode = "reader",
  knobs = DEFAULT_KNOBS,
  position = "both",
  label = "Tweaks",
  storageKey = TWEAKS_DEFAULT_STORAGE_KEY,
  persist = true,
  fontOptions = TWEAKS_DEFAULT_FONT_OPTIONS,
  onApply,
}: TweaksControlProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useTweaksOpen();
  const [state, setState] = useState<TweaksState>({});

  // Hydrate from localStorage after mount (the FOUC script already applied
  // saved tweaks to the DOM pre-paint; this just syncs React state).
  useEffect(() => {
    const saved = readSavedTweaks(storageKey);
    if (saved) {
      setState(saved);
      applyTweaks(saved);
    }
    setMounted(true);
  }, [storageKey]);

  const patch = useCallback(
    (next: Partial<TweaksState>) => {
      setState((prev) => {
        const merged: TweaksState = { ...prev, ...next };
        applyTweaks(merged);
        if (persist) writeSavedTweaks(merged, storageKey);
        void onApply?.(stateToRecord(merged));
        return merged;
      });
    },
    [onApply, persist, storageKey],
  );

  const reset = useCallback(() => {
    setState({});
    resetTweaks();
    if (persist) clearSavedTweaks(storageKey);
    void onApply?.({});
  }, [onApply, persist, storageKey]);

  const showFloating = position === "floating" || position === "both";
  const floatingIsFallback = position === "both";

  if (!mounted) return null;

  return (
    <>
      {showFloating && (
        <TweaksTrigger
          variant="floating"
          label={label}
          open={open}
          onClick={() => setOpen(!open)}
          fallback={floatingIsFallback}
        />
      )}
      <TweaksDialog
        open={open}
        onClose={() => setOpen(false)}
        mode={mode}
        knobs={knobs}
        fontOptions={fontOptions}
        state={state}
        onPatch={patch}
        onReset={reset}
        title={mode === "author" ? `${label} · Author` : label}
      />
    </>
  );
}

// ─── FOUC prevention script (renders an inline <script> in <head>) ─────

export function TweaksFoucScript({
  storageKey = TWEAKS_DEFAULT_STORAGE_KEY,
}: {
  storageKey?: string;
}) {
  // Self-contained IIFE that reads localStorage and writes inline styles to
  // documentElement before paint
  return <script dangerouslySetInnerHTML={{ __html: buildFoucScript(storageKey) }} />;
}
