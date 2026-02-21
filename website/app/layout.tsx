import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RootProvider } from "@farming-labs/theme";
import { Suspense } from "react";
import { ThemeCustomizer } from "@/components/theme-customizer";
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
export const metadata: Metadata = {
  title: {
    default: "@farming-labs/docs",
    template: "%s – @farming-labs/docs",
  },
  description:
    "A modern, flexible MDX documentation framework. One config, zero boilerplate.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistSansDocs.variable} ${geistMono.variable} ${geistMonoDocs.variable} antialiased bg-fd-background`}
      >
        <RootProvider>
          {children}
          <Suspense>
            <ThemeCustomizer />
          </Suspense>
        </RootProvider>
      </body>
    </html>
  );
}
