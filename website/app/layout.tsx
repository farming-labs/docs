import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RootProvider } from "@farming-labs/theme";
import { Databuddy } from "@databuddy/sdk/react";
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
  openGraph: {
    title: "a documentation that just works.",
    description: "A modern documentation framework that works. One config file, zero boilerplate.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "a documentation that just works.",
    description: "A modern documentation framework that works. One config file, zero boilerplate.",
  },
};

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('theme');
    if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistSansDocs.variable} ${geistMono.variable} ${geistMonoDocs.variable} antialiased bg-fd-background`}
      >
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <RootProvider>{children}</RootProvider>
        <Databuddy
          trackHashChanges={true}
          trackAttributes={true}
          trackOutgoingLinks={true}
          clientId="e0e31f34-2bef-4e80-8904-ca3cba9bfba3"
        />
      </body>
    </html>
  );
}
