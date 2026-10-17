import type { LayoutProps, Metadata } from "@farm.js/core";
import { defineLayoutFonts, localFont } from "@farm.js/core/font";
import { Databuddy } from "@databuddy/sdk/react";
import { ThemeCustomizer } from "@/components/theme-customizer";
import "./globals.css";

const geistSans = localFont({
  src: "geist/dist/fonts/geist-sans/Geist-Variable.woff2",
  family: "Geist",
  weight: "100 900",
  variable: "--font-geist-sans",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const geistMono = localFont({
  src: "geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  family: "Geist Mono",
  weight: "100 900",
  variable: "--font-geist-mono",
  fallback: ["ui-monospace", "monospace"],
});

const geistPixel = localFont({
  src: "geist/dist/fonts/geist-pixel/GeistPixel-Square.woff2",
  family: "Geist Pixel Square",
  weight: 500,
  variable: "--font-geist-pixel-square",
  fallback: ["ui-monospace", "monospace"],
  // Only a few labels use it; keep the preload budget for Geist Sans and Mono.
  preload: false,
});

// Farm Docs reads these too, so the docs runtime shares the site's typefaces.
export const fonts = defineLayoutFonts({ body: geistSans, code: geistMono });

// Layouts also load in the browser, so read server environment only in here.
export function generateMetadata(): Metadata {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  return {
    metadataBase: baseUrl ? new URL(baseUrl) : undefined,
    title: {
      default: "@farming-labs/docs",
      template: "%s – @farming-labs/docs",
    },
    description:
      "An AI-native documentation framework for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt. One config, zero boilerplate.",
    icons: "/favicon.ico",
    openGraph: {
      title: "a documentation that just works.",
      description:
        "AI-native, agent-optimized docs for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt.",
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "a documentation that just works.",
      description:
        "AI-native, agent-optimized docs for Next.js, TanStack Start, SvelteKit, Astro, and Nuxt.",
    },
  };
}

// The site themes with a `dark` class on <html> (globals.css, the theme toggle, and the
// docs theme all key off it). Set it before paint so a stored choice never flashes.
const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.add(d?'dark':'light');r.classList.remove(d?'light':'dark');r.style.colorScheme=d?'dark':'light'}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${geistPixel.variable}`}
    >
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-fd-background antialiased">
        {children}
        <ThemeCustomizer />
        <Databuddy
          clientId="e0e31f34-2bef-4e80-8904-ca3cba9bfba3"
          trackAttributes={true}
          trackHashChanges={true}
          trackOutgoingLinks={true}
        />
      </body>
    </html>
  );
}
