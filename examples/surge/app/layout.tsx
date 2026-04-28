import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { RootProvider } from "@farming-labs/theme";
import docsConfig from "@/docs.config";
import "./global.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Surge Docs",
    template: docsConfig.metadata?.titleTemplate ?? "%s",
  },
  description: docsConfig.metadata?.description,
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${geistMono.variable}`}>
      <body className="bg-fd-background text-fd-foreground">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
