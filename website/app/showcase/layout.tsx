import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Showcase",
  description: "Documentation sites built with @farming-labs/docs. Submit your project.",
};

export default function ShowcaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
