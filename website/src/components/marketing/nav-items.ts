import { BookOpen, Cloud, Gauge, Palette } from "lucide-react";

export const navItems = [
  { index: "01", label: "Docs", href: "/docs", icon: BookOpen },
  { index: "02", label: "Themes", href: "/themes", icon: Palette },
  { index: "03", label: "Cloud", href: "/cloud", icon: Cloud },
  { index: "04", label: "Agent score", href: "/score", icon: Gauge },
] as const;
