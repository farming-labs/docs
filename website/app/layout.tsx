import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RootProvider } from "@farming-labs/theme";
import "./global.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});
const geistSansDocs = Geist({
  variable: "--fd-font-sans",
  subsets: ["latin"],
});

const geistMonoDocs = Geist_Mono({
  variable: "--fd-font-mono",
  subsets: ["latin"],
});
const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export const metadata: Metadata = {
  metadataBase: baseUrl ? new URL(baseUrl) : undefined,
  title: {
    default: "@farming-labs/docs",
    template: "%s – @farming-labs/docs",
  },
  description: "A modern, flexible MDX documentation framework. One config, zero boilerplate.",
  // Static OG image for base URL (/) only. Docs and other routes override with dynamic OG.
  openGraph: {
    title: "a documentation that just works.",
    description:
      "A modern documentation framework that works. One config file, zero boilerplate.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "a documentation that just works.",
    description:
      "A modern documentation framework that works. One config file, zero boilerplate.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistSansDocs.variable} ${geistMono.variable} ${geistMonoDocs.variable} antialiased bg-fd-background`}
      >
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
