import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import PixelSnow from "@/components/pixel-snow";

const referenceHref = "https://docs.farming-labs.dev";
const installCommand = "npx @farming-labs/docs init";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const [copied, setCopied] = useState(false);

  const chipStyle: React.CSSProperties = {
    border: "1px solid var(--color-fd-border, rgba(255,255,255,0.12))",
    borderRadius: 0,
    padding: "0.45rem 0.8rem",
    fontSize: "0.72rem",
    letterSpacing: "0.14em",
    fontFamily: "var(--fd-font-mono, var(--font-geist-mono, monospace))",
    textTransform: "uppercase",
    opacity: 0.72,
  };

  const buttonBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 0,
    padding: "0.95rem 1.35rem",
    textDecoration: "none",
    fontWeight: 600,
    minWidth: 180,
    fontFamily: "var(--fd-font-mono, var(--font-geist-mono, monospace))",
    fontSize: "0.76rem",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  };

  const copyCommand = async () => {
    await navigator.clipboard.writeText(installCommand);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "grid",
        placeItems: "center",
        padding: "2rem 1.25rem",
        overflow: "hidden",
        background: "var(--color-fd-background, #0b0b0c)",
      }}
    >
      <PixelSnow />
      <section
        style={{
          width: "100%",
          maxWidth: 980,
          textAlign: "center",
          display: "grid",
          gap: "1.5rem",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          className="border border-dashed border-black/10 dark:border-white/10"
          style={{
            display: "inline-flex",
            justifySelf: "center",
            alignItems: "center",
            gap: "0.75rem",
            padding: "0.5rem 0.85rem",
            borderRadius: 0,
            backgroundImage:
              "repeating-linear-gradient(-45deg, color-mix(in srgb, var(--color-fd-border) 7%, transparent), color-mix(in srgb, var(--color-fd-foreground) 7%, transparent) 1px, transparent 1px, transparent 6px)",
            fontSize: "0.78rem",
            letterSpacing: "0.14em",
            fontFamily: "var(--fd-font-mono, var(--font-geist-mono, monospace))",
            textTransform: "uppercase",
          }}
        >
          <span>@farming-labs/docs</span>
          <span style={{ opacity: 0.45 }}>TanStack Start Example</span>
        </div>

        <div style={{ display: "grid", gap: "1rem", justifyItems: "center" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2.8rem, 7vw, 5.6rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.05em",
              maxWidth: 860,
            }}
          >
            a documentation framework
            <br />
            that{" "}
            <span
              style={{
                background: "var(--color-fd-foreground, #fff)",
                color: "var(--color-fd-background, #0b0b0c)",
                padding: "0 0.3em",
                display: "inline-block",
              }}
            >
              just works.
            </span>
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: 720,
              fontSize: "1.02rem",
              lineHeight: 1.8,
              color: "var(--color-fd-muted-foreground, rgba(255,255,255,0.72))",
            }}
          >
            Framework-native docs with MDX, themes, search, page actions, and AI-ready utilities.
            This example shows the same Farming Labs docs model running on TanStack Start.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0.75rem",
          }}
        >
          <span style={chipStyle}>MDX</span>
          <span style={chipStyle}>Themes</span>
          <span style={chipStyle}>Search</span>
          <span style={chipStyle}>AI-ready</span>
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 544,
            justifySelf: "center",
            display: "grid",
            gap: "0.65rem",
          }}
        >
          <span
            style={{
              justifySelf: "start",
              fontFamily: "var(--fd-font-mono, var(--font-geist-mono, monospace))",
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--color-fd-muted-foreground, rgba(255,255,255,0.58))",
            }}
          >
            Install in one command
          </span>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              alignItems: "stretch",
              border: "1px solid var(--color-fd-border, rgba(255,255,255,0.12))",
              background: "color-mix(in srgb, var(--color-fd-card, #111) 92%, transparent)",
            }}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                padding: "0 1rem",
                borderRight: "1px solid var(--color-fd-border, rgba(255,255,255,0.12))",
                fontFamily: "var(--fd-font-mono, var(--font-geist-mono, monospace))",
                fontSize: "1rem",
                color: "var(--color-fd-muted-foreground, rgba(255,255,255,0.58))",
              }}
            >
              &gt;
            </span>
            <code
              style={{
                display: "grid",
                alignItems: "center",
                padding: "0.95rem 1rem",
                textAlign: "left",
                fontFamily: "var(--fd-font-mono, var(--font-geist-mono, monospace))",
                fontSize: "clamp(0.82rem, 2vw, 1rem)",
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {installCommand}
            </code>
            <button
              type="button"
              onClick={copyCommand}
              style={{
                border: 0,
                borderLeft: "1px solid var(--color-fd-border, rgba(255,255,255,0.12))",
                background: "transparent",
                color: "inherit",
                minWidth: 88,
                padding: "0 1rem",
                cursor: "pointer",
                fontFamily: "var(--fd-font-mono, var(--font-geist-mono, monospace))",
                fontSize: "0.72rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <Link
            to="/docs"
            style={{
              ...buttonBase,
              background: "var(--color-fd-foreground, #fff)",
              color: "var(--color-fd-background, #0b0b0c)",
            }}
          >
            Open Example Docs
          </Link>
          <a
            className="inline-flex h-full items-end gap-2 border-b border-dotted border-black/20 pb-0.5 font-mono uppercase tracking-[0.14em] text-[0.66rem] text-black/45 transition hover:text-black/70 dark:border-white/20 dark:text-white/45 dark:hover:text-white/70"
            href={referenceHref}
            target="_blank"
            rel="noreferrer"
            style={{
              textDecoration: "none",
            }}
          >
            <span>docs.farming-labs.dev</span>
            <span style={{ opacity: 0.55 }}>↗</span>
          </a>
        </div>

        <p
          className="font-mono uppercase tracking-tight text-black/30 dark:text-white/30"
          style={{
            margin: 0,
            color: "var(--color-fd-muted-foreground, rgba(255,255,255,0.58))",
            fontSize: "0.82rem",
          }}
        >
          // Start locally at <code>/docs</code>, then use the full reference when you need the
          broader map.
        </p>
      </section>
    </main>
  );
}
