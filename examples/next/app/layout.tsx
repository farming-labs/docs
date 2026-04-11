import type { Metadata } from "next";
import { Bebas_Neue, Geist, Geist_Mono, IBM_Plex_Mono } from "next/font/google";
import { RootProvider } from "@farming-labs/theme";
import docsConfig from "@/docs.config";
import "./global.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistSansDocs = Geist({
  variable: "--fd-font-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const geistMonoDocs = Geist_Mono({
  variable: "--fd-font-mono",
  subsets: ["latin"],
});

const betterCmdkDisplay = Bebas_Neue({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

const betterCmdkMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Docs",
    template: docsConfig.metadata?.titleTemplate ?? "%s",
  },
  description: docsConfig.metadata?.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistSansDocs.variable} ${geistMono.variable} ${geistMonoDocs.variable} ${betterCmdkDisplay.variable} ${betterCmdkMono.variable}`}
      >
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
