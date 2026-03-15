import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background:
          "radial-gradient(circle at top, rgba(15,118,110,0.12), transparent 40%), var(--color-fd-background, #fff)",
      }}
    >
      <div style={{ maxWidth: 720 }}>
        <p style={{ textTransform: "uppercase", letterSpacing: "0.18em", fontSize: 12 }}>
          @farming-labs/docs x TanStack Start
        </p>
        <h1 style={{ fontSize: "clamp(2.5rem, 7vw, 4.5rem)", lineHeight: 1, margin: "0.75rem 0" }}>
          Docs without the Next.js-only tradeoff.
        </h1>
        <p style={{ fontSize: "1.05rem", lineHeight: 1.8, opacity: 0.8, marginBottom: "1.5rem" }}>
          This example renders MDX docs through TanStack Start while keeping the same
          `docs.config.tsx` model, theme presets, search endpoint, page actions, and llms.txt
          output.
        </p>
        <Link
          to="/docs"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.875rem 1.25rem",
            borderRadius: 999,
            background: "var(--color-fd-primary, #0f766e)",
            color: "white",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Open the docs
        </Link>
      </div>
    </main>
  );
}
