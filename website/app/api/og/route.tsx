import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

async function loadGoogleFont(family: string, weight: number) {
  const params = new URLSearchParams({
    family: `${family}:wght@${weight}`,
    display: "swap",
  });
  const url = `https://fonts.googleapis.com/css2?${params.toString()}`;
  const css = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (BB10; Touch) AppleWebKit/537.10+ (KHTML, like Gecko) Version/10.0.9.2372 Mobile Safari/537.10+",
    },
  }).then((res) => res.text());

  const match = css.match(/src:\s*url\(([^)]+)\)/);
  if (!match) throw new Error(`Failed to load font: ${family}`);

  return fetch(match[1]).then((res) => res.arrayBuffer());
}

async function loadFonts() {
  const [bold, mono] = await Promise.all([
    loadGoogleFont("Inter", 700),
    loadGoogleFont("JetBrains Mono", 400),
  ]);
  return { bold, mono };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "@farming-labs/docs";
  const description = searchParams.get("description") ?? "";

  const { bold, mono } = await loadFonts();

  const imageResponse = new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#000000",
        padding: "0",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Full-height -45deg diagonal pattern (entire image) */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          opacity: 0.06,
          backgroundImage:
            "repeating-linear-gradient(-45deg, #ffffff, #ffffff 1px, transparent 1px, transparent 6px)",
        }}
      />

      {/* Border lines — visible opacity */}
      <div
        style={{
          position: "absolute",
          top: "55px",
          left: 0,
          right: 0,
          height: "1px",
          backgroundColor: "rgba(255,255,255,0.18)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "80px",
          left: 0,
          right: 0,
          height: "1px",
          backgroundColor: "rgba(255,255,255,0.18)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "79px",
          width: "1px",
          height: "100%",
          backgroundColor: "rgba(255,255,255,0.14)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 0,
          right: "79px",
          width: "1px",
          height: "100%",
          backgroundColor: "rgba(255,255,255,0.14)",
        }}
      />

      {/* ── Top branding ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "50px 80px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            height: "14px",
            width: "1px",
            backgroundColor: "rgba(255,255,255,0.4)",
          }}
        />
        <span
          style={{
            fontFamily: '"JetBrains Mono"',
            fontSize: "14px",
            color: "rgba(255,255,255,0.4)",
            letterSpacing: "-0.03em",
            textTransform: "uppercase" as const,
          }}
        >
          @farming-labs/docs
        </span>
      </div>

      {/* ── Main content ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "0 80px",
          marginTop: "auto",
          marginBottom: "100px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <h1
          style={{
            fontFamily: '"Inter"',
            fontSize: title.length > 40 ? "48px" : title.length > 25 ? "56px" : "68px",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "-0.04em",
            lineHeight: 0.95,
            margin: 0,
            padding: 0,
            maxWidth: "850px",
          }}
        >
          {title}
        </h1>

        {description && (
          <p
            style={{
              fontFamily: '"JetBrains Mono"',
              fontSize: "14px",
              color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.03em",
              textTransform: "uppercase" as const,
              lineHeight: 1.6,
              margin: 0,
              marginTop: "20px",
              maxWidth: "650px",
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* ── Bottom bar ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "40px 80px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span
            style={{
              fontFamily: '"JetBrains Mono"',
              fontSize: "14px",
              color: "rgba(255,255,255,0.25)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.03em",
            }}
          >
            documentation
          </span>
          <div
            style={{
              height: "14px",
              width: "1px",
              backgroundColor: "rgba(255,255,255,0.15)",
            }}
          />
          <span
            style={{
              fontFamily: '"JetBrains Mono"',
              fontSize: "14px",
              color: "rgba(255,255,255,0.2)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.03em",
            }}
          >
            docs.farming-labs.com
          </span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            backgroundColor: "#ffffff",
            color: "#000000",
            padding: "7px 18px",
            fontFamily: '"JetBrains Mono"',
            fontSize: "10px",
            textTransform: "uppercase" as const,
            letterSpacing: "0.06em",
          }}
        >
          get started →
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Inter",
          data: bold,
          weight: 700 as const,
          style: "normal" as const,
        },
        {
          name: "JetBrains Mono",
          data: mono,
          weight: 400 as const,
          style: "normal" as const,
        },
      ],
    },
  );

  // Prevent caching so changes show immediately when testing
  const headers = new Headers(imageResponse.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  return new Response(imageResponse.body, { headers, status: imageResponse.status });
}
